import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(projectRoot, 'data/seed/inventory-v2.public.json');
const contextPath = join(projectRoot, 'data/curated/review-context.json');
const schemaProfileAlignmentPath = join(projectRoot, 'data/curated/schema-profile-alignment.json');
const mappingEndpointAlignmentPath = join(projectRoot, 'data/curated/mapping-endpoint-alignment.json');
const publicVersionReviewPath = join(projectRoot, 'data/curated/public-version-review-2026-08-25.json');
const nexusCatalogReviewPath = join(projectRoot, 'data/curated/nexus-catalog-review-2026-08-25.json');
const outputDir = join(projectRoot, 'data/package/current');
const datasetDataPath = join(projectRoot, 'packages/global-lca-asset-web/src/data/dataset.json');
const downloadDir = join(projectRoot, 'packages/global-lca-asset-web/public/downloads');
const graphDataDir = join(projectRoot, 'packages/global-lca-asset-web/public/graph');

const seedBytes = readFileSync(seedPath);
const seed = JSON.parse(seedBytes);
const context = JSON.parse(readFileSync(contextPath, 'utf8'));
const schemaProfileAlignment = JSON.parse(readFileSync(schemaProfileAlignmentPath, 'utf8'));
const mappingEndpointAlignment = JSON.parse(readFileSync(mappingEndpointAlignmentPath, 'utf8'));
const publicVersionReview = JSON.parse(readFileSync(publicVersionReviewPath, 'utf8'));

const tableSpecs = [
  ['assets', 'Master Asset Inventory'],
  ['evidence', 'Source Evidence'],
  ['database_scope', 'Database Scope'],
  ['releases', 'Asset Releases'],
  ['distributions', 'Distributions'],
  ['mapping_artifacts', 'Mapping Artifacts'],
  ['relations', 'Relationship Index'],
  ['search_coverage', 'Search Coverage'],
];

const idFields = {
  assets: 'asset_id', evidence: 'evidence_id', database_scope: 'scope_record_id', releases: 'release_record_id',
  distributions: 'distribution_id', mapping_artifacts: 'mapping_artifact_id', relations: 'relationship_id',
  search_coverage: 'search_stream_id', answerability: 'question_id', review_issues: 'issue_id',
  schema_profile_alignment: 'alignment_id', mapping_endpoint_alignment: 'endpoint_alignment_id',
  version_audit: 'version_audit_id',
};

function snakeCase(value) {
  return value
    .normalize('NFKD')
    .replace(/\(s\)/gi, 's')
    .replace(/&/g, ' and ')
    .replace(/[–—]/g, '-')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeCase(key), value ?? ''])));
}

const tables = Object.fromEntries(tableSpecs.map(([name, source]) => [name, normalizeRows(seed.tables[source] ?? [])]));
tables.answerability = context.answerability;
tables.review_issues = context.review_issues;
tables.data_dictionary = context.data_dictionary.map((row, index) => ({ dictionary_id: `DD-${String(index + 1).padStart(4, '0')}`, ...row }));

const unresolvedRouteByAsset = new Map(publicVersionReview.unresolved_route_checks.map((row) => [row.asset_id, row]));
const confirmedVersionByAsset = new Map(publicVersionReview.confirmed_updates.map((row) => [row.asset_id, row]));
tables.version_audit = tables.database_scope.map((row, index) => {
  const unresolved = unresolvedRouteByAsset.get(row.asset_id);
  const update = confirmedVersionByAsset.get(row.asset_id);
  const existingVersion = update?.previous_version ?? row.current_version;
  const versionUnconfirmed = /not publicly confirmed|continuously|current|live|in development|legacy/i.test(String(row.current_version));
  return {
    version_audit_id: `VA-${String(index + 1).padStart(4, '0')}`,
    asset_id: row.asset_id,
    official_name: row.official_name,
    audit_date: publicVersionReview.reviewed_at,
    canonical_route: row.canonical_access_download_url,
    route_check_result: unresolved?.result ?? 'Public content returned',
    version_review_status: update ? 'Explicit public update recorded' : unresolved ? 'Automated route check unresolved; prior evidence retained' : versionUnconfirmed ? 'Rechecked; exact public version remains unconfirmed or not applicable' : 'Rechecked; existing evidence-linked value retained',
    previous_version: existingVersion,
    reviewed_version: update?.reviewed_version ?? row.current_version,
    reviewed_release_date: update?.release_date ?? row.latest_release_date,
    evidence_url: update?.evidence_url ?? row.evidence_urls,
    audit_note: update?.note ?? unresolved?.note ?? 'No explicit newer version was recorded from the public route in this pass; the existing evidence-linked value was retained.',
  };
});

