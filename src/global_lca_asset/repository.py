"""Graph repository interface and an in-memory implementation for local checks."""

from __future__ import annotations

from collections import Counter, deque
from typing import Any, Protocol

from .models import GraphNode, GraphPayload, GraphRelationship, GraphSnapshot


class GraphRepository(Protocol):
    """Operations required by the public API."""

    async def health(self) -> dict[str, Any]: ...

    async def close(self) -> None: ...

    async def search_assets(
        self,
        *,
        q: str | None,
        asset_type: str | None,
        country: str | None,
        sector: str | None,
        open_only: bool,
        limit: int,
        offset: int,
    ) -> dict[str, Any]: ...

    async def get_asset(self, asset_id: str) -> dict[str, Any] | None: ...

    async def timeline(self, asset_id: str) -> list[dict[str, Any]]: ...

    async def neighborhood(self, uid: str, depth: int, limit: int) -> GraphPayload: ...

    async def shortest_path(self, source_uid: str, target_uid: str, max_depth: int) -> GraphPayload: ...

    async def get_evidence(self, evidence_id: str) -> dict[str, Any] | None: ...

    async def compare(self, asset_ids: list[str]) -> list[dict[str, Any]]: ...

    async def statistics(self) -> dict[str, Any]: ...

    async def execute(self, cypher: str, parameters: dict[str, Any], limit: int) -> dict[str, Any]: ...


def node_document(node: GraphNode) -> dict[str, Any]:
    """Flatten a portable node for tables while retaining graph identity."""
    return {
        "uid": node.uid,
        "labels": node.labels,
        "name": node.name,
        **node.properties,
    }


class InMemoryGraphRepository:
    """Read-only graph repository backed by a seed snapshot."""

    def __init__(self, snapshot: GraphSnapshot) -> None:
        self.snapshot = snapshot
        self.nodes = {node.uid: node for node in snapshot.nodes}
        self.relationships = list(snapshot.relationships)
        self.outgoing: dict[str, list[GraphRelationship]] = {}
        self.incoming: dict[str, list[GraphRelationship]] = {}
        for rel in self.relationships:
            self.outgoing.setdefault(rel.start_uid, []).append(rel)
            self.incoming.setdefault(rel.end_uid, []).append(rel)

    async def health(self) -> dict[str, Any]:
        return {"status": "ok", "backend": "memory", "nodes": len(self.nodes)}

    async def close(self) -> None:
        return None

    async def search_assets(
        self,
        *,
        q: str | None,
        asset_type: str | None,
        country: str | None,
        sector: str | None,
        open_only: bool,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        assets = [node for node in self.nodes.values() if "Asset" in node.labels]

        def matches(node: GraphNode) -> bool:
            props = node.properties
            if asset_type and str(props.get("asset_type", "")).casefold() != asset_type.casefold():
                return False
            searchable = " ".join(
                str(value)
                for value in [
                    node.name,
                    props.get("alternative_name_acronym"),
                    props.get("short_description"),
                ]
                if value is not None
            ).casefold()
            if q and q.casefold() not in searchable:
                return False
            geography = " ".join(
                str(props.get(key, ""))
                for key in (
                    "owner_country_countries",
                    "developer_country_countries",
                    "geographic_data_coverage",
                    "geographic_coverage",
                )
            ).casefold()
            if country and country.casefold() not in geography:
                return False
            sector_text = " ".join(
                str(props.get(key, "")) for key in ("sector_scope", "sector_product_process_coverage")
            ).casefold()
            if sector and sector.casefold() not in sector_text:
                return False
            if (
                open_only
                and "open"
                not in str(
                    props.get("open_data_status", props.get("commercial_restricted_open_status", ""))
                ).casefold()
            ):
                return False
            return True

        filtered = sorted((node for node in assets if matches(node)), key=lambda node: node.name.casefold())
        return {
            "total": len(filtered),
            "items": [node_document(node) for node in filtered[offset : offset + limit]],
            "limit": limit,
            "offset": offset,
        }

    async def get_asset(self, asset_id: str) -> dict[str, Any] | None:
        node = self.nodes.get(asset_id)
        if node is None or "Asset" not in node.labels:
            return None
        neighbors = await self.neighborhood(asset_id, 1, 100)
        return {"asset": node_document(node), "graph": neighbors.model_dump(mode="json")}

    async def timeline(self, asset_id: str) -> list[dict[str, Any]]:
        releases = [
            self.nodes[rel.end_uid]
            for rel in self.outgoing.get(asset_id, [])
            if rel.type == "HAS_RELEASE" and rel.end_uid in self.nodes
        ]
        releases.sort(key=lambda item: str(item.properties.get("release_date", "")))
        return [node_document(node) for node in releases]

    async def neighborhood(self, uid: str, depth: int, limit: int) -> GraphPayload:
        if uid not in self.nodes:
            return GraphPayload()
        visited = {uid}
        selected: dict[str, GraphRelationship] = {}
        frontier = {uid}
        for _ in range(depth):
            next_frontier: set[str] = set()
            for current in frontier:
                for rel in [*self.outgoing.get(current, []), *self.incoming.get(current, [])]:
                    other = rel.end_uid if rel.start_uid == current else rel.start_uid
                    selected[rel.uid] = rel
                    if other not in visited and len(visited) < limit:
                        visited.add(other)
                        next_frontier.add(other)
            frontier = next_frontier
            if not frontier or len(visited) >= limit:
                break
        relationships = [
            rel for rel in selected.values() if rel.start_uid in visited and rel.end_uid in visited
        ]
        return GraphPayload(nodes=[self.nodes[item] for item in sorted(visited)], relationships=relationships)

    async def shortest_path(self, source_uid: str, target_uid: str, max_depth: int) -> GraphPayload:
        if source_uid not in self.nodes or target_uid not in self.nodes:
            return GraphPayload()
        queue: deque[tuple[str, list[str], list[GraphRelationship]]] = deque([(source_uid, [source_uid], [])])
        seen = {source_uid}
        while queue:
            current, node_path, rel_path = queue.popleft()
            if current == target_uid:
                return GraphPayload(nodes=[self.nodes[uid] for uid in node_path], relationships=rel_path)
            if len(rel_path) >= max_depth:
                continue
            for rel in [*self.outgoing.get(current, []), *self.incoming.get(current, [])]:
                other = rel.end_uid if rel.start_uid == current else rel.start_uid
                if other in seen:
                    continue
                seen.add(other)
                queue.append((other, [*node_path, other], [*rel_path, rel]))
        return GraphPayload()

    async def get_evidence(self, evidence_id: str) -> dict[str, Any] | None:
        node = self.nodes.get(evidence_id)
        return node_document(node) if node and "Evidence" in node.labels else None

    async def compare(self, asset_ids: list[str]) -> list[dict[str, Any]]:
        return [
            node_document(self.nodes[uid])
            for uid in asset_ids
            if uid in self.nodes and "Asset" in self.nodes[uid].labels
        ]

    async def statistics(self) -> dict[str, Any]:
        labels = Counter(label for node in self.nodes.values() for label in node.labels if label != "Entity")
        rel_types = Counter(rel.type for rel in self.relationships)
        return {
            "metadata": self.snapshot.metadata,
            "nodes": len(self.nodes),
            "relationships": len(self.relationships),
            "nodes_by_label": dict(sorted(labels.items())),
            "relationships_by_type": dict(sorted(rel_types.items())),
        }

    async def execute(self, cypher: str, parameters: dict[str, Any], limit: int) -> dict[str, Any]:
        raise RuntimeError("Cypher execution requires the Neo4j backend")
