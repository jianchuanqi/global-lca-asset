# Counting units in the research views

The main number and search results use the object named by each view. Linked resources are evidence or detail and do not increase that object's count.

| View | Main counting unit | Search row | Related counts |
|---|---|---|---|
| Overview / All assets | Registered Asset ID | One asset | Category totals are subsets of the asset register. |
| Databases | Database family (80 core); extended data-bearing asset (88, including the core) | One Database Scope asset | Access categories use the same 88 records. Distribution variants do not add databases. |
| Formats | Registered format/schema definition (14), grouped into named systems (12) | One format Asset ID | ecoSpold 1 and ecoSpold2 are registered separately in ecoSpold; ILCD and ILCD+EPD belong to ILCD. Release and distribution records do not add formats. |
| Software | Registered software product/tool (130) | One software Asset ID | Actor identities and role assertions have separate labels. Functional categories count software, not companies or roles. |
| Providers | Reviewed provider identity or collective provider group (143) | One provider_id, with aliases merged | A provider counts once per country/region. Multiple locations can overlap; no summed “Other” provider total is shown. Linked assets are expandable details. |
| Mappings | Mapping artifact record (25) | One mapping_artifact_id | Typed endpoint counts describe endpoints. Project/source wording is not a deduplicated project register and is not reported as a project count. |
| Relationship graph | Searchable nodes and registered edges | One asset or public organization-label node | Nodes/edges loaded into the current view are labelled separately from the full register. Organization-label nodes are not the deduplicated provider directory. |
| Downloads | Rows in each named table | Table-specific ID | format_scope is the format catalogue. distributions retains package, usage and compatibility evidence. |

Format classification comes from the explicit format_asset_systems mapping in the curated schema alignment file. Distribution-profile alignment remains available for package analysis and does not supply the format catalogue's counts.
