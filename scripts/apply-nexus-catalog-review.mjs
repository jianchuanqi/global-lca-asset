import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(projectRoot, 'data/seed/inventory-v2.public.json');
const reviewPath = join(projectRoot, 'data/curated/nexus-catalog-review-2026-08-25.json');
const reviewedAt = '2026-08-25';
const catalogUrl = 'https://nexus.openlca.org/databases';
const apiRoot = 'https://nexus.openlca.org/ws/dataproviders';

const catalogMapping = [
  [9901, 'LCA-DB-0070', 'New distinct database/add-on family; added to the core lower bound'],
  [8701, 'LCA-DB-0001', 'Matched to existing database family'],
  [9552, 'LCA-DB-0025', 'Matched to existing database family'],
  [10202, 'LCA-DB-0071', 'New distinct database/add-on family; added to the core lower bound'],
  [10465, 'LCA-DB-0005', 'Matched to existing database family'],
  [10457, 'LCA-DB-0046', 'Matched to existing database family'],
  [9801, 'LCA-DB-0006', 'Matched to existing database family'],
  [10451, 'LCA-DB-0072', 'New distinct database/add-on family; added to the core lower bound'],
  [8001, 'LCA-DB-0004', 'Matched to existing database family'],
  [8753, 'LCA-DB-0003', 'Matched to existing database family'],
  [9251, 'LCA-REP-0002', 'Matched to the existing LCA Commons repository family; Nexus integration retained as a distribution, not double-counted as a new database family'],
  [8501, 'LCA-DB-0007', 'Matched to existing database family'],
  [8951, 'LCA-DB-0073', 'New distinct database family; added to the core lower bound'],
  [9701, 'LCA-DB-0040', 'Matched to existing database family'],
  [8902, 'LCA-DB-0028', 'Matched to existing database family'],
  [8651, 'LCA-DB-0008', 'Matched to existing database family'],
  [8351, 'LCA-DB-0074', 'New distinct database family; added to the core lower bound'],
  [9401, 'LCA-DB-0075', 'New distinct database family; added to the core lower bound'],
  [9001, 'LCA-DB-0042', 'Matched to existing database family'],
  [10201, 'LCA-DB-0076', 'New distinct database/add-on family; added to the core lower bound'],
  [8253, 'LCA-DB-0077', 'New distinct database/add-on family; added to the core lower bound'],
  [8251, 'LCA-DB-0043', 'Matched to existing database family'],
  [10463, 'LCA-DB-0078', 'New distinct dataset family; added to the core lower bound'],
  [53, 'LCA-DB-0034', 'Matched to existing database family'],
  [8904, 'LCA-DB-0030', 'Matched to existing database family'],
  [52, 'LCA-DB-0016', 'Matched to existing database family'],
  [301, 'LCA-DB-0079', 'New distinct database family; added to the core lower bound'],
  [151, 'LCA-DB-0026', 'Matched to existing database family'],
  [8101, 'LCA-DB-0020', 'Matched to existing database family'],
  [256, 'LCA-DB-0036', 'Matched to existing database family'],
  [9751, 'LCA-DB-0023', 'Matched to existing database family'],
  [10466, 'LCA-DB-0080', 'New distinct database family; added to the core lower bound'],
  [201, 'LCA-DB-0015', 'Matched to existing database family'],
  [10468, 'LCA-MTH-0021', 'New LCIA/sustainability assessment method; excluded from the database count'],
  [10454, 'LCA-MTH-0022', 'New LCIA method; excluded from the database count despite the provider type label'],
  [9053, 'LCA-MTH-0010', 'Matched to existing LCIA method'],
  [10456, 'LCA-MTH-0023', 'New LCIA method package; excluded from the database count'],
].map(([providerId, assetId, countingDecision]) => ({ providerId, assetId, countingDecision }));

