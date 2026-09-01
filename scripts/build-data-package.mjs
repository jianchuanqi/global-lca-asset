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
const softwareMarketReviewPath = join(projectRoot, 'data/curated/software-market-review-2026-09-01.json');
const softwareSemanticAlignmentPath = join(projectRoot, 'data/curated/software-semantic-alignment-2026-09-01.json');
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
const softwareMarketReview = JSON.parse(readFileSync(softwareMarketReviewPath, 'utf8'));
const softwareSemanticAlignment = JSON.parse(readFileSync(softwareSemanticAlignmentPath, 'utf8'));

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
  version_audit: 'version_audit_id', software_scope: 'software_record_id',
  software_company_roles: 'software_company_role_id', software_role_gaps: 'software_role_gap_id',
  software_candidate_review: 'candidate_review_id',
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

const softwareCatalogs = [
  {
    key: 'pact',
    name: 'WBCSD PACT Network solution directory',
    sourceUrl: 'https://www.carbon-transparency.org/network',
    relationTargetAssetId: 'LCA-FMT-0008',
    relationType: 'supports PCF exchange specification',
    candidates: softwareMarketReview.pact_candidates,
  },
  {
    key: 'ecoinvent',
    name: 'ecoinvent software tools partner directory',
    sourceUrl: 'https://ecoinvent.org/partners/?category=software-tools',
    relationTargetAssetId: 'LCA-DB-0001',
    relationType: 'publicly listed software use of database',
    candidates: softwareMarketReview.ecoinvent_candidates,
  },
  {
    key: 'official',
    name: 'Targeted official-product and sector-tool search',
    sourceUrl: '',
    relationTargetAssetId: 'LCA-STD-0003',
    relationType: 'states implementation of method or standard',
    candidates: softwareMarketReview.official_product_candidates,
  },
];

const allSoftwareCandidates = softwareCatalogs.flatMap((catalog) => catalog.candidates.map((candidate) => ({ ...candidate, catalog })));
const acceptedSoftwareCandidates = allSoftwareCandidates.filter((candidate) => candidate.decision === 'accept_new');

const capabilityAliasMap = new Map();
for (const capability of softwareSemanticAlignment.capability_taxonomy) {
  capabilityAliasMap.set(capability.label.toLocaleLowerCase(), capability.label);
  for (const alias of capability.aliases) {
    const key = alias.toLocaleLowerCase();
    if (capabilityAliasMap.has(key) && capabilityAliasMap.get(key) !== capability.label) {
      throw new Error(`Duplicate software capability alias: ${alias}`);
    }
    capabilityAliasMap.set(key, capability.label);
  }
}
const primaryFunctionIdByLabel = new Map(softwareSemanticAlignment.primary_function_taxonomy.map((row) => [row.label, row.function_id]));

function alignSoftwareCapabilities(rawCapabilities) {
  const aligned = [];
  const unresolved = [];
  for (const raw of rawCapabilities) {
    const canonical = capabilityAliasMap.get(String(raw).trim().toLocaleLowerCase());
    if (canonical) aligned.push(canonical);
    else unresolved.push(String(raw).trim());
  }
  return { aligned: [...new Set(aligned)], unresolved: [...new Set(unresolved)] };
}

function primarySoftwareFunction(alignedCapabilities) {
  if (alignedCapabilities.includes('Life cycle assessment modelling') || alignedCapabilities.includes('Product carbon footprint calculation')) return 'LCA/PCF modelling and calculation';
  if (alignedCapabilities.includes('PCF data exchange and interoperability')) return 'PCF data exchange and interoperability';
  if (alignedCapabilities.includes('EPD and environmental reporting')) return 'EPD and environmental reporting workflow';
  if (alignedCapabilities.includes('Eco-design and scenario analysis') || alignedCapabilities.includes('Design and planning workflow')) return 'Eco-design and scenario assessment';
  if (alignedCapabilities.includes('API and enterprise integration') || alignedCapabilities.includes('Environmental data and calculation models') || alignedCapabilities.includes('Supplier and product data management')) return 'Data and systems integration';
  return 'Supporting LCA/PCF model or workflow';
}

function softwareProductType(asset, alignedCapabilities) {
  const corpus = [asset.official_name, asset.short_description, asset.main_use_cases, asset.data_content_type, asset.sector_product_process_coverage].join(' ');
  const hasCalculation = alignedCapabilities.includes('Life cycle assessment modelling') || alignedCapabilities.includes('Product carbon footprint calculation');
  if (!hasCalculation && alignedCapabilities.includes('PCF data exchange and interoperability')) return 'Data exchange or interoperability service';
  if (/\bapi\b|toolkit|library|calculation model|source repository|formatter/i.test(corpus) && !/platform|software application/i.test(corpus)) return 'API, library, or calculation model';
  if (/building|construction|pavement|packag|agri|food|waste|automotive|material|chemical|apparel|textile/i.test(String(asset.sector_product_process_coverage || '')) && !/multi-sector/i.test(String(asset.sector_product_process_coverage || ''))) return 'Sector-specific workflow application';
  return 'Software application or platform';
}