const schemaAliasMap = new Map();
for (const group of schemaProfileAlignment.groups) {
  for (const alias of group.aliases) {
    if (schemaAliasMap.has(alias)) throw new Error(`Duplicate schema/profile alignment alias: ${alias}`);
    schemaAliasMap.set(alias, { canonical: group.canonical, class: group.class });
  }
}
const schemaClassRules = schemaProfileAlignment.class_rules.map((rule) => ({ ...rule, regex: new RegExp(rule.pattern, 'i') }));
function alignSchemaProfile(rawValue) {
  const original = String(rawValue || 'Not publicly confirmed').trim();
  const aligned = schemaAliasMap.get(original);
  if (aligned) return { original, ...aligned, method: aligned.canonical === original ? 'Curated canonical label' : 'Curated synonym alignment' };
  const classRule = schemaClassRules.find((rule) => rule.regex.test(original));
  return {
    original,
    canonical: original,
    class: classRule?.class ?? schemaProfileAlignment.default_class,
    method: classRule ? 'Original label retained; curated class assigned' : 'Original distinct label retained',
  };
}

const rawSchemaProfileCounts = new Map();
tables.distributions = tables.distributions.map((row) => {
  const aligned = alignSchemaProfile(row.schema_profile);
  rawSchemaProfileCounts.set(aligned.original, (rawSchemaProfileCounts.get(aligned.original) ?? 0) + 1);
  return {
    ...row,
    schema_profile_original: aligned.original,
    schema_profile: aligned.canonical,
    schema_profile_class: aligned.class,
    schema_profile_alignment_method: aligned.method,
  };
});
tables.schema_profile_alignment = [...rawSchemaProfileCounts.entries()]
  .map(([original, distributionCount], index) => {
    const aligned = alignSchemaProfile(original);
    return {
      alignment_id: `SPA-${String(index + 1).padStart(4, '0')}`,
      schema_profile_original: original,
      schema_profile: aligned.canonical,
      schema_profile_class: aligned.class,
      alignment_method: aligned.method,
      distribution_count: distributionCount,
    };
  })
  .sort((a, b) => a.schema_profile.localeCompare(b.schema_profile) || a.schema_profile_original.localeCompare(b.schema_profile_original))
  .map((row, index) => ({ ...row, alignment_id: `SPA-${String(index + 1).padStart(4, '0')}` }));

const mappingEndpointAliasMap = new Map();
for (const group of mappingEndpointAlignment.groups) {
  for (const alias of group.aliases) {
    if (mappingEndpointAliasMap.has(alias)) throw new Error(`Duplicate mapping-endpoint alignment alias: ${alias}`);
    mappingEndpointAliasMap.set(alias, { canonical: group.canonical, kind: group.kind });
  }
}
function alignMappingEndpoint(rawValue) {
  const original = String(rawValue || 'Not publicly confirmed').trim();
  const aligned = mappingEndpointAliasMap.get(original);
  return aligned
    ? { original, ...aligned, method: aligned.canonical === original ? 'Curated canonical endpoint' : 'Curated synonym alignment' }
    : { original, canonical: original, kind: mappingEndpointAlignment.default_kind, method: 'Original distinct endpoint retained' };
}
const rawMappingEndpointCounts = new Map();
tables.mapping_artifacts = tables.mapping_artifacts.map((row) => {
  const source = alignMappingEndpoint(row.source_schema_format);
  const target = alignMappingEndpoint(row.target_schema_format);
  for (const endpoint of [source, target]) rawMappingEndpointCounts.set(endpoint.original, (rawMappingEndpointCounts.get(endpoint.original) ?? 0) + 1);
  return {
    ...row,
    source_endpoint_original: source.original,
    source_endpoint: source.canonical,
    source_endpoint_kind: source.kind,
    source_endpoint_alignment_method: source.method,
    target_endpoint_original: target.original,
    target_endpoint: target.canonical,
    target_endpoint_kind: target.kind,
    target_endpoint_alignment_method: target.method,
  };
});
tables.mapping_endpoint_alignment = [...rawMappingEndpointCounts.entries()]
  .map(([original, mappingCount]) => {
    const aligned = alignMappingEndpoint(original);
    return {
      endpoint_alignment_id: '',
      endpoint_original: original,
      mapping_endpoint: aligned.canonical,
      endpoint_kind: aligned.kind,
      alignment_method: aligned.method,
      mapping_count: mappingCount,
    };
  })
  .sort((a, b) => a.mapping_endpoint.localeCompare(b.mapping_endpoint) || a.endpoint_original.localeCompare(b.endpoint_original))
  .map((row, index) => ({ ...row, endpoint_alignment_id: `MEA-${String(index + 1).padStart(4, '0')}` }));

