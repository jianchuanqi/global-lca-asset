# Updating Existing Asset Review Data

English | [Chinese](data-update-example.zh-CN.md)

This example presents a complete, reproducible contribution path: clone or fork the repository, install the `global-lca-asset-review` Skill, review an existing record without modifying it, authorize the Agent to edit canonical data, rebuild and verify the data package, and finally prepare or create a Pull Request.

> [!IMPORTANT]
> This example uses the existing openLCA asset `LCA-SW-0003` in the repository to illustrate the data structure. The hypothetical values `<NEW_VERSION>`, `<RELEASE_DATE>`, `<OFFICIAL_RELEASE_URL>`, and `<ACCESS_DATE>` are placeholders, not factual claims about the current openLCA version. Before performing a real update, the Agent must revisit public primary sources and replace every placeholder.

The values `EVD-0253`, `RLS-0311`, `252 → 253`, and `310 → 311` use the `2026-08-25.7` data package that existed when this example was written as their baseline. After the repository changes, check the IDs and counts again before using them; do not copy them directly.

## 1. Fork, clone, and install the Skill

If you have write access to the upstream repository, you can clone it directly:

```bash
git clone https://github.com/jianchuanqi/global-lca-asset.git
cd global-lca-asset
```

External contributors should first fork the repository on GitHub, then clone their writable fork and retain the original repository as `upstream`:

```bash
GLOBAL_LCA_GITHUB_ACCOUNT=replace-with-your-github-account
git clone "https://github.com/${GLOBAL_LCA_GITHUB_ACCOUNT}/global-lca-asset.git"
cd global-lca-asset
git remote add upstream https://github.com/jianchuanqi/global-lca-asset.git
```

Install the repository's Skill for both Codex and Claude Code:

```bash
python3 scripts/install-skill.py --target all
```

Use `--target codex` or `--target claude` to install it for only one client. The default link mode lets both Agents use the same Skill and data directly from the clone. If a target directory already exists, the installer stops without overwriting it. You can use `--dry-run` first to inspect the target paths.

If the newly installed Skill does not appear immediately in the client, start a new Codex turn/session or restart Claude Code.

A complete review and validation also require the Node.js version declared in `package.json` (`^22.19.0 || >=24`), pnpm `11.19.0`, Python 3.11+, and `uv`. The inspection commands in this example also use `jq` and ripgrep (`rg`). GitHub CLI (`gh`) and an authenticated session are required only when submitting a PR. Confirm that these commands are available, then install the locked dependencies in a fresh clone:

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

If a command is unavailable, install it using the operating system's standard package-management method before continuing. Installing the Skill itself uses only the Python standard library and does not require Node dependencies to be installed first.

## 2. Create a dedicated review branch

First inspect the current branch, remotes, and working tree. Do not hide or overwrite existing changes:

```bash
git status --short
git branch --show-current
git remote -v
```

`git status --short` should produce no output. If it does, identify and preserve the existing work first; do not stash or overwrite it, and do not include it in this contribution. Fork users should create a branch containing only this review from the latest `upstream/main`. The following command uses the date on which this document was written as an example; for a real contribution, replace it with the actual review date and subject:

```bash
git fetch upstream
git switch -c review/2026-08-26-openlca-version upstream/main
```

Maintainers who cloned upstream directly and have write access should replace `upstream` above with `origin`.

## 3. Begin with a read-only review

Inspect the asset, evidence, and releases in the current data package:

```bash
skills/global-lca-asset-review/scripts/lca_query.py --asset LCA-SW-0003
```

In Codex, you can use this request:

```text
Use $global-lca-asset-review to perform a read-only review of the current version,
release date, existing Source Evidence, and Asset Releases for LCA-SW-0003. Then
verify the current version against public primary sources. List the exact URLs,
access dates, supported fields, remaining uncertainties, and tables expected to
be affected. Do not modify any files.
```

Use the same request in Claude Code, but write the invocation as `/global-lca-asset-review`.

At this stage, the Agent should confirm that:

- this is a new release in the same openLCA software family, not a new asset family;
- the source requires no login, registration, payment, or form submission, and priority is given to the maintainer's release page, changelog, or public repository;
- the source explicitly supports `<NEW_VERSION>` and `<RELEASE_DATE>`, rather than merely appearing in a search snippet or third-party account;
- the new evidence changes any other claim about formats, APIs, schemas, database compatibility, or similar matters;
- any information that remains uncertain is kept as “unconfirmed.”

If only search results or ambiguous pages are available, the placeholders must not be promoted to verified facts.

## 4. Explicitly authorize local edits

After the read-only review is complete, give a clearly bounded editing request:

```text
Use $global-lca-asset-review to update LCA-SW-0003 from the public sources just
verified: update the current version and release date in the master record, add
one Source Evidence record, change the previous current release to a historical
release, and add the new current release. Synchronize the evidence cutoff date,
package version, count baselines, and every affected public description; rebuild
the data package and run the complete validation suite. Make local changes only
and show the diff. Do not commit, push, or create a PR yet.
```

This request authorizes scoped local edits and validation. It does not authorize writes to GitHub. The Agent must preserve any working-tree changes unrelated to this review.

## 5. Expected canonical data changes

The Agent should edit source inputs, not manually edit SQLite, the manifest, web download files, or graph chunks.

### 5.1 Master asset record

Locate `LCA-SW-0003` in `Master Asset Inventory` within `data/seed/inventory-v2.public.json`, and review at least these fields:

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

Confirming the version number does not justify marking unsupported compatibility, schema version, or licence claims as verified.

### 5.2 Add public evidence

Allocate an unused ID in `Source Evidence`. With the baseline used by this example, the next ID is `EVD-0253`:

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

`Evidence excerpt` should briefly paraphrase the claim supported by the evidence. Do not copy long passages from a web page or add personal contact details or internal reviewer notes.

### 5.3 Maintain the release chain

Change the existing `RLS-0157` from the current release to a historical release, and point its successor to the full label that exactly matches the new release. Because the new successor claim comes from the new evidence, also review the old record's evidence URL and evidence date:

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

Then add a release to `Asset Releases`; with the baseline used by this example:

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

Perform an exact collision check first. These two commands should produce no output when the IDs are unused:

```bash
jq -r '.tables["Source Evidence"][] | select(."Evidence ID" == "EVD-0253") | ."Evidence ID"' \
  data/seed/inventory-v2.public.json
jq -r '.tables["Asset Releases"][] | select(."Release record ID" == "RLS-0311") | ."Release record ID"' \
  data/seed/inventory-v2.public.json
```

If the corresponding release already exists, update and strengthen that record instead of creating a duplicate milestone for the sake of following this example.

### 5.4 Update other tables only when supported by evidence

This example assumes that only the software release is confirmed, so the number of asset families, 80 core database families, 88 extended data-bearing assets, distributions, mappings, and relationships should remain unchanged.

Modify `Distributions`, `Mapping Artifacts`, or `Relationship Index` only when a public source explicitly provides an exact version pairing. For example, “supports JSON-LD” does not automatically prove a lossless round trip between a particular `<NEW_VERSION>` and a particular schema release.

### 5.5 Update package metadata

Update:

- `metadata.evidence_cutoff` and `metadata.generated_at` in `data/seed/inventory-v2.public.json`;
- `package_version` and `generated_at` in `data/curated/review-context.json`.

The version should create a new dated package, such as `<YYYY-MM-DD.N>`, rather than changing the meaning of an old package version. Use ISO 8601 timestamps with a time-zone offset.

## 6. Reconcile counts instead of mechanically replacing numbers

This example assumes that one evidence record and one release are added:

| Object | Before | After | Reason |
|---|---:|---:|---|
| Asset families | 214 | 214 | New release in the same software family |
| Public evidence records | 252 | 253 | One new primary source |
| Releases or milestones | 310 | 311 | One new verified milestone |
| Core database families | 80 | 80 | A software release does not change the scope of database families |
| Extended data-bearing assets | 88 | 88 | No new database or data-bearing asset |