function candidateSourceUrls(candidate) {
  return [...new Set([candidate.official_url, candidate.source_url, candidate.catalog.sourceUrl].filter(Boolean))];
}

function candidateEvidenceExcerpt(candidate) {
  if (candidate.evidence_excerpt) return candidate.evidence_excerpt;
  const capabilities = (candidate.capabilities ?? []).join(', ') || 'a qualifying LCA/PCF software function';
  return `${candidate.catalog.name} identifies ${candidate.name}, attributes it to ${candidate.developer || 'the listed provider'}, and publicly describes: ${capabilities}.`;
}

const assetNameByIdBeforeSoftwareReview = new Map(tables.assets.map((asset) => [asset.asset_id, asset.official_name]));
let nextEvidenceNumber = Math.max(...tables.evidence.map((row) => Number(String(row.evidence_id).match(/\d+/)?.[0] ?? 0))) + 1;
let nextRelationshipNumber = Math.max(...tables.relations.map((row) => Number(String(row.relationship_id).match(/\d+/)?.[0] ?? 0))) + 1;

for (const candidate of acceptedSoftwareCandidates) {
  const capabilities = candidate.capabilities ?? [];
  const alignedCapabilities = alignSoftwareCapabilities(capabilities).aligned;
  const primaryFunction = primarySoftwareFunction(alignedCapabilities);
  const targetAssetId = candidate.relationship_target_asset_id || candidate.catalog.relationTargetAssetId;
  const targetName = assetNameByIdBeforeSoftwareReview.get(targetAssetId) ?? targetAssetId;
  const sourceUrls = candidateSourceUrls(candidate);
  const evidenceExcerpt = candidateEvidenceExcerpt(candidate);
  const isPact = candidate.catalog.key === 'pact' || targetAssetId === 'LCA-FMT-0008';
  const isEcoinvent = candidate.catalog.key === 'ecoinvent';
  tables.assets.push({
    asset_id: candidate.asset_id,
    official_name: candidate.name,
    alternative_name_acronym: candidate.alternative_name ?? '',
    asset_type: 'Software / API / tool',
    short_description: `${candidate.name} is a publicly documented software product whose aligned primary function is ${primaryFunction.toLowerCase()}, included under the 2026-09-01 PCF/LCA software review rule.`,
    owner: candidate.owner || '',
    operator_maintainer: candidate.operator || '',
    developer: candidate.developer,
    official_url: candidate.official_url,
    geographic_coverage: candidate.geography ?? 'Not publicly confirmed',
    sector_product_process_coverage: candidate.sector ?? 'Multi-sector or source-listed industries; exact scope not fully reviewed',
    intended_users: 'LCA/PCF practitioners, sustainability teams, product teams, and supply-chain teams as applicable',
    main_use_cases: capabilities.join('; '),
    language: 'Public documentation reviewed in the language available at the cited route',
    temporal_coverage: 'Not publicly confirmed',
    current_version: 'Not publicly confirmed',
    release_update_date: 'Not publicly confirmed',
    maintenance_status: candidate.lifecycle_status ?? `Listed in ${candidate.catalog.name} or an official product page at the evidence cut-off`,
    access_model: 'Public product information; software access, price, and account requirements were not tested',
    licence_or_usage_rights: 'Not publicly confirmed',
    commercial_restricted_open_status: 'Software product; commercial/open-source status not fully reviewed',
    registration_requirement: 'Not assessed; no registration or login was used in this review',
    governance_arrangement: `The reviewed source attributes the product to ${candidate.developer} as developer/provider. Owner and operator/maintainer are recorded only when separately supported.`,
    long_term_stewardship_information: 'Not publicly confirmed',
    data_content_type: capabilities.join('; '),
    data_model_or_schema: isPact ? 'PACT Technical Specifications v3 interoperability claim; product-internal model not reviewed' : 'Product-internal model not publicly reviewed',
    exchange_format: isPact ? 'PACT Technical Specifications v3' : 'Not publicly confirmed',
    api_or_machine_readable_interface: capabilities.some((value) => /API|integration|exchange|connector/i.test(value)) ? 'Public integration or exchange capability stated; exact API contract not reviewed' : 'Not publicly confirmed',
    nomenclature_classification: 'Not publicly confirmed',
    identifiers: 'Not publicly confirmed',
    metadata_approach: 'Public product or authoritative directory description',
    versioning_mechanism: 'Not publicly confirmed',
    documentation_availability: 'Public product or directory page; restricted application content not accessed',
    qa_validation_approach: 'Public provider or directory capability statement; no independent calculation test performed',
    review_procedure: 'Not publicly confirmed',
    data_quality_documentation: 'Not exhaustively reviewed',
    methodological_basis: capabilities.includes('LCA') ? 'Publicly stated LCA capability; exact method and implementation require product-level review' : capabilities.includes('PCF calculation') ? 'Publicly stated PCF calculation capability; exact method and implementation require product-level review' : 'Publicly stated PCF exchange or supporting capability',
    provenance_information: `Curated from ${candidate.catalog.name} and the linked official product route`,
    citation_mechanism: 'Cite the product and directory URLs retained in this package',
    known_limitations: 'Identity and stated capability were verified from public pages; software access, outputs, numerical quality, and implementation performance were not tested',
    related_assets: targetName,
    relationship_type: candidate.catalog.relationType,
    evidence_for_relationship: evidenceExcerpt,
    import_export_compatibility: isPact ? 'PACT Network listing or official product statement supports PCF data-exchange compatibility; calculation quality is a separate claim' : isEcoinvent ? 'ecoinvent lists the product in its selected software-tools directory' : 'The official product page states use of the named method, standard, or sector workflow',
    existing_mapping_or_conversion: 'Not publicly confirmed',
    potential_interoperability_opportunity: 'Connect public product capability, organization roles, standards, formats, and database use without inferring untested compatibility',
    known_interoperability_constraint: 'A public capability statement does not demonstrate exact version support, calculation equivalence, or lossless data exchange',
    primary_sources: sourceUrls.join(' ; '),
    supporting_sources: candidate.catalog.sourceUrl || candidate.source_url || '',
    evidence_excerpt: evidenceExcerpt,
    access_date: softwareMarketReview.reviewed_at,
    confidence_level: 'High',
    unresolved_questions: 'Exact product version; licence and access terms; independent calculation or exchange tests; detailed method and data provenance',
    public_evidence_status: 'Identity, provider role, and stated qualifying capability publicly verified; software not accessed or tested',
    primary_software_function: primaryFunction,
    software_capabilities: alignedCapabilities.join('; '),
    software_capabilities_original: capabilities.join('; '),
    source_software_class: candidate.software_class || '',
    software_discovery_source: candidate.catalog.name,
  });

  tables.evidence.push({
    evidence_id: `E-${String(nextEvidenceNumber++).padStart(4, '0')}`,
    asset_id: candidate.asset_id,
    source_title: `${candidate.name} — public software capability and provider evidence`,
    publisher_maintainer: candidate.developer,
    url_or_file: sourceUrls.join(' ; '),
    source_type: candidate.catalog.key === 'official' ? 'Official product page' : 'Authoritative directory plus official product route',
    access_date: softwareMarketReview.reviewed_at,
    supported_fields: 'identity; product type; developer; qualifying LCA/PCF capability; relationship',
    evidence_excerpt: evidenceExcerpt,
    source_reliability: 'Primary or authoritative directory / high',
    access_restriction: 'Public pages only; software application not accessed',
    publicly_accessed: 'Yes',
    notes: 'Capability evidence does not constitute independent software or calculation validation',
  });

  tables.relations.push({
    relationship_id: `REL-${String(nextRelationshipNumber++).padStart(4, '0')}`,
    source_asset_id: candidate.asset_id,
    source_asset_name: candidate.name,
    source_resolution: 'Curated software market review',
    target_asset_id: targetAssetId,
    target_asset_name: targetName,
    target_resolution: 'Exact reviewed asset ID',
    relationship_type: candidate.catalog.relationType,
    status: 'Confirmed public statement or directory listing',
    evidence: evidenceExcerpt,
    constraints: 'Public capability or compatibility claim; no independent functional, numerical, or exchange test was performed',
    validation_question: 'Recheck product lifecycle, exact versions, method implementation, and exchange conformance in the next review',
    mapping_artifact_id: null,
  });
}