const newProfiles = [
  {
    id: 'LCA-DB-0070', providerId: 9901, name: 'EN15804 add-on', alt: 'EN15804 add-on for ecoinvent', owner: 'GreenDelta GmbH', country: 'Germany',
    description: 'Database extension for ecoinvent that supports Environmental Product Declaration calculations under EN 15804, including resource, output and waste indicators.',
    geography: 'Primarily European EN 15804 applications; underlying ecoinvent coverage is global', sector: 'Construction products and Environmental Product Declarations',
    currentVersion: 'EN15804 add-on to ecoinvent v3.12', releaseDate: '2025-12-18', firstRelease: 'Public Nexus history includes versions based on ecoinvent 3.8 and later',
    format: 'openLCA zolca; openLCA library; JSON-LD', schema: 'openLCA database package and openLCA JSON-LD',
    access: 'Commercial package; public metadata and review documents', rights: 'Commercial package; ecoinvent licence/dependency terms apply', registration: 'Nexus account and licence/order required for package access; not used',
    openStatus: 'Commercial / restricted', scopeClass: 'Sectoral database extension', lifecycle: 'Active; updated with current ecoinvent releases',
    excerpt: 'GreenDelta describes the add-on as EN 15804-compliant background data and methods for EPD modelling, with current packages based on ecoinvent 3.12.'
  },
  {
    id: 'LCA-DB-0071', providerId: 10202, name: 'Circularity Package', alt: 'Circularity Package for openLCA', owner: 'GreenDelta GmbH', country: 'Germany; EU research projects',
    description: 'ecoinvent-based database package enhanced with circularity indicators and an accompanying calculation workflow for circular-economy assessment.',
    geography: 'Global background coverage through ecoinvent', sector: 'Cross-sector circular economy and material circularity',
    currentVersion: '3.1', releaseDate: '2026-08-12', firstRelease: 'First version developed through TRIPLELINK; exact year not stated in the catalog',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Commercial package; public metadata and review statement', rights: 'Commercial package; ecoinvent licence/dependency terms apply',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', scopeClass: 'Cross-sector database extension', lifecycle: 'Active',
    excerpt: 'The public catalog describes an ecoinvent 3.12 package with ISO 59020 and Material Circularity Indicator support and third-party review.'
  },
  {
    id: 'LCA-DB-0072', providerId: 10451, name: 'PLEX', alt: 'Plastic Litter Extension database', owner: 'GreenDelta GmbH', country: 'Germany; EU research projects',
    description: 'ecoinvent APOS extension for estimating plastic litter from product systems, distributed with a plastic-litter LCIA method.',
    geography: 'Global background coverage through ecoinvent', sector: 'Plastics and plastic litter', currentVersion: '4', releaseDate: '2026-07-31', firstRelease: 'Not publicly confirmed',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Commercial package; public metadata and documentation', rights: 'Commercial package; ecoinvent licence/dependency terms apply',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', scopeClass: 'Sectoral database extension', lifecycle: 'Active',
    excerpt: 'The public catalog identifies PLEX v4 as an ecoinvent 3.12 APOS extension for estimating plastic litter.'
  },
  {
    id: 'LCA-DB-0073', providerId: 8951, name: 'UVEK LCI Data', alt: 'UVEK Ökobilanzdatenbestand DQRv2:2018', owner: 'Swiss Federal Offices', country: 'Switzerland',
    description: 'Swiss federal LCI database based on ecoinvent 2.2 with updates for energy, transport, waste treatment, forestry and wood systems.',
    geography: 'Switzerland with relevant international background data', sector: 'Energy, transport, waste, forestry and wood', currentVersion: 'DQRv2:2018', releaseDate: '2023-10-31 Nexus package date', firstRelease: '2018 data-quality-reference version',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Public metadata and background reports; usable package requires an eligible ecoinvent licence', rights: 'Use requires a valid ecoinvent licence',
    registration: 'Nexus/ecoinvent licensed access required for package use; not used', openStatus: 'Free catalog listing with restricted third-party dependency', scopeClass: 'National/federal LCI database', lifecycle: 'Retained public package',
    excerpt: 'The public record states that DQRv2:2018 is based on ecoinvent 2.2 and can only be accessed and used with a valid ecoinvent licence.'
  },
  {
    id: 'LCA-DB-0074', providerId: 8351, name: 'ARVI database', alt: 'ARVI Material Value Chains database', owner: 'CLIC Innovation / ARVI research programme', country: 'Finland',
    description: 'Parameterized value-chain model for wood-polymer composite production developed within the Finnish ARVI Material Value Chains programme.',
    geography: 'Finland with global and local parameters', sector: 'Wood-polymer composites and material value chains', currentVersion: 'ARVI database for ecoinvent 3.01–3.3', releaseDate: '2017-02-15', firstRelease: '2017',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Catalog lists a free package; ecoinvent background data are separately licensed', rights: 'Package terms and ecoinvent dependency rights apply; redistribution not confirmed',
    registration: 'Nexus account may be required for package download; not used', openStatus: 'Public/free access; licence or redistribution unclear or mixed', scopeClass: 'Research-programme sector database', lifecycle: 'Legacy public package',
    excerpt: 'The public catalog describes a parameterized wood-polymer composite value-chain model prepared for several ecoinvent 3 releases.'
  },
  {
    id: 'LCA-DB-0075', providerId: 9401, name: 'OzLCI2019', alt: 'Evah OzLCI2019 Free Database', owner: 'The Evah Institute', country: 'Australia',
    description: 'Australasian regional life-cycle inventory database covering regional supply and imports, developed with openLCA.',
    geography: 'Australasia, including imports', sector: 'Multi-sector regional supply chains', currentVersion: 'OzLCI2019', releaseDate: '2020-02-04', firstRelease: '2019/2020',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Free Nexus package according to the public catalog', rights: 'Licence and redistribution terms not identified in the public metadata',
    registration: 'Nexus account may be required for package download; not used', openStatus: 'Public/free access; licence or redistribution unclear or mixed', scopeClass: 'Regional LCI database', lifecycle: 'Retained public package',
    excerpt: 'The public catalog identifies an Australasian database developed by The Evah Institute using openLCA.'
  },
  {
    id: 'LCA-DB-0076', providerId: 10201, name: 'Circularity Food Package', alt: 'Circularity Food Package for openLCA', owner: 'GreenDelta GmbH / TRIPLELINK', country: 'Germany; European Union',
    description: 'Agribalyse-based agri-food database package enhanced with circularity indicators, an LCIA method and a supporting calculation script.',
    geography: 'France-focused agri-food data with broader background variants', sector: 'Food and agriculture; circular economy', currentVersion: 'Circularity Food Package', releaseDate: '2023-07-12', firstRelease: '2023',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Commercial package; public metadata and manual', rights: 'Commercial package; Agribalyse and any ecoinvent dependency terms apply',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', scopeClass: 'Sectoral database extension', lifecycle: 'Retained public package',
    excerpt: 'The public catalog describes an Agribalyse 3.1-based food package for Material Circularity Indicator and Circularity Index calculations.'
  },
  {
    id: 'LCA-DB-0077', providerId: 8253, name: 'soca', alt: 'soca social LCA add-on', owner: 'GreenDelta GmbH', country: 'Germany',
    description: 'Social LCA add-on for ecoinvent with social risk indicators and supporting documentary information.',
    geography: 'Global supply chains through ecoinvent and social data sources', sector: 'Cross-sector social LCA', currentVersion: '5', releaseDate: '2026-07-14', firstRelease: 'Not publicly confirmed',
    format: 'openLCA zolca; openLCA library', schema: 'openLCA database package', access: 'Commercial package; public metadata and documentation', rights: 'Commercial package; ecoinvent licence/dependency terms apply',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', scopeClass: 'Social LCA database extension', lifecycle: 'Active',
    excerpt: 'The public catalog describes soca v5 as an ecoinvent 3.12 add-on for social LCA, distributed as openLCA database and library packages.'
  },
  {
    id: 'LCA-DB-0078', providerId: 10463, name: 'EcoProfiles Recycled Plastics', alt: 'European Recycled Plastics EcoProfiles', owner: 'PRIMUS project / Plastics Recyclers Europe', country: 'European Union',
    description: 'European average life-cycle inventory datasets for nine recycled plastics based on direct data collection from recyclers.',
    geography: 'Europe', sector: 'Recycled plastics', currentVersion: '1.0', releaseDate: '2025-09-03', firstRelease: '2025',
    format: 'ILCD; JSON-LD; PDF', schema: 'ILCD and openLCA JSON-LD', access: 'Publicly licensed datasets and documentation', rights: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    registration: 'Nexus account may be required for package download; public metadata did not require login', openStatus: 'Open licence confirmed for the listed datasets', scopeClass: 'Sector LCI dataset family', lifecycle: 'Current public release',
    excerpt: 'The public catalog lists European average recycled-plastics datasets created in 2024, published in 2025 and licensed CC BY 4.0.'
  },
  {
    id: 'LCA-DB-0079', providerId: 301, name: 'LC-Inventories.ch', alt: 'LC-Inventories.ch database collections', owner: 'ESU-services and contributing authors', country: 'Switzerland',
    description: 'Collection of corrections, updates and extensions to ecoinvent 2.2 prepared by ESU-services and other authors.',
    geography: 'Switzerland and international background systems', sector: 'Energy, fuels, materials, recycling, buildings and other sector modules', currentVersion: '15 public Nexus database groups', releaseDate: '2014-01-23 latest listed group date', firstRelease: '2014 Nexus package dates',
    format: 'openLCA zolca', schema: 'openLCA database package', access: 'Commercial catalog packages; public metadata', rights: 'Commercial ESU/provider terms; underlying ecoinvent-related rights may apply',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', scopeClass: 'Multi-sector LCI collection', lifecycle: 'Legacy catalog collection',
    excerpt: 'The public catalog groups ESU-services corrections, updates and extensions to ecoinvent 2.2 into fifteen database packages.'
  },
  {
    id: 'LCA-DB-0080', providerId: 10466, name: 'My-Wood LCI', alt: 'Malaysian Timber Life Cycle Inventory Database', owner: 'Forest Research Institute Malaysia (FRIM) and Malaysian Timber Industry Board (MTIB)', country: 'Malaysia',
    description: 'Life-cycle inventory data for Malaysian timber products reflecting local forestry and primary wood-processing conditions.',
    geography: 'Malaysia', sector: 'Forestry and primary timber processing', currentVersion: 'My-Wood LCI public Nexus release', releaseDate: '2025-12-31', firstRelease: '2025',
    format: 'JSON-LD', schema: 'openLCA JSON-LD', access: 'Free of charge subject to stated terms of use', rights: 'Acknowledgement required; datasets must not be sold or redistributed for commercial purposes',
    registration: 'Nexus account may be required for package download; not used', openStatus: 'Free access with non-commercial redistribution restriction', scopeClass: 'National/sector LCI database', lifecycle: 'Evolving database',
    excerpt: 'The public catalog describes Malaysian timber LCI data, free subject to terms, but notes that the datasets omit elementary flows and are therefore typically incomplete.'
  },
  {
    id: 'LCA-MTH-0021', providerId: 10468, name: 'HILCSA', alt: 'Holistic and Integrated Life Cycle Sustainability Assessment', owner: 'Helmholtz Centre for Environmental Research (UFZ)', country: 'Germany', assetType: 'Method / guidance (incl. LCIA)',
    description: 'Integrated life-cycle sustainability assessment method combining environmental, social and economic indicators linked to the UN Sustainable Development Goals.',
    geography: 'Global application', sector: 'Cross-sector sustainability assessment', currentVersion: '2.3', releaseDate: '2026-03-23', firstRelease: 'Not publicly confirmed',
    format: 'Excel; JSON-LD', schema: 'openLCA JSON-LD plus Excel documentation', access: 'Commercial method package; public metadata and documentation', rights: 'Commercial package terms',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', lifecycle: 'Active',
    excerpt: 'UFZ HILCSA uses about 80 indicators linked to the SDGs; the public Nexus advice pairs version 2.3 with soca v3.'
  },
  {
    id: 'LCA-MTH-0022', providerId: 10454, name: 'LC-Impact LCIA Method', alt: 'LC-IMPACT method for openLCA', owner: 'LC-IMPACT project; openLCA adaptation by GreenDelta GmbH', country: 'European Union; Germany', assetType: 'Method / guidance (incl. LCIA)',
    description: 'Global and regionalized endpoint life-cycle impact assessment method covering human health, ecosystem quality and resources.',
    geography: 'Global with regionalized categories', sector: 'Cross-sector LCIA', currentVersion: '1.3', releaseDate: '2025-04-15', firstRelease: 'Adapted for openLCA in 2024',
    format: 'JSON-LD', schema: 'openLCA JSON-LD', access: 'Commercial package; public metadata and setup guidance', rights: 'Commercial package terms',
    registration: 'Nexus account and licence/order required for package access; not used', openStatus: 'Commercial / restricted', lifecycle: 'Active openLCA adaptation',
    excerpt: 'The public catalog describes LC-Impact v1.3 as a global endpoint LCIA method with regionalized data, adapted for openLCA by GreenDelta.'
  },
  {
    id: 'LCA-MTH-0023', providerId: 10456, name: 'openLCA LCIA Methods', alt: 'openLCA LCIA method package', owner: 'GreenDelta GmbH', country: 'Germany', assetType: 'Method / guidance (incl. LCIA)',
    description: 'Curated package of life-cycle impact assessment methods prepared for use with databases distributed through openLCA Nexus.',
    geography: 'Global and method-specific regional coverage', sector: 'Cross-sector LCIA', currentVersion: '2.8.2', releaseDate: '2026-06-30', firstRelease: 'Not publicly confirmed',
    format: 'JSON-LD; openLCA zolca; JSON extension files', schema: 'openLCA JSON-LD and openLCA database package', access: 'Free Nexus package according to the public catalog', rights: 'Method-specific rights and package terms; redistribution status not fully consolidated',
    registration: 'Nexus account may be required for package download; not used', openStatus: 'Public/free access; method-specific rights vary', lifecycle: 'Active',
    excerpt: 'The public catalog lists version 2.8.2 with 45 LCIA methods and compatibility claims for recent Nexus database releases.'
  },
];

