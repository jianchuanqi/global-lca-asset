"""Allowlisted graph-query planning and read-only Cypher validation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .models import GraphQueryPlan

ALLOWED_LABELS = {
    "Entity",
    "Asset",
    "Database",
    "Schema",
    "Software",
    "Platform",
    "Nomenclature",
    "Method",
    "QualitySystem",
    "Organization",
    "Geography",
    "Sector",
    "Release",
    "Distribution",
    "MappingArtifact",
    "Assertion",
    "Evidence",
    "SearchStream",
    "ExternalReference",
}

ALLOWED_RELATIONSHIPS = {
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

ALLOWED_PROPERTIES = {
    "uid",
    "name",
    "official_name",
    "alternative_name_acronym",
    "asset_type",
    "short_description",
    "owner",
    "operator_maintainer",
    "official_url",
    "geographic_coverage",
    "sector_product_process_coverage",
    "sector_scope",
    "intended_users",
    "main_use_cases",
    "language",
    "temporal_coverage",
    "current_version",
    "release_update_date",
    "maintenance_status",
    "access_model",
    "licence_or_usage_rights",
    "commercial_restricted_open_status",
    "registration_requirement",
    "governance_arrangement",
    "data_content_type",
    "data_model_or_schema",
    "exchange_format",
    "api_or_machine_readable_interface",
    "nomenclature_classification",
    "identifiers",
    "metadata_approach",
    "versioning_mechanism",
    "documentation_availability",
    "qa_validation_approach",
    "methodological_basis",
    "known_limitations",
    "confidence_level",
    "public_evidence_status",
    "owner_country_countries",
    "developer_country_countries",
    "geographic_data_coverage",
    "first_release_year",
    "latest_release_date",
    "metadata_access",
    "data_access",
    "open_data_status",
    "source_code_openness",
    "fee",
    "licence_identifier_terms",
    "redistribution_rights",
    "schema_data_model",
    "format_s",
    "software_compatibility",
    "version",
    "release_date",
    "lifecycle_status",
    "source_reliability",
    "publicly_accessed",
    "access_restriction",
    "relationship_kind",
    "status",
    "evidence_summary",
    "constraints",
    "evidence_as_of",
    "direction",
    "mapping_type",
    "claimed_tested",
}

_WRITE_TOKENS = re.compile(
    r"\b(?:CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP|ALTER|RENAME|GRANT|DENY|REVOKE|FOREACH|LOAD\s+CSV|CALL)\b",
    re.IGNORECASE,
)
_READ_START = re.compile(r"^(?:EXPLAIN\s+|PROFILE\s+)?(?:MATCH|OPTIONAL\s+MATCH|WITH|UNWIND|RETURN)\b", re.I)


@dataclass(frozen=True)
class CompiledQuery:
    """Parameterized Cypher emitted by the deterministic compiler."""

    cypher: str
    parameters: dict[str, Any]
    aliases: list[str]


class QueryPlanError(ValueError):
    """The structured query uses a label, relation, or property outside the public schema."""


def _allow(value: str, allowed: set[str], category: str) -> str:
    if value not in allowed:
        raise QueryPlanError(f"unsupported {category}: {value}")
    return value


def compile_plan(plan: GraphQueryPlan) -> CompiledQuery:
    """Compile an allowlisted query plan to parameterized Cypher."""
    node_by_alias = {node.alias: node for node in plan.nodes}
    lines: list[str] = []
    connected: set[str] = set()

    for relationship in plan.relationships:
        source = node_by_alias[relationship.source]
        target = node_by_alias[relationship.target]
        source_label = _allow(source.label, ALLOWED_LABELS, "label")
        target_label = _allow(target.label, ALLOWED_LABELS, "label")
        rel = (
            ""
            if relationship.type is None
            else f":{_allow(relationship.type, ALLOWED_RELATIONSHIPS, 'relationship')}"
        )
        prefix = "OPTIONAL MATCH" if relationship.optional else "MATCH"
        if relationship.direction == "out":
            pattern = f"({source.alias}:{source_label})-[{rel}]->({target.alias}:{target_label})"
        elif relationship.direction == "in":
            pattern = f"({source.alias}:{source_label})<-[{rel}]-({target.alias}:{target_label})"
        else:
            pattern = f"({source.alias}:{source_label})-[{rel}]-({target.alias}:{target_label})"
        lines.append(f"{prefix} {pattern}")
        connected.update((source.alias, target.alias))

    for node in plan.nodes:
        if node.alias not in connected:
            label = _allow(node.label, ALLOWED_LABELS, "label")
            lines.append(f"MATCH ({node.alias}:{label})")

    parameters: dict[str, Any] = {}
    predicates: list[str] = []
    for index, item in enumerate(plan.filters):
        prop = _allow(item.property, ALLOWED_PROPERTIES, "property")
        expression = f"{item.alias}.{prop}"
        parameter = f"p{index}"
        if item.operator == "exists":
            predicates.append(f"{expression} IS NOT NULL")
            continue
        parameters[parameter] = item.value
        if item.operator == "eq":
            predicates.append(f"{expression} = ${parameter}")
        elif item.operator == "neq":
            predicates.append(f"{expression} <> ${parameter}")
        elif item.operator == "contains":
            predicates.append(f"toLower(toString({expression})) CONTAINS toLower(toString(${parameter}))")
        elif item.operator == "starts_with":
            predicates.append(f"toLower(toString({expression})) STARTS WITH toLower(toString(${parameter}))")
        elif item.operator == "in":
            predicates.append(f"{expression} IN ${parameter}")
        elif item.operator == "gte":
            predicates.append(f"{expression} >= ${parameter}")
        elif item.operator == "lte":
            predicates.append(f"{expression} <= ${parameter}")

    if predicates:
        lines.append("WHERE " + " AND ".join(predicates))

    aliases = plan.return_aliases or [node.alias for node in plan.nodes]
    distinct = "DISTINCT " if plan.distinct else ""
    lines.append("RETURN " + distinct + ", ".join(aliases))
    if plan.order_by:
        ordering = []
        for item in plan.order_by:
            prop = _allow(item.property, ALLOWED_PROPERTIES, "property")
            ordering.append(f"{item.alias}.{prop} {item.direction.upper()}")
        lines.append("ORDER BY " + ", ".join(ordering))
    lines.append("LIMIT $query_limit")
    parameters["query_limit"] = plan.limit
    return CompiledQuery(cypher="\n".join(lines), parameters=parameters, aliases=aliases)


def validate_readonly_cypher(cypher: str) -> str:
    """Conservatively accept one read-only Cypher statement for expert mode."""
    value = cypher.strip()
    if ";" in value:
        raise QueryPlanError("only one Cypher statement is allowed; semicolons are rejected")
    if not _READ_START.match(value):
        raise QueryPlanError("expert Cypher must start with MATCH, OPTIONAL MATCH, WITH, UNWIND, or RETURN")
    match = _WRITE_TOKENS.search(value)
    if match:
        raise QueryPlanError(f"read-only Cypher rejected token: {match.group(0).upper()}")
    return value


def public_schema() -> dict[str, Any]:
    """Return the graph vocabulary and safe-plan grammar for AI clients."""
    return {
        "labels": sorted(ALLOWED_LABELS),
        "relationships": sorted(ALLOWED_RELATIONSHIPS),
        "properties": sorted(ALLOWED_PROPERTIES),
        "operators": ["eq", "neq", "contains", "starts_with", "in", "exists", "gte", "lte"],
        "plan_example": {
            "nodes": [
                {"alias": "d", "label": "Database"},
                {"alias": "f", "label": "Schema"},
            ],
            "relationships": [{"source": "d", "target": "f", "type": "USES_FORMAT", "direction": "out"}],
            "filters": [
                {"alias": "d", "property": "open_data_status", "operator": "contains", "value": "open"}
            ],
            "return_aliases": ["d", "f"],
            "limit": 50,
        },
        "notes": [
            "Asset families and releases are different nodes.",
            (
                "A mapping claim is not proof of lossless conversion; inspect MappingArtifact "
                "and Assertion evidence."
            ),
            "The current asset count is a public-evidence lower bound, not a claim of global completeness.",
        ],
    }