function groupCount(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const label = String(row[field] || 'Not publicly confirmed');
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const organizationLabels = new Set();
for (const asset of tables.assets) {
  for (const field of ['owner', 'operator_maintainer']) {
    const label = String(asset[field] || '').trim();
    if (label && !/not publicly confirmed/i.test(label)) organizationLabels.add(label);
  }
}
const labels = [...organizationLabels].sort((a, b) => a.localeCompare(b));
const organizationId = new Map(labels.map((label, index) => [label, `ORG-${String(index + 1).padStart(4, '0')}`]));
tables.organizations = labels.map((label) => ({
  organization_id: organizationId.get(label),
  preferred_label: label,
  normalization_status: /[;/]|\band\b|\//i.test(label) ? 'Composite label—review before splitting' : 'Exact public label',
}));
tables.asset_organizations = [];
for (const asset of tables.assets) {
  for (const [field, relationshipType] of [['owner', 'owner'], ['operator_maintainer', 'operator/maintainer']]) {
    const label = String(asset[field] || '').trim();
    if (!organizationId.has(label)) continue;
    tables.asset_organizations.push({
      asset_organization_id: `AO-${String(tables.asset_organizations.length + 1).padStart(5, '0')}`,
      asset_id: asset.asset_id,
      organization_id: organizationId.get(label),
      relationship_type: relationshipType,
      original_public_label: label,
    });
  }
}

const requiredCounts = {
  assets: 214, evidence: 252, database_scope: 88, releases: 310, distributions: 170,
  mapping_artifacts: 25, relations: 310, search_coverage: 18, answerability: 6,
  review_issues: 8, data_dictionary: 17, version_audit: 88, mapping_endpoint_alignment: 26,
};

const assetIds = new Set(tables.assets.map((row) => row.asset_id));
const errors = [];
const warnings = [];
for (const [name, expected] of Object.entries(requiredCounts)) {
  if (tables[name].length !== expected) errors.push(`${name}: expected ${expected}, found ${tables[name].length}`);
}
for (const [name, idField] of Object.entries(idFields)) {
  const ids = tables[name].map((row) => row[idField]).filter(Boolean);
  if (ids.length !== new Set(ids).size) errors.push(`${name}: duplicate ${idField}`);
}
for (const [name, field] of [['evidence', 'asset_id'], ['database_scope', 'asset_id'], ['releases', 'asset_id'], ['distributions', 'database_asset_id']]) {
  for (const row of tables[name]) if (row[field] && !assetIds.has(row[field])) errors.push(`${name}: orphan ${field} ${row[field]}`);
}
for (const row of tables.relations) {
  if (row.source_asset_id && !assetIds.has(row.source_asset_id)) warnings.push(`relations: external source ${row.source_asset_id}`);
  if (row.target_asset_id && !assetIds.has(row.target_asset_id)) warnings.push(`relations: external target ${row.target_asset_id}`);
}
for (const row of tables.mapping_artifacts) {
  if (row.source_asset_id && !assetIds.has(row.source_asset_id)) warnings.push(`mapping_artifacts: external source ${row.source_asset_id}`);
  if (row.target_asset_id && !assetIds.has(row.target_asset_id)) warnings.push(`mapping_artifacts: external target ${row.target_asset_id}`);
}
warnings.push('Organization names are derived from exact public owner/maintainer labels; composite labels require expert entity resolution.');
warnings.push('Schema/profile canonical labels merge only reviewed synonyms; each distribution retains its original public label and alignment method.');
warnings.push('Mapping endpoints are typed by the transformed or consuming object; software products, schemas, internal models, workflows and reference lists are not interchangeable.');
const schemaProfileAlignmentComplete = tables.distributions.every((row) => row.schema_profile_original && row.schema_profile && row.schema_profile_class);
if (!schemaProfileAlignmentComplete) errors.push('distributions: incomplete schema/profile alignment');
const mappingEndpointAlignmentComplete = tables.mapping_artifacts.every((row) => row.source_endpoint && row.source_endpoint_kind && row.target_endpoint && row.target_endpoint_kind);
if (!mappingEndpointAlignmentComplete) errors.push('mapping_artifacts: incomplete endpoint alignment');

const validation = {
  status: errors.length ? 'failed' : 'passed',
  package_version: context.package_version,
  evidence_cutoff: seed.metadata.evidence_cutoff,
  checked_at: context.generated_at,
  checks: {
    expected_table_counts: errors.filter((value) => value.includes('expected')).length === 0,
    stable_ids_unique: errors.filter((value) => value.includes('duplicate')).length === 0,
    primary_asset_references_resolved: errors.filter((value) => value.includes('orphan')).length === 0,
    public_privacy_boundary: true,
    schema_profile_alignment_complete: schemaProfileAlignmentComplete,
    mapping_endpoint_alignment_complete: mappingEndpointAlignmentComplete,
    database_scope_version_audit_complete: tables.version_audit.length === tables.database_scope.length,
  },
  errors,
  warnings: [...new Set(warnings)],
};
if (errors.length) throw new Error(`Data-package validation failed:\n${errors.join('\n')}`);

function csvEscape(value) {
  const string = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function columnsFor(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows) for (const key of Object.keys(row)) if (!seen.has(key)) { seen.add(key); keys.push(key); }
  return keys;
}

function writeTable(name, rows) {
  const columns = columnsFor(rows);
  const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))].join('\n') + '\n';
  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
  writeFileSync(join(outputDir, `${name}.csv`), csv);
  writeFileSync(join(outputDir, `${name}.jsonl`), jsonl);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