tables.search_coverage.push(...normalizeRows(softwareMarketReview.search_coverage_additions));

tables.software_candidate_review = allSoftwareCandidates.map((candidate, index) => ({
  candidate_review_id: `SCR-${String(index + 1).padStart(4, '0')}`,
  discovery_register: candidate.catalog.name,
  candidate_name: candidate.name,
  developer_provider: candidate.developer ?? 'Not publicly confirmed',
  official_url: candidate.official_url ?? '',
  source_url: candidate.source_url || candidate.catalog.sourceUrl || candidate.official_url || '',
  qualifying_capabilities: (candidate.capabilities ?? []).join('; '),
  review_status: candidate.decision === 'accept_new' ? 'Promoted as new asset' : candidate.decision === 'existing' ? 'Matched existing asset' : 'Excluded from verified software count',
  matched_asset_id: candidate.asset_id || candidate.matched_asset_id || '',
  decision_reason: candidate.reason || (candidate.decision === 'accept_new' ? 'Distinct product with a publicly stated qualifying LCA, PCF-calculation, or PCF-exchange function' : 'Deduplicated against an existing software asset'),
  reviewed_at: softwareMarketReview.reviewed_at,
}));

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

function multiValueCount(rows, field) {
  const expanded = rows.flatMap((row) => String(row[field] || '').split(/\s*;\s*/g).filter(Boolean).map((value) => ({ value })));
  return groupCount(expanded, 'value');
}

const candidatesByAssetId = new Map();
for (const candidate of allSoftwareCandidates) {
  const matchedId = candidate.asset_id || candidate.matched_asset_id;
  if (!matchedId) continue;
  if (!candidatesByAssetId.has(matchedId)) candidatesByAssetId.set(matchedId, []);
  candidatesByAssetId.get(matchedId).push(candidate);
}

