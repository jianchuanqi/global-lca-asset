import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(projectRoot, 'data/package/current');
const manifestPath = join(packageDir, 'manifest.json');
if (!existsSync(manifestPath)) throw new Error('Data package is missing. Run pnpm data:build first.');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const validation = JSON.parse(readFileSync(join(packageDir, 'validation_report.json'), 'utf8'));
const failures = [];

if (validation.status !== 'passed') failures.push(`validation status is ${validation.status}`);
for (const file of manifest.files) {
  const path = join(packageDir, file.name);
  if (!existsSync(path)) { failures.push(`missing file: ${file.name}`); continue; }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== file.sha256) failures.push(`hash mismatch: ${file.name}`);
}

const db = new DatabaseSync(join(packageDir, 'global_lca_assets.sqlite'), { readOnly: true });
for (const [table, expected] of Object.entries(manifest.table_counts)) {
  const actual = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
  if (actual !== expected) failures.push(`${table}: manifest ${expected}, SQLite ${actual}`);
}
const assetSummaryCount = db.prepare('SELECT COUNT(*) AS count FROM asset_summary').get().count;
if (assetSummaryCount !== manifest.table_counts.assets) failures.push('asset_summary view does not cover all assets');
const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
if (integrity !== 'ok') failures.push(`SQLite integrity check: ${integrity}`);
db.close();

if (failures.length) throw new Error(`Data-package verification failed:\n${failures.join('\n')}`);
console.log(`Verified package ${manifest.package_version}: ${manifest.table_counts.assets} assets, ${manifest.table_counts.evidence} evidence records, SQLite integrity ok.`);
