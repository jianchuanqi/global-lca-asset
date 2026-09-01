# Global LCA Asset

**English** | [简体中文](README.zh-CN.md)

Global LCA Asset is a versioned public-evidence dataset and access system for life cycle assessment resources worldwide. It brings databases, datasets, software, schemas, formats, nomenclatures, organizations, releases, distributions, and mapping projects into one reviewed structure.

The dataset is the shared foundation. The website, downloadable files, knowledge graph, MCP, client plugin, and project Skill are complementary ways to explore and use the same evidence—not separate inventories.

## Current dataset

Release `2026-09-01.2` has an evidence cut-off of 1 September 2026.

| Published object | Count |
|---|---:|
| Asset families | 301 |
| Core database families | 80 |
| Extended data-bearing assets | 88 |
| PCF/LCA software products, APIs, models, and workflows | 130 |
| Qualifying PCF/LCA market records | 97 |
| Software candidate appearances reviewed | 104 |
| Evidence-linked software actor-role assertions | 179 |
| Unresolved software role labels retained for review | 39 |
| Public evidence records | 339 |
| Releases or milestones | 310 |
| Distributions | 170 |
| Mapping artifacts | 25 |
| Relationship assertions | 397 |

All counts are reproducible lower bounds under the published inclusion rules and evidence cut-off; they are not claims of a final worldwide total. The software market review distinguishes product type, aligned primary function, multi-valued capabilities, and standard/network associations. “PACT” refers to the WBCSD Partnership for Carbon Transparency and is retained as interoperability evidence, not as a software category or quality rating.

## Project architecture

```mermaid
flowchart LR
    A[Public sources and review inputs] --> B[Privacy-screened public seed]
    B --> C[Versioned package builder]
    C --> D[CSV / JSONL / SQLite]
    D --> E[Dataset website]
    D --> F[Project Skill and direct AI analysis]
    B --> G[Deterministic graph builder]
    G --> H[(Neo4j)]
    H --> I[FastAPI read service]
    I --> J[Anonymous read-only MCP]
    J --> K[MCP-capable agents]
    I --> L[DeepSeek Harness plugin]
    L --> M[Interactive query-result graph]
```

| Component | Primary purpose | Main location | Neo4j required? |
|---|---|---|---:|
| Dataset package | Reproducible research data for spreadsheets, AI, and exact queries | `data/package/current/` | No |
| Dataset website | Public exploration, comparison, sources, and downloads | `packages/global-lca-asset-web/` | No |
| Knowledge graph | Relationship, neighborhood, path, evidence, and timeline queries | `src/global_lca_asset/` | Yes |
| REST API and MCP | Safe machine access to the graph | `/api/*` and `/mcp` | Yes |
| DeepSeek Harness plugin | Natural-language graph tools and interactive result cards | `packages/dsh-lca-plugin/` | Through the API |
| Project Skill | Consistent local analysis of CSV, JSONL, and SQLite | `skills/global-lca-asset-review/` | No |

## 1. Public dataset and data package

The privacy-screened public seed at `data/seed/inventory-v2.public.json` plus documented curated review layers are the canonical inputs. A deterministic build creates the versioned package in `data/package/current/`, including:

- CSV for spreadsheet review and exchange;
- JSONL for direct AI-assisted analysis;
- SQLite for precise relational queries;
- the manifest, validation report, summary, controlled vocabularies, and analysis rules;
- alignment tables for schema/profile synonyms and mapping endpoints;
- software scope, evidence-linked software actor roles, unresolved role gaps, and software candidate-review tables.

The package distinguishes Asset, Release, Distribution, MappingArtifact, Assertion, Evidence, Organization, and their relationships. Original labels are preserved alongside aligned values where normalization is applied.

Questionnaire contacts, email mappings, private personal data, and internal reviewer notes are excluded from the public seed and generated package. A publicly credited professional individual may be retained only when an official source explicitly attributes a software role.

## 2. Dataset website

The standalone Global LCA Asset website publishes the dataset for researchers. It provides:

