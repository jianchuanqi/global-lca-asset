# 更新已有资产 review 数据

[English](data-update-example.md) | 中文

本例展示一条完整、可复制的贡献路径：clone 或 fork 仓库，安装 `global-lca-asset-review` Skill，只读核查已有记录，授权 Agent 修改 canonical 数据，重建并验证数据包，最后准备或创建 Pull Request。

> [!IMPORTANT]
> 本例使用仓库中现有的 openLCA 资产 `LCA-SW-0003` 来说明数据结构，但假设的 `<NEW_VERSION>`、`<RELEASE_DATE>`、`<OFFICIAL_RELEASE_URL>` 和 `<ACCESS_DATE>` 都是占位符，不是对 openLCA 当前版本的事实声明。执行真实更新前，必须让 Agent 重新访问公开的一手来源并替换全部占位符。

文中的 `EVD-0253`、`RLS-0311`、`252 → 253` 和 `310 → 311` 以编写本例时的 `2026-08-25.7` 数据包为基线。仓库更新后，应先重新检查 ID 和计数，不能直接复制。

## 1. Fork、clone 并安装 Skill

有上游仓库写权限时，可以直接 clone：

```bash
git clone https://github.com/jianchuanqi/global-lca-asset.git
cd global-lca-asset
```

外部贡献者应先在 GitHub fork，再 clone 自己可写的 fork，并把原仓库保留为 `upstream`：

```bash
GLOBAL_LCA_GITHUB_ACCOUNT=replace-with-your-github-account
git clone "https://github.com/${GLOBAL_LCA_GITHUB_ACCOUNT}/global-lca-asset.git"
cd global-lca-asset
git remote add upstream https://github.com/jianchuanqi/global-lca-asset.git
```

为 Codex 和 Claude Code 同时安装仓库内的 Skill：

```bash
python3 scripts/install-skill.py --target all
```

只安装一个客户端时使用 `--target codex` 或 `--target claude`。默认的 link 模式会让两个 Agent 直接使用 clone 中的同一份 Skill 和数据；目标目录已存在时，安装器会停止而不会覆盖。可以先用 `--dry-run` 查看目标路径。

如果新安装的 Skill 没有立即出现在客户端中，开始一个新的 Codex turn/session，或重启 Claude Code。

完整 review 和验证还需要仓库在 `package.json` 中声明的 Node.js `^22.19.0 || >=24`、pnpm `11.19.0`，以及 Python 3.11+ 和 `uv`。本例中的检查命令还使用 `jq` 和 ripgrep（`rg`）；只有提交 PR 时才需要 GitHub CLI（`gh`）及其登录状态。先确认这些命令可用，再为 fresh clone 安装锁定的依赖：

```bash
node --version
pnpm --version
python3 --version
uv --version
jq --version
rg --version
pnpm install --frozen-lockfile
uv sync --extra dev
```

如果某个命令不存在，先用所在操作系统的标准包管理方式安装，再继续。安装 Skill 本身只使用 Python 标准库，不要求先安装 Node 依赖。

## 2. 建立独立 review 分支

先确认当前分支、远程仓库和工作树。不要隐藏或覆盖已有修改：

```bash
git status --short
git branch --show-current
git remote -v
```

`git status --short` 应为空；如果不是，先辨认并保留已有工作，不要 stash、覆盖或带入本次贡献。Fork 用户从最新 `upstream/main` 建立只包含本次 review 的分支。下面用本文编写日期作为示例；真实贡献应换成实际 review 日期和主题：

```bash
git fetch upstream
git switch -c review/2026-08-26-openlca-version upstream/main
```

直接 clone 上游且有写权限的维护者，把上面的 `upstream` 换成 `origin`。

## 3. 先做只读 review

直接查看当前数据包中的资产、证据和 release：

```bash
skills/global-lca-asset-review/scripts/lca_query.py --asset LCA-SW-0003
```

在 Codex 中可以这样提问：

```text
使用 $global-lca-asset-review，只读 review LCA-SW-0003 的当前版本、发布日期、
已有 Source Evidence 和 Asset Releases。再从公开的一手来源核对当前版本，列出准确 URL、
访问日期、支持的字段、仍不确定的内容和预计受影响的表。不要修改文件。
```

在 Claude Code 中使用同样的请求，把调用写为 `/global-lca-asset-review`。

Agent 应在这一阶段确认：

- 这是同一 openLCA 软件家族的新 release，而不是新的资产家族；
- 来源无需登录、注册、付费或提交表单，并且优先使用维护者的 release page、changelog 或公开仓库；
- 来源明确支持 `<NEW_VERSION>` 和 `<RELEASE_DATE>`，而不仅是搜索摘要或第三方转述；
- 新证据是否改变格式、API、schema 或数据库兼容性等其他 claim；
- 哪些内容仍然只能保留为“未确认”。

如果只有搜索结果或不明确的页面，不应把占位符提升为已验证事实。

## 4. 明确授权本地修改

只读 review 完成后，再给出边界清楚的修改请求：