const profileById = new Map(newProfiles.map((profile) => [profile.id, profile]));
const mappingByProvider = new Map(catalogMapping.map((row) => [row.providerId, row]));

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[contact omitted]')
    .replace(/(^|\s)@[A-Z0-9_.-]+\b/gi, '$1[mention omitted]')
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function appendList(existing, values) {
  const parts = String(existing || '').split(/\s*;\s*/).filter(Boolean);
  return unique([...parts, ...values]).join('; ');
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Global-LCA-Asset-public-review/1.0' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function normalizeDetail(detail) {
  const databases = (detail.databases || []).map((database) => {
    const packageRows = (database.datapacks || []).map((datapack) => ({
      name: String(datapack.name || '').trim(),
      description: stripHtml(datapack.description),
      formats: unique((datapack.datafiles || []).map((file) => file.format?.name)),
    }));
    const formats = unique([
      ...(database.formats || []).map((format) => format.name),
      ...packageRows.flatMap((datapack) => datapack.formats),
    ]);
    return {
      database_group_id: database.id,
      name: String(database.name || '').trim(),
      description: stripHtml(database.description),
      free: Boolean(database.free),
      release_date: isoDate(database.version?.releaseDate),
      provider_version_number: database.version?.version ?? null,
      active: Boolean(database.version?.active),
      formats,
      dependencies: unique((database.dependencies || []).map((dependency) => dependency.name)),
      datapacks: packageRows,
    };
  });
  return {
    provider_id: detail.id,
    catalog_name: String(detail.name || '').trim(),
    catalog_type: detail.typeOfData || '',
    catalog_lists_free: Boolean(detail.free),
    public_api_url: `${apiRoot}/${detail.id}`,
    description: stripHtml(detail.description),
    database_group_count: databases.length,
    datapack_count: databases.reduce((sum, database) => sum + database.datapacks.length, 0),
    database_groups: databases,
  };
}

