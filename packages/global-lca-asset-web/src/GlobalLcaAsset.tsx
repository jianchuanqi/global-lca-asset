import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import datasetUrl from './data/dataset.json?url';

type Row = Record<string, string | number | null>;
type Tab = 'overview' | 'databases' | 'access' | 'formats' | 'providers' | 'mappings' | 'network' | 'assets' | 'data';

const RelationshipGraph = lazy(() => import('./RelationshipGraph'));

export type Dataset = {
  meta: Record<string, string>;
  summaries: {
    overview: Record<string, number>;
    asset_types: Array<{ label: string; count: number }>;
    confidence_levels: Array<{ label: string; count: number }>;
    relationship_statuses: Array<{ label: string; count: number }>;
    database_access_classes: Array<{ label: string; count: number }>;
    schema_profile_classes: Array<{ label: string; count: number }>;
    schema_profiles: Array<{ label: string; count: number }>;
    field_information_gaps: Array<{ field: string; label: string; count: number; rate: number }>;
  };
  assets: Row[];
  evidence: Row[];
  relations: Row[];
  distributions: Row[];
  mappings: Row[];
  databaseScope: Row[];
  databaseAccessScope: Row[];
  searchCoverage: Row[];
  reviewIssues: Row[];
  answerability: Row[];
  versionAudit: Row[];
  mappingEndpointAlignment: Row[];
};

type DatasetFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DatasetContext = createContext<Dataset | null>(null);

function useDataset() {
  const dataset = useContext(DatasetContext);
  if (dataset === null) throw new Error('Global LCA dataset context is unavailable.');
  return dataset;
}

function useAssetIndex() {
  const { assets } = useDataset();
  return useMemo(() => new Map(assets.map((asset) => [String(asset.asset_id), asset])), [assets]);
}

function isDataset(value: unknown): value is Dataset {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.meta === null || typeof candidate.meta !== 'object') return false;
  if (candidate.summaries === null || typeof candidate.summaries !== 'object') return false;
  const meta = candidate.meta as Record<string, unknown>;
  const summaries = candidate.summaries as Record<string, unknown>;
  return typeof meta.packageVersion === 'string'
    && typeof meta.cutoff === 'string'
    && summaries.overview !== null
    && typeof summaries.overview === 'object'
    && ['asset_types', 'confidence_levels', 'database_access_classes', 'schema_profile_classes', 'field_information_gaps']
      .every((field) => Array.isArray(summaries[field]))
    && [
      'assets', 'evidence', 'relations', 'distributions', 'mappings', 'databaseScope',
      'databaseAccessScope', 'searchCoverage', 'reviewIssues', 'answerability', 'versionAudit',
      'mappingEndpointAlignment',
    ].every((field) => Array.isArray(candidate[field]));
}

export async function loadDataset(
  fetcher: DatasetFetcher = globalThis.fetch,
  signal?: AbortSignal,
): Promise<Dataset> {
  const response = await fetcher(datasetUrl, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Dataset request failed with HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isDataset(payload)) throw new Error('Dataset response does not match the expected public package shape.');
  return payload;
}

const projectOwner = 'UNEP Global LCA Platform Working Group 2';
const contactName = 'Jianchuan Qi';
const contactAffiliation = 'Tsinghua University';
const contactEmail = 'jcqi@tsinghua.edu.cn';
const projectRepository = 'https://github.com/jianchuanqi/global-lca-asset';
const feedbackUrl = 'https://uzmhiopsjv.feishu.cn/share/base/form/shrcnLwAU43hwAwb5bsDNMoaohc';
export const dataContributionGuideUrl = `${projectRepository}/blob/main/docs/data-update-example.md`;
const projectMembers: Array<{ name: string; affiliation?: string }> = [
  { name: 'Jianchuan Qi', affiliation: 'Tsinghua University' },
  { name: 'Natasha Das', affiliation: 'AECOM' },
  { name: 'António Martins', affiliation: 'Portuguese Catholic University' },
];

const tabs: Array<[Tab, string]> = [
  ['overview', 'Overview'],
  ['network', 'Explore'],
  ['databases', '1 · Databases'],
  ['access', '2 · Access'],
  ['formats', '3 · Formats & software'],
  ['providers', '4 · Providers & sectors'],
  ['mappings', '5 · Mappings'],
  ['assets', 'All assets'],
  ['data', 'Download data'],
];

function text(value: unknown, fallback = 'Not publicly confirmed') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function isUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function extractUrls(value: unknown) {
  return (text(value, '').match(/https?:\/\/[^\s|;]+/gi) ?? []).map((url) => url.replace(/[),.\]]+$/, ''));
}

function SourceLinks({ values, label = 'Source' }: { values: unknown[]; label?: string }) {
  const urls = [...new Set(values.flatMap(extractUrls))];
  if (!urls.length) return <span className="no-source">—</span>;
  return (
    <span className="source-links">
      {urls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>{label}{urls.length > 1 ? ` ${index + 1}` : ''} ↗</a>)}
    </span>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.95-.09-.23-.48-.95-.82-1.14-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.6-.18-3.28-.81-3.28-3.6 0-.8.28-1.44.74-1.95-.07-.19-.32-.93.07-1.92 0 0 .6-.19 1.97.75A6.7 6.7 0 0 1 8 5.49c.61 0 1.22.08 1.79.25 1.37-.94 1.97-.75 1.97-.75.39.99.14 1.73.07 1.92.46.51.74 1.16.74 1.95 0 2.8-1.69 3.42-3.29 3.6.29.26.54.75.54 1.52 0 1.09-.01 1.97-.01 2.24 0 .22.15.47.55.39A8.15 8.15 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
    </svg>
  );
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'dark' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Metric({ value, label, note }: { value: number | string; label: string; note?: string }) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <div><span>{label}</span>{note && <small>{note}</small>}</div>
    </article>
  );
}

