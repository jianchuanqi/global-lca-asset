"""FastAPI application for graph search, evidence, Cypher, and AI query plans."""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import CompareRequest, CypherRequest, GraphQueryPlan, QueryResponse
from .neo4j_repository import Neo4jGraphRepository
from .query import QueryPlanError, compile_plan, public_schema, validate_readonly_cypher
from .repository import GraphRepository, InMemoryGraphRepository
from .settings import Settings
from .snapshot import build_snapshot_from_path


def get_repository(request: Request) -> GraphRepository:
    """Resolve the application-scoped graph repository."""
    return request.app.state.repository


RepositoryDependency = Annotated[GraphRepository, Depends(get_repository)]


def _create_repository(settings: Settings) -> GraphRepository:
    if settings.graph_backend == "memory":
        return InMemoryGraphRepository(build_snapshot_from_path(settings.seed_path))
    if settings.graph_backend == "neo4j":
        return Neo4jGraphRepository(
            settings.neo4j_uri,
            settings.neo4j_user,
            settings.neo4j_password,
            settings.neo4j_database,
        )
    raise ValueError(f"unsupported graph backend: {settings.graph_backend}")


def create_app(
    settings: Settings | None = None,
    repository: GraphRepository | None = None,
) -> FastAPI:
    """Create an application, optionally injecting a repository for tests."""
    resolved_settings = settings or Settings()
    resolved_repository = repository or _create_repository(resolved_settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = resolved_settings
        app.state.repository = resolved_repository
        yield
        await resolved_repository.close()

    app = FastAPI(
        title="Global LCA Asset Knowledge Graph",
        version="0.1.0",
        description=(
            "Public-evidence graph API for LCA databases, software, schemas, mappings, "
            "releases, and provenance."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.middleware("http")
    async def optional_bearer_auth(request: Request, call_next):
        if (
            resolved_settings.api_token
            and request.url.path.startswith("/api/")
            and request.method != "OPTIONS"
        ):
            expected = f"Bearer {resolved_settings.api_token}"
            provided = request.headers.get("Authorization", "")
            if not secrets.compare_digest(provided, expected):
                return JSONResponse(status_code=401, content={"detail": "invalid or missing API token"})
        return await call_next(request)

    @app.get("/", tags=["system"])
    async def root() -> dict[str, Any]:
        return {
            "name": "Global LCA Asset Knowledge Graph",
            "version": "0.1.0",
            "api_docs": "/docs",
            "schema": "/api/schema",
            "scope_note": (
                "Public-evidence lower bound; not a claim that every LCA asset worldwide has been found."
            ),
        }

    @app.get("/health", tags=["system"])
    async def health(repo: RepositoryDependency) -> dict[str, Any]:
        return await repo.health()

    @app.get("/api/schema", tags=["query"])
    async def schema() -> dict[str, Any]:
        return public_schema()

    @app.get("/api/statistics", tags=["analysis"])
    async def statistics(repo: RepositoryDependency) -> dict[str, Any]:
        return await repo.statistics()

    @app.get("/api/assets", tags=["assets"])
    async def search_assets(
        repo: RepositoryDependency,
        q: str | None = None,
        asset_type: str | None = None,
        country: str | None = None,
        sector: str | None = None,
        open_only: bool = False,
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        return await repo.search_assets(
            q=q,
            asset_type=asset_type,
            country=country,
            sector=sector,
            open_only=open_only,
            limit=limit,
            offset=offset,
        )

    @app.get("/api/assets/{asset_id}", tags=["assets"])
    async def get_asset(asset_id: str, repo: RepositoryDependency) -> dict[str, Any]:
        result = await repo.get_asset(asset_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"asset not found: {asset_id}")
        return result

    @app.get("/api/assets/{asset_id}/timeline", tags=["assets"])
    async def timeline(asset_id: str, repo: RepositoryDependency) -> dict[str, Any]:
        return {"asset_id": asset_id, "releases": await repo.timeline(asset_id)}

    @app.get("/api/evidence/{evidence_id}", tags=["evidence"])
    async def get_evidence(evidence_id: str, repo: RepositoryDependency) -> dict[str, Any]:
        result = await repo.get_evidence(evidence_id)
        if result is None:
            raise HTTPException(status_code=404, detail=f"evidence not found: {evidence_id}")
        return result

    @app.get("/api/graph/neighborhood", tags=["graph"])
    async def neighborhood(
        uid: str,
        repo: RepositoryDependency,
        depth: int = Query(default=1, ge=1, le=3),
        limit: int = Query(default=100, ge=1, le=500),
    ) -> dict[str, Any]:
        return (await repo.neighborhood(uid, depth, limit)).model_dump(mode="json")

    @app.get("/api/graph/path", tags=["graph"])
    async def path(
        source_uid: str,
        target_uid: str,
        repo: RepositoryDependency,
        max_depth: int = Query(default=4, ge=1, le=8),
    ) -> dict[str, Any]:
        return (await repo.shortest_path(source_uid, target_uid, max_depth)).model_dump(mode="json")

    @app.post("/api/compare", tags=["analysis"])
    async def compare(request: CompareRequest, repo: RepositoryDependency) -> dict[str, Any]:
        return {"requested": request.asset_ids, "assets": await repo.compare(request.asset_ids)}

    @app.post("/api/query/plan", response_model=QueryResponse, tags=["query"])
    async def query_plan(plan: GraphQueryPlan, repo: RepositoryDependency) -> QueryResponse:
        try:
            compiled = compile_plan(plan)
            if isinstance(repo, Neo4jGraphRepository):
                await repo.explain(compiled.cypher, compiled.parameters)
            result = await repo.execute(compiled.cypher, compiled.parameters, plan.limit)
        except QueryPlanError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return QueryResponse(
            cypher=compiled.cypher,
            parameters=compiled.parameters,
            records=result["records"],
            graph=result["graph"],
            truncated=result["truncated"],
        )

    @app.post("/api/query/cypher", response_model=QueryResponse, tags=["query"])
    async def expert_cypher(request: CypherRequest, repo: RepositoryDependency) -> QueryResponse:
        if not resolved_settings.enable_expert_cypher:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "expert Cypher is disabled; set LCA_ENABLE_EXPERT_CYPHER=true "
                    "for a read-only Neo4j account"
                ),
            )
        try:
            cypher = validate_readonly_cypher(request.cypher)
            if isinstance(repo, Neo4jGraphRepository):
                await repo.explain(cypher, request.parameters)
            result = await repo.execute(cypher, request.parameters, request.limit)
        except QueryPlanError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return QueryResponse(
            cypher=cypher,
            parameters=request.parameters,
            records=result["records"],
            graph=result["graph"],
            truncated=result["truncated"],
        )

    return app