function inferredCapabilities(asset) {
  const corpus = [asset.official_name, asset.short_description, asset.main_use_cases, asset.data_content_type, asset.related_assets, asset.software_capabilities].join(' ');
  const capabilities = [];
  if (/\blca\b|life[ -]cycle assessment/i.test(corpus)) capabilities.push('LCA');
  if (/\bpcf\b|product carbon footprint|carbon footprint/i.test(corpus)) capabilities.push('PCF calculation');
  if (/\bepd\b|environmental product declaration/i.test(corpus)) capabilities.push('EPD workflow');
  if (/exchange|interoperab|convert|mapping|schema|format/i.test(corpus)) capabilities.push('Data exchange / conversion');
  if (/\bapi\b|json|machine-readable|toolkit/i.test(corpus)) capabilities.push('API / developer tooling');
  if (/model|calculator|calculation/i.test(corpus)) capabilities.push('Domain calculation model');
  return [...new Set(capabilities.length ? capabilities : ['Supporting LCA/PCF workflow'])];
}

const softwareAssets = tables.assets.filter((asset) => asset.asset_type === 'Software / API / tool');
const roleFieldByRole = { owner: 'owner', developer: 'developer', 'operator/maintainer': 'operator_maintainer' };
const isPublicActorLabel = (value) => Boolean(String(value || '').trim()) && !/not publicly confirmed|unknown|not stated/i.test(String(value));

function inferActorEntityType(label) {
  if (/university|institute|laboratory|research cent(?:er|re)|\bETH\b|\bRWTH\b|college/i.test(label)) return 'University / research institution';
  if (/department|agency|administration|ministry|government/i.test(label)) return 'Public body';
  if (/foundation|association|Cascale|Building Transparency|The Circulate Initiative/i.test(label)) return 'Nonprofit / industry organization';
  if (/consortium|community|commons|contributors|research team/i.test(label)) return 'Public consortium / community';
  return 'Company';
}

function resolvePublicProvider(rawLabel, productName, evidenceUrl) {
  const raw = String(rawLabel || '').trim();
  if (!isPublicActorLabel(raw)) return null;
  const aligned = softwareSemanticAlignment.provider_name_alignments[raw];
  if (aligned) return {
    organization_name: aligned.canonical_name,
    entity_type: aligned.entity_type,
    original_public_label: raw,
    resolution_status: aligned.resolution_status,
    evidence_url: aligned.evidence_url,
  };
  if (raw.localeCompare(String(productName || '').trim(), undefined, { sensitivity: 'base' }) === 0) return null;
  return {
    organization_name: raw,
    entity_type: inferActorEntityType(raw),
    original_public_label: raw,
    resolution_status: 'Distinct public developer/provider label retained; legal entity suffix not independently normalized',
    evidence_url: evidenceUrl,
  };
}

const roleRows = [];
const roleGaps = [];
const roleKeys = new Set();
const gapKeys = new Set();
function addRole(asset, assertion) {
  if (!assertion?.organization_name || !assertion?.role) return;
  const key = `${asset.asset_id}\u0000${assertion.role}\u0000${assertion.organization_name}`;
  if (roleKeys.has(key)) return;
  roleKeys.add(key);
  const rawField = roleFieldByRole[assertion.role];
  roleRows.push({
    asset_id: asset.asset_id,
    product_name: asset.official_name,
    organization_name: assertion.organization_name,
    entity_type: assertion.entity_type || inferActorEntityType(assertion.organization_name),
    role: assertion.role,
    original_public_label: assertion.original_public_label || String(asset[rawField] || '').trim() || assertion.organization_name,
    resolution_status: assertion.resolution_status || 'Actor and role resolved from reviewed public evidence',
    evidence_url: assertion.evidence_url || asset.official_url || asset.primary_sources,
    reviewed_at: softwareMarketReview.reviewed_at,
  });
}
function addRoleGap(asset, role, rawLabel, evidenceUrl, reason) {
  if (!isPublicActorLabel(rawLabel)) return;
  const key = `${asset.asset_id}\u0000${role}\u0000${rawLabel}`;
  if (gapKeys.has(key)) return;
  gapKeys.add(key);
  roleGaps.push({
    asset_id: asset.asset_id,
    product_name: asset.official_name,
    role,
    unresolved_public_label: rawLabel,
    reason,
    evidence_url: evidenceUrl || asset.official_url || asset.primary_sources,
    reviewed_at: softwareMarketReview.reviewed_at,
  });
}