function BarList({ rows, max, compact = false }: { rows: Array<{ label: string; count: number }>; max?: number; compact?: boolean }) {
  const denominator = max ?? Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className={`bar-list ${compact ? 'bar-list-compact' : ''}`}>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-label"><span>{row.label}</span><strong>{row.count}</strong></div>
          <div className="bar-track"><span style={{ width: `${Math.max(2, (row.count / denominator) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function matches(row: Row, needle: string, fields: string[]) {
  return !needle || fields.some((field) => text(row[field], '').toLowerCase().includes(needle));
}

function reportsTesting(value: unknown) {
  const label = text(value, '').toLowerCase();
  return /\btested\b/.test(label) && !/not (independently )?tested|untested|no .*test/.test(label);
}

function SectionHeading({ eyebrow, title, note }: { eyebrow?: string; title: ReactNode; note?: string }) {
  return (
    <div className="section-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {note && <p>{note}</p>}
    </div>
  );
}

function Overview({ openTab }: { openTab: (tab: Tab) => void }) {
  const data = useDataset();
  const o = data.summaries.overview;
  const queryEntrypoints: Array<{ tab: Tab; number: string; title: string; description: string; count: string }> = [
    { tab: 'databases', number: '01', title: 'Database landscape', description: 'Browse the core count and the extended data-bearing scope.', count: '80 core · 88 extended' },
    { tab: 'access', number: '02', title: 'Open and accessible data', description: 'Filter licences, fees, registration and canonical access routes.', count: '88 scoped records' },
    { tab: 'formats', number: '03', title: 'Formats and software', description: 'Trace distributions from database releases to schemas and software.', count: `${data.distributions.length} distributions` },
    { tab: 'providers', number: '04', title: 'Providers and sector coverage', description: 'Search owners, maintainers, countries, geographies and industries.', count: `${data.assets.length} asset profiles` },
    { tab: 'mappings', number: '05', title: 'Mappings and conversions', description: 'Inspect projects, version pairs, tests and known conversion losses.', count: `${data.mappings.length} mapping records` },
    { tab: 'assets', number: '06', title: 'Cross-asset search', description: 'Search and compare normalized records across every asset category.', count: `${data.assets.length} asset families` },
  ];
  return (
    <div className="page-stack">
      <section className="publication-hero">
        <div className="publication-intro">
          <p className="kicker">Public research dataset · release {data.meta.packageVersion}</p>
          <h1>Global LCA Asset</h1>
          <p className="lede">
            A versioned public-evidence dataset of life cycle assessment databases, software, schemas, formats,
            distributions and mapping projects.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => openTab('databases')}>Browse the database landscape <span>→</span></button>
            <button className="secondary-button" onClick={() => openTab('data')}>Download this release</button>
          </div>
        </div>
        <aside className="edition-card">
          <p>Dataset edition</p>
          <strong>{data.meta.packageVersion}</strong>
          <dl>
            <div><dt>Evidence cut-off</dt><dd>{data.meta.cutoff}</dd></div>
            <div><dt>Coverage statement</dt><dd>Dated public-evidence lower bound</dd></div>
          </dl>
        </aside>
      </section>

      <section className="metric-grid overview-metrics" aria-label="Inventory overview">
        <Metric value={o.verified_assets} label="asset families" note="all asset categories" />
        <Metric value={data.summaries.asset_types.length} label="asset categories" note="databases, software, schemas and related systems" />
        <Metric value={o.core_database_families} label="core database families" note="narrow working count" />
        <Metric value={o.extended_data_bearing_assets} label="extended data-bearing assets" note="including repositories and platforms" />
      </section>

      <section className="content-card asset-type-summary">
        <SectionHeading eyebrow="Coverage by asset category" title="What is included" note="Family-level records; distribution and mapping records are stored separately." />
        <div className="type-stat-grid">
          {data.summaries.asset_types.map((row) => <div key={row.label}><strong>{row.count}</strong><span>{row.label}</span></div>)}
        </div>
      </section>

      <section className="query-section">
        <SectionHeading title="Explore the dataset" note="Open a focused view to query the relevant fields and supporting sources." />
        <div className="query-grid">
          {queryEntrypoints.map((item) => (
            <button key={item.tab} className="query-card" onClick={() => openTab(item.tab)}>
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{item.count}</strong>
              <b>Open view →</b>
            </button>
          ))}
        </div>
      </section>

      <section className="relationship-callout">
        <div><p className="eyebrow">Cross-cutting view</p><h2>Explore asset relationships</h2><p>Search first, open one local network, and expand neighboring assets only when needed.</p></div>
        <button onClick={() => openTab('network')}>Open relationship graph <span>→</span></button>
      </section>

      <section>
        <article className="content-card citation-card">
          <SectionHeading eyebrow="How to report the count" title={`At least ${o.core_database_families} core database families`} note={`${o.extended_data_bearing_assets} records when data-bearing repositories and platforms are included.`} />
          <p>These figures are a reproducible lower bound under the published inclusion rule and evidence cut-off. They are not a claim that the world contains only this many databases.</p>
          <button className="text-link" onClick={() => openTab('data')}>Read methods and download the manifest →</button>
        </article>
      </section>

      <section className="project-meta-grid" aria-label="Project ownership and feedback">
        <article className="content-card project-owner-card">
          <SectionHeading eyebrow="Project owner" title={<>UNEP Global LCA Platform<br />Working Group 2</>} />
          <dl>
            {projectMembers.map((member) => <div key={member.name}><dd><strong>{member.name}</strong>{member.affiliation && <span>{member.affiliation}</span>}</dd></div>)}
          </dl>
        </article>
        <FeedbackCard />
      </section>
    </div>
  );
}

export function FeedbackCard() {
  return (
    <article className="content-card feedback-card" id="comment-feedback">
      <SectionHeading eyebrow="Participate" title="Comment & feedback" note="We welcome corrections, missing assets, source updates, comments and suggestions for future releases." />
      <p className="feedback-contact">Contact: <strong>{contactName}</strong>, {contactAffiliation}<br /><a href={`mailto:${contactEmail}`}>{contactEmail}</a></p>
      <div className="feedback-actions">
        <a className="primary-button" href={feedbackUrl} target="_blank" rel="noreferrer">Send comment or feedback</a>
        <a className="github-project-link" href={dataContributionGuideUrl} target="_blank" rel="noreferrer"><GitHubIcon /><span>Contribute data via GitHub PR</span></a>
        <a className="github-project-link" href={projectRepository} target="_blank" rel="noreferrer"><GitHubIcon /><span>View Git project</span></a>
      </div>
    </article>
  );
}

function DatabaseLandscape() {
  const data = useDataset();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('All scope classes');
  const [access, setAccess] = useState('All access classes');
  const scopes = [...new Set(data.databaseScope.map((row) => text(row.working_count_status)))].sort();
  const accessClasses = [...new Set(data.databaseScope.map((row) => text(row.open_data_status)))].sort();
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.databaseScope.filter((row) => {
      if (scope !== 'All scope classes' && row.working_count_status !== scope) return false;
      if (access !== 'All access classes' && row.open_data_status !== access) return false;
      return matches(row, needle, ['asset_id', 'official_name', 'owner', 'owner_country_countries', 'developer_country_countries', 'geographic_data_coverage', 'sector_scope']);
    });
  }, [query, scope, access, data.databaseScope]);

  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Research view 01" title="Database landscape" note="The core count and extended data-bearing scope use explicit, reproducible inclusion rules." />
      <section className="scope-summary">
        <div><strong>80</strong><span>core database families</span><small>narrow working count</small></div>
        <div><strong>88</strong><span>extended data-bearing assets</span><small>includes repositories and platforms</small></div>
        <p><strong>Why two counts?</strong> The 80 core records answer the narrow database-family question. The 88-record extended scope contains those same 80 plus eight repositories, platforms and libraries that bear or distribute LCA data. Keeping both prevents a portal—or a Nexus package variant—from being counted as an additional database while preserving the full access ecosystem.</p>
      </section>
      <section className="filter-panel">
        <label className="wide-filter"><span>Search database records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, owner, country, geography or sector…" /></label>
        <label><span>Counting scope</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option>All scope classes</option>{scopes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Access class</span><select value={access} onChange={(event) => setAccess(event.target.value)}><option>All access classes</option>{accessClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="filter-result"><strong>{rows.length}</strong><span>database records</span></div>
      </section>
      <section className="content-card table-card">
        <div className="responsive-table"><table><thead><tr><th>Database</th><th>Scope</th><th>Country / coverage</th><th>Sector</th><th>Current release</th><th>Access class</th><th>Original sources</th></tr></thead><tbody>
          {rows.map((row) => <tr key={text(row.scope_record_id)}><td><strong>{text(row.official_name)}</strong><span>{text(row.asset_id)}</span></td><td>{text(row.working_count_status)}<span>{text(row.lifecycle_status)}</span></td><td>{text(row.owner_country_countries)}<span>{text(row.geographic_data_coverage)}</span></td><td>{text(row.sector_scope)}</td><td>{text(row.current_version)}<span>{text(row.latest_release_date)}</span></td><td><Pill>{text(row.open_data_status)}</Pill></td><td><SourceLinks values={[row.evidence_urls, row.canonical_access_download_url]} /></td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}

function AccessExplorer() {
  const data = useDataset();
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState('All access classes');
  const accessClasses = data.summaries.database_access_classes.map((row) => row.label);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.databaseScope.filter((row) => {
      if (access !== 'All access classes' && row.open_data_status !== access) return false;
      return matches(row, needle, ['official_name', 'open_data_status', 'data_access', 'metadata_access', 'licence_identifier_terms', 'registration', 'fee']);
    });
  }, [query, access, data.databaseScope]);
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Research view 02" title="Access, licences and download routes" note="Free access, open data, public metadata, registration, fees and redistribution rights remain separate fields." />
      <section className="two-column weighted">
        <article className="content-card chart-card"><SectionHeading eyebrow="88-item scope" title="Access classification" /><BarList rows={data.summaries.database_access_classes} /></article>
        <article className="content-card interpretation-card"><h3>Read access claims carefully</h3><p>A public web page does not make the underlying database open. Use the licence and redistribution fields before describing an asset as open data.</p></article>
      </section>
      <section className="filter-panel compact-filter-panel">
        <label className="wide-filter"><span>Search access records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Database, licence, registration or fee…" /></label>
        <label><span>Access class</span><select value={access} onChange={(event) => setAccess(event.target.value)}><option>All access classes</option>{accessClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="filter-result"><strong>{rows.length}</strong><span>matching records</span></div>
      </section>
      <section className="content-card table-card"><div className="responsive-table"><table><thead><tr><th>Database</th><th>Classification</th><th>Data / metadata access</th><th>Licence / rights</th><th>Registration / fee</th><th>Canonical route</th><th>Original sources</th></tr></thead><tbody>
        {rows.map((row) => <tr key={text(row.scope_record_id)}><td><strong>{text(row.official_name)}</strong><span>{text(row.asset_id)}</span></td><td><Pill>{text(row.open_data_status)}</Pill></td><td>{text(row.data_access)}<span>{text(row.metadata_access)}</span></td><td>{text(row.licence_identifier_terms)}<span>Redistribution: {text(row.redistribution_rights)}</span></td><td>{text(row.registration)}<span>{text(row.fee)}</span></td><td>{isUrl(row.canonical_access_download_url) ? <a href={String(row.canonical_access_download_url)} target="_blank" rel="noreferrer">Open official route ↗</a> : text(row.canonical_access_download_url)}</td><td><SourceLinks values={[row.evidence_urls]} /></td></tr>)}
      </tbody></table></div></section>
    </div>
  );
}

function FormatsAndSoftware() {
  const data = useDataset();
  const [query, setQuery] = useState('');
  const [schemaClass, setSchemaClass] = useState('All format / schema families');
  const [status, setStatus] = useState('All evidence statuses');
  const schemaClasses = data.summaries.schema_profile_classes.map((row) => row.label);
  const statuses = [...new Set(data.distributions.map((row) => text(row.claimed_tested_status)))].sort();
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.distributions.filter((row) => {
      if (schemaClass !== 'All format / schema families' && row.schema_profile_class !== schemaClass) return false;
      if (status !== 'All evidence statuses' && row.claimed_tested_status !== status) return false;
      return matches(row, needle, ['database_name', 'database_release', 'distribution_package', 'schema_profile', 'schema_profile_original', 'schema_profile_class', 'schema_version', 'compatible_software', 'software_version']);
    });
  }, [query, schemaClass, status, data.distributions]);
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Research view 03" title="Database formats and software compatibility" note="Schema and profile synonyms are aligned for filtering, while the exact source wording remains visible in every record." />
      <section className="two-column weighted">
        <article className="content-card chart-card"><SectionHeading eyebrow="Distribution register" title="Format and schema families" /><BarList rows={data.summaries.schema_profile_classes} compact /></article>
        <article className="content-card interpretation-card"><h3>Compatibility is a directional claim</h3><p>An advertised import option is not evidence of a complete or lossless conversion. Check the version pair, test status and documented constraint.</p></article>
      </section>
      <section className="filter-panel">
        <label className="wide-filter"><span>Search compatibility records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Database, package, schema, format or software…" /></label>
        <label><span>Format / schema family</span><select value={schemaClass} onChange={(event) => setSchemaClass(event.target.value)}><option>All format / schema families</option>{schemaClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Claim / test status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All evidence statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="filter-result"><strong>{rows.length}</strong><span>distribution records</span></div>
      </section>
      <section className="content-card table-card"><div className="responsive-table"><table><thead><tr><th>Database release</th><th>Distribution / package</th><th>Aligned schema / profile</th><th>Compatible software</th><th>Direction</th><th>Claim / test status</th><th>Original source</th></tr></thead><tbody>
        {rows.map((row) => <tr key={text(row.distribution_id)}><td><strong>{text(row.database_name)}</strong><span>{text(row.database_release)}</span></td><td>{text(row.distribution_package)}</td><td><Pill>{text(row.schema_profile_class)}</Pill><strong>{text(row.schema_profile)}</strong>{row.schema_profile_original !== row.schema_profile && <span>Source label: {text(row.schema_profile_original)}</span>}<span>{text(row.schema_version)}</span></td><td>{text(row.compatible_software)}<span>{text(row.software_version)}</span></td><td>{text(row.direction)}</td><td>{text(row.claimed_tested_status)}<span>{text(row.known_constraint_next_test)}</span></td><td><SourceLinks values={[row.evidence_url, row.access_route]} /></td></tr>)}
      </tbody></table></div></section>
    </div>
  );
}

function ProvidersAndSectors() {
  const data = useDataset();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All asset types');
  const types = data.summaries.asset_types.map((row) => row.label);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assets.filter((row) => {
      if (typeFilter !== 'All asset types' && row.asset_type !== typeFilter) return false;
      return matches(row, needle, ['official_name', 'asset_type', 'owner', 'operator_maintainer', 'geographic_coverage', 'sector_product_process_coverage']);
    });
  }, [query, typeFilter, data.assets]);
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Research view 04" title="Providers, countries and sector coverage" note="Owner, operator, developer country and geographic data coverage are different concepts and are shown separately where available." />
      <section className="filter-panel compact-filter-panel">
        <label className="wide-filter"><span>Search providers and coverage</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset, organization, country, geography or industry…" /></label>
        <label><span>Asset type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All asset types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="filter-result"><strong>{rows.length}</strong><span>asset profiles</span></div>
      </section>
      <section className="content-card table-card"><div className="responsive-table"><table><thead><tr><th>Asset</th><th>Type</th><th>Owner</th><th>Operator / maintainer</th><th>Geographic coverage</th><th>Sector / process coverage</th><th>Original sources</th></tr></thead><tbody>
        {rows.map((row) => <tr key={text(row.asset_id)}><td><strong>{text(row.official_name)}</strong><span>{text(row.asset_id)}</span></td><td><Pill>{text(row.asset_type)}</Pill></td><td>{text(row.owner)}</td><td>{text(row.operator_maintainer)}</td><td>{text(row.geographic_coverage)}</td><td>{text(row.sector_product_process_coverage)}</td><td><SourceLinks values={[row.official_url, row.primary_sources, row.supporting_sources]} /></td></tr>)}
      </tbody></table></div></section>
    </div>
  );
}

function AssetDetail({ asset, onClose, onCompare }: { asset: Row; onClose: () => void; onCompare: (id: string) => void }) {
  const data = useDataset();
  const assetById = useAssetIndex();
  const id = text(asset.asset_id, '');
  const evidence = data.evidence.filter((row) => row.asset_id === id);
  const relations = data.relations.filter((row) => row.source_asset_id === id || row.target_asset_id === id);
  const distributions = data.distributions.filter((row) => row.database_asset_id === id);
  const mappings = data.mappings.filter((row) => row.source_asset_id === id || row.target_asset_id === id);
  const fields: Array<[string, unknown]> = [
    ['Alternative names / acronyms', asset.alternative_name_acronym], ['Owner', asset.owner], ['Operator / maintainer', asset.operator_maintainer], ['Geographic coverage', asset.geographic_coverage],
    ['Sector scope', asset.sector_product_process_coverage], ['Current version', asset.current_version], ['Release / update date', asset.release_update_date],
    ['Access model', asset.access_model], ['Licence / rights', asset.licence_or_usage_rights], ['Schema / data model', asset.data_model_or_schema],
    ['Exchange format', asset.exchange_format], ['API / machine-readable interface', asset.api_or_machine_readable_interface],
    ['QA / validation', asset.qa_validation_approach], ['Known limitations', asset.known_limitations],
  ];
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`Asset details: ${text(asset.official_name)}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close asset details">×</button>
        <div className="drawer-head">
          <Pill tone="dark">{text(asset.asset_type)}</Pill>
          <p>{id}</p>
          <h2>{text(asset.official_name)}</h2>
          <p className="drawer-description">{text(asset.short_description)}</p>
          <div className="drawer-actions">
            {isUrl(asset.official_url) && <a className="secondary-button" href={String(asset.official_url)} target="_blank" rel="noreferrer">Official source ↗</a>}
            <button className="secondary-button" onClick={() => onCompare(id)}>Add to comparison</button>
          </div>
        </div>

        <div className="detail-stats">
          <span><strong>{evidence.length}</strong> evidence</span>
          <span><strong>{relations.length}</strong> relations</span>
          <span><strong>{distributions.length}</strong> distributions</span>
          <span><strong>{mappings.length}</strong> mappings</span>
        </div>

        <section className="detail-section">
          <h3>Profile</h3>
          <dl className="detail-grid">
            {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{text(value)}</dd></div>)}
          </dl>
        </section>

        {evidence.length > 0 && <section className="detail-section"><h3>Public evidence</h3><div className="evidence-list">
          {evidence.map((row) => <article key={text(row.evidence_id)}>
            <div><Pill tone={text(row.source_reliability).toLowerCase().includes('high') ? 'good' : 'neutral'}>{text(row.evidence_id)}</Pill><strong>{text(row.source_title)}</strong></div>
            <p>{text(row.evidence_excerpt)}</p>
            {isUrl(row.url_or_file) && <a href={String(row.url_or_file)} target="_blank" rel="noreferrer">Open source ↗</a>}
          </article>)}
        </div></section>}

        {relations.length > 0 && <section className="detail-section"><h3>Connected assets</h3><div className="relation-list">
          {relations.map((row) => {
            const outgoing = row.source_asset_id === id;
            const otherId = text(outgoing ? row.target_asset_id : row.source_asset_id, '');
            return <article key={text(row.relationship_id)}><span>{outgoing ? '→' : '←'}</span><div><strong>{text(assetById.get(otherId)?.official_name ?? (outgoing ? row.target_asset_name : row.source_asset_name))}</strong><p>{text(row.relationship_type)} · {text(row.status)}</p></div></article>;
          })}
        </div></section>}
      </aside>
    </div>
  );
}

