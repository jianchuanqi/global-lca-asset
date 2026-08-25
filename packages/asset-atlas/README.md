# Global LCA Asset Atlas

面向研究人员的独立浏览界面。它和 CSV、JSONL、SQLite 数据包由同一份公开种子生成，提供概览、资产检索与比较、互操作关系、版本时间线、审阅问题和数据下载。

```bash
pnpm data:build
pnpm atlas:dev
```

Atlas 是完整 review 的交互入口；`packages/dsh-lca-graph-ui` 仍负责在 AI 查询结果中展示局部关系图。
