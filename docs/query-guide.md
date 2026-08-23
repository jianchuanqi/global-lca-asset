# 查询指南

## 1. 快速检索

```bash
curl 'http://127.0.0.1:8000/api/assets?q=ecoinvent&limit=10'
curl 'http://127.0.0.1:8000/api/assets?asset_type=Database%20%2F%20dataset&country=China'
curl 'http://127.0.0.1:8000/api/assets?sector=energy&open_only=true'
```

`open_only=true` 是宽松的公开元数据筛选，不等同于“明确开放许可”。正式回答开放数据库问题时应读取 `open_data_status`、`licence_identifier_terms`、`redistribution_rights`、`registration` 和 `fee`。

## 2. 资产、时间线、关系和证据

```bash
curl http://127.0.0.1:8000/api/assets/LCA-DB-0001
curl http://127.0.0.1:8000/api/assets/LCA-DB-0001/timeline
curl 'http://127.0.0.1:8000/api/graph/neighborhood?uid=LCA-DB-0001&depth=1&limit=100'
curl 'http://127.0.0.1:8000/api/graph/path?source_uid=LCA-DB-0001&target_uid=LCA-FMT-0001&max_depth=4'
curl http://127.0.0.1:8000/api/evidence/E-0001
```

图接口返回：

```json
{
  "nodes": [{"uid": "...", "labels": ["Entity", "Asset"], "name": "...", "properties": {}}],
  "relationships": [{"uid": "...", "type": "USES_FORMAT", "start_uid": "...", "end_uid": "...", "properties": {}}],
  "records": []
}
```

## 3. 结构化查询计划

AI 和普通应用推荐使用 `/api/query/plan`。先读取 `/api/schema` 获取允许词汇。

```json
{
  "nodes": [
    {"alias": "d", "label": "Database"},
    {"alias": "f", "label": "Schema"}
  ],
  "relationships": [
    {"source": "d", "target": "f", "type": "USES_FORMAT", "direction": "out"}
  ],
  "filters": [
    {"alias": "d", "property": "open_data_status", "operator": "contains", "value": "open"}
  ],
  "return_aliases": ["d", "f"],
  "order_by": [{"alias": "d", "property": "name", "direction": "asc"}],
  "distinct": true,
  "limit": 50
}
```

```bash
curl -X POST http://127.0.0.1:8000/api/query/plan \
  -H 'Content-Type: application/json' \
  --data @examples/query-plan-open-database-formats.json
```

允许的 operator：`eq`、`neq`、`contains`、`starts_with`、`in`、`exists`、`gte`、`lte`。用户提供的 value 永远进入 Cypher parameters，不会插入查询字符串。

## 4. 专家 Cypher

当 API 显式开启时：

```bash
curl -X POST http://127.0.0.1:8000/api/query/cypher \
  -H 'Content-Type: application/json' \
  --data '{
    "cypher": "MATCH (a:Asset) RETURN count(a) AS asset_count",
    "parameters": {},
    "limit": 10
  }'
```

返回结果仍包含实际 Cypher、parameters、records 和 graph。写入、procedure 和多语句会得到 422；未开启会得到 403。

## 5. 六个 review 问题

`graph/queries/six-review-questions.cypher` 保存六组可复核查询。它们分别回答：

1. 当前公开证据中的 database family 数量及口径。
2. 明确开放许可、公开但权利混合、商业或申请获取的数据库。
3. 数据库、Distribution、schema/format 和软件兼容关系。
4. 开发/维护机构、国家和行业。
5. 资产的首发、版本和里程碑时间线。
6. schema、format 和 nomenclature mapping 的项目、版本、测试和已知损失。

任何数量结论都要和 `GraphMetadata.evidence_cutoff`、搜索覆盖和 unresolved questions 一起解释。