function makeAsset(profile) {
  const apiUrl = `${apiRoot}/${profile.providerId}`;
  const isMethod = profile.assetType === 'Method / guidance (incl. LCIA)';
  return {
    'Asset ID': profile.id,
    'Official name': profile.name,
    'Alternative name/acronym': profile.alt,
    'Asset type': profile.assetType || 'Database / dataset',
    'Short description': profile.description,
    'Owner': profile.owner,
    'Operator/maintainer': profile.owner,
    'Official URL': apiUrl,
    'Geographic coverage': profile.geography,
    'Sector/product/process coverage': profile.sector,
    'Intended users': isMethod ? 'LCA practitioners, researchers and sustainability analysts' : 'LCA practitioners, researchers and database/software users',
    'Main use cases': isMethod ? 'Life-cycle impact or sustainability assessment in openLCA' : 'Life-cycle inventory modelling and assessment in openLCA',
    'Language': 'English public Nexus metadata; provider documentation may include other languages',
    'Temporal coverage': profile.firstRelease,
    'Current version': profile.currentVersion,
    'Release/update date': profile.releaseDate,
    'Maintenance status': profile.lifecycle,
    'Access model': profile.access,
    'Licence or usage rights': profile.rights,
    'Commercial/restricted/open status': profile.openStatus,
    'Registration requirement': profile.registration,
    'Governance arrangement': `Developed/maintained by ${profile.owner}; distributed through openLCA Nexus`,
    'Long-term stewardship information': profile.lifecycle,
    'Data/content type': isMethod ? 'LCIA/sustainability indicators, characterization factors and supporting method files' : 'Life-cycle inventory datasets, model extensions and supporting metadata',
    'Data model or schema': profile.schema,
    'Exchange format': profile.format,
    'API or machine-readable interface': 'Public catalog metadata API; package access conditions are separate',
    'Nomenclature/classification': 'Provider- and dependency-specific; not fully harmonized in public metadata',
    'Identifiers': 'openLCA package identifiers; exact dataset identifiers require package-level review',
    'Metadata approach': 'Public Nexus provider, database-group and datapack metadata',
    'Versioning mechanism': 'Named/numbered Nexus database groups and package releases',
    'Documentation availability': 'Public catalog metadata; public documents where marked; package content not accessed',
    'QA/validation approach': 'Provider claims and review documents recorded where public; no independent package test in this review',
    'Review procedure': 'Not publicly confirmed unless stated in the provider record',
    'Data quality documentation': 'Provider-specific public documentation; completeness varies',
    'Methodological basis': profile.description,
    'Provenance information': `${profile.owner}; public openLCA Nexus catalog record`,
    'Citation mechanism': 'Provider citation where stated; otherwise not publicly confirmed',
    'Known limitations': 'Package files were not downloaded because Nexus package access can require an account, licence or order; catalog claims were not independently tested.',
    'Related assets': 'openLCA Nexus; openLCA',
    'Relationship type': 'public catalog distribution; software compatibility',
    'Evidence for relationship': `${apiUrl} lists the asset, its database groups, formats and dependency information in the public openLCA Nexus catalog.`,
    'Import/export compatibility': `${profile.format}; provider-listed for openLCA; exact version-pair and round-trip behavior not independently tested`,
    'Existing mapping or conversion': 'Nexus/openLCA adaptation is provider-listed; field-level mapping artifact not publicly identified unless noted separately',
    'Potential interoperability opportunity': 'Use the public package and dependency metadata to select explicit version/format pairs for conformance tests',
    'Known interoperability constraint': 'Licence/dependency terms and provider-specific adaptations can restrict reuse, redistribution and cross-software equivalence',
    'Primary sources': apiUrl,
    'Supporting sources': catalogUrl,
    'Evidence excerpt': profile.excerpt,
    'Access date': reviewedAt,
    'Confidence level': 'High for public catalog identity and package metadata; moderate for untested interoperability',
    'Unresolved questions': 'Exact package licence/redistribution terms where unclear; independent import and round-trip tests; field-level schema mapping and loss assessment',
    'Public evidence status': 'Public Nexus metadata verified; restricted or account-gated package content not accessed',
  };
}