function Comparison({ ids, onRemove, onClear }: { ids: string[]; onRemove: (id: string) => void; onClear: () => void }) {
  const assetById = useAssetIndex();
  const assets = ids.map((id) => assetById.get(id)).filter(Boolean) as Row[];
  if (!assets.length) return null;
  const fields: Array<[string, string]> = [
    ['Asset type', 'asset_type'], ['Owner', 'owner'], ['Geography', 'geographic_coverage'], ['Sector', 'sector_product_process_coverage'],
    ['Access', 'commercial_restricted_open_status'], ['Licence', 'licence_or_usage_rights'], ['Version', 'current_version'],
    ['Schema', 'data_model_or_schema'], ['Format', 'exchange_format'], ['Software compatibility', 'import_export_compatibility'],
    ['Confidence', 'confidence_level'], ['Original source', 'official_url'],
  ];
  return (
    <section className="comparison-panel">
      <div className="comparison-head"><div><p className="eyebrow">Working comparison</p><h3>{assets.length} selected assets</h3></div><button className="text-button" onClick={onClear}>Clear all</button></div>
      <div className="comparison-scroll"><table><thead><tr><th>Field</th>{assets.map((asset) => <th key={text(asset.asset_id)}>{text(asset.official_name)}<button onClick={() => onRemove(text(asset.asset_id, ''))} aria-label={`Remove ${text(asset.official_name)}`}>×</button></th>)}</tr></thead>
      <tbody>{fields.map(([label, field]) => <tr key={field}><th>{label}</th>{assets.map((asset) => <td key={text(asset.asset_id)}>{field === 'official_url' ? <SourceLinks values={[asset[field]]} label="Official source" /> : text(asset[field])}</td>)}</tr>)}</tbody></table></div>
    </section>
  );
}

