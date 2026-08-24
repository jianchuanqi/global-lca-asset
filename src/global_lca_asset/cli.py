"""Command-line entry points for serving, building, importing, and checking the graph."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import uvicorn

from .neo4j_repository import Neo4jGraphRepository
from .settings import Settings
from .snapshot import build_snapshot_from_path


def _repository(settings: Settings) -> Neo4jGraphRepository:
    return Neo4jGraphRepository(
        settings.neo4j_uri,
        settings.neo4j_user,
        settings.neo4j_password,
        settings.neo4j_database,
        connection_timeout_seconds=settings.neo4j_connection_timeout_seconds,
        query_timeout_seconds=settings.neo4j_query_timeout_seconds,
        max_connection_pool_size=settings.neo4j_max_connection_pool_size,
    )


async def _wait_for_neo4j(repository: Neo4jGraphRepository, seconds: int) -> None:
    deadline = asyncio.get_running_loop().time() + seconds
    last_error: Exception | None = None
    while asyncio.get_running_loop().time() < deadline:
        try:
            await repository.health()
            return
        except Exception as error:  # noqa: BLE001 - the next retry reports the last driver failure
            last_error = error
            await asyncio.sleep(1)
    raise RuntimeError(f"Neo4j did not become ready within {seconds}s: {last_error}")


async def _import(args: argparse.Namespace) -> None:
    settings = Settings()
    source = Path(args.source) if args.source else settings.seed_path
    snapshot = build_snapshot_from_path(source)
    repository = _repository(settings)
    try:
        if args.wait:
            await _wait_for_neo4j(repository, args.wait)
        result = await repository.import_snapshot(snapshot, replace=args.replace)
        print(json.dumps({**result, "source": str(source), "metadata": snapshot.metadata}, indent=2))
    finally:
        await repository.close()


async def _stats() -> None:
    settings = Settings()
    repository = _repository(settings)
    try:
        print(json.dumps(await repository.statistics(), indent=2))
    finally:
        await repository.close()


def _build_snapshot(args: argparse.Namespace) -> None:
    settings = Settings()
    source = Path(args.source) if args.source else settings.seed_path
    snapshot = build_snapshot_from_path(source)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(snapshot.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(output),
                "nodes": len(snapshot.nodes),
                "relationships": len(snapshot.relationships),
            }
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(prog="global-lca", description="Global LCA Asset Knowledge Graph")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve", help="run the API")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8000)
    serve_parser.add_argument("--reload", action="store_true")

    import_parser = subparsers.add_parser("import", help="merge the public seed into Neo4j")
    import_parser.add_argument("--source")
    import_parser.add_argument("--replace", action="store_true", help="delete existing Entity nodes first")
    import_parser.add_argument("--wait", type=int, default=0, metavar="SECONDS")

    snapshot_parser = subparsers.add_parser("build-snapshot", help="write a portable graph snapshot")
    snapshot_parser.add_argument("--source")
    snapshot_parser.add_argument("--output", default="data/canonical/graph-snapshot.json")

    subparsers.add_parser("stats", help="show Neo4j graph counts")
    args = parser.parse_args()

    if args.command == "serve":
        uvicorn.run(
            "global_lca_asset.api:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=args.reload,
        )
    elif args.command == "import":
        asyncio.run(_import(args))
    elif args.command == "build-snapshot":
        _build_snapshot(args)
    elif args.command == "stats":
        asyncio.run(_stats())


if __name__ == "__main__":
    main()
