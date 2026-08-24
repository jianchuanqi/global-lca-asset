"""Anonymous, read-only MCP surface for the public LCA asset graph."""

from __future__ import annotations

from collections.abc import Awaitable
from typing import Annotated, Any, TypeVar

from mcp import types
from mcp.server import MCPServer
from pydantic import Field

from . import __version__
from .query import public_schema
from .repository import GraphRepository

T = TypeVar("T")

PUBLIC_SCOPE = {
    "access": "anonymous_public",
    "read_only": True,
    "contains_personal_data": False,
    "completeness": (
        "Public-evidence lower bound; the inventory is not a claim that every LCA asset "
        "worldwide has been identified."
    ),
}

READ_ONLY_ANNOTATIONS = types.ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)

Identifier = Annotated[str, Field(min_length=1, max_length=200)]
OptionalSearchText = Annotated[str | None, Field(max_length=200)]
OptionalFilterText = Annotated[str | None, Field(max_length=100)]


def _result(
    data: Any,
    *,
    graph: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    """Return one stable, visualization-ready result envelope for every tool."""
    return {
        "schema_version": "1.0",
        "scope": PUBLIC_SCOPE,
        "data": data,
        "graph": graph or {"nodes": [], "relationships": [], "records": []},
        "warnings": warnings or [],
    }


def _bounded_graph(
    graph: dict[str, Any],
    *,
    max_nodes: int,
    center_uid: str | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """Enforce the public response ceiling independently of the database query."""
    nodes = list(graph.get("nodes", []))
    if center_uid is not None:
        nodes.sort(key=lambda node: node.get("uid") != center_uid)
    selected_nodes = nodes[:max_nodes]
    selected_uids = {str(node.get("uid")) for node in selected_nodes}
    relationships = [
        relationship
        for relationship in graph.get("relationships", [])
        if str(relationship.get("start_uid")) in selected_uids
        and str(relationship.get("end_uid")) in selected_uids
    ]
    max_relationships = max_nodes * 3
    selected_relationships = relationships[:max_relationships]
    truncated = len(nodes) > len(selected_nodes) or len(relationships) > len(selected_relationships)
    warnings = ["The relationship subgraph was truncated to the public response limit."] if truncated else []
    return (
        {
            "nodes": selected_nodes,
            "relationships": selected_relationships,
            "records": list(graph.get("records", []))[:100],
        },
        warnings,
    )


async def _public_call(operation: Awaitable[T]) -> T:
    """Avoid returning deployment details when the backing service is unavailable."""
    try:
        return await operation
    except Exception as error:
        raise RuntimeError("The public LCA graph service is temporarily unavailable") from error


def create_mcp_server(repository: GraphRepository) -> MCPServer:
    """Build an MCP server bound only to the injected public, read-only repository."""
    mcp = MCPServer(
        name="global-lca-assets",
        title="Global LCA Asset Knowledge Graph",
        version=__version__,
        description="Anonymous read-only access to the public Global LCA Asset graph.",
        instructions=(
            "Use these tools to search and analyze public LCA databases, software, schemas, "
            "formats, mappings, organizations, releases, and supporting evidence. Treat counts "
            "as a public-evidence lower bound. Do not describe the inventory as a proven total "
            "of all LCA assets worldwide. All returned data is public and excludes contact data."
        ),
    )

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def search_assets(
        q: OptionalSearchText = None,
        asset_type: OptionalFilterText = None,
        country: OptionalFilterText = None,
        sector: OptionalFilterText = None,
        open_only: bool = False,
        limit: Annotated[int, Field(ge=1, le=100)] = 25,
        offset: Annotated[int, Field(ge=0, le=10_000)] = 0,
    ) -> dict[str, Any]:
        """Search public LCA assets by text, type, country, sector, or open-data status."""
        data = await _public_call(
            repository.search_assets(
                q=q,
                asset_type=asset_type,
                country=country,
                sector=sector,
                open_only=open_only,
                limit=limit,
                offset=offset,
            )
        )
        return _result(data)

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_asset(asset_id: Identifier) -> dict[str, Any]:
        """Get one public asset record and its immediate visualization-ready relationships."""
        found = await _public_call(repository.get_asset(asset_id))
        if found is None:
            return _result({"found": False, "asset_id": asset_id})
        graph, warnings = _bounded_graph(found.get("graph", {}), max_nodes=100, center_uid=asset_id)
        return _result(
            {"found": True, "asset": found["asset"]},
            graph=graph,
            warnings=warnings,
        )

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def expand_graph(
        uid: Identifier,
        depth: Annotated[int, Field(ge=1, le=2)] = 1,
        limit: Annotated[int, Field(ge=1, le=200)] = 100,
    ) -> dict[str, Any]:
        """Expand a public node into a bounded one- or two-hop relationship subgraph."""
        payload = await _public_call(repository.neighborhood(uid, depth, limit))
        graph, warnings = _bounded_graph(
            payload.model_dump(mode="json"),
            max_nodes=limit,
            center_uid=uid,
        )
        return _result(
            {"center_uid": uid, "depth": depth, "node_limit": limit},
            graph=graph,
            warnings=warnings,
        )

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def find_path(
        source_uid: Identifier,
        target_uid: Identifier,
        max_depth: Annotated[int, Field(ge=1, le=4)] = 4,
    ) -> dict[str, Any]:
        """Find a bounded shortest path between two public graph nodes."""
        graph = await _public_call(repository.shortest_path(source_uid, target_uid, max_depth))
        return _result(
            {
                "source_uid": source_uid,
                "target_uid": target_uid,
                "max_depth": max_depth,
                "found": bool(graph.nodes),
            },
            graph=graph.model_dump(mode="json"),
        )

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def compare_assets(
        asset_ids: Annotated[list[Identifier], Field(min_length=2, max_length=10)],
    ) -> dict[str, Any]:
        """Return up to ten public asset records for side-by-side comparison."""
        assets = await _public_call(repository.compare(asset_ids))
        return _result({"requested": asset_ids, "assets": assets})

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_timeline(asset_id: Identifier) -> dict[str, Any]:
        """Get the public releases and milestones currently linked to one asset."""
        releases = await _public_call(repository.timeline(asset_id))
        return _result({"asset_id": asset_id, "releases": releases})

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_evidence(evidence_id: Identifier) -> dict[str, Any]:
        """Get one public evidence record and the assets it supports when available."""
        evidence = await _public_call(repository.get_evidence(evidence_id))
        if evidence is None:
            return _result({"found": False, "evidence_id": evidence_id})
        return _result({"found": True, "evidence_id": evidence_id, **evidence})

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_inventory_statistics() -> dict[str, Any]:
        """Get public graph counts, type breakdowns, and snapshot metadata."""
        statistics = await _public_call(repository.statistics())
        return _result(
            statistics,
            warnings=[PUBLIC_SCOPE["completeness"]],
        )

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_graph_schema() -> dict[str, Any]:
        """Get the public node labels, relationships, properties, and interpretation notes."""
        return _result(public_schema())

    @mcp.tool(annotations=READ_ONLY_ANNOTATIONS, structured_output=True)
    async def get_service_status() -> dict[str, Any]:
        """Check whether the public graph backend is available."""
        health = await _public_call(repository.health())
        return _result(
            {
                "status": health.get("status", "unknown"),
                "backend": health.get("backend", "graph"),
            }
        )

    return mcp
