"""Neo4j implementation of the Global LCA graph repository."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from neo4j import READ_ACCESS, AsyncGraphDatabase, Query
from neo4j.graph import Node, Path, Relationship

from .models import GraphNode, GraphPayload, GraphRelationship, GraphSnapshot


def _json_value(value: Any) -> Any:
    if isinstance(value, Node):
        return {
            "uid": value.get("uid", value.element_id),
            "labels": sorted(value.labels),
            **dict(value),
        }
    if isinstance(value, Relationship):
        return {
            "uid": value.get("uid", value.element_id),
            "type": value.type,
            "start_uid": value.start_node.get("uid", value.start_node.element_id),
            "end_uid": value.end_node.get("uid", value.end_node.element_id),
            **dict(value),
        }
    if isinstance(value, Path):
        return {
            "nodes": [_json_value(node) for node in value.nodes],
            "relationships": [_json_value(rel) for rel in value.relationships],
        }
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def _portable_node(node: Node) -> GraphNode:
    props = dict(node)
    uid = str(props.pop("uid", node.element_id))
    name = str(props.get("name", uid))
    return GraphNode(uid=uid, labels=sorted(node.labels), name=name, properties=props)


def _portable_relationship(rel: Relationship) -> GraphRelationship:
    props = dict(rel)
    uid = str(props.pop("uid", rel.element_id))
    return GraphRelationship(
        uid=uid,
        type=rel.type,
        start_uid=str(rel.start_node.get("uid", rel.start_node.element_id)),
        end_uid=str(rel.end_node.get("uid", rel.end_node.element_id)),
        properties=props,
    )


class Neo4jGraphRepository:
    """Async Neo4j repository with a read-only query surface and batch importer."""

    def __init__(
        self,
        uri: str,
        user: str,
        password: str,
        database: str,
        *,
        connection_timeout_seconds: float = 5.0,
        query_timeout_seconds: float = 10.0,
        max_connection_pool_size: int = 10,
    ) -> None:
        self.driver = AsyncGraphDatabase.driver(
            uri,
            auth=(user, password),
            connection_timeout=connection_timeout_seconds,
            max_connection_pool_size=max_connection_pool_size,
        )
        self.database = database
        self.query_timeout_seconds = query_timeout_seconds

    def _read_query(self, cypher: str) -> Query:
        """Apply the public query deadline at the Neo4j transaction boundary."""
        return Query(cypher, timeout=self.query_timeout_seconds)

    async def health(self) -> dict[str, Any]:
        info = await self.driver.get_server_info()
        return {"status": "ok", "backend": "neo4j", "server": info.agent}

    async def close(self) -> None:
        await self.driver.close()

    async def _records(self, cypher: str, parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        async with self.driver.session(database=self.database, default_access_mode=READ_ACCESS) as session:
            result = await session.run(self._read_query(cypher), parameters or {})
            return [_json_value(dict(record)) async for record in result]

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
        cypher = """
        MATCH (a:Asset)
        WHERE (
          $q IS NULL OR toLower(
            coalesce(a.name, '') + ' ' +
            coalesce(a.alternative_name_acronym, '') + ' ' +
            coalesce(a.short_description, '')
          ) CONTAINS toLower($q)
        )
          AND ($asset_type IS NULL OR toLower(a.asset_type) = toLower($asset_type))
          AND (
            $country IS NULL OR toLower(
              coalesce(a.owner_country_countries, '') + ' ' +
              coalesce(a.developer_country_countries, '') + ' ' +
              coalesce(a.geographic_data_coverage, '') + ' ' +
              coalesce(a.geographic_coverage, '')
            ) CONTAINS toLower($country)
          )
          AND (
            $sector IS NULL OR toLower(
              coalesce(a.sector_scope, '') + ' ' +
              coalesce(a.sector_product_process_coverage, '')
            ) CONTAINS toLower($sector)
          )
          AND (
            NOT $open_only OR toLower(
              coalesce(a.open_data_status, a.commercial_restricted_open_status, '')
            ) CONTAINS 'open'
          )
        WITH a ORDER BY toLower(a.name)
        WITH collect(a) AS matches
        RETURN size(matches) AS total,
               [a IN matches[$offset..($offset + $limit)] | a{.*, labels: labels(a)}] AS items
        """
        records = await self._records(
            cypher,
            {
                "q": q,
                "asset_type": asset_type,
                "country": country,
                "sector": sector,
                "open_only": open_only,
                "limit": limit,
                "offset": offset,
            },
        )
        record = records[0] if records else {"total": 0, "items": []}
        return {**record, "limit": limit, "offset": offset}

    async def get_asset(self, asset_id: str) -> dict[str, Any] | None:
        records = await self._records(
            "MATCH (a:Asset {uid: $uid}) RETURN a{.*, labels: labels(a)} AS asset", {"uid": asset_id}
        )
        if not records:
            return None
        graph = await self.neighborhood(asset_id, 1, 100)
        return {"asset": records[0]["asset"], "graph": graph.model_dump(mode="json")}

    async def timeline(self, asset_id: str) -> list[dict[str, Any]]:
        records = await self._records(
            """
            MATCH (:Asset {uid: $uid})-[:HAS_RELEASE]->(r:Release)
            RETURN r{.*, labels: labels(r)} AS release
            ORDER BY coalesce(r.release_date, r.first_development_release_year, '')
            """,
            {"uid": asset_id},
        )
        return [record["release"] for record in records]

    async def neighborhood(self, uid: str, depth: int, limit: int) -> GraphPayload:
        cypher = f"""
        MATCH p=(center:Entity {{uid: $uid}})-[*0..{depth}]-(neighbor:Entity)
        WITH p LIMIT $limit
        RETURN p
        """
        records = await self._records(cypher, {"uid": uid, "limit": limit})
        return self._graph_from_records(records)

    async def shortest_path(self, source_uid: str, target_uid: str, max_depth: int) -> GraphPayload:
        cypher = f"""
        MATCH (source:Entity {{uid: $source_uid}}), (target:Entity {{uid: $target_uid}})
        MATCH p = shortestPath((source)-[*..{max_depth}]-(target))
        RETURN p
        """
        records = await self._records(cypher, {"source_uid": source_uid, "target_uid": target_uid})
        return self._graph_from_records(records)

    async def get_evidence(self, evidence_id: str) -> dict[str, Any] | None:
        records = await self._records(
            """
            MATCH (e:Evidence {uid: $uid})
            OPTIONAL MATCH (a:Asset)-[:SUPPORTED_BY]->(e)
            RETURN e{.*, labels: labels(e)} AS evidence, collect(a{.uid, .name}) AS supported_assets
            """,
            {"uid": evidence_id},
        )
        return records[0] if records else None

    async def compare(self, asset_ids: list[str]) -> list[dict[str, Any]]:
        records = await self._records(
            """
            UNWIND $asset_ids AS requested
            OPTIONAL MATCH (a:Asset {uid: requested})
            RETURN CASE WHEN a IS NULL THEN null ELSE a{.*, labels: labels(a)} END AS asset
            """,
            {"asset_ids": asset_ids},
        )
        return [record["asset"] for record in records if record["asset"] is not None]

    async def statistics(self) -> dict[str, Any]:
        records = await self._records(
            """
            MATCH (n:Entity)
            WITH count(n) AS nodes
            MATCH ()-[r]->()
            WITH nodes, count(r) AS relationships
            CALL () {
              MATCH (a:Asset) RETURN count(a) AS assets
            }
            CALL () {
              MATCH (e:Evidence) RETURN count(e) AS evidence
            }
            OPTIONAL MATCH (m:GraphMetadata {uid: 'graph:metadata'})
            RETURN nodes, relationships, assets, evidence, properties(m) AS metadata
            """
        )
        counts = records[0] if records else {}
        labels = await self._records(
            "MATCH (n:Entity) UNWIND labels(n) AS label "
            "WITH label, count(*) AS count RETURN label, count ORDER BY label"
        )
        relationships = await self._records(
            "MATCH ()-[r]->() WITH type(r) AS type, count(*) AS count RETURN type, count ORDER BY type"
        )
        return {
            **counts,
            "nodes_by_label": {row["label"]: row["count"] for row in labels if row["label"] != "Entity"},
            "relationships_by_type": {row["type"]: row["count"] for row in relationships},
        }

    async def execute(self, cypher: str, parameters: dict[str, Any], limit: int) -> dict[str, Any]:
        async with self.driver.session(database=self.database, default_access_mode=READ_ACCESS) as session:
            result = await session.run(self._read_query(cypher), parameters)
            records: list[dict[str, Any]] = []
            raw_records: list[dict[str, Any]] = []
            truncated = False
            async for record in result:
                if len(records) >= limit:
                    truncated = True
                    break
                raw = dict(record)
                raw_records.append(raw)
                records.append(_json_value(raw))
            graph = self._graph_from_raw_records(raw_records)
            return {"records": records, "graph": graph, "truncated": truncated}

    async def explain(self, cypher: str, parameters: dict[str, Any]) -> None:
        async with self.driver.session(database=self.database, default_access_mode=READ_ACCESS) as session:
            result = await session.run(self._read_query(f"EXPLAIN\n{cypher}"), parameters)
            await result.consume()

    async def initialize_schema(self) -> None:
        statements = [
            "CREATE CONSTRAINT entity_uid IF NOT EXISTS FOR (n:Entity) REQUIRE n.uid IS UNIQUE",
            "CREATE INDEX asset_type IF NOT EXISTS FOR (n:Asset) ON (n.asset_type)",
            "CREATE INDEX asset_name IF NOT EXISTS FOR (n:Asset) ON (n.name)",
            "CREATE INDEX release_date IF NOT EXISTS FOR (n:Release) ON (n.release_date)",
            (
                "CREATE FULLTEXT INDEX asset_search IF NOT EXISTS FOR (n:Asset) "
                "ON EACH [n.name, n.alternative_name_acronym, n.short_description]"
            ),
        ]
        async with self.driver.session(database=self.database) as session:
            for statement in statements:
                await (await session.run(statement)).consume()

    async def import_snapshot(self, snapshot: GraphSnapshot, *, replace: bool = False) -> dict[str, int]:
        await self.initialize_schema()
        async with self.driver.session(database=self.database) as session:
            if replace:
                await (await session.run("MATCH (n:Entity) DETACH DELETE n")).consume()
                await (await session.run("MATCH (m:GraphMetadata) DELETE m")).consume()

            node_groups: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
            for node in snapshot.nodes:
                labels = tuple(sorted(set(node.labels)))
                node_groups[labels].append(
                    {"uid": node.uid, "name": node.name, "properties": node.properties}
                )
            for labels, rows in node_groups.items():
                suffix = ":".join(labels)
                query = f"""
                UNWIND $rows AS row
                MERGE (n:Entity {{uid: row.uid}})
                SET n:{suffix}
                SET n += row.properties, n.name = row.name
                """
                for batch in _batches(rows, 500):
                    await (await session.run(query, {"rows": batch})).consume()

            rel_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for rel in snapshot.relationships:
                rel_groups[rel.type].append(rel.model_dump(mode="json"))
            for rel_type, rows in rel_groups.items():
                query = f"""
                UNWIND $rows AS row
                MATCH (start:Entity {{uid: row.start_uid}}), (end:Entity {{uid: row.end_uid}})
                MERGE (start)-[r:{rel_type} {{uid: row.uid}}]->(end)
                SET r += row.properties
                """
                for batch in _batches(rows, 500):
                    await (await session.run(query, {"rows": batch})).consume()

            metadata = {key: value for key, value in snapshot.metadata.items() if value is not None}
            await (
                await session.run(
                    "MERGE (m:GraphMetadata {uid: 'graph:metadata'}) SET m += $metadata",
                    {"metadata": metadata},
                )
            ).consume()
        return {"nodes": len(snapshot.nodes), "relationships": len(snapshot.relationships)}

    @staticmethod
    def _graph_from_records(records: list[dict[str, Any]]) -> GraphPayload:
        nodes: dict[str, GraphNode] = {}
        relationships: dict[str, GraphRelationship] = {}

        def collect(value: Any) -> None:
            if isinstance(value, dict) and {"nodes", "relationships"} <= value.keys():
                for node in value["nodes"]:
                    uid = str(node["uid"])
                    props = {key: item for key, item in node.items() if key not in {"uid", "labels", "name"}}
                    nodes[uid] = GraphNode(
                        uid=uid,
                        labels=list(node.get("labels", [])),
                        name=str(node.get("name", uid)),
                        properties=props,
                    )
                for rel in value["relationships"]:
                    uid = str(rel["uid"])
                    props = {
                        key: item
                        for key, item in rel.items()
                        if key not in {"uid", "type", "start_uid", "end_uid"}
                    }
                    relationships[uid] = GraphRelationship(
                        uid=uid,
                        type=str(rel["type"]),
                        start_uid=str(rel["start_uid"]),
                        end_uid=str(rel["end_uid"]),
                        properties=props,
                    )
            elif isinstance(value, dict):
                for item in value.values():
                    collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)

        for record in records:
            collect(record)
        return GraphPayload(nodes=list(nodes.values()), relationships=list(relationships.values()))

    @staticmethod
    def _graph_from_raw_records(records: list[dict[str, Any]]) -> GraphPayload:
        nodes: dict[str, GraphNode] = {}
        relationships: dict[str, GraphRelationship] = {}

        def collect(value: Any) -> None:
            if isinstance(value, Node):
                node = _portable_node(value)
                nodes[node.uid] = node
            elif isinstance(value, Relationship):
                rel = _portable_relationship(value)
                relationships[rel.uid] = rel
                collect(value.start_node)
                collect(value.end_node)
            elif isinstance(value, Path):
                for node in value.nodes:
                    collect(node)
                for rel in value.relationships:
                    collect(rel)
            elif isinstance(value, dict):
                for item in value.values():
                    collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)

        for record in records:
            collect(record)
        return GraphPayload(nodes=list(nodes.values()), relationships=list(relationships.values()))


def _batches(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]