function makeScope(profile, index) {
  const apiUrl = `${apiRoot}/${profile.providerId}`;
  const free = !/commercial/i.test(profile.openStatus);
  return {
    'Scope record ID': `DBS-${String(78 + index).padStart(4, '0')}`,
    'Asset ID': profile.id,
    'Official name': profile.name,
    'Current asset type': 'Database / dataset',
    'Scope class': profile.scopeClass,
    'Working count status': 'Core working count',
    'Extended data-bearing count': 'Yes',
    'Lifecycle status': profile.lifecycle,
    'Owner': profile.owner,
    'Owner country / countries': profile.country,
    'Developer country / countries': profile.country,
    'Geographic data coverage': profile.geography,
    'Sector scope': profile.sector,
    'First release year': profile.firstRelease,
    'Current version': profile.currentVersion,
    'Latest release date': profile.releaseDate,
    'Metadata access': 'Public metadata through the openLCA Nexus catalog/API',
    'Data access': profile.access,
    'Open-data status': profile.openStatus,
    'Source-code openness': 'Not applicable to data rights; related software/code assessed separately',
    'Registration': profile.registration,
    'Fee': free ? 'No fee stated for the listed package; dependency terms may apply' : 'Commercial licence/package applies',
    'Licence identifier / terms': profile.rights,
    'Redistribution rights': /CC BY 4\.0/i.test(profile.rights) ? 'Permitted under CC BY 4.0 with attribution' : /must not be sold|not be sold/i.test(profile.rights) ? 'Commercial resale/redistribution prohibited by stated terms' : 'Not publicly confirmed beyond stated package/dependency terms',
    'Canonical access / download URL': apiUrl,
    'Schema / data model': profile.schema,
    'Format(s)': profile.format,
    'Software compatibility': 'openLCA; exact version depends on the provider package',
    'Evidence URL(s)': apiUrl,
    'Evidence as of': reviewedAt,
    'Information status': 'Public openLCA Nexus catalog and API reviewed; package not accessed',
    'Scope / evidence note': 'Counted once at the distinct database/add-on family level; database groups, system models and datapacks are distributions rather than additional database families.',
  };
}

