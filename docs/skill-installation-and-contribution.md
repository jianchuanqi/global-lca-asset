# Skill installation and contribution

`global-lca-asset-review` uses the cloned Git repository as the source of both the Skill and the reviewed data. The default installation creates directory links rather than detached copies. Codex and Claude Code therefore see the same Skill version, and every accepted edit appears in ordinary `git status` and `git diff` output.

## 1. Clone or fork

For read-only analysis or maintainers with push access:

```bash
git clone https://github.com/jianchuanqi/global-lca-asset.git
cd global-lca-asset
```

External contributors should fork the repository and clone their writable fork. Keep the fork as `origin` and the base repository as `upstream`:

```bash
GLOBAL_LCA_GITHUB_ACCOUNT=replace-with-your-github-account
git clone "https://github.com/${GLOBAL_LCA_GITHUB_ACCOUNT}/global-lca-asset.git"
cd global-lca-asset
git remote add upstream https://github.com/jianchuanqi/global-lca-asset.git
```

## 2. Install the Skill

Install for both agents:

```bash
python3 scripts/install-skill.py --target all
```

Or choose one:

```bash
python3 scripts/install-skill.py --target codex
python3 scripts/install-skill.py --target claude
```

The installer targets `$CODEX_HOME/skills/global-lca-asset-review` (default `~/.codex/skills/...`) and `$CLAUDE_CONFIG_DIR/skills/global-lca-asset-review` (default `~/.claude/skills/...`). It aborts rather than replacing an existing destination. Preview all paths with `--dry-run`.

Link mode is recommended for contributors. Use `--mode copy` only when links are unavailable; the copied Skill receives a marker pointing back to the clone so its query and PR helpers can still find the project.

Start a new Codex turn/session if the Skill is not immediately listed. Claude Code reloads changes inside existing Skill directories; restart it when the parent Skill directory was created after the session started.

Before running the complete contribution gate in a fresh clone, install the locked JavaScript and Python development dependencies:

```bash
pnpm install --frozen-lockfile
uv sync --extra dev
```

The repository requires Node.js `^22.19.0 || >=24`, pnpm `11.19.0`, and Python 3.11+. The worked example also uses `jq` and `rg`; GitHub CLI is needed only for `--submit`.

## 3. Review or modify data

In Codex, invoke `$global-lca-asset-review`. In Claude Code, invoke `/global-lca-asset-review`, or ask a question matching its description.

Examples:

```text
Use $global-lca-asset-review to review the current openLCA version evidence. Do not modify files.

Use $global-lca-asset-review to update LCA-SW-0003 from the attached public source, add the evidence record, rebuild the package, and show me the diff. Do not push yet.

/global-lca-asset-review add this publicly documented database as a candidate contribution, validate all affected counts, and prepare a PR.
```

A review-only request remains read-only. A correction/addition request authorizes scoped local edits and validation, but not a commit, push, PR, deployment, or merge. The Skill edits canonical seed or curated inputs, never generated SQLite/download/graph outputs directly.

For a concrete clone-to-PR walkthrough, including evidence, release-chain, package-version, and count reconciliation, see [Updating an existing reviewed asset](data-update-example.md).

New, unresolved assets first enter the Git-tracked candidate queue and do not affect published counts:

```bash
skills/global-lca-asset-review/scripts/candidate_queue.py new \
  --candidate-id CAND-2026-example-database \
  --name "Example Database" \
  --asset-type "Database / dataset" \
  --summary "Public evidence lead pending identity and scope review" \
  --url "https://example.org/database" \
  --source-title "Example database" \
  --publisher "Example organization" \
  --supported-claim "The provider describes a life-cycle database"
```

`pnpm data:verify` validates every candidate record. Promotion still requires canonical inventory edits, evidence records, count reconciliation, package rebuild, and ordinary PR review.

## 4. Validate the contribution

The full data-review gate is:

```bash
pnpm data:build
pnpm data:verify
pnpm --filter @global-lca/global-lca-asset-web build
uv run --extra dev pytest
pnpm test
git diff --check
```

Review `data/package/current/validation_report.json`, manifest and public count changes before committing. Row-count changes must be reconciled deliberately in the builder baselines and tests; count checks must not be changed merely to make CI pass.

## 5. Prepare and submit a pull request

Create a focused branch and commit only the reviewed contribution:

```bash
git switch -c review/2026-08-26-example
git add --patch
git diff --cached --check
git commit -m "data: review example asset evidence"
```

Copy the PR template outside the repository so it does not make the clean-tree check fail, then fill it in. Previewing prints the exact push and GitHub CLI command without external changes:

```bash
cp skills/global-lca-asset-review/assets/review-pr-body.md /tmp/global-lca-review-pr-body.md
```

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review example asset evidence" \
  --body-file /tmp/global-lca-review-pr-body.md
```

Only after the user explicitly asks to create the PR, rerun with `--submit`. The helper requires a clean non-`main` branch in both modes; submission additionally requires an installed and authenticated GitHub CLI, pushes without force to `origin`, and opens a PR against `jianchuanqi/global-lca-asset:main` using `gh pr create`. It never merges the PR.

The PR should identify affected asset/evidence IDs, exact public claims, sources and access dates, count or mapping impact, validation results, and unresolved expert-review questions.