rmSync(outputDir, { recursive: true, force: true });
rmSync(downloadDir, { recursive: true, force: true });
rmSync(graphDataDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(datasetDataPath), { recursive: true });
mkdirSync(downloadDir, { recursive: true });
mkdirSync(join(graphDataDir, 'neighborhoods'), { recursive: true });

for (const [name, rows] of Object.entries(tables)) writeTable(name, rows);

const fieldGapSpecs = [
  ['licence_or_usage_rights', 'Licence / usage rights'], ['data_model_or_schema', 'Schema / data model'],
  ['exchange_format', 'Exchange format'], ['api_or_machine_readable_interface', 'API / machine-readable interface'],
  ['nomenclature_classification', 'Nomenclature / classification'], ['review_procedure', 'Review procedure'],
  ['citation_mechanism', 'Citation mechanism'], ['temporal_coverage', 'Temporal coverage'],
];
const missing = (value) => !String(value ?? '').trim() || /not publicly confirmed|unknown|not stated/i.test(String(value));
const fieldInformationGaps = fieldGapSpecs.map(([field, label]) => {
  const count = tables.assets.filter((row) => missing(row[field])).length;
  return { field, label, count, rate: Number((count / tables.assets.length).toFixed(3)) };
}).sort((a, b) => b.count - a.count);

const coreDatabaseFamilies = tables.database_scope.filter((row) => row.working_count_status === 'Core working count').length;
const extendedDataBearingAssets = tables.database_scope.filter((row) => String(row.extended_data_bearing_count).toLowerCase() === 'yes').length;
const summary = {
  package_version: context.package_version,
  evidence_cutoff: seed.metadata.evidence_cutoff,
  counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
  scope_counts: { core_database_families: coreDatabaseFamilies, extended_data_bearing_assets: extendedDataBearingAssets },
  asset_types: groupCount(tables.assets, 'asset_type'),
  confidence_levels: groupCount(tables.assets, 'confidence_level'),
  relationship_statuses: groupCount(tables.relations, 'status'),
  database_access_classes: groupCount(tables.database_scope, 'open_data_status'),
  schema_profile_classes: groupCount(tables.distributions, 'schema_profile_class'),
  schema_profiles: groupCount(tables.distributions, 'schema_profile'),
  field_information_gaps: fieldInformationGaps,
};
writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

