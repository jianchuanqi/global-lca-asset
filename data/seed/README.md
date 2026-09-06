# Public seed provenance

`inventory-v2.public.json` is the graph source extracted from `2026-08-22_Global_LCA_Asset_Inventory_v2.xlsx`.

## Source and integrity

- Package evidence cutoff: 2026-09-06 (provider-location review; other claims retain their dated evidence)
- Source workbook SHA-256: `3f2388768b506d44fd6e50d5e3fa844cc5d45a5b41e043b9e422126903df7fe5`
- Public JSON SHA-256: `b22650dbf7737373257d6b78b313c035e25b9f51247e27f45bc71a8adbc0e369`

Included tables:

| Table | Rows |
|---|---:|
| Master Asset Inventory | 214 |
| Source Evidence | 252 |
| Database Scope | 88 |
| Asset Releases | 310 |
| Distributions | 170 |
| Mapping Artifacts | 25 |
| Relationship Index | 310 |
| Search Coverage | 18 |

The extraction excluded `Contact information`, questionnaire/person mapping tables, organization lead contacts, and internal `Reviewer notes`. The graph builder and tests additionally verify that public node properties do not contain the excluded field names or common personal-email patterns.

Questionnaire records and earlier spreadsheets are discovery leads, not a statistical sample and not graph authority. The public seed contains only the reviewed public-evidence result. Restricted, registered, purchased, or account-only data packages were not opened.

## Rebuilding the graph snapshot

```bash
uv run global-lca build-snapshot \
  --source data/seed/inventory-v2.public.json \
  --output data/canonical/graph-snapshot.json
```

The canonical snapshot is generated and ignored by Git. Neo4j can import the public source directly with `global-lca import`; the same deterministic builder is used in both paths.

For a future workbook release, create a new dated public JSON file with the same table envelope and field names, record both checksums here, run all data tests, and keep the previous seed for release comparison rather than silently overwriting its provenance.

Provider locations are maintained in `data/curated/provider-location-review-2026-09-06.json`. The generated `provider_locations` table preserves the original organization labels, reviewed provider identities, country/region labels, source links and dates. It covers named owners, operators and maintainers across asset categories. Developer-only roles are outside this count. Reviewed aliases count once per location; collective provider groups remain explicit. Global communities and regional networks are classified separately. Maintenance-status placeholders are excluded, and unconfirmed institutional locations remain unresolved.