function AssetExplorer() {
  const data = useDataset();
  const assetById = useAssetIndex();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All asset types');
  const [confidence, setConfidence] = useState('All confidence levels');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [visible, setVisible] = useState(36);
  const types = data.summaries.asset_types.map((row) => row.label);
  const confidenceLevels = data.summaries.confidence_levels.map((row) => row.label);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assets.filter((asset) => {
      if (typeFilter !== 'All asset types' && asset.asset_type !== typeFilter) return false;
      if (confidence !== 'All confidence levels' && asset.confidence_level !== confidence) return false;
      if (!needle) return true;
      return ['asset_id', 'official_name', 'alternative_name_acronym', 'asset_type', 'owner', 'operator_maintainer', 'geographic_coverage', 'sector_product_process_coverage', 'data_model_or_schema', 'exchange_format', 'related_assets']
        .some((field) => text(asset[field], '').toLowerCase().includes(needle));
    });
  }, [query, typeFilter, confidence, data.assets]);

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Full catalogue" title="Browse all asset families" note="Search normalized public records and open an asset to inspect its evidence, distributions, relationships and mappings." />
      <section className="filter-panel">
        <label className="wide-filter"><span>Search</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(36); }} placeholder="Name, owner, country, sector, schema, format…" /></label>
        <label><span>Asset type</span><select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setVisible(36); }}><option>All asset types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Confidence</span><select value={confidence} onChange={(event) => { setConfidence(event.target.value); setVisible(36); }}><option>All confidence levels</option>{confidenceLevels.map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="filter-result"><strong>{filtered.length}</strong><span>matching assets</span></div>
      </section>

      <Comparison ids={compareIds} onRemove={toggleCompare} onClear={() => setCompareIds([])} />

      <section className="asset-grid">
        {filtered.slice(0, visible).map((asset) => {
          const id = text(asset.asset_id, '');
          const selected = compareIds.includes(id);
          return <article className="asset-card" key={id}>
            <div className="asset-card-top"><Pill>{text(asset.asset_type)}</Pill><span>{id}</span></div>
            <button className="asset-open" onClick={() => setSelectedId(id)}><h3>{text(asset.official_name)}</h3><p>{text(asset.short_description)}</p></button>
            <dl><div><dt>Owner</dt><dd>{text(asset.owner)}</dd></div><div><dt>Geography</dt><dd>{text(asset.geographic_coverage)}</dd></div><div><dt>Access</dt><dd>{text(asset.commercial_restricted_open_status)}</dd></div></dl>
            <div className="asset-card-bottom"><Pill tone={asset.confidence_level === 'High' ? 'good' : 'warn'}>{text(asset.confidence_level)} confidence</Pill><button className={selected ? 'compare-selected' : ''} onClick={() => toggleCompare(id)}>{selected ? 'Selected ✓' : 'Compare +'}</button></div>
          </article>;
        })}
      </section>
      {visible < filtered.length && <button className="load-more" onClick={() => setVisible((current) => current + 36)}>Show more assets</button>}
      {selectedId && assetById.get(selectedId) && <AssetDetail asset={assetById.get(selectedId)!} onClose={() => setSelectedId(null)} onCompare={toggleCompare} />}
    </div>
  );
}