for (const asset of softwareAssets) {
  const legacyAssertions = softwareSemanticAlignment.legacy_role_assertions[asset.asset_id];
  const assetNumber = Number(String(asset.asset_id).match(/(\d+)$/)?.[1] || 0);
  if (legacyAssertions) {
    for (const assertion of legacyAssertions) addRole(asset, assertion);
    for (const [role, field] of Object.entries(roleFieldByRole)) {
      const rawLabel = String(asset[field] || '').trim();
      if (isPublicActorLabel(rawLabel) && !legacyAssertions.some((assertion) => assertion.role === role)) {
        addRoleGap(asset, role, rawLabel, asset.official_url, 'The prior record contains a public label, but this review did not resolve it to an evidence-linked actor for this role.');
      }
    }
    continue;
  }
  if (assetNumber <= 43) {
    for (const [role, field] of Object.entries(roleFieldByRole)) {
      addRoleGap(asset, role, String(asset[field] || '').trim(), asset.official_url, 'The prior label was not promoted because the actor and role were not independently resolved in this review.');
    }
    continue;
  }
  for (const candidate of candidatesByAssetId.get(asset.asset_id) ?? []) {
    for (const [role, field] of [['owner', 'owner'], ['developer', 'developer'], ['operator/maintainer', 'operator']]) {
      const rawLabel = String(candidate[field] || '').trim();
      if (!isPublicActorLabel(rawLabel)) continue;
      const resolved = resolvePublicProvider(rawLabel, asset.official_name, candidate.official_url || candidate.source_url);
      if (resolved) addRole(asset, { role, ...resolved });
      else addRoleGap(asset, role, rawLabel, candidate.official_url || candidate.source_url, 'The source label is identical to the product name and no distinct legal, institutional, or individual actor was resolved.');
    }
  }
}

tables.software_role_gaps = roleGaps
  .sort((a, b) => a.asset_id.localeCompare(b.asset_id) || a.role.localeCompare(b.role) || a.unresolved_public_label.localeCompare(b.unresolved_public_label))
  .map((row, index) => ({ software_role_gap_id: `SRG-${String(index + 1).padStart(5, '0')}`, ...row }));

const rolesByAssetId = new Map();
for (const row of roleRows) {
  if (!rolesByAssetId.has(row.asset_id)) rolesByAssetId.set(row.asset_id, []);
  rolesByAssetId.get(row.asset_id).push(row);
}
for (const asset of softwareAssets) {
  const roles = rolesByAssetId.get(asset.asset_id) ?? [];
  for (const [role, field] of Object.entries(roleFieldByRole)) {
    asset[field] = [...new Set(roles.filter((row) => row.role === role).map((row) => row.organization_name))].join('; ');
  }
  asset.governance_arrangement = roles.length
    ? `Evidence-linked actor roles are recorded in software_company_roles; missing roles are not inferred from other roles or from the product name.`
    : 'No owner, developer, or operator/maintainer actor was independently resolved from the reviewed public evidence.';
}

tables.software_scope = softwareAssets.map((asset, index) => {
  const matchedCandidates = candidatesByAssetId.get(asset.asset_id) ?? [];
  const curatedCandidate = matchedCandidates.find((candidate) => candidate.decision === 'accept_new') || matchedCandidates[0];
  const rawCapabilities = curatedCandidate?.capabilities?.length ? curatedCandidate.capabilities : inferredCapabilities(asset);
  const { aligned: alignedCapabilities, unresolved: unresolvedCapabilities } = alignSoftwareCapabilities(rawCapabilities);
  const primaryFunction = primarySoftwareFunction(alignedCapabilities);
  const sourceUrls = [...new Set([
    asset.official_url,
    ...String(asset.primary_sources || '').split(/\s*;\s*/g),
    ...String(asset.supporting_sources || '').split(/\s*;\s*/g),
    ...matchedCandidates.flatMap(candidateSourceUrls),
  ].filter(Boolean))];
  const pactCandidate = matchedCandidates.find((candidate) => candidate.catalog.key === 'pact');
  const ecoinventCandidate = matchedCandidates.find((candidate) => candidate.catalog.key === 'ecoinvent');
  const officialPactCandidate = matchedCandidates.find((candidate) => candidate.relationship_target_asset_id === 'LCA-FMT-0008');
  const roles = rolesByAssetId.get(asset.asset_id) ?? [];
  const gaps = tables.software_role_gaps.filter((row) => row.asset_id === asset.asset_id);
  const actorSummary = roles.length
    ? [...new Set(roles.map((row) => `${row.organization_name} (${row.role})`))].join('; ')
    : 'No actor identity publicly resolved in this review';
  return {
    software_record_id: `SWR-${String(index + 1).padStart(4, '0')}`,
    asset_id: asset.asset_id,
    product_name: asset.official_name,
    product_type: softwareProductType(asset, alignedCapabilities),
    primary_function_id: primaryFunctionIdByLabel.get(primaryFunction),
    primary_function: primaryFunction,
    functional_capabilities: alignedCapabilities.join('; '),
    capabilities_original: rawCapabilities.join('; '),
    unresolved_capability_labels: unresolvedCapabilities.join('; '),
    source_software_class: asset.source_software_class || asset.software_class || curatedCandidate?.software_class || '',
    market_scope_status: curatedCandidate?.decision === 'accept_new' || matchedCandidates.length ? 'Qualifying PCF/LCA product or interoperability solution' : 'Existing broader LCA/PCF software, API, model, or workflow asset',
    owner: asset.owner,
    developer: asset.developer,
    operator_maintainer: asset.operator_maintainer,
    actor_role_summary: actorSummary,
    role_assertion_count: roles.length,
    unresolved_role_label_count: gaps.length,
    role_resolution_status: roles.length ? (gaps.length ? 'Partial actor resolution' : 'Evidence-linked actors resolved') : 'No resolved actor identity',
    sector_scope: asset.sector_product_process_coverage,
    geographic_coverage: asset.geographic_coverage,
    standard_associations: pactCandidate
      ? 'WBCSD Partnership for Carbon Transparency (PACT) Technical Specifications — PACT Network directory listing'
      : officialPactCandidate ? 'WBCSD Partnership for Carbon Transparency (PACT) Technical Specifications — official product compatibility statement' : '',
    standard_association_basis: pactCandidate ? 'Authoritative network directory provenance' : officialPactCandidate ? 'Official product statement' : '',
    ecoinvent_directory_status: ecoinventCandidate ? 'Listed in ecoinvent software tools directory at the evidence cut-off' : '',
    lifecycle_status: asset.maintenance_status,
    access_model: asset.access_model,
    official_product_url: asset.official_url,
    discovery_source: matchedCandidates.length ? [...new Set(matchedCandidates.map((candidate) => candidate.catalog.name))].join('; ') : 'Prior Global LCA Asset inventory',
    evidence_urls: sourceUrls.join(' ; '),
    confidence_level: asset.confidence_level,
    classification_basis: curatedCandidate ? 'Curated semantic alignment of the 2026-09-01 software-market review' : 'Curated semantic alignment of the existing evidence-linked software record',
    reviewed_at: softwareMarketReview.reviewed_at,
  };
});

