# Data package schema

Read this reference for joins, scoped counts, compatibility questions, and update work.

## Core tables

- `assets`: one normalized asset record per `asset_id`; includes type, owner, geography, sector, access, schema/format, QA, evidence status and confidence.
- `evidence`: public source records linked by `asset_id`; use `evidence_id`, URL, supported fields, excerpt, reliability and access date.
- `relations`: ID-resolved asset-to-asset relations. Join `source_asset_id` and `target_asset_id` to `assets.asset_id`.
- `database_scope`: the 88-row scoped database/data-bearing register. Use `working_count_status = 'Core working count'` for the lower-bound core count.
- `database_scope`: also holds access, openness, developer geography and sector classification for the 88-item scope.
- `distributions`: one database release/package/schema/software compatibility claim per row. Use `database_asset_id` to join to assets. `schema_profile` is the reviewed aligned label, `schema_profile_class` is the filterable family, and `schema_profile_original` preserves the exact public wording.
- `schema_profile_alignment`: auditable original-to-aligned schema/profile decisions, assigned classes, methods, and distribution counts.
- `mapping_endpoint_alignment`: auditable original-to-aligned mapping endpoints and endpoint kinds. It prevents software products, schemas, internal models, workflows and reference lists from being merged because of shared brand wording.
- `releases`: verified release or development milestones linked by `asset_id`.
- `mapping_artifacts`: directional schema, format, flow-list, converter or alignment artifacts, including versions, tests and known losses. Prefer `source_endpoint`, `source_endpoint_kind`, `target_endpoint`, and `target_endpoint_kind`; retain the original endpoint labels for provenance.
- `version_audit`: one dated route/version recheck for every database-scope record, separating explicit updates, retained values, unconfirmed versions and unresolved automated checks.
- `answerability`: current answer form, readiness, evidence, remaining gap and completion test for each of the six review questions.
- `search_coverage`: documented geography/language/sector search streams and follow-up actions.
- `review_issues`: unresolved expert-validation claims.
- `organizations` and `asset_organizations`: derived exact public owner/maintainer labels and asset-role links. Composite labels may require expert splitting.
- `data_dictionary`: review concepts and counting rules used by people and AI.

Questionnaire rows, stakeholder lists and new web results are leads outside the public verified package until identity, evidence and inclusion have been reviewed.

The SQLite view `asset_summary` adds evidence, release, and relation counts to common asset fields.

## Counting

- Verified assets: count rows in `assets`.
- Core database families: count `database_scope` where `working_count_status = 'Core working count'`.
- Extended data-bearing count: count `database_scope` where `extended_data_bearing_count = 'Yes'`; this is the core set plus data-bearing repositories/platforms/libraries, not a second definition of “database”.
- Open-licence or access categories: group `database_scope.open_data_status`; do not infer openness from software source-code status.
- Distribution compatibility: count or inspect `distributions`, keeping release, package, schema version, software version, direction, and claimed/tested status.
- Mapping evidence: inspect `mapping_artifacts`; do not use the generic relationship count as the number of technical mappings.

## Common joins

```sql
SELECT a.asset_id, a.official_name, e.evidence_id, e.url_or_file
FROM assets a
JOIN evidence e ON e.asset_id = a.asset_id
WHERE a.asset_id = ?;
```

```sql
SELECT a.official_name, d.database_release, d.schema_profile,
       d.schema_profile_original, d.schema_profile_class,
       d.schema_version, d.compatible_software, d.software_version,
       d.direction, d.claimed_tested_status
FROM assets a
JOIN distributions d ON d.database_asset_id = a.asset_id
WHERE a.asset_id = ?;
```

```sql
SELECT source_endpoint, source_endpoint_kind, source_endpoint_original, source_version,
       target_endpoint, target_endpoint_kind, target_endpoint_original, target_version,
       direction, project_study, claimed_tested,
       known_loss_exception, artifact_url_doi
FROM mapping_artifacts
ORDER BY mapping_artifact_id;
```

## Evidence priority

Prefer direct official/provider sources, normative public metadata, peer-reviewed studies, and public repositories. A provider statement may establish a documented claim but not independent conformance or losslessness.