function makeRelease(profile, index) {
  return {
    'Release record ID': `RLS-${String(297 + index).padStart(4, '0')}`,
    'Asset ID': profile.id,
    'Asset name': profile.name,
    'Asset type': profile.assetType || 'Database / dataset',
    'Release line': 'Current public openLCA Nexus catalog release',
    'First development / release year': profile.firstRelease,
    'Version': profile.currentVersion,
    'Release date': profile.releaseDate,
    'Lifecycle status': profile.lifecycle,
    'Predecessor release': 'See versioned public Nexus catalog snapshot where available',
    'Successor release': 'None recorded after the evidence cut-off',
    'Release evidence URL(s)': `${apiRoot}/${profile.providerId}`,
    'Evidence status': 'Verified public provider/catalog metadata; package not independently accessed or tested',
    'Evidence as of': reviewedAt,
    'Notes': 'One release row represents the current catalog family; all public database groups and datapacks are retained in the curated Nexus review snapshot.',
  };
}

function latestGroups(entry) {
  if (!entry.database_groups.length) return [];
  const sorted = [...entry.database_groups].sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)) || a.name.localeCompare(b.name));
  const latestDate = sorted[0].release_date;
  return sorted.filter((row) => row.release_date === latestDate);
}

function makeDistribution(entry, mapping, asset, index) {
  const profile = profileById.get(mapping.assetId);
  const formats = unique(entry.database_groups.flatMap((database) => database.formats));
  const dependencies = unique(entry.database_groups.flatMap((database) => database.dependencies));
  const latest = latestGroups(entry);
  const hasDatabasePackage = formats.some((format) => /zolca|library/i.test(format));
  const hasJsonLd = formats.some((format) => /json-ld/i.test(format));
  const schemaProfile = hasDatabasePackage ? 'openLCA database package' : hasJsonLd ? 'openLCA JSON-LD' : formats.includes('ILCD') ? 'ILCD' : 'Not publicly confirmed';
  const explicitlyOpen = /CC BY 4\.0|open licence confirmed/i.test(profile?.rights || asset['Licence or usage rights'] || '');
  const commercial = !entry.catalog_lists_free && !explicitlyOpen;
  const releaseLabel = latest.map((row) => row.name).join('; ') || 'Current public catalog record';
  return {
    'Distribution ID': `DST-${String(134 + index).padStart(4, '0')}`,
    'Database Asset ID': mapping.assetId,
    'Database name': asset['Official name'],
    'Database release': releaseLabel,
    'Distribution / package': `openLCA Nexus catalog family (${entry.database_group_count} database group${entry.database_group_count === 1 ? '' : 's'}; ${entry.datapack_count} public datapack metadata record${entry.datapack_count === 1 ? '' : 's'})`,
    'Schema / profile': schemaProfile,
    'Schema version': `Provider-listed formats: ${formats.join('; ') || 'Not publicly confirmed'}; exact schema revisions not stated`,
    'Access route': entry.public_api_url,
    'Access category': explicitlyOpen ? 'Open licence confirmed for at least one listed distribution' : commercial ? 'Commercial/proprietary' : 'Public/free access; licence or redistribution may be limited',
    'Licence / rights': profile?.rights || asset['Licence or usage rights'] || (commercial ? 'Commercial/provider terms apply' : 'Provider terms apply; redistribution not publicly confirmed'),
    'Registration': profile?.registration || 'Nexus account may be required for package download/order; no account-gated package was used in this review',
    'Fee': commercial ? 'Commercial licence/package applies' : 'Catalog lists free access; dependency terms may still apply',
    'Compatible software': 'openLCA',
    'Software version': entry.provider_id === 8701 ? 'ecoinvent 3.12 implemented for openLCA 2.5.0 or newer, according to the provider record' : 'Provider lists an openLCA-compatible package/format; exact software-version pair not consistently stated',
    'Direction': 'Database or method package to consumer software/tool',
    'Claimed / tested status': 'Provider-listed public Nexus metadata; package not independently downloaded or tested',
    'Evidence URL': entry.public_api_url,
    'Evidence as of': reviewedAt,
    'Known constraint / next test': `${dependencies.length ? `Dependencies: ${dependencies.join('; ')}. ` : ''}Select an explicitly licensed public test package where possible and verify import, references, calculations and round-trip loss in a named openLCA release.`,
  };
}

function makeEvidence(entry, mapping, index) {
  const groupCount = entry.database_group_count;
  const datapackCount = entry.datapack_count;
  const formats = unique(entry.database_groups.flatMap((database) => database.formats));
  return {
    'Evidence ID': `EVD-${String(216 + index).padStart(4, '0')}`,
    'Asset ID': mapping.assetId,
    'Source title': `openLCA Nexus public catalog record — ${entry.catalog_name}`,
    'Publisher/maintainer': 'openLCA Nexus / GreenDelta; underlying provider identified in the catalog record',
    'URL or file': entry.public_api_url,
    'Source type': 'Official public provider/catalog API metadata',
    'Access date': reviewedAt,
    'Supported fields': 'Identity; catalog type; description; free/commercial signal; database groups; releases; datapacks; formats; dependencies; public documents',
    'Evidence excerpt': `${entry.catalog_name} is listed with ${groupCount} database group${groupCount === 1 ? '' : 's'} and ${datapackCount} datapack metadata record${datapackCount === 1 ? '' : 's'}; formats include ${formats.join(', ') || 'no explicit format label'}.`,
    'Source reliability': 'A — official public openLCA Nexus catalog/API record; underlying provider claims not independently tested',
    'Access restriction': 'Metadata publicly accessible; some package files require account, licence, order or third-party dependency',
    'Publicly accessed': 'Yes — public metadata only',
    'Notes': 'No login, registration, purchase or restricted package content was used. The complete normalized public catalog metadata is retained in the curated Nexus review snapshot.',
  };
}