const organizationMetadata = new Map();
for (const asset of tables.assets.filter((row) => row.asset_type !== 'Software / API / tool')) {
  for (const field of ['owner', 'developer', 'operator_maintainer']) {
    const label = String(asset[field] || '').trim();
    if (!isPublicActorLabel(label) || organizationMetadata.has(label)) continue;
    organizationMetadata.set(label, {
      entity_type: 'Not typed in this review',
      normalization_status: /[;/]|\band\b|\//i.test(label) ? 'Composite public label—review before splitting' : 'Exact public label',
    });
  }
}
for (const row of roleRows) {
  organizationMetadata.set(row.organization_name, {
    entity_type: row.entity_type,
    normalization_status: row.resolution_status,
  });
}
const labels = [...organizationMetadata.keys()].sort((a, b) => a.localeCompare(b));
const organizationId = new Map(labels.map((label, index) => [label, `ORG-${String(index + 1).padStart(4, '0')}`]));
tables.organizations = labels.map((label) => ({
  organization_id: organizationId.get(label),
  preferred_label: label,
  entity_type: organizationMetadata.get(label).entity_type,
  normalization_status: organizationMetadata.get(label).normalization_status,
}));

tables.software_company_roles = roleRows
  .sort((a, b) => a.asset_id.localeCompare(b.asset_id) || a.role.localeCompare(b.role) || a.organization_name.localeCompare(b.organization_name))
  .map((row, index) => ({
    software_company_role_id: `SCRL-${String(index + 1).padStart(5, '0')}`,
    ...row,
    organization_id: organizationId.get(row.organization_name),
  }));

tables.asset_organizations = [];
for (const asset of tables.assets.filter((row) => row.asset_type !== 'Software / API / tool')) {
  for (const [field, relationshipType] of [['owner', 'owner'], ['developer', 'developer'], ['operator_maintainer', 'operator/maintainer']]) {
    const label = String(asset[field] || '').trim();
    if (!organizationId.has(label)) continue;
    tables.asset_organizations.push({
      asset_id: asset.asset_id,
      organization_id: organizationId.get(label),
      relationship_type: relationshipType,
      original_public_label: label,
    });
  }
}
for (const row of tables.software_company_roles) {
  tables.asset_organizations.push({
    asset_id: row.asset_id,
    organization_id: row.organization_id,
    relationship_type: row.role,
    original_public_label: row.original_public_label,
  });
}
tables.asset_organizations = tables.asset_organizations.map((row, index) => ({
  asset_organization_id: `AO-${String(index + 1).padStart(5, '0')}`,
  ...row,
}));