- dataset-level counts and asset-category coverage;
- focused views for database scope, access conditions, formats, PCF/LCA software and company roles, providers and sectors, and mappings;
- cross-asset search, source links, comparison, and data downloads;
- an on-demand relationship view that loads a lightweight asset index and selected one-hop neighborhoods.

The website reads generated static files and does not require Neo4j. It can therefore be built and deployed as an independent Vercel project. The on-demand website graph is a public exploration view; it is separate from the server-side Neo4j query service.

## 3. Knowledge graph

The graph builder converts the public seed into stable graph objects such as Asset, Release, Distribution, MappingArtifact, Assertion, Evidence, and ExternalReference. Stable UIDs and idempotent `MERGE` operations allow the same release to be imported repeatedly without duplication.

Neo4j supports relationship expansion, multi-hop paths, evidence tracing, comparisons, and timelines. A documented compatibility or mapping relationship must still be interpreted with its direction, version pair, test status, evidence, and known conversion losses; a relationship does not automatically imply a lossless conversion.

Two visual graph experiences serve different purposes:

- the dataset website progressively loads selected public one-hop neighborhoods without Neo4j;
- the DeepSeek Harness companion displays the evidence subgraph returned by an individual query, with Graph, Data, and Evidence views.

## 4. REST API and public MCP

FastAPI provides the controlled read/query layer over Neo4j. It supports asset search and detail, neighborhoods, shortest paths, comparisons, timelines, evidence, statistics, schema inspection, and validated structured query plans.

The public `/mcp` endpoint uses stateless Streamable HTTP and requires no token. It exposes 10 size-limited public read tools for MCP-capable clients such as Codex, Claude Code, OpenClaw, Tencent WorkBuddy, and TRAE. It does not expose writes, imports, database administration, or arbitrary Cypher.

An expert read-only Cypher endpoint is available but disabled by default. When enabled, it rejects writes, procedures, and multiple statements, runs `EXPLAIN` first, and should use a Neo4j reader identity in production.

See the [query guide](docs/query-guide.md) for tool selection, REST examples, and research caveats.

## 5. DeepSeek Harness plugin

The out-of-tree DeepSeek Harness plugin is a reference client for natural-language graph analysis. It translates model tool calls into requests to the Global LCA Asset API without exposing Neo4j credentials to the model.

The installable bundle combines:

- `packages/dsh-lca-plugin/` for tools, domain guidance, and API calls;
- `packages/dsh-lca-graph-ui/` for interactive Graph, Data, and Evidence result views.

DeepSeek Harness remains an independent upstream project; this repository does not modify, copy, or fork it. Other AI clients can use the public MCP directly and do not need this plugin.

## 6. Project Skill

The repository includes the `global-lca-asset-review` Skill for querying and interpreting the versioned evidence package directly. It is intended for questions about databases, access conditions, formats, schemas, software compatibility, organizations, sectors, releases, mappings, and evidence quality. A change request authorizes scoped local edits, package regeneration, validation, and a PR-ready contribution. Commit, push, and pull-request creation remain separate actions; the Skill performs them only when the user explicitly requests them.

The Skill uses the same CSV, JSONL, and SQLite release as the website. It can answer ad hoc questions or generate new tables and HTML views without requiring a running graph database.

Clone the repository, then install the repository-owned Skill for Codex, Claude Code, or both. Link mode is the default so both agents edit this same Git working tree:

```bash
git clone https://github.com/jianchuanqi/global-lca-asset.git
cd global-lca-asset
python3 scripts/install-skill.py --target all
```

Use `--target codex` or `--target claude` to install for one client. `--mode copy` is available when directory links are not supported. Existing destination Skills are never overwritten. See [Skill installation and contribution](docs/skill-installation-and-contribution.md) for fork, review, validation, and pull-request workflows, and [Updating an existing reviewed asset](docs/data-update-example.md) for a complete worked example.

## Choosing an access route

