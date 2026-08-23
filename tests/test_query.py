import pytest

from global_lca_asset.models import GraphQueryPlan
from global_lca_asset.query import QueryPlanError, compile_plan, validate_readonly_cypher


def test_compile_plan_parameterizes_values() -> None:
    plan = GraphQueryPlan.model_validate(
        {
            "nodes": [
                {"alias": "d", "label": "Database"},
                {"alias": "f", "label": "Schema"},
            ],
            "relationships": [{"source": "d", "target": "f", "type": "USES_FORMAT", "direction": "out"}],
            "filters": [
                {"alias": "d", "property": "name", "operator": "contains", "value": "eco' MATCH (x)"}
            ],
            "return_aliases": ["d", "f"],
            "order_by": [{"alias": "d", "property": "name", "direction": "asc"}],
            "limit": 25,
        }
    )
    compiled = compile_plan(plan)

    assert "eco' MATCH" not in compiled.cypher
    assert compiled.parameters["p0"] == "eco' MATCH (x)"
    assert compiled.parameters["query_limit"] == 25
    assert "MATCH (d:Database)-[:USES_FORMAT]->(f:Schema)" in compiled.cypher
    assert compiled.cypher.endswith("LIMIT $query_limit")


def test_compile_plan_rejects_unknown_vocabulary() -> None:
    plan = GraphQueryPlan.model_validate({"nodes": [{"alias": "a", "label": "SecretLabel"}], "limit": 10})
    with pytest.raises(QueryPlanError, match="unsupported label"):
        compile_plan(plan)


@pytest.mark.parametrize(
    "query",
    [
        "MATCH (n) DELETE n RETURN n",
        "CALL db.labels()",
        "MATCH (n) RETURN n; MATCH (m) RETURN m",
        "CREATE (n) RETURN n",
    ],
)
def test_readonly_cypher_rejects_writes_and_procedures(query: str) -> None:
    with pytest.raises(QueryPlanError):
        validate_readonly_cypher(query)


def test_readonly_cypher_accepts_a_single_read_query() -> None:
    assert validate_readonly_cypher("MATCH (n:Asset) RETURN n LIMIT 5") == (
        "MATCH (n:Asset) RETURN n LIMIT 5"
    )