const requiredCounts = {
  assets: normalizeRows(seed.tables['Master Asset Inventory'] ?? []).length + acceptedSoftwareCandidates.length,
  evidence: normalizeRows(seed.tables['Source Evidence'] ?? []).length + acceptedSoftwareCandidates.length,
  database_scope: normalizeRows(seed.tables['Database Scope'] ?? []).length,
  releases: normalizeRows(seed.tables['Asset Releases'] ?? []).length,
  distributions: normalizeRows(seed.tables['Distributions'] ?? []).length,
  mapping_artifacts: normalizeRows(seed.tables['Mapping Artifacts'] ?? []).length,
  relations: normalizeRows(seed.tables['Relationship Index'] ?? []).length + acceptedSoftwareCandidates.length,
  search_coverage: normalizeRows(seed.tables['Search Coverage'] ?? []).length + softwareMarketReview.search_coverage_additions.length,
  answerability: context.answerability.length,
  review_issues: context.review_issues.length,
  data_dictionary: context.data_dictionary.length,
  version_audit: normalizeRows(seed.tables['Database Scope'] ?? []).length,
  mapping_endpoint_alignment: 26,
  software_scope: softwareAssets.length,
  software_candidate_review: allSoftwareCandidates.length,
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
warnings.push('Software actor edges are evidence-linked only. Missing owner, developer, or operator/maintainer roles remain missing, and unresolved public labels are retained in software_role_gaps.');
warnings.push('Schema/profile canonical labels merge only reviewed synonyms; each distribution retains its original public label and alignment method.');
warnings.push('Mapping endpoints are typed by the transformed or consuming object; software products, schemas, internal models, workflows and reference lists are not interchangeable.');
const schemaProfileAlignmentComplete = tables.distributions.every((row) => row.schema_profile_original && row.schema_profile && row.schema_profile_class);
if (!schemaProfileAlignmentComplete) errors.push('distributions: incomplete schema/profile alignment');
const mappingEndpointAlignmentComplete = tables.mapping_artifacts.every((row) => row.source_endpoint && row.source_endpoint_kind && row.target_endpoint && row.target_endpoint_kind);
if (!mappingEndpointAlignmentComplete) errors.push('mapping_artifacts: incomplete endpoint alignment');
const acceptedSoftwareIds = new Set(acceptedSoftwareCandidates.map((candidate) => candidate.asset_id));
if (acceptedSoftwareIds.size !== acceptedSoftwareCandidates.length) errors.push('software market review: duplicate accepted asset IDs');
if (acceptedSoftwareCandidates.length !== 87) errors.push(`software market review: expected 87 newly accepted products, found ${acceptedSoftwareCandidates.length}`);
if (tables.software_scope.length !== softwareAssets.length) errors.push('software_scope: not every software asset has one scope row');
const primaryFunctionLabels = new Set(softwareSemanticAlignment.primary_function_taxonomy.map((row) => row.label));
const productTypeLabels = new Set(softwareSemanticAlignment.product_type_taxonomy);
const softwareSemanticAlignmentComplete = tables.software_scope.every((row) =>
  row.primary_function_id && primaryFunctionLabels.has(row.primary_function) && productTypeLabels.has(row.product_type) && row.functional_capabilities && !row.unresolved_capability_labels
);
if (!softwareSemanticAlignmentComplete) errors.push('software_scope: incomplete or unresolved semantic alignment');
const softwareRoleErrors = tables.software_company_roles.filter((row) =>
  !row.organization_id || !row.organization_name || !row.entity_type || !row.evidence_url || row.organization_name.localeCompare(row.product_name, undefined, { sensitivity: 'base' }) === 0
);
if (softwareRoleErrors.length) errors.push(`software_company_roles: ${softwareRoleErrors.length} role assertions lack an actor type/evidence link or repeat the product name as actor`);
if (tables.software_company_roles.length >= softwareAssets.length * 3) errors.push('software_company_roles: role assertions still reflect forced three-role completion');
for (const assetId of acceptedSoftwareIds) {
  if (!tables.evidence.some((row) => row.asset_id === assetId)) errors.push(`software market review: missing evidence for ${assetId}`);
  if (!tables.relations.some((row) => row.source_asset_id === assetId)) errors.push(`software market review: missing relationship for ${assetId}`);
}

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
    software_market_review_complete: acceptedSoftwareCandidates.length === 87 && tables.software_scope.length === softwareAssets.length,
    software_semantic_alignment_complete: softwareSemanticAlignmentComplete,
    software_actor_roles_evidence_linked: softwareRoleErrors.length === 0 && tables.software_company_roles.length < softwareAssets.length * 3,
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
  software_primary_functions: groupCount(tables.software_scope, 'primary_function'),
  software_product_types: groupCount(tables.software_scope, 'product_type'),
  software_capabilities: multiValueCount(tables.software_scope, 'functional_capabilities'),
  software_actor_entity_types: groupCount(tables.software_company_roles, 'entity_type'),
  software_market_scope_statuses: groupCount(tables.software_scope, 'market_scope_status'),
  software_candidate_decisions: groupCount(tables.software_candidate_review, 'review_status'),
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
  software_primary_function: [tables.software_scope, 'primary_function'], software_product_type: [tables.software_scope, 'product_type'],
  software_capability: [tables.software_scope.flatMap((row) => String(row.functional_capabilities || '').split(/\s*;\s*/g).filter(Boolean).map((value) => ({ value }))), 'value'],
  software_market_scope_status: [tables.software_scope, 'market_scope_status'], software_company_role: [tables.software_company_roles, 'role'],
  software_actor_entity_type: [tables.software_company_roles, 'entity_type'], software_candidate_decision: [tables.software_candidate_review, 'review_status'],
};
const vocabularies = Object.fromEntries(Object.entries(vocabularyFields).map(([name, [rows, field]]) => [name, [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort()]));
writeFileSync(join(outputDir, 'controlled_vocabularies.json'), JSON.stringify(vocabularies, null, 2) + '\n');
writeFileSync(join(outputDir, 'data_dictionary.json'), JSON.stringify(tables.data_dictionary, null, 2) + '\n');
writeFileSync(join(outputDir, 'validation_report.json'), JSON.stringify(validation, null, 2) + '\n');

const analysisRules = `# Analysis rules\n\n- Treat all counts as dated, reproducible lower bounds based on public evidence available by ${seed.metadata.evidence_cutoff}.\n- The public seed plus documented curated review layers are canonical for this package. Questionnaire and stakeholder records are discovery leads, not the sample frame or verified asset count.\n- Use public information only. Do not register, log in, purchase data, or include email addresses, internal mappings, private personal data, or reviewer notes. A publicly credited professional individual may be retained only when the source explicitly attributes a software role.\n- State the database counting rule: ${coreDatabaseFamilies} core database families; ${extendedDataBearingAssets} extended data-bearing assets. The extended scope contains the core set plus repositories, platforms and libraries that bear or distribute LCA data but are not counted again as database families.\n- State the software counting rule: ${tables.software_scope.length} reviewed software, API, model, or workflow assets at the cutoff. Of these, ${tables.software_scope.filter((row) => row.market_scope_status.startsWith('Qualifying')).length} have a qualifying PCF/LCA product or interoperability listing in the reviewed market streams; the remainder are broader supporting assets retained from the prior inventory.\n- A PCF/LCA software product must publicly state LCA, PCF calculation, or direct standardized PCF exchange. Do not promote general corporate-only accounting, consultancy, or service listings without a qualifying product function.\n- Keep product type, primary function, multi-valued functional capabilities, and standard/network associations as separate dimensions. LCA and PCF modelling are aligned under the headline function “LCA/PCF modelling and calculation” while remaining distinguishable capabilities.\n- PACT means the WBCSD Partnership for Carbon Transparency. A PACT Network listing or compatibility statement is standard/interoperability evidence and discovery provenance, not a software category, quality rating, or proof of calculation capability.\n- Keep product, owner, developer, and operator/maintainer as separate entities and roles. Create actor-role edges only from public evidence; do not copy one role into another and do not use the product name as the actor.\n- Do not equate free access, public metadata, open data, open-source software, registration-free access, or redistribution rights.\n- Use distributions.schema_profile for aligned analysis and filtering; retain distributions.schema_profile_original whenever source wording or package detail matters. Branded schemas and provider-specific data models remain named classes.\n- Use mapping_artifacts.source_endpoint and target_endpoint for endpoint analysis; retain the original fields and distinguish schema, format, software importer, internal model, workflow and reference-list endpoints.\n- Do not equate a compatibility claim with an implemented mapping, a tested conversion, or a lossless round trip.\n- Treat release records as verified public milestones, not necessarily exhaustive patch histories; use version_audit to distinguish explicit updates, retained evidence-linked values and unresolved route checks.\n- Keep owner, operator, developer country, and geographic data coverage as separate concepts.\n- Cite evidence URLs and preserve unresolved questions when answering.\n`;
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
  CREATE INDEX idx_software_scope_asset_id ON software_scope(asset_id);
  CREATE INDEX idx_software_scope_product_name ON software_scope(product_name);
  CREATE INDEX idx_software_company_roles_asset_id ON software_company_roles(asset_id);
  CREATE INDEX idx_software_company_roles_organization_id ON software_company_roles(organization_id);
  CREATE INDEX idx_software_role_gaps_asset_id ON software_role_gaps(asset_id);
  CREATE INDEX idx_software_candidate_review_status ON software_candidate_review(review_status);
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
      software_products: tables.software_scope.length,
      qualifying_software_products: tables.software_scope.filter((row) => row.market_scope_status.startsWith('Qualifying')).length,
      software_organizations: new Set(tables.software_company_roles.map((row) => row.organization_id)).size,
    },
    asset_types: summary.asset_types,
    confidence_levels: summary.confidence_levels,
    relationship_statuses: summary.relationship_statuses,
    database_access_classes: summary.database_access_classes,
    schema_profile_classes: summary.schema_profile_classes,
    schema_profiles: summary.schema_profiles,
    software_primary_functions: summary.software_primary_functions,
    software_product_types: summary.software_product_types,
    software_capabilities: summary.software_capabilities,
    software_actor_entity_types: summary.software_actor_entity_types,
    software_market_scope_statuses: summary.software_market_scope_statuses,
    software_candidate_decisions: summary.software_candidate_decisions,
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
  softwareScope: tables.software_scope,
  softwareCompanyRoles: tables.software_company_roles,
  softwareRoleGaps: tables.software_role_gaps,
  softwareCandidateReview: tables.software_candidate_review,
  organizations: tables.organizations,
  assetOrganizations: tables.asset_organizations,
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
  curated_inputs: [contextPath, schemaProfileAlignmentPath, mappingEndpointAlignmentPath, publicVersionReviewPath, nexusCatalogReviewPath, softwareMarketReviewPath, softwareSemanticAlignmentPath].map((path) => ({
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
