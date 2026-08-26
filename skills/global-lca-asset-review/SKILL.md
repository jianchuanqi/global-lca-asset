---
name: global-lca-asset-review
description: Query and review Global LCA Asset evidence, and when explicitly requested edit its Git-tracked source data, validate a new package, and prepare or submit a pull request. Use for LCA databases, software, schemas, formats, releases, mappings, access, coverage, evidence quality, expert review, or dataset contributions.
---

# Global LCA Asset

Use the reviewed data package as the factual base and preserve its definitions, evidence cut-off, and uncertainty.

## Locate the project

- Use the cloned Git repository as the single source of truth. The repository installer links this Skill into Codex and/or Claude Code.
- Locate the project from `GLOBAL_LCA_ASSET_ROOT`, the installed `.global-lca-asset-root` marker, the Skill's resolved link target, or the current working directory.
- Current package: `data/package/current`
- Web dataset project: `packages/global-lca-asset-web`
- Canonical public input: `data/seed/inventory-v2.public.json`
- Curated review layers: `data/curated/schema-profile-alignment.json`, `data/curated/mapping-endpoint-alignment.json`, dated public-version review files, and `data/curated/nexus-catalog-review-2026-08-25.json`

The canonical input is already screened to exclude personal information and internal reviewer mappings. If these paths move, locate `global_lca_assets.sqlite` beside a `manifest.json` whose `package_name` begins “Global LCA Asset”. Do not silently substitute older inventory workbooks or the legacy 183-asset report artifact.

## Choose the mode

### Answer or analyze

1. Read `manifest.json` and `analysis_rules.md` before interpreting counts.
2. Query only the needed tables, preferably through `scripts/lca_query.py`.
3. Read [references/schema.md](references/schema.md) when the question needs joins, entity granularity, compatibility, mappings, releases, or access classification.
4. Support factual conclusions with evidence IDs and public URLs from `evidence`, `database_scope`, `distributions`, `releases`, or `mapping_artifacts`.
5. State the evidence cut-off and distinguish verified findings from inference, gaps, and future validation.
6. Generate a fresh CSV, JSON, table, figure, report, or HTML view when that makes the answer clearer.

Do not browse by default for a question explicitly bounded to the current package. Browse when the user asks for current verification, new discovery, or an update; use public sources only.

### Refresh or extend the web dataset

Preserve the existing Overview; database, access, format/software, provider/sector, and mapping research views; progressively loaded Relationship graph; All assets comparison; and Data package functions. Release milestones remain available in the evidence package but are not a public web view because coverage is incomplete.

- Do not hand-edit generated `packages/global-lca-asset-web/src/data/dataset.json`, `public/graph/`, downloadable exports, or SQLite tables.
- After an authorized change to the public seed or curated review context, run `pnpm data:build`, `pnpm data:verify`, and `pnpm --filter @global-lca/global-lca-asset-web build` from the project root.
- Confirm `validation_report.json` is `passed` and reconcile its counts before presenting the refreshed web dataset.
- Keep the site local unless the user explicitly authorizes publishing or sharing.

### Update research

Use only publicly accessible information. Do not register, log in, request an API key, submit a form, purchase content, or infer restricted information.

1. Treat questionnaire rows, stakeholder organizations, and web results as leads.
2. Add a new finding under `data/candidates/` and validate it with `scripts/candidate_queue.py`; candidates are review leads and do not change published counts.
3. Resolve duplicates, families, distributions, profiles, versions, and successor/predecessor relations.
4. Attach public evidence for every promoted claim and record the access date.
5. Route ambiguous or high-impact claims to expert review.
6. Create a new package version, advance its evidence cut-off to the reviewed date when appropriate, and preserve the historical meaning of every earlier package, cut-off, and reported count.

Personal names, email addresses, source questionnaire row IDs, and internal reviewer notes stay outside public research records. The explicitly authorized publication owners are Jianchuan Qi (Tsinghua University), Natasha Das (AECOM), and António Martins (Portuguese Catholic University). The feedback contact is Jianchuan Qi, `jcqi@tsinghua.edu.cn`. Keep all publication ownership/contact information separate from the research dataset.

### Prepare expert review

Make a specific claim or relationship the review unit, not an entire asset record. Include the current claim, evidence, exact question, decision impact, priority, reviewer response, correction, supporting source, adjudication, and release impact.

### Modify reviewed data

Read [references/data-editing.md](references/data-editing.md). Treat review-only requests as read-only. Make scoped local source-data changes only when the user asks to correct, add, update, or implement them. Preserve unrelated working-tree changes, attach public evidence, regenerate derived outputs, and run the full validation sequence.

### Contribute through Git

Read [references/git-contribution.md](references/git-contribution.md) when the user wants a branch, commit, push, or pull request. A request to edit data authorizes local changes, not external GitHub writes. Push and open a PR only after the user explicitly asks for that action; never merge, force-push, or include unrelated edits.

## Non-negotiable interpretation rules

- Say **“at least 80 core database families under the stated rule”**, not “there are 80 databases in the world”.
- The extended data-bearing count is 88: the same 80 core database families plus eight repositories, platforms or libraries that bear/distribute LCA data without being counted again as database families.
- The 37-entry openLCA Nexus public DATA catalog is fully reconciled. Count distinct database/add-on families once; treat versions, system models, unit/system aggregations, database groups, formats and datapacks as distributions. Keep LCIA methods and repositories as assets without adding them to the database-family count.
- Free access, public browsing, explicit open licence, registration, fee, redistribution, and source-code openness are separate properties.
- Compatibility, import/export support, nomenclature mapping, schema conversion, and lossless round-trip are different claims.
- Use the aligned `schema_profile` and `schema_profile_class` fields for grouping; retain `schema_profile_original` when reporting exact source wording. Branded schemas and provider-specific models such as HESTIA and TIDAS remain named classes rather than being collapsed into generic JSON.
- Use `source_endpoint` / `target_endpoint` and their endpoint-kind fields for mapping analysis; do not treat a software product and its branded schema as the same endpoint.
- Use `version_audit` to distinguish explicit public updates, retained evidence-linked values, versions that remain unconfirmed, and unresolved route checks.
- Release records are verified public milestones, not necessarily complete patch histories.
- Owner/steward country, developer country, hosting location, and geographic data coverage are different fields.
- Preserve direction and exact versions for every mapping or conversion claim.
- English is the default for structured outputs; internal methods and review notes may be bilingual.

## Answer style

Lead with the answer. Then give the relevant count or comparison, definition, evidence, and limitation. Avoid technical implementation detail unless asked.