```text
使用 $global-lca-asset-review，根据刚才核验的公开来源更新 LCA-SW-0003：
更新主记录的当前版本和发布日期，新增一条 Source Evidence，把旧的 current release
改为 historical release，再新增当前 release。同步证据截止日期、package version、计数基线
和所有受影响的公开说明；重建数据包并运行完整验证。只做本地修改并显示 diff，
现在不要 commit、push 或创建 PR。
```

这个请求授权 scoped local edits 和验证，不授权 GitHub 写入。Agent 必须保留工作树中与本次 review 无关的修改。

## 5. 预期的 canonical 数据修改

Agent 应编辑源输入，而不是手工修改 SQLite、manifest、网页下载文件或 graph chunks。

### 5.1 主资产记录

在 `data/seed/inventory-v2.public.json` 的 `Master Asset Inventory` 中定位 `LCA-SW-0003`，至少审查这些字段：

```json
{
  "Asset ID": "LCA-SW-0003",
  "Current version": "<NEW_VERSION>",
  "Release/update date": "<RELEASE_DATE>",
  "Primary sources": "<EXISTING_PRIMARY_URLS>; <OFFICIAL_RELEASE_URL>",
  "Evidence excerpt": "<CONCISE_SUPPORTED_CLAIM>",
  "Access date": "<ACCESS_DATE>",
  "Unresolved questions": "<ONLY_THE_QUESTIONS_STILL_UNRESOLVED>"
}
```

不要因为确认了版本号，就顺便把没有证据支持的兼容性、schema version 或 licence claim 标为已验证。

### 5.2 新增公开证据

在 `Source Evidence` 中分配一个未使用的 ID。以本例基线为例，下一个 ID 是 `EVD-0253`：

```json
{
  "Evidence ID": "EVD-0253",
  "Asset ID": "LCA-SW-0003",
  "Source title": "<OFFICIAL_RELEASE_TITLE>",
  "Publisher/maintainer": "GreenDelta GmbH",
  "URL or file": "<OFFICIAL_RELEASE_URL>",
  "Source type": "Official release page",
  "Access date": "<ACCESS_DATE>",
  "Supported fields": "Current version; release date",
  "Evidence excerpt": "<SHORT_PARAPHRASE_OF_THE_SUPPORTED_CLAIM>",
  "Source reliability": "Primary / high",
  "Access restriction": "None for documentation",
  "Publicly accessed": "Yes",
  "Notes": "Public release claim; installation and compatibility were not independently tested."
}
```

`Evidence excerpt` 应简短转述证据支持的 claim，不要复制长段网页内容，也不要加入个人联系方式或内部 reviewer notes。

### 5.3 维护 release 链

把现有 `RLS-0157` 从 current release 改成 historical release，并把它的 successor 指向与新 release 完全一致的完整标签。新 successor claim 来自新证据，因此也要重新审查旧记录的 evidence URL 和 evidence date：

```json
{
  "Release record ID": "RLS-0157",
  "Version": "openLCA 2.6.2",
  "Lifecycle status": "Historical release",
  "Successor release": "openLCA <NEW_VERSION>",
  "Release evidence URL(s)": "<EXISTING_RELEASE_URLS>; <OFFICIAL_RELEASE_URL>",
  "Evidence as of": "<ACCESS_DATE>"
}
```

然后在 `Asset Releases` 中新增一条 release；以本例基线为例：

```json
{
  "Release record ID": "RLS-0311",
  "Asset ID": "LCA-SW-0003",
  "Asset name": "openLCA",
  "Asset type": "Software / API / tool",
  "Release line": "Software release",
  "First development / release year": "2006 development start",
  "Version": "openLCA <NEW_VERSION>",
  "Release date": "<RELEASE_DATE>",
  "Lifecycle status": "Current release",
  "Predecessor release": "openLCA 2.6.2",
  "Successor release": "None recorded after evidence cut-off",
  "Release evidence URL(s)": "<OFFICIAL_RELEASE_URL>",
  "Evidence status": "Verified public milestone; official/provider, repository or formal project source",
  "Evidence as of": "<ACCESS_DATE>",
  "Notes": "Milestone history: intervening releases may exist unless the official source enumerates every version."
}
```

先做精确 collision check。以下两条命令在 ID 未使用时应没有输出：

```bash
jq -r '.tables["Source Evidence"][] | select(."Evidence ID" == "EVD-0253") | ."Evidence ID"' \
  data/seed/inventory-v2.public.json
jq -r '.tables["Asset Releases"][] | select(."Release record ID" == "RLS-0311") | ."Release record ID"' \
  data/seed/inventory-v2.public.json
```

如果对应 release 已存在，就更新并补强那条记录，不要为了示例再创建重复 milestone。

### 5.4 只在证据支持时更新其他表

这次假设只确认软件 release，因此资产家族数、80 个 core database family、88 个 extended data-bearing asset、distribution、mapping 和 relationship 数都不应改变。

只有公开来源明确给出精确版本对时，才同步修改 `Distributions`、`Mapping Artifacts` 或 `Relationship Index`。例如“支持 JSON-LD”不能自动证明某个 `<NEW_VERSION>` 与某个 schema release 的 lossless round trip。

