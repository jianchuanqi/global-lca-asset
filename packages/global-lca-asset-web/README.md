# Global LCA Asset

面向研究人员的公开数据集入口。它和 CSV、JSONL、SQLite 数据包由同一份公开种子生成，按五个研究视图提供数据库范围、开放获取、格式与软件、开发者与行业、mapping/conversion 查询，并保留全部资产检索和数据下载。时间数据仍保存在完整证据包中，但不作为网页发布视图。

构建时，`src/data/dataset.json` 会作为带内容 hash 的独立 JSON asset 发布，页面启动后加载并校验它；数据不会被编译进主 JavaScript chunk。加载失败时页面会显示错误并允许重试。

Relationship graph 是独立的跨问题视图，不依赖 Neo4j。页面先获取 `public/graph/index.json`，用户选择资产或机构后才获取对应的 `public/graph/neighborhoods/<node_id>.json`，展开相邻节点时继续按需合并新的局部网络。Owner、developer 与 operator/maintainer 均作为有证据来源的机构—资产关系呈现。

```bash
pnpm data:build
pnpm web:dev
```

Global LCA Asset 是完整数据集的发布与查询入口；`packages/dsh-lca-graph-ui` 仍负责在 AI 查询结果中展示局部关系图。