| Need | Recommended route |
|---|---|
| Browse and filter the published dataset | Dataset website |
| Download or cite a versioned release | CSV, JSONL, SQLite, and manifest |
| Ask an AI to analyze the complete small dataset directly | Project Skill with JSONL or SQLite |
| Review, correct, or add public-evidence records | Project Skill in the cloned Git repository |
| Validate a contribution and open a pull request | Project Skill plus Git and GitHub CLI |
| Explore multi-hop relationships or shortest paths | Public MCP or REST API |
| Use natural-language graph tools in DeepSeek Harness | DSH plugin bundle |
| Reproduce or extend the graph service | Neo4j, FastAPI, and the graph builder |

## Run locally

### Dataset website only

```bash
pnpm install
pnpm data:build
pnpm web:dev
```

Open <http://127.0.0.1:5173/>.

### Complete graph, API, and MCP stack

Docker Desktop is required:

```bash
docker compose up -d --build
```

After startup:

- API and interactive documentation: <http://127.0.0.1:8000/docs>
- Anonymous read-only MCP: <http://127.0.0.1:8000/mcp>
- Neo4j Browser: <http://127.0.0.1:7474>
- Health check: <http://127.0.0.1:8000/health>

`seed` is a one-time import container; exit code 0 is expected.

### DeepSeek Harness reference client

```bash
pnpm build
GLOBAL_LCA_API_URL=http://127.0.0.1:8000 pnpm dsh:web
```

To build an installable bundle:

```bash
pnpm pack:plugin
dsh plugin --profile global-lca add /absolute/path/to/global-lca-dsh-lca-plugin-0.2.0.tgz
```

## Deployment

The two public deployment targets are independent:

- the static dataset website can be deployed directly from `packages/global-lca-asset-web/` as a standalone Vercel project;
- the repository-root `app.py` deploys the stateless FastAPI/MCP layer to Vercel, while Neo4j runs in AuraDB or another securely accessible managed environment.

Configuration, access boundaries, and production checks are documented in [Vercel deployment](docs/vercel-deployment.md).

## Verification

The offline contribution gate does not require Neo4j or Docker:

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
```

`pnpm smoke` is the live Neo4j → API → client-plugin integration gate. Start the stack first; `seed` should finish with exit code 0 and both `neo4j` and `api` should become healthy:

```bash
docker compose up -d --build
docker compose ps -a
pnpm smoke
```

The smoke command now performs a fast `/health` preflight and prints startup/log commands when the API is unavailable. For a protected remote deployment, set `GLOBAL_LCA_API_URL` and `GLOBAL_LCA_API_TOKEN` before running it.

## Repository map

```text
data/seed/                        Canonical privacy-screened public seed
data/curated/                     Review context, alignment, and data definitions
data/package/current/             Versioned CSV, JSONL, SQLite, and validation files
packages/global-lca-asset-web/    Standalone dataset publication website
src/global_lca_asset/             Graph builder, Neo4j repository, API, MCP, and CLI
packages/dsh-lca-plugin/          DeepSeek Harness query plugin
packages/dsh-lca-graph-ui/        Interactive graph companion for query results
skills/global-lca-asset-review/   Project query, analysis, update, and visualization Skill
graph/queries/                    Reference queries for the six review questions
config/                           Local read-only client configuration
tests/                            Data, API, and secure-query tests
docs/                             Architecture, data model, use, and maintenance guides
```

## Project ownership and feedback

- Project owner: UNEP Global LCA Platform Working Group 2
- Jianchuan Qi, Tsinghua University
- Natasha Das, AECOM
- António Martins, Portuguese Catholic University
- Comment and feedback: [submit corrections, missing assets, source updates, comments, or suggestions](https://uzmhiopsjv.feishu.cn/share/base/form/shrcnLwAU43hwAwb5bsDNMoaohc)
- Git project: [github.com/jianchuanqi/global-lca-asset](https://github.com/jianchuanqi/global-lca-asset)

## Documentation

- [System architecture](docs/architecture.md)
- [Graph data model](docs/graph-model.md)
- [Query guide](docs/query-guide.md)
- [DeepSeek Harness usage](docs/deepseek-harness.md)
- [Graph-results interface design](docs/graph-visualization.md)
- [Dataset website](packages/global-lca-asset-web/README.md)
- [Vercel deployment](docs/vercel-deployment.md)
- [Development and acceptance status](docs/development-plan.md)
