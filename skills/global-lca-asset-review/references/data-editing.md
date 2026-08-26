# Editing reviewed data

Read this reference only when the user asks to correct, add, update, or otherwise modify the reviewed dataset.

For a clone-to-PR worked example, read `docs/data-update-example.md` from the discovered project root.

## Authorization boundary

- A request to review, inspect, compare, explain, or recommend is read-only.
- A request to correct, add, update, or implement authorizes scoped local edits and validation.
- Local edit authorization does not authorize a commit, push, pull request, deployment, or merge.
- Never add personal contact data, questionnaire-person mappings, internal reviewer notes, credentials, or content obtained through login, registration, payment, or restricted access.

## Source of truth

Edit source inputs, then regenerate derived outputs.

| Change | Primary source input |
|---|---|
| Asset identity, description, access, schema, QA, coverage | `data/seed/inventory-v2.public.json` → `Master Asset Inventory` |
| Public source and supported claim | `data/seed/inventory-v2.public.json` → `Source Evidence` |
| Core/extended database scope | `data/seed/inventory-v2.public.json` → `Database Scope` |
| Version milestone | `data/seed/inventory-v2.public.json` → `Asset Releases` |
| Release/package/schema/software compatibility | `data/seed/inventory-v2.public.json` → `Distributions` |
| Directional mapping/converter/alignment | `data/seed/inventory-v2.public.json` → `Mapping Artifacts` |
| Asset relationship assertion | `data/seed/inventory-v2.public.json` → `Relationship Index` |
| Search stream and documented gap | `data/seed/inventory-v2.public.json` → `Search Coverage` |
| Schema/profile synonym decision | `data/curated/schema-profile-alignment.json` |
| Mapping endpoint identity/kind decision | `data/curated/mapping-endpoint-alignment.json` |
| Review readiness, dictionary, unresolved issue | `data/curated/review-context.json` |

Do not hand-edit `data/package/current`, generated web dataset JSON, downloads, graph chunks, SQLite, or compiled package output.

## Review procedure

1. Read the current manifest, analysis rules, target asset, linked evidence, distributions, releases, relations, mappings, and version audit. For a new unresolved asset, create and validate a `data/candidates/` record before editing the canonical inventory.
2. Inspect `git status` and preserve unrelated user changes. Work on a `review/<date>-<slug>` branch when the user wants a contribution.
3. Verify identity before editing: distinguish an asset family from versions, distributions, schemas, software products, repositories, and mappings.
4. Add or update public evidence before promoting a factual claim. Record the exact URL, publisher, source type, access date, supported fields, concise excerpt, reliability, restriction, and public-access status.
5. Update every affected representation. A version change may affect the master asset, database scope, release record, distribution, mapping version pair, evidence, and version-review layer.
6. Update `metadata.evidence_cutoff` and `metadata.generated_at` in the public seed, then increment `package_version` and update `generated_at` in `data/curated/review-context.json` for a new published package.
7. When row counts change, intentionally reconcile `requiredCounts` in `scripts/build-data-package.mjs`, the six-question baselines, manifest output, public-facing counts, and tests. Never change a count merely to silence validation.
8. Run the complete validation sequence and inspect the generated diff before claiming the change is ready.

## Evidence and claim rules

- A provider statement proves that the provider made the claim; it does not prove conformance, successful import, losslessness, or independent reproducibility.
- Keep free access, open licence, registration, fee, redistribution rights, and source-code openness separate.
- Keep owner/steward country, developer country, hosting location, and geographic data coverage separate.
- Preserve mapping direction, exact source/target endpoints, endpoint kinds, versions, test scope, and known losses.
- Do not delete a historical or conflicting claim silently. Correct the active field, retain auditable evidence, and record unresolved ambiguity or expert-review impact.

## Validation sequence

Run from the repository root:

```bash
pnpm data:build
pnpm data:verify
pnpm --filter @global-lca/global-lca-asset-web build
uv run --extra dev pytest
pnpm test
git diff --check
```

Confirm `data/package/current/validation_report.json` is `passed`, review all warnings, and reconcile the manifest counts with the intended change.
