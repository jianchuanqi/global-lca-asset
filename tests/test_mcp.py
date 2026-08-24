from fastapi.testclient import TestClient
from mcp.client import Client

from global_lca_asset.api import create_app
from global_lca_asset.mcp_server import create_mcp_server
from global_lca_asset.repository import InMemoryGraphRepository
from global_lca_asset.settings import Settings

PUBLIC_TOOLS = {
    "search_assets",
    "get_asset",
    "expand_graph",
    "find_path",
    "compare_assets",
    "get_timeline",
    "get_evidence",
    "get_inventory_statistics",
    "get_graph_schema",
    "get_service_status",
}


async def test_mcp_exposes_only_anonymous_read_tools(
    memory_repository: InMemoryGraphRepository,
) -> None:
    server = create_mcp_server(memory_repository)
    async with Client(server) as client:
        tools = (await client.list_tools()).tools

    assert {tool.name for tool in tools} == PUBLIC_TOOLS
    assert all(tool.annotations is not None for tool in tools)
    assert all(tool.annotations.read_only_hint is True for tool in tools if tool.annotations)
    assert all(tool.annotations.destructive_hint is False for tool in tools if tool.annotations)
    assert not any("cypher" in tool.name for tool in tools)


async def test_mcp_returns_stable_graph_envelope(
    memory_repository: InMemoryGraphRepository,
) -> None:
    server = create_mcp_server(memory_repository)
    async with Client(server) as client:
        search = await client.call_tool("search_assets", {"q": "ecoinvent", "limit": 2})
        graph = await client.call_tool("expand_graph", {"uid": "LCA-DB-0001", "depth": 1})
        evidence = await client.call_tool("get_evidence", {"evidence_id": "E-0001"})

    assert search.is_error is False
    assert search.structured_content["scope"]["access"] == "anonymous_public"
    assert search.structured_content["scope"]["read_only"] is True
    assert search.structured_content["data"]["total"] >= 1
    assert graph.is_error is False
    assert any(node["uid"] == "LCA-DB-0001" for node in graph.structured_content["graph"]["nodes"])
    assert evidence.structured_content["data"]["found"] is True
    assert evidence.structured_content["data"]["evidence"]["uid"] == "E-0001"


async def test_mcp_rejects_out_of_bounds_graph_expansion(
    memory_repository: InMemoryGraphRepository,
) -> None:
    server = create_mcp_server(memory_repository)
    async with Client(server) as client:
        result = await client.call_tool("expand_graph", {"uid": "LCA-DB-0001", "depth": 3})

    assert result.is_error is True
    assert "less than or equal to 2" in result.content[0].text


def test_streamable_http_mcp_is_anonymous_and_stateless(
    memory_repository: InMemoryGraphRepository,
) -> None:
    app = create_app(
        Settings(graph_backend="memory", api_token="api-only-secret"),
        memory_repository,
    )
    initialize = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "1"},
        },
    }

    with TestClient(app, base_url="http://localhost") as client:
        response = client.post(
            "/mcp",
            headers={"Accept": "application/json, text/event-stream"},
            json=initialize,
        )

    assert response.status_code == 200
    assert response.headers.get("mcp-session-id") is None
    assert response.json()["result"]["serverInfo"]["name"] == "global-lca-assets"


def test_streamable_http_mcp_rejects_unlisted_hosts(
    memory_repository: InMemoryGraphRepository,
) -> None:
    app = create_app(Settings(graph_backend="memory"), memory_repository)
    with TestClient(app, base_url="http://untrusted.example") as client:
        response = client.post(
            "/mcp",
            headers={"Accept": "application/json, text/event-stream"},
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        )

    assert response.status_code == 421


def test_streamable_http_mcp_can_trust_vercel_proxy(
    memory_repository: InMemoryGraphRepository,
) -> None:
    app = create_app(
        Settings(graph_backend="memory", mcp_trust_proxy=True),
        memory_repository,
    )
    with TestClient(app, base_url="https://preview-name.vercel.app") as client:
        response = client.post(
            "/mcp",
            headers={"Accept": "application/json, text/event-stream"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-11-25",
                    "capabilities": {},
                    "clientInfo": {"name": "vercel-check", "version": "1"},
                },
            },
        )

    assert response.status_code == 200
