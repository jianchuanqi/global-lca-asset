"""Shared API and graph data models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

JsonValue = Any


class GraphNode(BaseModel):
    """Portable graph node used by seed snapshots and API responses."""

    uid: str
    labels: list[str]
    name: str
    properties: dict[str, JsonValue] = Field(default_factory=dict)


class GraphRelationship(BaseModel):
    """Portable directed graph relationship."""

    uid: str
    type: str
    start_uid: str
    end_uid: str
    properties: dict[str, JsonValue] = Field(default_factory=dict)


class GraphSnapshot(BaseModel):
    """Complete importable graph snapshot."""

    metadata: dict[str, JsonValue]
    nodes: list[GraphNode]
    relationships: list[GraphRelationship]


class GraphPayload(BaseModel):
    """A query subgraph plus optional tabular records."""

    nodes: list[GraphNode] = Field(default_factory=list)
    relationships: list[GraphRelationship] = Field(default_factory=list)
    records: list[dict[str, JsonValue]] = Field(default_factory=list)


class MatchNode(BaseModel):
    """An allowlisted node variable in a structured graph query."""

    alias: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")
    label: str


class MatchRelationship(BaseModel):
    """An allowlisted relationship between two query variables."""

    source: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")
    target: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")
    type: str | None = None
    direction: Literal["out", "in", "either"] = "out"
    optional: bool = False


class QueryFilter(BaseModel):
    """A parameterized property predicate."""

    alias: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")
    property: str
    operator: Literal[
        "eq",
        "neq",
        "contains",
        "starts_with",
        "in",
        "exists",
        "gte",
        "lte",
    ]
    value: JsonValue = None


class OrderBy(BaseModel):
    """A deterministic order expression."""

    alias: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")
    property: str
    direction: Literal["asc", "desc"] = "asc"


class GraphQueryPlan(BaseModel):
    """LLM-safe, allowlisted plan that is compiled to parameterized Cypher."""

    nodes: list[MatchNode] = Field(min_length=1, max_length=8)
    relationships: list[MatchRelationship] = Field(default_factory=list, max_length=8)
    filters: list[QueryFilter] = Field(default_factory=list, max_length=20)
    return_aliases: list[str] = Field(default_factory=list, max_length=8)
    order_by: list[OrderBy] = Field(default_factory=list, max_length=4)
    distinct: bool = True
    limit: int = Field(default=50, ge=1, le=500)

    @model_validator(mode="after")
    def validate_aliases(self) -> GraphQueryPlan:
        """Ensure every plan reference points at a declared alias."""
        aliases = {node.alias for node in self.nodes}
        if len(aliases) != len(self.nodes):
            raise ValueError("node aliases must be unique")
        referenced = {
            *(rel.source for rel in self.relationships),
            *(rel.target for rel in self.relationships),
            *(item.alias for item in self.filters),
            *(item.alias for item in self.order_by),
            *self.return_aliases,
        }
        unknown = sorted(referenced - aliases)
        if unknown:
            raise ValueError(f"unknown aliases: {', '.join(unknown)}")
        return self


class CypherRequest(BaseModel):
    """Expert-mode read-only Cypher request."""

    cypher: str = Field(min_length=1, max_length=20_000)
    parameters: dict[str, JsonValue] = Field(default_factory=dict)
    limit: int = Field(default=200, ge=1, le=500)

    @field_validator("cypher")
    @classmethod
    def no_nul(cls, value: str) -> str:
        """Reject control bytes before the query reaches Neo4j."""
        if "\x00" in value:
            raise ValueError("Cypher contains a NUL byte")
        return value.strip()


class CompareRequest(BaseModel):
    """Asset comparison request."""

    asset_ids: list[str] = Field(min_length=2, max_length=10)


class QueryResponse(BaseModel):
    """Compiled query, parameters, records, and visualization-ready graph."""

    cypher: str
    parameters: dict[str, JsonValue]
    records: list[dict[str, Any]] = Field(default_factory=list)
    graph: GraphPayload = Field(default_factory=GraphPayload)
    truncated: bool = False
