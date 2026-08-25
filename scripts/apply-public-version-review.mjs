import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(projectRoot, 'data/seed/inventory-v2.public.json');
const reviewPath = join(projectRoot, 'data/curated/public-version-review-2026-08-25.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));

const tableNames = {
  assets: 'Master Asset Inventory',
  evidence: 'Source Evidence',
  database_scope: 'Database Scope',
  releases: 'Asset Releases',
  distributions: 'Distributions',
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

function fieldMap(rows) {
  return new Map(Object.keys(rows[0]).map((field) => [snakeCase(field), field]));
}

function normalizedValue(row, field) {
  const sourceField = [...Object.keys(row)].find((key) => snakeCase(key) === field);
  return sourceField ? row[sourceField] : undefined;
}

for (const [logicalName, patches] of Object.entries(review.table_patches)) {
  const rows = seed.tables[tableNames[logicalName]];
  const fields = fieldMap(rows);
  for (const patch of patches) {
    const matches = rows.filter((row) => Object.entries(patch.match).every(([field, value]) => normalizedValue(row, field) === value));
    if (matches.length !== 1) throw new Error(`Seed patch for ${logicalName} matched ${matches.length} rows: ${JSON.stringify(patch.match)}`);
    for (const [field, value] of Object.entries(patch.set)) {
      const sourceField = fields.get(field);
      if (!sourceField) throw new Error(`Unknown ${logicalName} field: ${field}`);
      matches[0][sourceField] = value;
    }
  }
}

for (const [logicalName, additions] of Object.entries(review.append)) {
  const rows = seed.tables[tableNames[logicalName]];
  const fields = fieldMap(rows);
  const idField = logicalName === 'evidence' ? 'evidence_id' : 'distribution_id';
  for (const addition of additions) {
    if (rows.some((row) => normalizedValue(row, idField) === addition[idField])) continue;
    rows.push(Object.fromEntries([...fields].map(([normalized, source]) => [source, addition[normalized] ?? ''])));
  }
}

seed.metadata.evidence_cutoff = review.reviewed_at;
writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Applied ${review.confirmed_updates.length} confirmed version updates to ${seedPath}`);