function makeRelation(id, sourceId, sourceName, targetId, targetName, type, entry) {
  return {
    'Relationship ID': id,
    'Source Asset ID': sourceId,
    'Source asset name': sourceName,
    'Source resolution': 'Exact curated asset match after Nexus catalog deduplication',
    'Target Asset ID': targetId,
    'Target asset name': targetName,
    'Target resolution': 'Exact curated platform/software asset match',
    'Relationship type': type,
    'Status': `Listed in the public openLCA Nexus catalog as of ${reviewedAt}`,
    'Evidence': `${entry.public_api_url} lists the asset and its openLCA-oriented database groups, datapacks or exchange formats.`,
    'Constraints': 'Public provider/catalog claim only; account-gated or licensed package content was not accessed, and lossless import or calculation equivalence was not independently tested.',
    'Validation question': 'For an explicitly accessible and licensed release, test the named package in a named openLCA version and record entity, reference, calculation and round-trip results.',
    'Mapping artifact ID': null,
  };
}

const providerList = await getJson(apiRoot);
const uniqueProviders = [...new Map(providerList.filter((provider) => provider.typeOfOffer === 'DATA').map((provider) => [provider.id, provider])).values()];
const expectedProviderIds = new Set(catalogMapping.map((row) => row.providerId));
const unexpected = uniqueProviders.filter((provider) => !expectedProviderIds.has(provider.id));
const missing = catalogMapping.filter((row) => !uniqueProviders.some((provider) => provider.id === row.providerId));
if (unexpected.length || missing.length || uniqueProviders.length !== catalogMapping.length) {
  throw new Error(`Nexus catalog changed: found ${uniqueProviders.length} unique DATA providers; unexpected=${unexpected.map((row) => `${row.id}:${row.name}`).join(',')}; missing=${missing.map((row) => row.providerId).join(',')}`);
}

const details = await Promise.all(catalogMapping.map((mapping) => getJson(`${apiRoot}/${mapping.providerId}`)));
const reviewedEntries = details.map(normalizeDetail);
const entryByProvider = new Map(reviewedEntries.map((entry) => [entry.provider_id, entry]));

const review = {
  review_id: 'NEXUS-CATALOG-2026-08-25',
  title: 'openLCA Nexus public DATA catalog reconciliation',
  reviewed_at: reviewedAt,
  source_catalog_url: catalogUrl,
  source_api_url: apiRoot,
  public_only_rule: 'Only anonymously accessible catalog/API metadata was used. No account-gated package, registration, purchase or restricted download was used.',
  counting_rule: 'Distinct database/add-on families are counted once. Versions, system models, unit/system aggregations, database groups, formats and datapacks are distributions. LCIA methods and repositories are retained as assets but excluded from the database-family count.',
  catalog_entry_count: reviewedEntries.length,
  database_group_count: reviewedEntries.reduce((sum, entry) => sum + entry.database_group_count, 0),
  datapack_count: reviewedEntries.reduce((sum, entry) => sum + entry.datapack_count, 0),
  reconciliation: catalogMapping.map((mapping) => {
    const entry = entryByProvider.get(mapping.providerId);
    return {
      provider_id: mapping.providerId,
      catalog_name: entry.catalog_name,
      catalog_type: entry.catalog_type,
      public_api_url: entry.public_api_url,
      mapped_asset_id: mapping.assetId,
      decision: profileById.has(mapping.assetId) ? 'New asset promoted after exact-name, alternative-name, owner, scope and dependency review' : 'Existing asset reused',
      counting_decision: mapping.countingDecision,
    };
  }),
  public_catalog_snapshot: reviewedEntries,
};
writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const tables = seed.tables;
const newAssetIds = new Set(newProfiles.map((profile) => profile.id));
tables['Master Asset Inventory'] = tables['Master Asset Inventory'].filter((row) => !newAssetIds.has(row['Asset ID']));
tables['Database Scope'] = tables['Database Scope'].filter((row) => !newAssetIds.has(row['Asset ID']));
tables['Asset Releases'] = tables['Asset Releases'].filter((row) => !newAssetIds.has(row['Asset ID']));
tables['Source Evidence'] = tables['Source Evidence'].filter((row) => !/^EVD-(021[6-9]|02[2-4][0-9]|025[0-2])$/.test(row['Evidence ID']));
tables['Distributions'] = tables['Distributions'].filter((row) => !/^DST-(01(3[4-9]|[4-6][0-9]|70))$/.test(row['Distribution ID']));
tables['Relationship Index'] = tables['Relationship Index'].filter((row) => !['public Nexus catalog distribution', 'provider-listed openLCA compatibility'].includes(row['Relationship type']));

