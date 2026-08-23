"""Transform the public review tables into a normalized graph snapshot."""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .models import GraphNode, GraphRelationship, GraphSnapshot, JsonValue

ASSET_LABELS = {
    "Database / dataset": "Database",
    "Data schema / exchange format": "Schema",
    "Software / API / tool": "Software",
    "Platform / repository / network": "Platform",
    "Nomenclature / classification": "Nomenclature",
    "Method / guidance (incl. LCIA)": "Method",
    "QA / validation system": "QualitySystem",
}

RELATIONSHIP_TYPES = {
    "USES_FORMAT",
    "USES_SCHEMA",
    "COMPATIBLE_WITH",
    "MAPPED_TO",
    "IMPLEMENTS",
    "PUBLISHES",
    "MAINTAINS",
    "OWNS",
    "DEVELOPS",
    "COVERS_SECTOR",
    "COVERS_GEOGRAPHY",
    "HAS_RELEASE",
    "HAS_DISTRIBUTION",
    "SUPPORTED_BY",
    "ASSERTS_SOURCE",
    "ASSERTS_TARGET",
    "NEXT_RELEASE",
    "MAPPING_SOURCE",
    "MAPPING_TARGET",
    "RELATED_TO",
}


def _clean(value: Any) -> JsonValue:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value.strip() if isinstance(value, str) else value
    return str(value)


def _key(name: str) -> str:
    value = name.lower().replace("/", " ")
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_")


def _properties(row: dict[str, Any], *, omit: set[str] | None = None) -> dict[str, JsonValue]:
    omitted = omit or set()
    return {
        _key(name): cleaned
        for name, value in row.items()
        if name not in omitted and (cleaned := _clean(value)) not in (None, "")
    }


def _stable_uid(prefix: str, value: str) -> str:
    digest = hashlib.sha256(value.strip().casefold().encode()).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _split_semicolon(value: Any, *, max_length: int = 180) -> list[str]:
    if not isinstance(value, str):
        return []
    return [part.strip() for part in value.split(";") if part.strip() and len(part.strip()) <= max_length]


def _relationship_type(value: Any) -> str:
    text = str(value or "").casefold()
    if "schema" in text:
        return "USES_SCHEMA"
    if "format" in text or "native data" in text:
        return "USES_FORMAT"
    if any(term in text for term in ("mapping", "conversion", "crosswalk", "alignment")):
        return "MAPPED_TO"
    if any(term in text for term in ("compatib", "import", "export", "software support")):
        return "COMPATIBLE_WITH"
    if "implement" in text or "conform" in text:
        return "IMPLEMENTS"
    if "maintain" in text:
        return "MAINTAINS"
    if any(term in text for term in ("publish", "distribut", "repository", "host")):
        return "PUBLISHES"
    return "RELATED_TO"


class SnapshotBuilder:
    """Incrementally build a deduplicated portable graph."""

    def __init__(self, metadata: dict[str, Any]) -> None:
        self.metadata = {key: _clean(value) for key, value in metadata.items()}
        self.nodes: dict[str, GraphNode] = {}
        self.relationships: dict[str, GraphRelationship] = {}

    def add_node(
        self,
        uid: str,
        labels: list[str],
        name: str,
        properties: dict[str, JsonValue] | None = None,
    ) -> None:
        props = dict(properties or {})
        props.setdefault("name", name)
        if current := self.nodes.get(uid):
            merged_labels = list(dict.fromkeys([*current.labels, *labels, "Entity"]))
            current.labels = merged_labels
            current.properties.update(props)
            return
        self.nodes[uid] = GraphNode(
            uid=uid,
            labels=list(dict.fromkeys(["Entity", *labels])),
            name=name,
            properties=props,
        )

    def add_relationship(
        self,
        uid: str,
        rel_type: str,
        start_uid: str,
        end_uid: str,
        properties: dict[str, JsonValue] | None = None,
    ) -> None:
        if start_uid not in self.nodes or end_uid not in self.nodes:
            return
        normalized_type = rel_type if rel_type in RELATIONSHIP_TYPES else "RELATED_TO"
        self.relationships[uid] = GraphRelationship(
            uid=uid,
            type=normalized_type,
            start_uid=start_uid,
            end_uid=end_uid,
            properties=properties or {},
        )

    def snapshot(self) -> GraphSnapshot:
        return GraphSnapshot(
            metadata=self.metadata,
            nodes=sorted(self.nodes.values(), key=lambda item: item.uid),
            relationships=sorted(self.relationships.values(), key=lambda item: item.uid),
        )