### 5.5 更新 package 元数据

更新：

- `data/seed/inventory-v2.public.json` 中的 `metadata.evidence_cutoff` 和 `metadata.generated_at`；
- `data/curated/review-context.json` 中的 `package_version` 和 `generated_at`。

版本应创建新的 dated package，例如 `<YYYY-MM-DD.N>`，而不是改变旧 package version 的含义。时间戳使用带时区的 ISO 8601 值。

## 6. 对账计数，而不是机械替换数字

按本例假设，将新增一条 evidence 和一条 release：

| 对象 | 修改前 | 修改后 | 原因 |
|---|---:|---:|---|
| Asset families | 214 | 214 | 同一软件家族的新 release |
| Public evidence records | 252 | 253 | 新增一条一手来源 |
| Releases or milestones | 310 | 311 | 新增一个 verified milestone |
| Core database families | 80 | 80 | 软件 release 不改变数据库家族范围 |
| Extended data-bearing assets | 88 | 88 | 不新增数据库或数据承载资产 |

至少要审查 `scripts/build-data-package.mjs` 的 `requiredCounts`、snapshot/web/smoke tests、两份 README、`data/seed/README.md` 和包含发布统计的 docs。可以先定位所有旧值：

```bash
rg -n '252|310|2026-08-25\.7' \
  README.md README.zh-CN.md data/seed/README.md docs \
  scripts/build-data-package.mjs scripts/smoke-test.mjs \
  tests packages/global-lca-asset-web/src
```

逐条判断数字的含义。当前 `310` 同时用于 releases 和 relationship assertions；本例只把 release count 改为 `311`，不能把关系数也批量替换。

## 7. 重建并通过 data-review gate

从仓库根目录运行：

```bash
pnpm data:build
pnpm data:verify
pnpm --filter @global-lca/global-lca-asset-web build
uv run --extra dev pytest
pnpm test
git diff --check
```

如果本次还修改了 Skill、helper、tests 或 workspace 代码，再运行全仓静态检查和 build：

```bash
uv run --extra dev ruff check src tests scripts/install-skill.py skills/global-lca-asset-review/scripts
pnpm typecheck
pnpm build
```

`pnpm smoke` 是依赖已运行 Neo4j/API 服务的集成测试，不是普通数据 review 的离线 gate；只有本地完整 stack 已启动时再运行。它会先检查 `/health`，服务不可用时给出 `docker compose` 启动、状态和日志命令，而不会把缺少服务当作测试通过。

然后检查验证报告、manifest 和 diff：

```bash
jq '.status, .errors, .warnings' data/package/current/validation_report.json
jq '{package_version, evidence_cutoff, table_counts, validation_status}' \
  data/package/current/manifest.json
git status --short
git diff --stat
git diff -- data/seed/inventory-v2.public.json data/curated/review-context.json
```

完成条件是：

- `validation_report.json` 的 `status` 为 `passed`；
- manifest 的 `assets=214`、`evidence=253`、`releases=311`，其他计数只发生有证据解释的变化；
- 所有生成文件都来自 `pnpm data:build`，没有手改派生输出；
- 测试和网页 production build 全部通过；
- canonical 数据和 PR 内容中没有未替换的占位符，也没有个人数据、受限来源内容或无关修改；本说明文档中明确标记的教学占位符应保留；
- PR 中仍明确写出未解决的不确定性。

如果真实变更与本例假设不同，应以实际 manifest 和证据影响为准，而不是强行得到上述数字。

## 8. Commit、预览并创建 PR

只有用户明确要求 commit 或 PR 时，才执行外部贡献步骤。先交互式选择本次 review 的 hunk，并检查 staged diff，避免把已有的无关修改带入提交：

```bash
git add --patch
git diff --cached --check
git diff --cached --stat
git commit -m "data: review openLCA release evidence"
```

把模板复制到仓库外再填写，避免未跟踪的 PR body 让 clean-tree 检查失败：

```bash
cp skills/global-lca-asset-review/assets/review-pr-body.md /tmp/global-lca-review-pr-body.md
```

PR body 应包括：

- `LCA-SW-0003`、新增 evidence ID 和 release ID；
- 改变的准确 claim、公开 URL 与 access date；
- 为什么这是同一资产家族，而不是新增资产；
- evidence/release count 的变化以及不受影响的 database counts；
- package version、evidence cutoff、验证命令与结果；
- 没有独立测试的 compatibility claim 和其他 unresolved questions。

先让 helper 只预览，不写 GitHub：

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review openLCA release evidence" \
  --body-file /tmp/global-lca-review-pr-body.md
```

只有在用户明确说“创建/提交 PR”后才加 `--submit`：

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review openLCA release evidence" \
  --body-file /tmp/global-lca-review-pr-body.md \
  --submit
```

helper 在预览和提交模式都会拒绝 `main`、detached HEAD、dirty working tree 和非 GitHub `origin`。只有 `--submit` 模式才要求已安装并登录 GitHub CLI；提交时只做非 force push 和 `gh pr create`，不会 merge PR。
