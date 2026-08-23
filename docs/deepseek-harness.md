# DeepSeek Harness 使用

## 1. 关系

`global-lca-asset` 是 DSH 的仓外业务插件。DSH 提供模型、会话、对话界面和插件运行环境；本项目提供 LCA 图谱、查询 API、工具和领域提示。两者通过 HTTP API 相连，DSH 仓库不需要任何代码修改。

## 2. 先启动图谱

```bash
cd /Users/jianchuan/Dev/global-lca-asset
docker compose up -d --build
curl http://127.0.0.1:8000/health
```

第一次启动会运行一次 `seed` 导入。查看状态：

```bash
docker compose ps -a
docker compose logs seed
```

`seed` 显示 `Exited (0)` 是预期状态；API 和 Neo4j 应保持 healthy。

## 3. 本地 overlay

先构建插件：

```bash
cd /Users/jianchuan/Dev/global-lca-asset
pnpm install
pnpm build
```

从本仓库启动已经附加的 DSH checkout：

```bash
GLOBAL_LCA_API_URL=http://127.0.0.1:8000 pnpm dsh:web
```

启动脚本使用本仓库内的隔离 profile，把查询工具和图谱界面同时暴露给 DSH。这个过程不写入 DSH 源码。

## 4. 可安装 bundle

打包：

```bash
cd /Users/jianchuan/Dev/global-lca-asset
pnpm pack:plugin
```

将生成的 `.tgz` 安装到 DSH profile：

```bash
dsh plugin --profile global-lca add \
  /absolute/path/to/global-lca-dsh-lca-plugin-0.2.0.tgz
```

图谱界面已经编译进查询 bundle 的 browser client，因此使用者只需安装这一个文件。包中的 `cordis.patch.yml` 注册查询组件，DSH 会从同一包发现图谱界面；默认 API 地址为 `http://127.0.0.1:8000`。远程部署只需设置：

```bash
export GLOBAL_LCA_API_URL=https://lca-graph.example.org
export GLOBAL_LCA_API_TOKEN=...
```

API token 只存在于插件配置和 HTTP header 中，不会成为模型可见的工具参数。

## 5. 提问示例

- 世界范围内当前公开证据确认了多少个 LCA database family？请说明口径和截止日期。
- 哪些数据库有明确开放许可，在哪里获取？不要把免费访问等同于开放许可。
- ecoinvent 使用什么格式？哪些软件或 repository 与它有记录的关系？给出关系路径和证据。
- 比较 ILCD、ecoSpold2 和 openLCA JSON-LD 的开发机构、版本时间线及相关软件。
- 当前图谱记录了哪些 schema 或 nomenclature mapping？哪些只是 alignment claim，哪些有公开测试？
- 找出 `LCA-DB-0001` 和 `LCA-FMT-0001` 之间的最短路径。

模型通常先用 `lca_search_assets` 解析 ID，再用详情、路径、timeline、mapping 和 evidence 工具形成回答。复杂问题会先调用 `lca_schema`，再提交 `lca_query_graph`。

## 6. 图谱结果

以下工具返回关系子图时，会出现可展开的专用结果卡：

- `lca_get_asset`
- `lca_find_relationships`
- `lca_find_path`
- `lca_query_graph`
- `lca_run_readonly_cypher`（仅在开启时）

结果卡提供 Graph、Data、Evidence 三种视图。研究人员可以按节点名称或类型筛选、切换布局、查看任一节点或关系的属性和来源，并导出 PNG、SVG、JSON 或本次查询的 Cypher。它只展示当前查询的证据子图；如需扩大范围，继续用自然语言提出邻域或路径问题即可。

## 7. 专家 Cypher

默认没有直接 Cypher 工具。开启需要两侧同时设置：

```bash
# API
LCA_ENABLE_EXPERT_CYPHER=true

# DSH plugin
GLOBAL_LCA_ENABLE_CYPHER=true
```

生产环境还必须让 API 使用 Neo4j reader 用户。直接 Cypher 入口适合专家复核，不应成为普通自然语言查询的默认路径。

## 8. 升级 DSH

DSH 仍处于 developer preview，升级后至少运行：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

插件只依赖 Cordis `Context` 和 DSH 的公开原始 ToolDefinition 字段，避免把未发布的 DSH 内部 package 打包进业务插件。若 DSH 更改 ToolDefinition 或 systemPrompt 扩展点，应在本仓库适配并保持 DSH checkout 不变。