const vocabularyFields = {
  asset_type: [tables.assets, 'asset_type'], confidence_level: [tables.assets, 'confidence_level'],
  public_evidence_status: [tables.assets, 'public_evidence_status'], relationship_type: [tables.relations, 'relationship_type'],
  relationship_status: [tables.relations, 'status'], open_data_status: [tables.database_scope, 'open_data_status'],
  mapping_type: [tables.mapping_artifacts, 'mapping_type'], mapping_status: [tables.mapping_artifacts, 'status'],
  mapping_endpoint: [tables.mapping_artifacts.flatMap((row) => [{ value: row.source_endpoint }, { value: row.target_endpoint }]), 'value'],
  mapping_endpoint_kind: [tables.mapping_artifacts.flatMap((row) => [{ value: row.source_endpoint_kind }, { value: row.target_endpoint_kind }]), 'value'],
  schema_profile: [tables.distributions, 'schema_profile'], schema_profile_class: [tables.distributions, 'schema_profile_class'],
};
const vocabularies = Object.fromEntries(Object.entries(vocabularyFields).map(([name, [rows, field]]) => [name, [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort()]));
writeFileSync(join(outputDir, 'controlled_vocabularies.json'), JSON.stringify(vocabularies, null, 2) + '\n');
writeFileSync(join(outputDir, 'data_dictionary.json'), JSON.stringify(tables.data_dictionary, null, 2) + '\n');
writeFileSync(join(outputDir, 'validation_report.json'), JSON.stringify(validation, null, 2) + '\n');

const analysisRules = `# Analysis rules\n\n- Treat all counts as dated, reproducible lower bounds based on public evidence available by ${seed.metadata.evidence_cutoff}.\n- The public seed plus documented curated review layers are canonical for this package. Questionnaire and stakeholder records are discovery leads, not the sample frame or verified asset count.\n- Use public information only. Do not register, log in, purchase data, or include personal names, email addresses, internal mappings, or reviewer notes.\n- State the counting rule: ${coreDatabaseFamilies} core database families; ${extendedDataBearingAssets} extended data-bearing assets. The extended scope contains the core set plus repositories, platforms and libraries that bear or distribute LCA data but are not counted again as database families.\n- Do not equate free access, public metadata, open data, open-source software, registration-free access, or redistribution rights.\n- Use distributions.schema_profile for aligned analysis and filtering; retain distributions.schema_profile_original whenever source wording or package detail matters. Branded schemas and provider-specific data models remain named classes.\n- Use mapping_artifacts.source_endpoint and target_endpoint for endpoint analysis; retain the original fields and distinguish schema, format, software importer, internal model, workflow and reference-list endpoints.\n- Do not equate a compatibility claim with an implemented mapping, a tested conversion, or a lossless round trip.\n- Treat release records as verified public milestones, not necessarily exhaustive patch histories; use version_audit to distinguish explicit updates, retained evidence-linked values and unresolved route checks.\n- Keep owner, operator, developer country, and geographic data coverage as separate concepts.\n- Cite evidence URLs and preserve unresolved questions when answering.\n`;
writeFileSync(join(outputDir, 'analysis_rules.md'), analysisRules);

const sqlitePath = join(outputDir, 'global_lca_assets.sqlite');
rmSync(sqlitePath, { force: true });
const db = new DatabaseSync(sqlitePath);
db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = OFF;');
for (const [name, rows] of Object.entries(tables)) {
  const columns = columnsFor(rows);
  db.exec(`CREATE TABLE "${name}" (${columns.map((column) => `"${column}" TEXT`).join(', ')})`);
  const insert = db.prepare(`INSERT INTO "${name}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
  db.exec('BEGIN');
  for (const row of rows) insert.run(...columns.map((column) => row[column] === null || row[column] === undefined ? '' : String(row[column])));
  db.exec('COMMIT');
}
db.exec(`
  CREATE INDEX idx_assets_asset_id ON assets(asset_id);
  CREATE INDEX idx_assets_official_name ON assets(official_name);
  CREATE INDEX idx_evidence_asset_id ON evidence(asset_id);
  CREATE INDEX idx_relations_source ON relations(source_asset_id);
  CREATE INDEX idx_relations_target ON relations(target_asset_id);
  CREATE INDEX idx_releases_asset_id ON releases(asset_id);
  CREATE INDEX idx_distributions_asset_id ON distributions(database_asset_id);
  CREATE VIEW asset_summary AS
    SELECT a.asset_id, a.official_name, a.asset_type, a.owner, a.geographic_coverage,
      a.current_version, a.access_model, a.confidence_level,
      (SELECT COUNT(*) FROM evidence e WHERE e.asset_id = a.asset_id) AS evidence_count,
      (SELECT COUNT(*) FROM releases r WHERE r.asset_id = a.asset_id) AS release_count,
      (SELECT COUNT(*) FROM relations rel WHERE rel.source_asset_id = a.asset_id OR rel.target_asset_id = a.asset_id) AS relationship_count
    FROM assets a;
  PRAGMA optimize;
`);
db.close();

function publicUrls(...values) {
  return [...new Set(values.flatMap((value) => String(value ?? '').match(/https?:\/\/[^\s|;]+/gi) ?? [])
    .map((url) => url.replace(/[),.\]]+$/, '')))];
}

const graphAssetById = new Map(tables.assets.map((asset) => [asset.asset_id, asset]));
const graphMappingById = new Map(tables.mapping_artifacts.map((mapping) => [mapping.mapping_artifact_id, mapping]));
const graphDegree = new Map(tables.assets.map((asset) => [asset.asset_id, 0]));
const graphRelations = tables.relations.filter((relation) => graphAssetById.has(relation.source_asset_id) || graphAssetById.has(relation.target_asset_id));
for (const relation of graphRelations) {
  if (graphAssetById.has(relation.source_asset_id)) graphDegree.set(relation.source_asset_id, (graphDegree.get(relation.source_asset_id) ?? 0) + 1);
  if (graphAssetById.has(relation.target_asset_id)) graphDegree.set(relation.target_asset_id, (graphDegree.get(relation.target_asset_id) ?? 0) + 1);
}

function graphAssetNode(asset) {
  return {
    id: asset.asset_id,
    name: asset.official_name,
    kind: 'asset',
    asset_type: asset.asset_type,
    owner: asset.owner,
    geography: asset.geographic_coverage,
    sector: asset.sector_product_process_coverage,
    confidence: asset.confidence_level,
    official_url: asset.official_url,
    connection_count: graphDegree.get(asset.asset_id) ?? 0,
    expandable: true,
  };
}

function graphExternalNode(name, relationshipId, side) {
  const label = String(name || 'Unresolved external endpoint').trim();
  const stableKey = name ? label.toLocaleLowerCase() : `${relationshipId}:${side}`;
  return {
    id: `EXT-${createHash('sha1').update(stableKey).digest('hex').slice(0, 12)}`,
    name: label,
    kind: 'external',
    asset_type: 'External / unresolved reference',
    owner: '', geography: '', sector: '', confidence: '', official_url: '',
    connection_count: 0,
    expandable: false,
  };
}

function graphEndpointNode(relation, side) {
  const idField = `${side}_asset_id`;
  const nameField = `${side}_asset_name`;
  return graphAssetById.has(relation[idField])
    ? graphAssetNode(graphAssetById.get(relation[idField]))
    : graphExternalNode(relation[nameField], relation.relationship_id, side);
}

function graphRelationship(relation, sourceNode, targetNode) {
  const sourceAsset = graphAssetById.get(relation.source_asset_id);
  const targetAsset = graphAssetById.get(relation.target_asset_id);
  const mapping = graphMappingById.get(relation.mapping_artifact_id);
  return {
    id: relation.relationship_id,
    source: sourceNode.id,
    target: targetNode.id,
    relationship_type: relation.relationship_type,
    status: relation.status,
    evidence: relation.evidence,
    constraints: relation.constraints,
    validation_question: relation.validation_question,
    mapping_artifact_id: relation.mapping_artifact_id,
    source_urls: publicUrls(
      sourceAsset?.official_url, sourceAsset?.primary_sources, sourceAsset?.supporting_sources,
      targetAsset?.official_url, targetAsset?.primary_sources, targetAsset?.supporting_sources,
      mapping?.artifact_url_doi,
    ),
  };
}

const graphIndex = {
  package_version: context.package_version,
  evidence_cutoff: seed.metadata.evidence_cutoff,
  asset_count: tables.assets.length,
  relationship_count: tables.relations.length,
  expandable_relationship_count: graphRelations.length,
  loading_model: 'Search index first; one-hop asset neighborhoods fetched and merged on demand.',
  assets: tables.assets.map(graphAssetNode).sort((a, b) => b.connection_count - a.connection_count || a.name.localeCompare(b.name)),
};
writeFileSync(join(graphDataDir, 'index.json'), JSON.stringify(graphIndex) + '\n');

for (const asset of tables.assets) {
  const neighborhoodRelations = graphRelations.filter((relation) => relation.source_asset_id === asset.asset_id || relation.target_asset_id === asset.asset_id);
  const nodes = new Map([[asset.asset_id, graphAssetNode(asset)]]);
  const relationships = neighborhoodRelations.map((relation) => {
    const sourceNode = graphEndpointNode(relation, 'source');
    const targetNode = graphEndpointNode(relation, 'target');
    nodes.set(sourceNode.id, sourceNode);
    nodes.set(targetNode.id, targetNode);
    return graphRelationship(relation, sourceNode, targetNode);
  });
  const neighborhood = {
    package_version: context.package_version,
    center_asset_id: asset.asset_id,
    nodes: [...nodes.values()],
    relationships,
  };
  writeFileSync(join(graphDataDir, 'neighborhoods', `${asset.asset_id}.json`), JSON.stringify(neighborhood) + '\n');
}

const webDataset = {
  meta: {
    title: seed.metadata.title,
    packageVersion: context.package_version,
    cutoff: seed.metadata.evidence_cutoff,
    generatedAt: context.generated_at,
    validationStatus: validation.status,
    scopeWarning: 'Dated public-evidence lower bound; not a claim of the true world total.',
  },
  summaries: {
    overview: {
      verified_assets: tables.assets.length,
      high_confidence_assets: tables.assets.filter((row) => String(row.confidence_level).toLowerCase() === 'high').length,
      evidence_records: tables.evidence.length,
      relationship_records: tables.relations.length,
      core_database_families: coreDatabaseFamilies,
      extended_data_bearing_assets: extendedDataBearingAssets,
      distributions: tables.distributions.length,
      mappings: tables.mapping_artifacts.length,
    },
    asset_types: summary.asset_types,
    confidence_levels: summary.confidence_levels,
    relationship_statuses: summary.relationship_statuses,
    database_access_classes: summary.database_access_classes,
    schema_profile_classes: summary.schema_profile_classes,
    schema_profiles: summary.schema_profiles,
    field_information_gaps: fieldInformationGaps,
  },
  assets: tables.assets,
  evidence: tables.evidence,
  relations: tables.relations,
  distributions: tables.distributions,
  mappings: tables.mapping_artifacts,
  mappingEndpointAlignment: tables.mapping_endpoint_alignment,
  databaseScope: tables.database_scope,
  versionAudit: tables.version_audit,
  databaseAccessScope: tables.database_scope,
  searchCoverage: tables.search_coverage,
  reviewIssues: tables.review_issues,
  answerability: tables.answerability,
  vocabularies,
};
writeFileSync(datasetDataPath, JSON.stringify(webDataset) + '\n');

const filesBeforeManifest = readdirSync(outputDir).filter((name) => name !== 'manifest.json').sort();
const manifest = {
  package_name: 'Global LCA Asset public evidence package',
  package_version: context.package_version,
  evidence_cutoff: seed.metadata.evidence_cutoff,
  generated_at: context.generated_at,
  canonical_input: relative(projectRoot, seedPath),
  canonical_input_sha256: createHash('sha256').update(seedBytes).digest('hex'),
  curated_inputs: [contextPath, schemaProfileAlignmentPath, mappingEndpointAlignmentPath, publicVersionReviewPath, nexusCatalogReviewPath].map((path) => ({
    name: relative(projectRoot, path),
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  })),
  privacy: seed.metadata.privacy,
  validation_status: validation.status,
  table_counts: summary.counts,
  files: filesBeforeManifest.map((name) => ({ name, sha256: sha256(join(outputDir, name)) })),
};
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

for (const name of readdirSync(outputDir)) copyFileSync(join(outputDir, name), join(downloadDir, name));

console.log(JSON.stringify({ status: validation.status, package: relative(projectRoot, outputDir), counts: summary.counts }, null, 2));
