# 在 Vercel 发布 Global LCA Asset

本仓库包含两个部署边界，建议从同一个 Git 仓库建立两个 Vercel Project：

1. 静态数据集界面：`packages/global-lca-asset-web`
2. 公共只读 MCP/API：仓库根目录

## 静态数据集界面

这一部分已经可以直接部署，不需要数据库或环境变量。新建 Vercel Project 时设置：

```text
Root Directory: packages/global-lca-asset-web
Framework Preset: Vite
Build Command: pnpm build
Output Directory: dist
```

包内的 `vercel.json` 已保存相同配置。`src/data/dataset.json` 和 `public/downloads/` 都由公开种子生成并随 Git 版本发布；Vite 把前者输出为带内容 hash 的独立 JSON asset，页面启动后加载并校验，避免把约 2 MB 数据编译进主 JavaScript chunk。因此这个目录仍是自包含的，五个查询视图在浏览器本地筛选，不依赖后端。

部署前应运行：

```bash
pnpm data:build
pnpm data:verify
pnpm --filter @global-lca/global-lca-asset-web build
```

确认生成数据、下载文件和界面改动已经提交并推送到远程 Git 后，再让 Vercel 从该提交构建。

## 公共只读 MCP/API

Vercel 只运行 FastAPI/MCP 查询服务，不运行 Neo4j。Neo4j 必须部署在 AuraDB 或其他能够从
Vercel 安全访问的托管环境中，并使用加密连接。

## 公共边界

- 公共入口：`https://<domain>/mcp`
- 访问方式：匿名、无 token、只读、无会话状态
- MCP 不提供任意 Cypher、写入、导入、procedure 或数据库管理工具
- Neo4j 的 Bolt 地址和凭据只保存在 Vercel 环境变量中
- MCP 使用专用 Neo4j reader 身份，只连接经过隐私筛选的公共数据库
- REST API 可通过 `LCA_API_TOKEN` 单独保护，不影响匿名 MCP

## Vercel 环境变量

必须配置：

```text
LCA_GRAPH_BACKEND=neo4j
LCA_NEO4J_URI=neo4j+s://<public-neo4j-host>
LCA_NEO4J_USER=<reader-user>
LCA_NEO4J_PASSWORD=<reader-password>
LCA_NEO4J_DATABASE=neo4j
LCA_ENABLE_EXPERT_CYPHER=false
LCA_MCP_TRUST_PROXY=true
```

`LCA_MCP_TRUST_PROXY=true` 只适用于 Vercel 这种已经控制 `Host` 请求头的反向代理环境。其他
部署方式应保持为 `false`，并通过 `LCA_MCP_ALLOWED_HOSTS` 明确列出正式域名。

推荐配置：

```text
LCA_NEO4J_CONNECTION_TIMEOUT_SECONDS=5
LCA_NEO4J_QUERY_TIMEOUT_SECONDS=10
LCA_NEO4J_MAX_CONNECTION_POOL_SIZE=10
LCA_MCP_MAX_REQUEST_BODY_BYTES=65536
LCA_API_TOKEN=<optional-secret-for-rest-api>
LCA_CORS_ORIGINS=https://<approved-browser-client>
```

如果没有浏览器客户端，可以保留默认 CORS 设置。Codex、Claude Code、OpenClaw、WorkBuddy
和 TRAE 等原生 MCP 客户端不依赖浏览器 CORS。

## 部署步骤

1. 在外部 Neo4j 中建立公共数据库和专用只读用户。
2. 用 `global-lca import` 在受控环境导入公开快照；不要在 Vercel 请求中运行导入。
3. 将本仓库连接到 Vercel，并把上述变量分别写入 Preview 和 Production 环境。
4. 选择与 Neo4j 尽量接近的 Vercel Function region。
5. 部署后先检查 `/health`，再连接 `/mcp`。

Vercel 会自动识别仓库根目录的 `app.py`，并把整个 FastAPI 应用作为一个 Python Function
运行。`vercel.json` 开启 Fluid compute，给请求设置 30 秒上限，并排除与服务端运行无关的
前端插件、测试和文档文件。

## 协议检查

下面的匿名请求应返回 `200`，并且不返回 `Mcp-Session-Id`：

```bash
curl -i https://<domain>/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"deployment-check","version":"1"}}}'
```

初始化响应中的服务名应为 `global-lca-assets`。工具清单只能包含以下公共读工具：

- `search_assets`
- `get_asset`
- `expand_graph`
- `find_path`
- `compare_assets`
- `get_timeline`
- `get_evidence`
- `get_inventory_statistics`
- `get_graph_schema`
- `get_service_status`

## 上线前检查

- 确认公共数据库不含 `Person_Contact`、邮箱、内部备注或未公开附件地址。
- 确认 Neo4j 的 Bolt/Browser 没有因为本项目而直接暴露给 MCP 用户。
- 确认 Vercel 中没有启用 `LCA_ENABLE_EXPERT_CYPHER`。
- 在 Vercel Firewall 中配置按 IP 的频率限制；应用内已经限制返回数量、图谱深度、路径长度、
  请求体积和 Neo4j 查询时间，但无状态 Function 不适合保存全局 IP 计数。
- 分别测试 Production 和 Preview；两者使用不同数据库时，应使用不同环境变量。
