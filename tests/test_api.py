from fastapi.testclient import TestClient

from global_lca_asset.api import create_app
from global_lca_asset.repository import InMemoryGraphRepository
from global_lca_asset.settings import Settings


def test_public_api_answers_core_asset_and_relationship_queries(
    memory_repository: InMemoryGraphRepository,
) -> None:
    app = create_app(Settings(graph_backend="memory"), memory_repository)
    with TestClient(app) as client:
        health = client.get("/health")
        statistics = client.get("/api/statistics")
        search = client.get("/api/assets", params={"q": "ecoinvent"})
        asset = client.get("/api/assets/LCA-DB-0001")
        timeline = client.get("/api/assets/LCA-DB-0001/timeline")
        neighborhood = client.get("/api/graph/neighborhood", params={"uid": "LCA-DB-0001", "depth": 1})

    assert health.json()["status"] == "ok"
    assert statistics.json()["metadata"]["asset_count"] == 214
    assert search.json()["total"] >= 1
    assert any(item["uid"] == "LCA-DB-0001" for item in search.json()["items"])
    assert asset.status_code == 200
    assert asset.json()["asset"]["name"] == "ecoinvent database"
    assert len(timeline.json()["releases"]) == 4
    assert any(node["uid"] == "LCA-DB-0001" for node in neighborhood.json()["nodes"])


def test_missing_asset_and_evidence_are_404(memory_repository: InMemoryGraphRepository) -> None:
    app = create_app(Settings(graph_backend="memory"), memory_repository)
    with TestClient(app) as client:
        assert client.get("/api/assets/NOT-FOUND").status_code == 404
        assert client.get("/api/evidence/NOT-FOUND").status_code == 404


def test_expert_cypher_is_disabled_by_default(memory_repository: InMemoryGraphRepository) -> None:
    app = create_app(Settings(graph_backend="memory", enable_expert_cypher=False), memory_repository)
    with TestClient(app) as client:
        response = client.post("/api/query/cypher", json={"cypher": "MATCH (n) RETURN n"})

    assert response.status_code == 403
    assert "disabled" in response.json()["detail"]


def test_plan_endpoint_validates_schema_before_backend(memory_repository: InMemoryGraphRepository) -> None:
    app = create_app(Settings(graph_backend="memory"), memory_repository)
    with TestClient(app) as client:
        response = client.post(
            "/api/query/plan",
            json={"nodes": [{"alias": "a", "label": "Unlisted"}], "limit": 10},
        )

    assert response.status_code == 422
    assert "unsupported label" in response.json()["detail"]


def test_optional_api_token_protects_graph_endpoints(
    memory_repository: InMemoryGraphRepository,
) -> None:
    app = create_app(Settings(graph_backend="memory", api_token="test-secret"), memory_repository)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/statistics").status_code == 401
        authorized = client.get("/api/statistics", headers={"Authorization": "Bearer test-secret"})

    assert authorized.status_code == 200