for (const profile of newProfiles) tables['Master Asset Inventory'].push(makeAsset(profile));
const newDatabaseProfiles = newProfiles.filter((profile) => !profile.assetType);
newDatabaseProfiles.forEach((profile, index) => tables['Database Scope'].push(makeScope(profile, index)));
newProfiles.forEach((profile, index) => tables['Asset Releases'].push(makeRelease(profile, index)));

const assetById = new Map(tables['Master Asset Inventory'].map((asset) => [asset['Asset ID'], asset]));
catalogMapping.forEach((mapping, index) => {
  const entry = entryByProvider.get(mapping.providerId);
  const asset = assetById.get(mapping.assetId);
  if (!asset) throw new Error(`Missing mapped asset ${mapping.assetId} for ${entry.catalog_name}`);
  asset['Related assets'] = appendList(asset['Related assets'], ['openLCA Nexus', 'openLCA']);
  asset['Supporting sources'] = appendList(asset['Supporting sources'], [entry.public_api_url, catalogUrl]);
  asset['Evidence for relationship'] = appendList(asset['Evidence for relationship'], [`Public openLCA Nexus metadata lists ${entry.catalog_name} with openLCA-oriented groups/packages and formats (${entry.public_api_url})`]);
  tables['Source Evidence'].push(makeEvidence(entry, mapping, index));
  tables['Distributions'].push(makeDistribution(entry, mapping, asset, index));
});

const ecoinvent = assetById.get('LCA-DB-0001');
ecoinvent['Evidence for relationship'] = 'Public Nexus metadata lists ecoinvent 3.12 in all three system models as openLCA zolca and openLCA library packages and states that v3.12 was implemented for openLCA 2.5.0 or newer; historical provider testing remains documented for v3.9.1.';
ecoinvent['Import/export compatibility'] = 'ecoSpold2; provider-listed ecoinvent 3.12 openLCA zolca/library packages for openLCA 2.5.0 or newer; historical provider-tested 3.9.1 package for openLCA 1.11/2.0';
ecoinvent['Existing mapping or conversion'] = 'For ecoinvent 3.11 or earlier, Nexus describes mappings to openLCA reference-data elementary flows; from 3.12, original ecoinvent elementary-flow UUIDs are retained without that mapping.';
ecoinvent['Evidence excerpt'] = 'Official ecoinvent sources identify v3.12 and annual updates. Public Nexus metadata lists v3.12 APOS, cut-off and consequential packages for openLCA 2.5.0 or newer and documents the elementary-flow UUID strategy change.';
ecoinvent['Unresolved questions'] = 'Independent import/round-trip and calculation tests for the v3.12 packages; exact package schema revision; dataset-level licence and redistribution constraints by use case';
ecoinvent['Public evidence status'] = 'Public metadata and provider compatibility claim verified; licensed packages not accessed';

const ecoinventRelation = tables['Relationship Index'].find((row) => row['Relationship ID'] === 'REL-0234');
if (ecoinventRelation) {
  ecoinventRelation['Status'] = 'Provider-listed for ecoinvent 3.12 and openLCA 2.5.0 or newer; historical 3.9.1 provider test retained';
  ecoinventRelation['Evidence'] = 'The public Nexus provider record lists ecoinvent v3.12 APOS, cut-off and consequential packages in openLCA zolca/library formats and states that they are implemented for openLCA 2.5.0 or newer. A historical public technical report documents provider testing for 3.9.1.';
  ecoinventRelation['Constraints'] = 'The current compatibility statement is provider-claimed, not independently tested in this review. Licence/order conditions apply, and the elementary-flow reference-data strategy changed at ecoinvent 3.12.';
  ecoinventRelation['Validation question'] = 'Independently test representative v3.12 packages in a named openLCA 2.5+ release and publish entity, reference, LCI/LCIA and round-trip comparison results.';
}

const existingPair = (source, target) => tables['Relationship Index'].some((row) => row['Source Asset ID'] === source && row['Target Asset ID'] === target);
let relationNumber = Math.max(...tables['Relationship Index'].map((row) => Number(String(row['Relationship ID']).replace(/\D/g, '')) || 0)) + 1;
for (const mapping of catalogMapping) {
  const entry = entryByProvider.get(mapping.providerId);
  const asset = assetById.get(mapping.assetId);
  if (!existingPair(mapping.assetId, 'LCA-REP-0001')) {
    tables['Relationship Index'].push(makeRelation(`REL-${String(relationNumber++).padStart(4, '0')}`, mapping.assetId, asset['Official name'], 'LCA-REP-0001', 'openLCA Nexus', 'public Nexus catalog distribution', entry));
  }
  if (!existingPair(mapping.assetId, 'LCA-SW-0003')) {
    tables['Relationship Index'].push(makeRelation(`REL-${String(relationNumber++).padStart(4, '0')}`, mapping.assetId, asset['Official name'], 'LCA-SW-0003', 'openLCA', 'provider-listed openLCA compatibility', entry));
  }
}

seed.metadata.evidence_cutoff = reviewedAt;
seed.metadata.generated_at = '2026-08-25T12:00:00.000Z';
writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`);

const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
console.log(JSON.stringify({
  catalog_entries: review.catalog_entry_count,
  database_groups: review.database_group_count,
  datapacks: review.datapack_count,
  promoted_assets: newProfiles.length,
  promoted_database_families: newDatabaseProfiles.length,
  counts,
}, null, 2));