At a minimum, review `requiredCounts` in `scripts/build-data-package.mjs`, snapshot/web/smoke tests, both README files, `data/seed/README.md`, and any documentation containing release statistics. First locate every old value:

```bash
rg -n '252|310|2026-08-25\.7' \
  README.md README.zh-CN.md data/seed/README.md docs \
  scripts/build-data-package.mjs scripts/smoke-test.mjs \
  tests packages/global-lca-asset-web/src
```

Evaluate what each number means. The current value `310` is used for both releases and relationship assertions. In this example, only the release count changes to `311`; the relationship count must not be replaced in bulk.

## 7. Rebuild and pass the data-review gate

Run these commands from the repository root:

```bash
pnpm data:build
pnpm data:verify
pnpm --filter @global-lca/global-lca-asset-web build
uv run --extra dev pytest
pnpm test
git diff --check
```

If this update also changes the Skill, a helper, tests, or workspace code, run the repository-wide static checks and build as well:

```bash
uv run --extra dev ruff check src tests scripts/install-skill.py skills/global-lca-asset-review/scripts
pnpm typecheck
pnpm build
```

`pnpm smoke` is an integration test that requires running Neo4j/API services, not an offline gate for a routine data review. Run it only when the complete local stack is running. It checks `/health` first and, when the services are unavailable, reports `docker compose` commands for startup, status inspection, and logs; it does not treat missing services as a passing test.

Then inspect the validation report, manifest, and diff:

```bash
jq '.status, .errors, .warnings' data/package/current/validation_report.json
jq '{package_version, evidence_cutoff, table_counts, validation_status}' \
  data/package/current/manifest.json
git status --short
git diff --stat
git diff -- data/seed/inventory-v2.public.json data/curated/review-context.json
```

The completion criteria are:

- `validation_report.json` has a `status` of `passed`;
- the manifest reports `assets=214`, `evidence=253`, and `releases=311`, while other counts change only when evidence explains the change;
- every generated file comes from `pnpm data:build`; no derived output was manually edited;
- all tests and the web production build pass;
- the canonical data and PR content contain no unreplaced placeholders, personal data, restricted-source content, or unrelated changes; the explicitly marked instructional placeholders in this document should remain;
- the PR still states unresolved uncertainties explicitly.

If the real change differs from this example's assumptions, follow the actual manifest and evidence impact rather than forcing the counts above.

## 8. Commit, preview, and create the PR

Perform external contribution steps only when the user explicitly requests a commit or PR. First select the hunks for this review interactively and inspect the staged diff, so that pre-existing unrelated changes are not included in the commit:

```bash
git add --patch
git diff --cached --check
git diff --cached --stat
git commit -m "data: review openLCA release evidence"
```

Copy the template outside the repository before filling it in, so that an untracked PR body does not cause the clean-tree check to fail:

```bash
cp skills/global-lca-asset-review/assets/review-pr-body.md /tmp/global-lca-review-pr-body.md
```

The PR body should include:

- `LCA-SW-0003`, the new evidence ID, and the new release ID;
- the exact claims changed, public URLs, and access dates;
- why this is the same asset family rather than a new asset;
- changes to the evidence and release counts, and the unaffected database counts;
- the package version, evidence cutoff, validation commands, and results;
- compatibility claims that were not independently tested and any other unresolved questions.

First use the helper only to preview the PR, without writing to GitHub:

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review openLCA release evidence" \
  --body-file /tmp/global-lca-review-pr-body.md
```

Add `--submit` only after the user explicitly says to “create/submit the PR”:

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review openLCA release evidence" \
  --body-file /tmp/global-lca-review-pr-body.md \
  --submit
```

In both preview and submission mode, the helper rejects `main`, detached HEAD, a dirty working tree, and a non-GitHub `origin`. Only `--submit` mode requires GitHub CLI to be installed and authenticated. During submission, the helper performs only a non-force push and `gh pr create`; it does not merge the PR.
