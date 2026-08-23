# Public seed provenance

`inventory-v2.public.json` is the graph source extracted from `2026-08-22_Global_LCA_Asset_Inventory_v2.xlsx`.

## Source and integrity

- Evidence cutoff: 2026-08-22
- Source workbook SHA-256: `3f2388768b506d44fd6e50d5e3fa844cc5d45a5b41e043b9e422126903df7fe5`
- Public JSON SHA-256: `5cde381832481b8c52693dd270b0ce3c51eb69ab2311a6e679b68f19d1ac5265`

Included tables:

| Table | Rows |
|---|---:|
| Master Asset Inventory | 199 |
| Source Evidence | 205 |
| Database Scope | 77 |
| Asset Releases | 290 |
| Distributions | 128 |
| Mapping Artifacts | 18 |
| Relationship Index | 233 |
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
