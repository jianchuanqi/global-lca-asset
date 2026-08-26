#!/usr/bin/env python3
"""Create and validate Git-tracked Global LCA Asset candidates."""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT_MARKER = ".global-lca-asset-root"
CANDIDATE_ID = re.compile(r"^CAND-[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$")
EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
STATUSES = {
    "candidate",
    "needs-expert-review",
    "promoted",
    "rejected-duplicate",
    "rejected-out-of-scope",
}


def is_project_root(path: Path) -> bool:
    return (path / "data" / "candidates" / "candidate.schema.json").is_file()


def discover_project_root(explicit: Path | None = None) -> Path:
    candidates: list[Path] = []
    if explicit is not None:
        candidates.append(explicit.expanduser())
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
    current = Path.cwd().resolve()
    candidates.extend([current, *current.parents])

    for candidate in candidates:
        resolved = candidate.resolve()
        if is_project_root(resolved):
            return resolved
    raise SystemExit("Global LCA Asset clone not found. Run the installer or set GLOBAL_LCA_ASSET_ROOT.")


def valid_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def validate_candidate(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["candidate must be a JSON object"]
    errors: list[str] = []
    required = {
        "schema_version",
        "candidate_id",
        "status",
        "official_name",
        "asset_type",
        "discovery_date",
        "summary",
        "public_sources",
        "duplicate_check",
        "review_questions",
    }
    missing = sorted(required - payload.keys())
    if missing:
        errors.append(f"missing fields: {', '.join(missing)}")
    if payload.get("schema_version") != "1.0":
        errors.append("schema_version must be 1.0")
    candidate_id = payload.get("candidate_id")
    if not isinstance(candidate_id, str) or not CANDIDATE_ID.fullmatch(candidate_id):
        errors.append("candidate_id must match CAND-YYYY-lowercase-slug")
    if payload.get("status") not in STATUSES:
        errors.append(f"unsupported status: {payload.get('status')}")
    if not valid_date(payload.get("discovery_date")):
        errors.append("discovery_date must be an ISO date")
    for field in ("official_name", "asset_type", "summary"):
        if not isinstance(payload.get(field), str) or not payload[field].strip():
            errors.append(f"{field} must be a non-empty string")

    sources = payload.get("public_sources")
    if not isinstance(sources, list) or not sources:
        errors.append("public_sources must contain at least one source")
    else:
        for index, source in enumerate(sources):
            prefix = f"public_sources[{index}]"
            if not isinstance(source, dict):
                errors.append(f"{prefix} must be an object")
                continue
            parsed = urlparse(str(source.get("url", "")))
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"{prefix}.url must be a public HTTP(S) URL")
            if not valid_date(source.get("access_date")):
                errors.append(f"{prefix}.access_date must be an ISO date")
            for field in ("source_title", "publisher"):
                if not isinstance(source.get(field), str) or not source[field].strip():
                    errors.append(f"{prefix}.{field} must be a non-empty string")
            claims = source.get("supported_claims")
            if (
                not isinstance(claims, list)
                or not claims
                or not all(isinstance(claim, str) and claim.strip() for claim in claims)
            ):
                errors.append(f"{prefix}.supported_claims must contain non-empty strings")

    duplicate_check = payload.get("duplicate_check")
    if not isinstance(duplicate_check, dict) or not str(duplicate_check.get("conclusion", "")).strip():
        errors.append("duplicate_check.conclusion must be recorded")
    questions = payload.get("review_questions")
    if not isinstance(questions, list) or not all(
        isinstance(question, str) and question.strip() for question in questions
    ):
        errors.append("review_questions must be an array of non-empty strings")
    if EMAIL.search(json.dumps(payload, ensure_ascii=False)):
        errors.append("candidate records must not contain email addresses")
    return errors


def candidate_files(root: Path) -> list[Path]:
    return sorted(
        path for path in (root / "data" / "candidates").glob("*.json") if path.name != "candidate.schema.json"
    )


def validate_files(paths: list[Path]) -> None:
    failures: list[str] = []
    seen: set[str] = set()
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            failures.append(f"{path}: {error}")
            continue
        errors = validate_candidate(payload)
        candidate_id = payload.get("candidate_id") if isinstance(payload, dict) else None
        if isinstance(candidate_id, str):
            if candidate_id in seen:
                errors.append(f"duplicate candidate_id: {candidate_id}")
            seen.add(candidate_id)
            if path.stem != candidate_id.lower():
                errors.append(f"filename must be {candidate_id.lower()}.json")
        failures.extend(f"{path}: {error}" for error in errors)
    if failures:
        raise SystemExit("Candidate validation failed:\n" + "\n".join(failures))
    print(f"Validated {len(paths)} candidate record(s).")


def new_candidate(args: argparse.Namespace, root: Path) -> None:
    raw_candidate_id = args.candidate_id.strip()
    candidate_id = (
        f"CAND-{raw_candidate_id[5:].lower()}"
        if raw_candidate_id.lower().startswith("cand-")
        else raw_candidate_id
    )
    payload = {
        "schema_version": "1.0",
        "candidate_id": candidate_id,
        "status": "candidate",
        "official_name": args.name,
        "asset_type": args.asset_type,
        "discovery_date": args.date,
        "summary": args.summary,
        "public_sources": [
            {
                "url": args.url,
                "source_title": args.source_title,
                "publisher": args.publisher,
                "access_date": args.date,
                "supported_claims": [args.supported_claim],
            }
        ],
        "duplicate_check": {
            "searched_asset_ids": [],
            "conclusion": "Pending identity and duplicate review",
        },
        "review_questions": ["Is this a distinct asset family and is it in scope?"],
    }
    errors = validate_candidate(payload)
    if errors:
        raise SystemExit("Candidate is invalid:\n" + "\n".join(errors))
    destination = root / "data" / "candidates" / f"{candidate_id.lower()}.json"
    if destination.exists():
        raise SystemExit(f"Candidate already exists: {destination}")
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage the Global LCA Asset candidate queue.")
    parser.add_argument("--project-root", type=Path)
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate")
    validate.add_argument("paths", nargs="*", type=Path)

    create = subparsers.add_parser("new")
    create.add_argument("--candidate-id", required=True, help="CAND-YYYY-lowercase-slug")
    create.add_argument("--name", required=True)
    create.add_argument("--asset-type", required=True)
    create.add_argument("--date", default=date.today().isoformat())
    create.add_argument("--summary", required=True)
    create.add_argument("--url", required=True)
    create.add_argument("--source-title", required=True)
    create.add_argument("--publisher", required=True)
    create.add_argument("--supported-claim", required=True)
    args = parser.parse_args()

    root = discover_project_root(args.project_root)
    if args.command == "new":
        new_candidate(args, root)
    else:
        paths = [path.expanduser().resolve() for path in args.paths] or candidate_files(root)
        validate_files(paths)


if __name__ == "__main__":
    main()
