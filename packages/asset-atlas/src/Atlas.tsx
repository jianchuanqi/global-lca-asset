import { useMemo, useState } from 'react';
import atlasJson from './data/atlas.json';

type Row = Record<string, string | number | null>;
type Tab = 'overview' | 'assets' | 'interop' | 'timeline' | 'review' | 'data';

const data = atlasJson as unknown as {
  meta: Record<string, string>;
  summaries: {
    overview: Record<string, number>;
    asset_types: Array<{ label: string; count: number }>;
    confidence_levels: Array<{ label: string; count: number }>;
    relationship_statuses: Array<{ label: string; count: number }>;
    database_access_classes: Array<{ label: string; count: number }>;
    field_information_gaps: Array<{ field: string; label: string; count: number; rate: number }>;
  };
  assets: Row[];
  evidence: Row[];
  relations: Row[];
  distributions: Row[];
  releases: Row[];
  mappings: Row[];
  databaseScope: Row[];
  databaseAccessScope: Row[];
  searchCoverage: Row[];
  reviewIssues: Row[];
  answerability: Row[];
};

const tabs: Array<[Tab, string]> = [
  ['overview', 'Overview'],
  ['assets', 'Asset Explorer'],
  ['interop', 'Interoperability'],
  ['timeline', 'Timeline'],
  ['review', 'Review & gaps'],
  ['data', 'Data package'],
];

const assetById = new Map(data.assets.map((asset) => [String(asset.asset_id), asset]));

function text(value: unknown, fallback = 'Not publicly confirmed') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function isUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function splitUrls(value: unknown) {
  return text(value, '').split(/\s*\|\s*/).filter((part) => isUrl(part));
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

function SectionHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {note && <p>{note}</p>}
    </div>
  );
}

