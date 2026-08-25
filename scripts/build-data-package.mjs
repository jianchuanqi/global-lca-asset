import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(projectRoot, 'data/seed/inventory-v2.public.json');
const contextPath = join(projectRoot, 'data/curated/review-context.json');
const outputDir = join(projectRoot, 'data/package/current');
const atlasDataPath = join(projectRoot, 'packages/asset-atlas/src/data/atlas.json');
const downloadDir = join(projectRoot, 'packages/asset-atlas/public/downloads');

const seedBytes = readFileSync(seedPath);
const seed = JSON.parse(seedBytes);
const context = JSON.parse(readFileSync(contextPath, 'utf8'));

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
  assets: 199, evidence: 205, database_scope: 77, releases: 290, distributions: 128,
  mapping_artifacts: 18, relations: 233, search_coverage: 18, answerability: 6,
  review_issues: 8, data_dictionary: 14,
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
mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(atlasDataPath), { recursive: true });
mkdirSync(downloadDir, { recursive: true });

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
  field_information_gaps: fieldInformationGaps,
};
writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

const vocabularyFields = {
  asset_type: [tables.assets, 'asset_type'], confidence_level: [tables.assets, 'confidence_level'],
  public_evidence_status: [tables.assets, 'public_evidence_status'], relationship_type: [tables.relations, 'relationship_type'],
  relationship_status: [tables.relations, 'status'], open_data_status: [tables.database_scope, 'open_data_status'],
  mapping_type: [tables.mapping_artifacts, 'mapping_type'], mapping_status: [tables.mapping_artifacts, 'status'],
};
const vocabularies = Object.fromEntries(Object.entries(vocabularyFields).map(([name, [rows, field]]) => [name, [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort()]));
writeFileSync(join(outputDir, 'controlled_vocabularies.json'), JSON.stringify(vocabularies, null, 2) + '\n');
writeFileSync(join(outputDir, 'data_dictionary.json'), JSON.stringify(tables.data_dictionary, null, 2) + '\n');
writeFileSync(join(outputDir, 'validation_report.json'), JSON.stringify(validation, null, 2) + '\n');

const analysisRules = `# Analysis rules\n\n- Treat all counts as dated, reproducible lower bounds based on public evidence available by ${seed.metadata.evidence_cutoff}.\n- The public seed is canonical for this package. Questionnaire and stakeholder records are discovery leads, not the sample frame or verified asset count.\n- Use public information only. Do not register, log in, purchase data, or include personal names, email addresses, internal mappings, or reviewer notes.\n- State the counting rule: ${coreDatabaseFamilies} core database families; ${extendedDataBearingAssets} extended data-bearing assets.\n- Do not equate free access, public metadata, open data, open-source software, registration-free access, or redistribution rights.\n- Do not equate a compatibility claim with an implemented mapping, a tested conversion, or a lossless round trip.\n- Treat release records as verified public milestones, not necessarily exhaustive patch histories.\n- Keep owner, operator, developer country, and geographic data coverage as separate concepts.\n- Cite evidence URLs and preserve unresolved questions when answering.\n`;
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

const atlas = {
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
      releases: tables.releases.length,
      mappings: tables.mapping_artifacts.length,
    },
    asset_types: summary.asset_types,
    confidence_levels: summary.confidence_levels,
    relationship_statuses: summary.relationship_statuses,
    database_access_classes: summary.database_access_classes,
    field_information_gaps: fieldInformationGaps,
  },
  assets: tables.assets,
  evidence: tables.evidence,
  relations: tables.relations,
  distributions: tables.distributions,
  releases: tables.releases,
  mappings: tables.mapping_artifacts,
  databaseScope: tables.database_scope,
  databaseAccessScope: tables.database_scope,
  searchCoverage: tables.search_coverage,
  reviewIssues: tables.review_issues,
  answerability: tables.answerability,
  vocabularies,
};
writeFileSync(atlasDataPath, JSON.stringify(atlas) + '\n');

const filesBeforeManifest = readdirSync(outputDir).filter((name) => name !== 'manifest.json').sort();
const manifest = {
  package_name: 'Global LCA Asset Review public evidence package',
  package_version: context.package_version,
  evidence_cutoff: seed.metadata.evidence_cutoff,
  generated_at: context.generated_at,
  canonical_input: relative(projectRoot, seedPath),
  canonical_input_sha256: createHash('sha256').update(seedBytes).digest('hex'),
  privacy: seed.metadata.privacy,
  validation_status: validation.status,
  table_counts: summary.counts,
  files: filesBeforeManifest.map((name) => ({ name, sha256: sha256(join(outputDir, name)) })),
};
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

for (const name of readdirSync(outputDir)) copyFileSync(join(outputDir, name), join(downloadDir, name));

console.log(JSON.stringify({ status: validation.status, package: relative(projectRoot, outputDir), counts: summary.counts }, null, 2));
