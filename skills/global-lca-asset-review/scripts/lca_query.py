#!/usr/bin/env python3
"""Read-only queries for the Global LCA Asset data package."""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

ROOT_MARKER = ".global-lca-asset-root"

MUTATING = re.compile(
    r"\b(insert|update|delete|drop|alter|create|replace|attach|detach|vacuum|reindex|pragma\s+(?!table_info))\b",
    re.IGNORECASE,
)


def rows(cursor: sqlite3.Cursor, limit: int) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchmany(limit)]


def emit(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def looks_like_project_root(path: Path) -> bool:
    return (path / "data" / "package" / "current" / "global_lca_assets.sqlite").is_file()


def candidate_roots() -> list[Path]:
    candidates: list[Path] = []
    configured = os.environ.get("GLOBAL_LCA_ASSET_ROOT")
    if configured:
        candidates.append(Path(configured).expanduser())

    skill_root = Path(__file__).resolve().parents[1]
    marker = skill_root / ROOT_MARKER
    if marker.is_file():
        marker_value = marker.read_text(encoding="utf-8").strip()
        if marker_value:
            candidates.append(Path(marker_value).expanduser())

    candidates.extend([skill_root, *skill_root.parents])
    working_directory = Path.cwd().resolve()
    candidates.extend([working_directory, *working_directory.parents])
    return candidates


def discover_project_root() -> Path:
    visited: set[Path] = set()
    for candidate in candidate_roots():
        resolved = candidate.resolve()
        if resolved in visited:
            continue
        visited.add(resolved)
        if looks_like_project_root(resolved):
            return resolved
    raise SystemExit(
        "Global LCA Asset clone not found. Run the repository installer or set "
        "GLOBAL_LCA_ASSET_ROOT to the cloned project directory."
    )


def default_database() -> Path:
    return discover_project_root() / "data" / "package" / "current" / "global_lca_assets.sqlite"


def validate_readonly_sql(value: str) -> str:
    sql = value.strip().rstrip(";").strip()
    if not re.match(r"^(select|with|pragma\s+table_info)", sql, re.IGNORECASE) or MUTATING.search(sql):
        raise ValueError("Only read-only SELECT, WITH, or PRAGMA table_info queries are allowed.")
    return sql


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=None)
    parser.add_argument("--list", action="store_true", help="List tables and views")
    parser.add_argument("--describe", metavar="TABLE")
    parser.add_argument("--search", metavar="TEXT")
    parser.add_argument("--asset", metavar="ASSET_ID")
    parser.add_argument("--sql", metavar="SELECT_SQL")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()

    database = args.db.expanduser() if args.db is not None else default_database()
    if not database.exists():
        raise SystemExit(f"Data package not found: {database}")

    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row

    if args.list:
        cursor = connection.execute(
            "SELECT name, type FROM sqlite_master "
            "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        emit(rows(cursor, args.limit))
        return

    if args.describe:
        safe_name = args.describe.replace('"', '""')
        emit(rows(connection.execute(f'PRAGMA table_info("{safe_name}")'), args.limit))
        return

    if args.search:
        needle = f"%{args.search.lower()}%"
        cursor = connection.execute(
            "SELECT * FROM asset_summary WHERE "
            "lower(coalesce(asset_id,'')) LIKE ? OR lower(coalesce(official_name,'')) LIKE ? OR "
            "lower(coalesce(owner,'')) LIKE ? OR lower(coalesce(geographic_coverage,'')) LIKE ? OR "
            "lower(coalesce(asset_type,'')) LIKE ? ORDER BY official_name LIMIT ?",
            (needle, needle, needle, needle, needle, args.limit),
        )
        emit(rows(cursor, args.limit))
        return

    if args.asset:
        asset_id = args.asset
        payload = {
            "asset": rows(connection.execute("SELECT * FROM assets WHERE asset_id = ?", (asset_id,)), 1),
            "evidence": rows(
                connection.execute("SELECT * FROM evidence WHERE asset_id = ?", (asset_id,)), args.limit
            ),
            "relations": rows(
                connection.execute(
                    "SELECT * FROM relations WHERE source_asset_id = ? OR target_asset_id = ?",
                    (asset_id, asset_id),
                ),
                args.limit,
            ),
            "releases": rows(
                connection.execute("SELECT * FROM releases WHERE asset_id = ?", (asset_id,)), args.limit
            ),
            "distributions": rows(
                connection.execute("SELECT * FROM distributions WHERE database_asset_id = ?", (asset_id,)),
                args.limit,
            ),
            "version_audit": rows(
                connection.execute("SELECT * FROM version_audit WHERE asset_id = ?", (asset_id,)), args.limit
            ),
            "mappings": rows(
                connection.execute(
                    "SELECT * FROM mapping_artifacts WHERE source_asset_id = ? OR target_asset_id = ?",
                    (asset_id, asset_id),
                ),
                args.limit,
            ),
        }
        emit(payload)
        return

    if args.sql:
        try:
            sql = validate_readonly_sql(args.sql)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        emit(rows(connection.execute(sql), args.limit))
        return

    parser.error("Choose --list, --describe, --search, --asset, or --sql")


if __name__ == "__main__":
    main()