function MappingsAndConversions() {
  const data = useDataset();
  const endpointOptions = useMemo(() => {
    const options = new Map<string, { endpoint: string; kind: string }>();
    for (const row of data.mappings) {
      for (const side of ['source', 'target']) {
        const endpoint = text(row[`${side}_endpoint`], '');
        const kind = text(row[`${side}_endpoint_kind`], 'Other mapping endpoint');
        if (endpoint) options.set(`${kind}|||${endpoint}`, { endpoint, kind });
      }
    }
    return [...options.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.kind.localeCompare(b.kind) || a.endpoint.localeCompare(b.endpoint));
  }, [data.mappings]);
  const [query, setQuery] = useState('');
  const [focusKey, setFocusKey] = useState(endpointOptions[0]?.key ?? '');
  const needle = query.toLowerCase();
  const mappings = data.mappings.filter((row) => !needle || Object.values(row).some((value) => text(value, '').toLowerCase().includes(needle)));
  const focusedEndpoint = endpointOptions.find((option) => option.key === focusKey);
  const focusedMappings = data.mappings.filter((row) =>
    (row.source_endpoint === focusedEndpoint?.endpoint && row.source_endpoint_kind === focusedEndpoint?.kind)
    || (row.target_endpoint === focusedEndpoint?.endpoint && row.target_endpoint_kind === focusedEndpoint?.kind));
  const tested = data.mappings.filter((row) => reportsTesting(row.claimed_tested)).length;
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Research view 05" title="Mapping and conversion projects" note="Mappings are organized by typed endpoints—the schema, format, software importer, internal model, workflow or reference list actually connected by a project." />
      <section className="interop-primer">
        <div><strong>{data.mappings.length}</strong><span>mapping records</span></div>
        <div><strong>{tested}</strong><span>records reporting tests</span></div>
        <div><strong>{new Set(data.mappings.map((row) => text(row.project_study))).size}</strong><span>named projects or studies</span></div>
        <p><strong>Interpretation rule:</strong> a product and its data model are not the same endpoint. “openLCA software” is used only when the record concerns the importer; “openLCA JSON-LD” is the separate schema endpoint. Compatibility, implementation and lossless round-trip also remain different claims.</p>
      </section>

      <section>
        <article className="content-card relation-focus">
          <SectionHeading eyebrow="Mapping endpoint focus" title={focusedEndpoint?.endpoint ?? 'Select an endpoint'} note={`${focusedEndpoint?.kind ?? ''} · ${focusedMappings.length} linked mapping records`} />
          <label><span>Mapping endpoint</span><select value={focusKey} onChange={(event) => setFocusKey(event.target.value)}>{endpointOptions.map((option) => <option value={option.key} key={option.key}>{option.endpoint} — {option.kind}</option>)}</select></label>
          <div className="relation-list compact-relations">
            {focusedMappings.map((row) => {
              const outgoing = row.source_endpoint === focusedEndpoint?.endpoint && row.source_endpoint_kind === focusedEndpoint?.kind;
              const otherEndpoint = text(outgoing ? row.target_endpoint : row.source_endpoint);
              const otherKind = text(outgoing ? row.target_endpoint_kind : row.source_endpoint_kind);
              return <article key={text(row.mapping_artifact_id)}><span>{outgoing ? '→' : '←'}</span><div><strong>{otherEndpoint}</strong><p>{otherKind} · {text(row.mapping_type)} · {text(row.claimed_tested)}</p></div></article>;
            })}
            {!focusedMappings.length && <p className="muted">No registered mapping artifact for this endpoint.</p>}
          </div>
        </article>
      </section>

      <section className="content-card">
        <div className="table-heading"><SectionHeading eyebrow="Mapping register" title="Projects, tools and studies" note="Filter by schema, format, implementing software, project or evidence status." /><label className="small-search"><span>Search mappings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ILCD, ecoSpold2, GLAD…" /></label></div>
        <div className="responsive-table"><table className="mapping-register-table"><thead><tr><th>Source endpoint</th><th>Target endpoint</th><th>Mapping / direction</th><th>Project or tool</th><th>Evidence status</th><th>Known loss / exception</th><th>Original source</th></tr></thead><tbody>
          {mappings.map((row) => <tr key={text(row.mapping_artifact_id)}><td className="mapping-endpoint-cell"><Pill>{text(row.source_endpoint_kind)}</Pill><strong>{text(row.source_endpoint)}</strong>{row.source_endpoint_original !== row.source_endpoint && <span>Original label: {text(row.source_endpoint_original)}</span>}<span>{text(row.source_version)}</span></td><td className="mapping-endpoint-cell"><Pill>{text(row.target_endpoint_kind)}</Pill><strong>{text(row.target_endpoint)}</strong>{row.target_endpoint_original !== row.target_endpoint && <span>Original label: {text(row.target_endpoint_original)}</span>}<span>{text(row.target_version)}</span></td><td>{text(row.mapping_type)}<span>{text(row.direction)}</span></td><td>{text(row.project_study)}<span>{text(row.implementing_software_tool)}</span></td><td><Pill tone={reportsTesting(row.claimed_tested) ? 'good' : 'warn'}>{text(row.claimed_tested)}</Pill></td><td>{text(row.known_loss_exception)}</td><td><SourceLinks values={[row.artifact_url_doi]} /></td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}

function DataPackage() {
  const data = useDataset();
  const downloads = [
    ['Manifest', 'manifest.json'], ['Validation report', 'validation_report.json'], ['Analysis rules', 'analysis_rules.md'],
    ['Assets · CSV', 'assets.csv'], ['Assets · JSONL', 'assets.jsonl'], ['Evidence · CSV', 'evidence.csv'],
    ['Relations · CSV', 'relations.csv'], ['Database scope · CSV', 'database_scope.csv'], ['Distributions · CSV', 'distributions.csv'],
    ['Schema/profile alignment · CSV', 'schema_profile_alignment.csv'], ['Mapping endpoint alignment · CSV', 'mapping_endpoint_alignment.csv'],
    ['Mappings · CSV', 'mapping_artifacts.csv'], ['Version audit · CSV', 'version_audit.csv'], ['Complete SQLite package', 'global_lca_assets.sqlite'],
  ];
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Dataset release" title="Download Global LCA Asset" note="CSV supports spreadsheet work, JSONL supports AI-assisted analysis, and SQLite supports exact relational queries." />
      <section className="package-hero">
        <div><Pill tone="good">Validation {data.meta.validationStatus}</Pill><h3>Release {data.meta.packageVersion}</h3><p>Evidence cut-off {data.meta.cutoff}. Public information only. Personal names, email addresses and internal review mappings are excluded.</p></div>
        <div className="package-flow"><span>Public sources</span><b>→</b><span>Reviewed records</span><b>→</b><span>Versioned dataset</span></div>
      </section>
      <section className="download-grid">{downloads.map(([label, file]) => <a key={file} href={`/downloads/${file}`} download><span>{label}</span><strong>{file.endsWith('.sqlite') ? 'SQLite' : file.split('.').pop()?.toUpperCase()}</strong><b>↓</b></a>)}</section>
      <section className="two-column">
        <article className="content-card"><SectionHeading eyebrow="Recommended use" title="Start with the manifest" /><ol className="numbered-list"><li>Use the evidence cut-off and package version with every result.</li><li>Select the table matching the research view.</li><li>Keep definitions, evidence URLs and unresolved fields attached.</li><li>Report scoped lower bounds instead of an unqualified world total.</li></ol></article>
        <article className="content-card principle-card"><SectionHeading eyebrow="Interpretation" title="Four distinctions to preserve" /><ul className="principle-list"><li><strong>Free access ≠ open data</strong><span>Check licence and redistribution rights.</span></li><li><strong>Compatibility ≠ mapping</strong><span>Check direction, versions and test status.</span></li><li><strong>Aligned label ≠ overwritten source</strong><span>Use the original-label field when exact source wording matters.</span></li><li><strong>Developer country ≠ data geography</strong><span>Use the separate coverage fields.</span></li></ul></article>
      </section>
      <section className="two-column weighted">
        <article className="content-card chart-card"><SectionHeading eyebrow="Data completeness" title="Fields not publicly confirmed" note="These counts describe information availability, not asset quality." /><BarList rows={data.summaries.field_information_gaps.map((row) => ({ label: row.label, count: row.count }))} max={data.summaries.overview.verified_assets} compact /></article>
        <article className="content-card"><SectionHeading eyebrow="Discovery record" title={`${data.searchCoverage.length} documented search streams`} note="Questionnaires and stakeholder lists are treated as discovery leads rather than the verified sample frame." /><p className="method-copy">The package preserves search coverage and evidence status so later releases can extend discovery without changing the meaning of earlier counts.</p><a className="text-link" href="/downloads/search_coverage.csv" download>Download search coverage →</a></article>
      </section>
    </div>
  );
}

function DatasetApplication() {
  const data = useDataset();
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <main className="dataset-shell full-dataset">
      <header className="dataset-header sticky-header">
        <button className="brand-button" onClick={() => setTab('overview')}>
          <span className="brand-mark">LCA</span><span><small>UNEP · Global LCA Platform</small><strong>Global LCA Asset</strong></span>
        </button>
        <div className="header-utilities">
          <a className="github-header-link" href={projectRepository} target="_blank" rel="noreferrer" aria-label="Open the Global LCA Asset GitHub project"><GitHubIcon /><span>GitHub</span></a>
          <div className="cutoff"><span className={`status-dot status-${data.meta.validationStatus}`} /><span className="cutoff-label">Evidence cut-off</span><span className="cutoff-separator">·</span><strong>{data.meta.cutoff}</strong></div>
        </div>
      </header>
      <nav className="tab-nav" aria-label="Global LCA Asset dataset views">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="dataset-content">
        {tab === 'overview' && <Overview openTab={setTab} />}
        {tab === 'databases' && <DatabaseLandscape />}
        {tab === 'access' && <AccessExplorer />}
        {tab === 'formats' && <FormatsAndSoftware />}
        {tab === 'providers' && <ProvidersAndSectors />}
        {tab === 'mappings' && <MappingsAndConversions />}
        {tab === 'network' && <Suspense fallback={<div className="page-stack"><section className="content-card"><p className="eyebrow">Loading on demand</p><h2>Preparing the relationship graph…</h2></section></div>}><RelationshipGraph /></Suspense>}
        {tab === 'assets' && <AssetExplorer />}
        {tab === 'data' && <DataPackage />}
      </div>
      <footer>
        <div><span>Global LCA Asset · release {data.meta.packageVersion}</span><span>{data.meta.scopeWarning}</span><span>Project owner: {projectOwner}</span></div>
      </footer>
    </main>
  );
}

type DatasetLoadState =
  | { status: 'loading' }
  | { status: 'ready'; dataset: Dataset }
  | { status: 'error'; message: string };

function DatasetLoadScreen({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <main className="dataset-shell full-dataset">
      <div className="dataset-content">
        <div className="page-stack">
          <section className="content-card" role={error ? 'alert' : 'status'}>
            <p className="eyebrow">Global LCA Asset</p>
            <h2>{error ? 'The reviewed dataset could not be loaded' : 'Loading the reviewed dataset…'}</h2>
            {error && <p>{error}</p>}
            {onRetry && <button className="primary-button" onClick={onRetry}>Retry loading</button>}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function GlobalLcaAsset() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DatasetLoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading' });
    loadDataset(globalThis.fetch, controller.signal).then(
      (dataset) => { if (active) setState({ status: 'ready', dataset }); },
      (error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Unknown dataset loading error.';
        setState({ status: 'error', message });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  if (state.status === 'loading') return <DatasetLoadScreen />;
  if (state.status === 'error') {
    return <DatasetLoadScreen error={state.message} onRetry={() => setAttempt((current) => current + 1)} />;
  }
  return <DatasetContext.Provider value={state.dataset}><DatasetApplication /></DatasetContext.Provider>;
}