def build_snapshot(source: dict[str, Any]) -> GraphSnapshot:
    """Build the graph from the public table export."""
    tables = source["tables"]
    builder = SnapshotBuilder(source.get("metadata", {}))

    for row in tables["Master Asset Inventory"]:
        asset_id = str(row["Asset ID"])
        asset_type = str(row.get("Asset type") or "Asset")
        builder.add_node(
            asset_id,
            ["Asset", ASSET_LABELS.get(asset_type, "AssetOther")],
            str(row["Official name"]),
            _properties(row, omit={"Asset ID", "Official name"}),
        )

        for role, field, rel_type in (
            ("owner", "Owner", "OWNS"),
            ("maintainer", "Operator/maintainer", "MAINTAINS"),
        ):
            value = row.get(field)
            if not isinstance(value, str) or not value.strip() or value == "Not publicly confirmed":
                continue
            org_uid = _stable_uid("org", value)
            builder.add_node(org_uid, ["Organization"], value, {"role_source": role})
            builder.add_relationship(f"{rel_type.lower()}:{org_uid}:{asset_id}", rel_type, org_uid, asset_id)

    for row in tables["Database Scope"]:
        asset_id = str(row["Asset ID"])
        if asset_id in builder.nodes:
            builder.nodes[asset_id].properties.update(_properties(row, omit={"Asset ID", "Official name"}))

        for field, role in (
            ("Owner country / countries", "owner_country"),
            ("Developer country / countries", "developer_country"),
            ("Geographic data coverage", "data_coverage"),
        ):
            for geography in _split_semicolon(row.get(field), max_length=120):
                geo_uid = _stable_uid("geo", geography)
                builder.add_node(geo_uid, ["Geography"], geography, {"geography_role": role})
                builder.add_relationship(
                    f"covers-geography:{asset_id}:{geo_uid}:{role}",
                    "COVERS_GEOGRAPHY",
                    asset_id,
                    geo_uid,
                    {"role": role},
                )

        sector_scope = row.get("Sector scope")
        if isinstance(sector_scope, str) and sector_scope.strip():
            sector_uid = _stable_uid("sector", sector_scope)
            builder.add_node(sector_uid, ["Sector"], sector_scope)
            builder.add_relationship(
                f"covers-sector:{asset_id}:{sector_uid}", "COVERS_SECTOR", asset_id, sector_uid
            )

    for row in tables["Source Evidence"]:
        evidence_id = str(row["Evidence ID"])
        asset_id = str(row["Asset ID"])
        builder.add_node(
            evidence_id,
            ["Evidence"],
            str(row.get("Source title") or evidence_id),
            _properties(row, omit={"Evidence ID", "Asset ID", "Source title"}),
        )
        builder.add_relationship(
            f"supported-by:{asset_id}:{evidence_id}", "SUPPORTED_BY", asset_id, evidence_id
        )

    releases_by_asset: dict[str, list[tuple[str, dict[str, Any]]]] = defaultdict(list)
    for row in tables["Asset Releases"]:
        release_id = str(row["Release record ID"])
        asset_id = str(row["Asset ID"])
        name = str(row.get("Version") or row.get("Release line") or release_id)
        builder.add_node(
            release_id,
            ["Release"],
            name,
            _properties(row, omit={"Release record ID", "Asset ID", "Asset name"}),
        )
        builder.add_relationship(f"has-release:{asset_id}:{release_id}", "HAS_RELEASE", asset_id, release_id)
        releases_by_asset[asset_id].append((release_id, row))

    for _asset_id, releases in releases_by_asset.items():
        by_version = {
            str(row.get("Version")): release_id for release_id, row in releases if row.get("Version")
        }
        for release_id, row in releases:
            successor = row.get("Successor release")
            if successor and successor in by_version:
                builder.add_relationship(
                    f"next-release:{release_id}:{by_version[str(successor)]}",
                    "NEXT_RELEASE",
                    release_id,
                    by_version[str(successor)],
                )

    for row in tables["Distributions"]:
        distribution_id = str(row["Distribution ID"])
        asset_id = str(row["Database Asset ID"])
        builder.add_node(
            distribution_id,
            ["Distribution"],
            str(row.get("Distribution / package") or distribution_id),
            _properties(row, omit={"Distribution ID", "Database Asset ID", "Database name"}),
        )
        builder.add_relationship(
            f"has-distribution:{asset_id}:{distribution_id}",
            "HAS_DISTRIBUTION",
            asset_id,
            distribution_id,
        )

    for row in tables["Mapping Artifacts"]:
        mapping_id = str(row["Mapping artifact ID"])
        builder.add_node(
            mapping_id,
            ["MappingArtifact"],
            str(row.get("Project / study") or mapping_id),
            _properties(row, omit={"Mapping artifact ID"}),
        )
        for field, name_field, rel_type in (
            ("Source Asset ID", "Source schema / format", "MAPPING_SOURCE"),
            ("Target Asset ID", "Target schema / format", "MAPPING_TARGET"),
        ):
            target_id = str(row.get(field) or "")
            if target_id not in builder.nodes and target_id:
                external_name = str(row.get(name_field) or target_id)
                target_id = _stable_uid("external", external_name)
                builder.add_node(target_id, ["ExternalReference"], external_name)
            if target_id:
                builder.add_relationship(
                    f"{rel_type.lower()}:{mapping_id}:{target_id}", rel_type, mapping_id, target_id
                )

    for row in tables["Relationship Index"]:
        relationship_id = str(row["Relationship ID"])
        source_id = str(row.get("Source Asset ID") or "")
        target_id = str(row.get("Target Asset ID") or "")
        if source_id not in builder.nodes:
            source_name = str(row.get("Source asset name") or "").strip()
            if source_name:
                source_id = _stable_uid("external", source_name)
                builder.add_node(source_id, ["ExternalReference"], source_name)
        if target_id not in builder.nodes:
            target_name = str(row.get("Target asset name") or "").strip()
            if target_name:
                target_id = _stable_uid("external", target_name)
                builder.add_node(target_id, ["ExternalReference"], target_name)
        if source_id not in builder.nodes or target_id not in builder.nodes:
            continue
        assertion_uid = f"assertion:{relationship_id}"
        original_type = str(row.get("Relationship type") or "related to")
        builder.add_node(
            assertion_uid,
            ["Assertion"],
            f"{row.get('Source asset name')} — {original_type} — {row.get('Target asset name')}",
            _properties(row, omit={"Source Asset ID", "Target Asset ID"}),
        )
        builder.add_relationship(
            f"asserts-source:{relationship_id}", "ASSERTS_SOURCE", assertion_uid, source_id
        )
        builder.add_relationship(
            f"asserts-target:{relationship_id}", "ASSERTS_TARGET", assertion_uid, target_id
        )
        builder.add_relationship(
            relationship_id,
            _relationship_type(original_type),
            source_id,
            target_id,
            {
                "relationship_kind": original_type,
                "status": _clean(row.get("Status")),
                "evidence_summary": _clean(row.get("Evidence")),
                "constraints": _clean(row.get("Constraints")),
                "assertion_uid": assertion_uid,
            },
        )

    for row in tables["Search Coverage"]:
        stream_id = str(row["Search stream ID"])
        builder.add_node(
            stream_id,
            ["SearchStream"],
            str(row.get("Discovery stream") or stream_id),
            _properties(row, omit={"Search stream ID", "Discovery stream"}),
        )

    snapshot = builder.snapshot()
    snapshot.metadata.update(
        {
            "asset_count": len(tables["Master Asset Inventory"]),
            "evidence_count": len(tables["Source Evidence"]),
            "release_count": len(tables["Asset Releases"]),
            "distribution_count": len(tables["Distributions"]),
            "mapping_count": len(tables["Mapping Artifacts"]),
            "relationship_assertion_count": len(tables["Relationship Index"]),
            "graph_node_count": len(snapshot.nodes),
            "graph_relationship_count": len(snapshot.relationships),
        }
    )
    return snapshot


def load_public_source(path: Path | str) -> dict[str, Any]:
    """Load a public source-table export from disk."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def build_snapshot_from_path(path: Path | str) -> GraphSnapshot:
    """Load and transform one public source-table export."""
    return build_snapshot(load_public_source(path))
