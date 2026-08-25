# Global LCA Asset Knowledge Graph

这是一个已经可以运行的、证据可追溯的全球 LCA 资产知识图谱。它把数据库、数据集、软件、schema、格式、名录、机构、国家、行业、版本、分发包及 mapping 项目组织成关系网络，并通过匿名只读 MCP 向 Codex、Claude Code、OpenClaw、腾讯 WorkBuddy、TRAE 等客户端开放。现有 DeepSeek Harness 插件继续作为示范客户端。

首个公开数据基线截止到 2026-08-22，包括 199 个资产家族、205 条公开证据、290 个版本或里程碑、128 个分发包、18 个 mapping artifact 和 233 条关系断言。导入后形成 1,663 个节点和 2,282 条关系。这个数量是公开证据下限，不表示已经证明“全球只有这些资产”。

## 已实现的能力

- 按名称、资产类型、国家、行业和开放状态检索。
- 通过 `/mcp` 提供无需 token 的 Streamable HTTP MCP；服务端无会话状态，适合 Vercel。
- MCP 只暴露 10 个有规模限制的公共读工具，不提供任意 Cypher、写入或管理工具。
- 查看资产详情、一跳或多跳关系、最短路径、证据和版本时间线。
- 用经过校验的结构化查询计划生成参数化 Cypher；执行前先 `EXPLAIN`。
- 为专家提供可选的直接只读 Cypher；默认关闭并拒绝写入、procedure 和多语句。
- 通过 DeepSeek Harness 插件进行中文或英文自然语言查询，模型不接触 Neo4j 凭据。
- 查询结果可直接展开为交互式关系图，并可切换数据表和证据视图。
- 图中支持搜索、类型筛选、四种布局、节点/关系详情、全屏和 PNG、SVG、JSON、Cypher 导出。
- 提供独立的 Asset Atlas：把概览、资产检索与比较、互操作关系、版本时间线、审阅问题和数据下载组织在一个研究界面中。
- 从同一公开种子生成版本化 CSV、JSONL 和 SQLite 数据包，供研究人员、AI 和临时分析直接使用。
- 仓库内置项目 Skill，用统一口径查询数据包、解释证据、更新分析并即时生成新的表格或 HTML 视图。
- 区分 Asset、Release、Distribution、MappingArtifact、Assertion 和 Evidence。
- 公开种子中不包含联系人字段、姓名/邮箱映射和内部审阅备注。

## 一键运行

需要 Docker Desktop：

```bash
docker compose up -d --build
```

启动后：

- API 和交互式接口文档：<http://127.0.0.1:8000/docs>
- 匿名只读 MCP：<http://127.0.0.1:8000/mcp>
- Neo4j Browser：<http://127.0.0.1:7474>
- 健康检查：<http://127.0.0.1:8000/health>

`seed` 是一次性导入容器；正常结束码为 0。重复导入使用稳定 UID 和 `MERGE`，不会产生重复节点。

运行全部本地检查：

```bash
uv sync --extra dev
uv run pytest
uv run ruff check src tests
pnpm install
pnpm data:build
pnpm data:verify
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

只查看完整 review 界面：

```bash
pnpm data:build
pnpm atlas:dev
```

浏览器打开 <http://127.0.0.1:5173/>。这里的 Atlas 是全局研究入口；AI 查询结果中的局部关系图仍由原有图谱伴随界面提供。

## 接入 DeepSeek Harness

本仓库只提供仓外插件，不修改 DeepSeek Harness。当前工作区的本地加载方式：

```bash
pnpm build
GLOBAL_LCA_API_URL=http://127.0.0.1:8000 pnpm dsh:web
```

这个命令在本仓库的隔离 profile 中运行已经附加的 DSH checkout；不会写入 DSH 源码。

也可以打包为可安装 bundle：

```bash
pnpm pack:plugin
dsh plugin --profile global-lca add /absolute/path/to/global-lca-dsh-lca-plugin-0.2.0.tgz
```

查询 bundle 已内置图谱结果界面，所以只需安装一个包。插件默认注册 10 个公开只读工具。只有同时设置 API 的 `LCA_ENABLE_EXPERT_CYPHER=true` 和插件的 `GLOBAL_LCA_ENABLE_CYPHER=true`，才会出现直接 Cypher 工具；生产环境还应使用数据库 reader 身份。

## 发布公共 MCP

Vercel 只部署 FastAPI/MCP 查询层，Neo4j 应放在 AuraDB 或其他可安全访问的托管环境中。仓库根目录的 `app.py` 是 Vercel ASGI 入口，`vercel.json` 已启用 Fluid compute 和 30 秒请求上限。

上线所需环境变量、匿名访问边界和协议检查见[《Vercel 部署》](docs/vercel-deployment.md)。正式 MCP 地址为：

```text
https://<domain>/mcp
```

REST API 可以通过 `LCA_API_TOKEN` 单独保护；这个设置不会要求公共 MCP 登录。

## 主要目录

```text
src/global_lca_asset/            图谱转换、Neo4j、API、MCP、查询编译器和 CLI
packages/dsh-lca-plugin/         可独立安装的 DeepSeek Harness 插件
packages/dsh-lca-graph-ui/       查询结果的交互式图谱伴随界面
packages/asset-atlas/            完整 review 的独立交互界面
data/seed/                       经过隐私筛选的公开数据基线
data/curated/                    六个问题、审阅议题和数据定义
data/package/current/            同源 CSV、JSONL、SQLite 数据包
graph/queries/                   六个 review 问题的基准 Cypher
config/                          DSH 本地只读加载配置
skills/global-lca-asset-review/  项目查询、分析、更新和可视化 Skill
tests/                           数据、API 和安全查询测试
docs/                            架构、数据模型、使用和维护说明
```

## 文档

- [系统架构](docs/architecture.md)
- [图谱数据模型](docs/graph-model.md)
- [DeepSeek Harness 使用](docs/deepseek-harness.md)
- [图谱结果界面设计](docs/graph-visualization.md)
- [Asset Atlas 与数据包](packages/asset-atlas/README.md)
- [查询指南](docs/query-guide.md)
- [Vercel 部署](docs/vercel-deployment.md)
- [开发与验收状态](docs/development-plan.md)