function Overview({ openAssets }: { openAssets: () => void }) {
  const o = data.summaries.overview;
  const accessRows = data.summaries.database_access_classes;
  return (
    <div className="page-stack">
      <section className="hero hero-full">
        <div>
          <p className="kicker">A versioned, evidence-traceable landscape</p>
          <h2>Explore what exists, how it connects, and what still needs validation.</h2>
          <p className="lede">
            This Atlas treats questionnaires and stakeholder lists as leads, then connects verified public evidence to assets,
            releases, distributions, formats, software and mapping projects.
          </p>
          <button className="primary-button" onClick={openAssets}>Explore all assets <span>→</span></button>
        </div>
        <aside className="scope-card">
          <p className="eyebrow">Counting rule</p>
          <strong>At least {o.core_database_families}</strong>
          <h3>core database families</h3>
          <p>{o.extended_data_bearing_assets} when data-bearing repositories and platforms are included.</p>
          <div className="scope-warning">A dated lower bound—not a claim of the true world total.</div>
        </aside>
      </section>

      <section className="metric-grid overview-metrics" aria-label="Inventory overview">
        <Metric value={o.verified_assets} label="verified assets" note={`${o.high_confidence_assets} high-confidence`} />
        <Metric value={o.evidence_records} label="evidence records" note="public sources only" />
        <Metric value={o.relationship_records} label="registered relations" note="direction and status retained" />
        <Metric value={o.releases} label="release milestones" note="not exhaustive patch history" />
      </section>

      <section className="two-column">
        <article className="content-card chart-card">
          <SectionHeading eyebrow="Landscape" title="Assets by type" note="Normalized records; not a measure of importance or use." />
          <BarList rows={data.summaries.asset_types} />
        </article>
        <article className="content-card chart-card">
          <SectionHeading eyebrow="Evidence" title="Confidence distribution" note="Confidence describes public evidence strength, not asset quality." />
          <BarList rows={data.summaries.confidence_levels} max={o.verified_assets} />
        </article>
      </section>

      <section className="two-column weighted">
        <article className="content-card chart-card">
          <SectionHeading eyebrow="Access" title="Availability does not mean openness" note="Classification for the 77-item extended data-bearing scope." />
          <BarList rows={accessRows} />
        </article>
        <article className="content-card principle-card">
          <p className="eyebrow">Interpretation guardrails</p>
          <ul className="principle-list">
            <li><strong>Free access ≠ open data.</strong><span>Licence and redistribution rights are recorded separately.</span></li>
            <li><strong>Compatibility ≠ lossless conversion.</strong><span>Direction, version pair, test status and known losses matter.</span></li>
            <li><strong>Current version ≠ version history.</strong><span>The timeline contains verified public milestones.</span></li>
            <li><strong>Developer country ≠ data geography.</strong><span>Owner, developer and coverage fields remain separate.</span></li>
          </ul>
        </article>
      </section>

      <section className="content-card answer-strip">
        <SectionHeading eyebrow="Review purpose" title="Six questions, one connected evidence base" />
        <div className="question-grid">
          {data.answerability.map((row, index) => (
            <article key={text(row.question)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{text(row.question)}</h3>
              <Pill tone={text(row.readiness).startsWith('Answerable') ? 'good' : 'warn'}>{text(row.readiness)}</Pill>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssetDetail({ asset, onClose, onCompare }: { asset: Row; onClose: () => void; onCompare: (id: string) => void }) {
  const id = text(asset.asset_id, '');
  const evidence = data.evidence.filter((row) => row.asset_id === id);
  const relations = data.relations.filter((row) => row.source_asset_id === id || row.target_asset_id === id);
  const releases = data.releases.filter((row) => row.asset_id === id);
  const distributions = data.distributions.filter((row) => row.database_asset_id === id);
  const mappings = data.mappings.filter((row) => row.source_asset_id === id || row.target_asset_id === id);
  const fields: Array<[string, unknown]> = [
    ['Owner', asset.owner], ['Operator / maintainer', asset.operator_maintainer], ['Geographic coverage', asset.geographic_coverage],
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
          <span><strong>{releases.length}</strong> releases</span>
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
  const assets = ids.map((id) => assetById.get(id)).filter(Boolean) as Row[];
  if (!assets.length) return null;
  const fields: Array<[string, string]> = [
    ['Asset type', 'asset_type'], ['Owner', 'owner'], ['Geography', 'geographic_coverage'], ['Sector', 'sector_product_process_coverage'],
    ['Access', 'commercial_restricted_open_status'], ['Licence', 'licence_or_usage_rights'], ['Version', 'current_version'],
    ['Schema', 'data_model_or_schema'], ['Format', 'exchange_format'], ['Software compatibility', 'import_export_compatibility'],
    ['Confidence', 'confidence_level'],
  ];
  return (
    <section className="comparison-panel">
      <div className="comparison-head"><div><p className="eyebrow">Working comparison</p><h3>{assets.length} selected assets</h3></div><button className="text-button" onClick={onClear}>Clear all</button></div>
      <div className="comparison-scroll"><table><thead><tr><th>Field</th>{assets.map((asset) => <th key={text(asset.asset_id)}>{text(asset.official_name)}<button onClick={() => onRemove(text(asset.asset_id, ''))} aria-label={`Remove ${text(asset.official_name)}`}>×</button></th>)}</tr></thead>
      <tbody>{fields.map(([label, field]) => <tr key={field}><th>{label}</th>{assets.map((asset) => <td key={text(asset.asset_id)}>{text(asset[field])}</td>)}</tr>)}</tbody></table></div>
    </section>
  );
}

function AssetExplorer() {
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
  }, [query, typeFilter, confidence]);

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Asset Explorer" title="Search the evidence base—not a flattened list" note="Open a record to inspect evidence, related assets, releases, distributions and mappings." />
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

function Interoperability() {
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState('LCA-DB-0001');
  const needle = query.toLowerCase();
  const mappings = data.mappings.filter((row) => !needle || Object.values(row).some((value) => text(value, '').toLowerCase().includes(needle)));
  const focusedAsset = assetById.get(focusId);
  const focusedRelations = data.relations.filter((row) => row.source_asset_id === focusId || row.target_asset_id === focusId);
  const schemaRows = Object.entries(data.distributions.reduce<Record<string, number>>((acc, row) => {
    const key = text(row.schema_profile, 'Not specified'); acc[key] = (acc[key] ?? 0) + 1; return acc;
  }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Interoperability landscape" title="Relationships are versioned claims, not binary compatibility" note="Use focused views to avoid a single unreadable network graph." />
      <section className="interop-primer">
        <div><strong>{data.distributions.length}</strong><span>distribution and compatibility rows</span></div>
        <div><strong>{data.mappings.length}</strong><span>mapping artifacts</span></div>
        <div><strong>{data.relations.length}</strong><span>registered relationships</span></div>
        <p><strong>Evidence rule:</strong> provider-stated import, tested conversion, nomenclature mapping and lossless round-trip are kept as different claims.</p>
      </section>

      <section className="two-column weighted">
        <article className="content-card chart-card"><SectionHeading eyebrow="Distributions" title="Frequently recorded schema / profile labels" /><BarList rows={schemaRows} compact /></article>
        <article className="content-card relation-focus">
          <SectionHeading eyebrow="Focused network" title={text(focusedAsset?.official_name, 'Select an asset')} note={`${focusedRelations.length} incoming and outgoing relationships`} />
          <label><span>Focus asset</span><select value={focusId} onChange={(event) => setFocusId(event.target.value)}>{data.assets.map((asset) => <option value={text(asset.asset_id, '')} key={text(asset.asset_id)}>{text(asset.official_name)}</option>)}</select></label>
          <div className="relation-list compact-relations">
            {focusedRelations.slice(0, 12).map((row) => {
              const outgoing = row.source_asset_id === focusId;
              return <article key={text(row.relationship_id)}><span>{outgoing ? '→' : '←'}</span><div><strong>{text(outgoing ? row.target_asset_name : row.source_asset_name)}</strong><p>{text(row.relationship_type)} · {text(row.status)}</p></div></article>;
            })}
            {!focusedRelations.length && <p className="muted">No explicit relationship records for this asset.</p>}
          </div>
        </article>
      </section>

      <section className="content-card">
        <div className="table-heading"><SectionHeading eyebrow="Mapping register" title="Projects, tools and studies" note="Direction, versions, test scope and known loss remain visible." /><label className="small-search"><span>Filter mappings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ILCD, ecoSpold2, GLAD…" /></label></div>
        <div className="responsive-table"><table><thead><tr><th>Source → target</th><th>Type / direction</th><th>Project or tool</th><th>Evidence status</th><th>Known loss / exception</th></tr></thead><tbody>
          {mappings.map((row) => <tr key={text(row.mapping_artifact_id)}><td><strong>{text(row.source_schema_format)}</strong><span>{text(row.source_version)} →</span><strong>{text(row.target_schema_format)}</strong><span>{text(row.target_version)}</span></td><td>{text(row.mapping_type)}<span>{text(row.direction)}</span></td><td>{text(row.project_study)}<span>{text(row.implementing_software_tool)}</span></td><td><Pill tone={text(row.claimed_tested).toLowerCase().includes('tested') ? 'good' : 'warn'}>{text(row.claimed_tested)}</Pill></td><td>{text(row.known_loss_exception)}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}

function Timeline() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All asset types');
  const types = [...new Set(data.releases.map((row) => text(row.asset_type)))].sort();
  const rows = useMemo(() => data.releases.filter((row) => {
    if (typeFilter !== 'All asset types' && row.asset_type !== typeFilter) return false;
    const needle = query.toLowerCase();
    return !needle || [row.asset_name, row.version, row.release_line, row.lifecycle_status].some((value) => text(value, '').toLowerCase().includes(needle));
  }).sort((a, b) => text(b.release_date, text(b.first_development_release_year, '0')).localeCompare(text(a.release_date, text(a.first_development_release_year, '0')))), [query, typeFilter]);
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Release history" title="Verified milestones, with lineage where public evidence supports it" note="Cloud products, proprietary tools and modular projects may not expose complete patch histories." />
      <section className="filter-panel timeline-filters"><label className="wide-filter"><span>Search release records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset, version or release line…" /></label><label><span>Asset type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All asset types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label><div className="filter-result"><strong>{rows.length}</strong><span>milestones</span></div></section>
      <section className="timeline-list">
        {rows.slice(0, 140).map((row) => <article key={text(row.release_record_id)}><div className="timeline-date">{text(row.release_date, text(row.first_development_release_year))}</div><div className="timeline-dot" /><div className="timeline-body"><div><Pill>{text(row.asset_type)}</Pill><span>{text(row.lifecycle_status)}</span></div><h3>{text(row.asset_name)} · {text(row.version)}</h3><p>{text(row.release_line)}{row.predecessor_release && ` · follows ${text(row.predecessor_release)}`}</p>{splitUrls(row.release_evidence_urls).slice(0, 1).map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>Release evidence ↗</a>)}</div></article>)}
      </section>
      {rows.length > 140 && <p className="limit-note">Showing the 140 most recent matching milestones. Narrow the filters to inspect earlier records.</p>}
    </div>
  );
}

function Review() {
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Expert validation" title="Review claims that could change decisions—not every cell" note="The package separates current answers, critical gaps and the evidence needed to close them." />
      <section className="answerability-list">
        {data.answerability.map((row, index) => <article key={text(row.question)}>
          <div className="answer-number">{String(index + 1).padStart(2, '0')}</div>
          <div className="answer-body"><div><h3>{text(row.question)}</h3><Pill tone={text(row.readiness).startsWith('Answerable') ? 'good' : 'warn'}>{text(row.readiness)}</Pill></div><p className="current-answer">{text(row.current_answer_form)}</p><dl><div><dt>Evidence now available</dt><dd>{text(row.evidence_basis)}</dd></div><div><dt>Critical remaining gap</dt><dd>{text(row.main_gap)}</dd></div><div><dt>Completion test</dt><dd>{text(row.completion_condition)}</dd></div></dl><p className="warning-line">{text(row.warning)}</p></div>
        </article>)}
      </section>

      <section className="two-column weighted">
        <article className="content-card chart-card"><SectionHeading eyebrow="Information gaps" title="Fields not publicly confirmed" note="Counts flag where holder or expert review could add the most information." /><BarList rows={data.summaries.field_information_gaps.map((row) => ({ label: row.label, count: row.count }))} max={data.summaries.overview.verified_assets} compact /></article>
        <article className="content-card"><SectionHeading eyebrow="Open review issues" title="Priority expert questions" />
          <div className="issue-list">{data.reviewIssues.map((row) => <article key={text(row.issue_id)}><div><Pill tone={row.priority === 'High' ? 'warn' : 'neutral'}>{text(row.priority)}</Pill><span>{text(row.area)}</span></div><h3>{text(row.issue)}</h3><p>{text(row.recommended_action)}</p></article>)}</div>
        </article>
      </section>

      <section className="content-card"><SectionHeading eyebrow="Discovery coverage" title="What has been searched—and where gaps remain" />
        <div className="coverage-grid">{data.searchCoverage.map((row) => <article key={text(row.search_stream_id)}><div><Pill tone={text(row.status).toLowerCase().includes('completed') ? 'good' : 'neutral'}>{text(row.status)}</Pill><span>{text(row.last_searched)}</span></div><h3>{text(row.discovery_stream)}</h3><p>{text(row.geography)} · {text(row.languages)}</p><strong>{text(row.result_evidence_signal)}</strong><small>{text(row.next_search_action)}</small></article>)}</div>
      </section>
    </div>
  );
}

function DataPackage() {
  const downloads = [
    ['Manifest', 'manifest.json'], ['Validation report', 'validation_report.json'], ['Analysis rules', 'analysis_rules.md'],
    ['Assets · CSV', 'assets.csv'], ['Assets · JSONL', 'assets.jsonl'], ['Evidence · CSV', 'evidence.csv'],
    ['Relations · CSV', 'relations.csv'], ['Database scope · CSV', 'database_scope.csv'], ['Distributions · CSV', 'distributions.csv'],
    ['Releases · CSV', 'releases.csv'], ['Mappings · CSV', 'mapping_artifacts.csv'], ['Complete SQLite package', 'global_lca_assets.sqlite'],
  ];
  return (
    <div className="page-stack">
      <SectionHeading eyebrow="Reusable evidence base" title="CSV for people, JSONL for AI, SQLite for exact queries" note="All formats are generated from the same privacy-screened public seed and carry the same cut-off and validation status." />
      <section className="package-hero">
        <div><Pill tone="good">Validation {data.meta.validationStatus}</Pill><h3>Package {data.meta.packageVersion}</h3><p>Evidence cut-off {data.meta.cutoff}. Public information only. Personal names and emails are excluded.</p></div>
        <div className="package-flow"><span>Public evidence seed</span><b>→</b><span>Versioned data package</span><b>→</b><span>AI answers & Atlas views</span></div>
      </section>
      <section className="download-grid">{downloads.map(([label, file]) => <a key={file} href={`/downloads/${file}`} download><span>{label}</span><strong>{file.endsWith('.sqlite') ? 'SQLite' : file.split('.').pop()?.toUpperCase()}</strong><b>↓</b></a>)}</section>
      <section className="two-column">
        <article className="content-card"><SectionHeading eyebrow="Query mode" title="Use reviewed data directly" /><ol className="numbered-list"><li>Read manifest and analysis rules.</li><li>Query only the tables needed for the question.</li><li>Return counts with definitions, evidence and caveats.</li><li>Generate a fresh table, figure or HTML view when useful.</li></ol></article>
        <article className="content-card"><SectionHeading eyebrow="Update mode" title="Protect the canonical inventory" /><ol className="numbered-list"><li>Search public information only.</li><li>Add findings to the candidate queue.</li><li>Resolve entity identity and attach evidence.</li><li>Promote reviewed claims, regenerate package, then record a new release.</li></ol></article>
      </section>
    </div>
  );
}

export default function AtlasClient() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <main className="atlas-shell full-atlas">
      <header className="atlas-header sticky-header">
        <button className="brand-button" onClick={() => setTab('overview')}>
          <span className="brand-mark">LCA</span><span><small>UNEP · Global LCA Platform</small><strong>Global LCA Asset Atlas</strong></span>
        </button>
        <div className="cutoff"><span className={`status-dot status-${data.meta.validationStatus}`} />Evidence cut-off · {data.meta.cutoff}</div>
      </header>
      <nav className="tab-nav" aria-label="Atlas sections">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="atlas-content">
        {tab === 'overview' && <Overview openAssets={() => setTab('assets')} />}
        {tab === 'assets' && <AssetExplorer />}
        {tab === 'interop' && <Interoperability />}
        {tab === 'timeline' && <Timeline />}
        {tab === 'review' && <Review />}
        {tab === 'data' && <DataPackage />}
      </div>
      <footer><span>Global LCA Asset Review · package {data.meta.packageVersion}</span><span>{data.meta.scopeWarning}</span></footer>
    </main>
  );
}
