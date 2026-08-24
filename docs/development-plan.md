# 开发与验收状态

## 1. 首版完成状态

本仓库已经从架构设计进入可运行的首版。完成项如下：

| 模块 | 状态 | 验收结果 |
|---|---|---|
| 公开数据基线 | 完成 | 8 张来源表，联系人和内部字段已排除 |
| 图谱构建 | 完成 | 1,663 节点、2,282 关系，无悬空关系 |
| Neo4j schema | 完成 | UID 约束、属性索引、全文索引 |
| 幂等导入 | 完成 | 批量 `MERGE`；重复导入计数不增加 |
| 资产和证据 API | 完成 | 检索、详情、时间线、证据、比较 |
| 关系 API | 完成 | 邻域、最短路径、图结构返回 |
| 结构化 AI 查询 | 完成 | allowlist、参数化 compiler、`EXPLAIN` |
| 专家 Cypher | 完成 | 默认关闭；只读语法门控和结果上限 |
| 公共 MCP | 完成 | 匿名、无状态；10 个预设只读工具，无 Cypher 和写入 |
| Vercel 运行入口 | 完成 | 根 ASGI 入口、Fluid compute、部署变量和协议检查 |
| DSH 插件 | 完成 | 可加载、可打包；10 个默认工具和 1 个可选工具 |
| 交互式图谱结果 | 完成 | Graph/Data/Evidence；筛选、布局、详情、全屏和四种导出 |
| 容器运行 | 完成 | Neo4j、API、一次性 seed importer |
| 自动测试 | 完成 | Python 和 TypeScript 测试、类型检查、lint、smoke |
| DSH 上游隔离 | 完成 | `/Users/jianchuan/Dev/deepseek-harness` 无文件改动 |

## 2. 当前完成定义

首版满足以下研究和使用条件：

- review 的 199 个主资产、205 条证据、290 个版本、128 个分发包、18 个 mapping 和 233 条关系断言均可查询。
- Asset family、Release、Distribution、MappingArtifact、Assertion 和 Evidence 是不同对象。
- 任一结构化查询都会返回实际 Cypher、参数、记录和关系子图。
- DSH 可以把自然语言问题转成图谱工具调用，并根据实际结果与证据 URL 回答。
- 带关系子图的查询可以在同一回答中展开为交互式图谱，保存后仍可重放。
- 模型没有数据库账号，也不能通过结构化计划表达写入。
- 公开 seed 中不存在联系人字段、姓名/邮箱映射或内部 reviewer notes。
- Docker Compose 可以从空图数据库完成导入并提供健康 API。
- 任意兼容 Streamable HTTP 的 MCP 客户端都可以匿名发现并调用公共读工具。

## 3. 自动检查

```bash
uv run ruff check src tests
uv run pytest
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

端到端验证还包括：

- Neo4j 5.26 Community 启动并健康。
- seed 容器以 0 退出并导入 1,663/2,282。
- `/api/statistics` 返回 199 个 Asset 和 205 个 Evidence。
- ecoinvent 到 ecoSpold2 返回一条 `USES_FORMAT` 最短路径。
- 结构化计划生成参数化 Cypher 并返回记录。
- 插件可直接调用 API；专家工具关闭和开启两种注册状态均经过测试。
- MCP 工具清单、只读 annotation、参数边界、无状态 HTTP 和 Host 防护均有自动测试。
- 图谱 client plugin 已在真实 DSH 启动清单和浏览器中完成加载验证。

## 4. 尚未声称完成的事项

“系统完成”不等于“全球资产发现已经结束”。下面属于后续持续研究或生产运营，不是当前代码缺陷：

- 继续扩充所有公开 LCA asset，特别是本地语言和区域网络中的遗漏。
- 对下载包进行 release-level 导入、schema validation 和 round-trip 测试。
- 建立人工专家纠错、版本发布和内容审核流程。
- 实际 Vercel 项目、正式域名、托管 Neo4j、备份、监控和 reader/writer 账号配置。
- 用真实研究人员问题建立大规模中英文自然语言评测集。

## 5. 建议的下一阶段

### 数据持续更新

1. 为每次 review 生成新的公开 seed，而不是覆盖历史文件。
2. 比较 Asset、Release、Distribution 和 Assertion 的增删改。
3. 先在临时数据库导入并对账，再发布为新的图谱快照。
4. 在回答中始终显示 evidence cut-off 和搜索覆盖警告。

### 研究质量

1. 为六个 review 问题维护固定 Cypher 和预期统计。
2. 把 claimed、documented、tested、verified 和 lossless 建成更严格的受控词表。
3. 对 open/free/public、schema/format、software/database 等容易混淆的概念建立专家标注集。
4. 对 unresolved ExternalReference 进行后续实体归并，但保留原 Assertion。

### 生产发布

1. Neo4j 导入账号和查询 reader 分离。
2. 公共 MCP 通过 TLS 匿名开放；REST API 根据需要用独立 token 保护。
3. 对自然语言问题、生成计划、Cypher、耗时和结果规模做审计记录，但不记录凭据。
4. 验证备份、恢复和上一版图谱回滚。

## 6. 主要风险

| 风险 | 当前控制 |
|---|---|
| 把当前 68 个数据库说成全球终值 | DSH prompt、schema note 和 metadata 都标记 lower bound |
| 把免费说成开放许可 | 保存多字段访问模型，基准查询区分许可、费用和注册 |
| 把 mapping 说成无损转换 | MappingArtifact 和 Assertion 保留 test scope 与 known loss |
| AI 生成危险查询 | GraphQueryPlan allowlist；专家入口默认关闭且拒绝写入/procedure |
| 关系端点尚未解析导致丢失 | 创建 ExternalReference 并保留全部 233 个 Assertion |
| 个人信息进入公开图谱 | 公开字段白名单、隐私测试和 seed 字符串扫描 |
| DSH 升级导致插件耦合 | 仓外 bundle、原始 ToolDefinition 接口、独立插件测试，不修改 core |
