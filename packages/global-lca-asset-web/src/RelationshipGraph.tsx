import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions } from 'cytoscape';
import './relationship-graph.css';

type GraphIndexNode = {
  id: string;
  name: string;
  kind: 'asset' | 'organization';
  asset_type: string;
  owner: string;
  geography: string;
  sector: string;
  confidence: string;
  official_url: string;
  connection_count: number;
  normalization_status: string;
  expandable: true;
};

type GraphNode = GraphIndexNode | (Omit<GraphIndexNode, 'kind' | 'expandable'> & {
  kind: 'external';
  expandable: false;
});

type GraphRelationship = {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  status: string;
  evidence: string;
  constraints: string;
  validation_question: string;
  mapping_artifact_id: string;
  source_urls: string[];
};

type GraphIndex = {
  package_version: string;
  evidence_cutoff: string;
  asset_count: number;
  organization_count?: number;
  node_count?: number;
  relationship_count: number;
  expandable_relationship_count: number;
  loading_model: string;
  assets: GraphIndexNode[];
  organizations?: GraphIndexNode[];
};

type Neighborhood = {
  package_version: string;
  center_node_id?: string;
  center_asset_id?: string;
  nodes: GraphNode[];
  relationships: GraphRelationship[];
};

type Selection = { kind: 'node' | 'relationship'; id: string } | null;
type LayoutName = 'cose' | 'breadthfirst' | 'circle' | 'grid';

const graphBase = '/graph';

function categoryFor(node: GraphNode) {
  if (node.kind === 'external') return 'external';
  if (node.kind === 'organization') return 'organization';
  if (node.asset_type.startsWith('Database')) return 'database';
  if (node.asset_type.startsWith('Software')) return 'software';
  if (node.asset_type.startsWith('Data schema')) return 'schema';
  if (node.asset_type.startsWith('Platform')) return 'platform';
  if (node.asset_type.startsWith('Nomenclature')) return 'nomenclature';
  if (node.asset_type.startsWith('Method')) return 'method';
  if (node.asset_type.startsWith('QA')) return 'quality';
  return 'asset';
}

function elements(nodes: GraphNode[], relationships: GraphRelationship[], centerId: string): ElementDefinition[] {
  return [
    ...nodes.map((node) => ({
      group: 'nodes' as const,
      data: {
        id: node.id,
        label: node.name,
        category: categoryFor(node),
        center: node.id === centerId ? 'yes' : 'no',
      },
    })),
    ...relationships.map((relationship) => ({
      group: 'edges' as const,
      data: {
        id: relationship.id,
        source: relationship.source,
        target: relationship.target,
        label: relationship.relationship_type,
        status: relationship.status,
      },
    })),
  ];
}

const graphStyles: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      'background-color': '#2f52a0', 'border-color': '#ffffff', 'border-width': 2,
      color: '#003b5c', label: 'data(label)', 'font-family': 'Montserrat, Arial, sans-serif',
      'font-size': 9, 'font-weight': 600, height: 33, width: 33, 'min-zoomed-font-size': 7,
      'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': '3px',
      'text-margin-y': 8, 'text-max-width': '120px', 'text-valign': 'bottom', 'text-wrap': 'ellipsis',
    },
  },
  { selector: 'node[category = "database"]', style: { 'background-color': '#2f52a0', shape: 'round-rectangle', width: 42 } },
  { selector: 'node[category = "software"]', style: { 'background-color': '#009edb', shape: 'ellipse' } },
  { selector: 'node[category = "schema"]', style: { 'background-color': '#7752a4', shape: 'diamond' } },
  { selector: 'node[category = "platform"]', style: { 'background-color': '#007fae', shape: 'hexagon' } },
  { selector: 'node[category = "nomenclature"]', style: { 'background-color': '#d29b2c', shape: 'tag' } },
  { selector: 'node[category = "method"]', style: { 'background-color': '#4f806f', shape: 'round-tag' } },
  { selector: 'node[category = "quality"]', style: { 'background-color': '#bf5b63', shape: 'octagon' } },
  { selector: 'node[category = "organization"]', style: { 'background-color': '#4f806f', shape: 'round-rectangle', width: 42, height: 30 } },
  { selector: 'node[category = "external"]', style: { 'background-color': '#9aaab3', shape: 'vee', width: 28, height: 28 } },
  { selector: 'node[center = "yes"]', style: { 'border-color': '#f7c948', 'border-width': 6, width: 48, height: 40, 'z-index': 20 } },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier', 'line-color': '#8fb6c9', 'target-arrow-color': '#8fb6c9',
      'target-arrow-shape': 'triangle', 'arrow-scale': 0.75, width: 1.3, opacity: 0.78,
      label: 'data(label)', color: '#526b78', 'font-size': 7, 'min-zoomed-font-size': 6,
      'text-background-color': '#ffffff', 'text-background-opacity': 0.84, 'text-background-padding': '2px',
      'text-rotation': 'autorotate',
    },
  },
  { selector: '.dimmed', style: { opacity: 0.1, 'text-opacity': 0.04 } },
  { selector: '.selected-context', style: { opacity: 1, 'text-opacity': 1 } },
  { selector: ':selected', style: { 'border-color': '#f7c948', 'border-width': 6, 'z-index': 30 } },
];

function layoutOptions(name: LayoutName): LayoutOptions {
  if (name === 'breadthfirst') return { name, directed: true, padding: 38, spacingFactor: 1.25, animate: false };
  if (name === 'circle') return { name, padding: 38, spacingFactor: 1.15, animate: false };
  if (name === 'grid') return { name, padding: 38, avoidOverlap: true, animate: false };
  return {
    name: 'cose', animate: false, fit: true, padding: 38, randomize: true,
    nodeRepulsion: () => 9000, idealEdgeLength: () => 105, edgeElasticity: () => 100,
    gravity: 0.45, numIter: 700,
  } as LayoutOptions;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

function SourceLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return <span className="graph-muted">No direct URL registered for this relationship.</span>;
  return <div className="graph-source-links">{urls.slice(0, 4).map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Public source{urls.length > 1 ? ` ${index + 1}` : ''} ↗</a>)}</div>;
}

export default function RelationshipGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<Core | null>(null);
  const loadedRef = useRef(new Set<string>());
  const [index, setIndex] = useState<GraphIndex | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [relationships, setRelationships] = useState<GraphRelationship[]>([]);
  const [centerId, setCenterId] = useState('');
  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<LayoutName>('cose');
  const [loadedIds, setLoadedIds] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${graphBase}/index.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Search index request failed (${response.status})`);
        return response.json() as Promise<GraphIndex>;
      })
      .then((value) => { if (active) setIndex(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the graph search index.'); });
    return () => { active = false; };
  }, []);

  const loadNeighborhood = useCallback(async (nodeId: string, reset = false) => {
    if (!reset && loadedRef.current.has(nodeId)) {
      setSelection({ kind: 'node', id: nodeId });
      return;
    }
    setLoadingId(nodeId);
    setError('');
    try {
      const response = await fetch(`${graphBase}/neighborhoods/${encodeURIComponent(nodeId)}.json`);
      if (!response.ok) throw new Error(`Neighborhood request failed (${response.status})`);
      const neighborhood = await response.json() as Neighborhood;
      if (reset) {
        setNodes(neighborhood.nodes);
        setRelationships(neighborhood.relationships);
        loadedRef.current = new Set([nodeId]);
      } else {
        setNodes((current) => mergeById(current, neighborhood.nodes));
        setRelationships((current) => mergeById(current, neighborhood.relationships));
        loadedRef.current.add(nodeId);
      }
      setLoadedIds([...loadedRef.current]);
      setCenterId(neighborhood.center_node_id || neighborhood.center_asset_id || nodeId);
      setSelection({ kind: 'node', id: nodeId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this neighborhood.');
    } finally {
      setLoadingId('');
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const core = cytoscape({
      container, elements: [], style: graphStyles, layout: { name: 'preset' },
      boxSelectionEnabled: false, minZoom: 0.16, maxZoom: 3.5,
    });
    coreRef.current = core;
    core.on('tap', 'node', (event) => setSelection({ kind: 'node', id: event.target.id() }));
    core.on('tap', 'edge', (event) => setSelection({ kind: 'relationship', id: event.target.id() }));
    core.on('tap', (event) => { if (event.target === core) setSelection(null); });
    return () => { coreRef.current = null; core.destroy(); };
  }, []);

  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    core.elements().remove();
    if (!nodes.length) return;
    core.add(elements(nodes, relationships, centerId));
    core.layout(layoutOptions(layout)).run();
    core.fit(core.elements(), 38);
  }, [nodes, relationships, centerId, layout]);

  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    core.elements().removeClass('dimmed selected-context');
    if (!selection) return;
    const selected = core.getElementById(selection.id);
    if (!selected.length) return;
    core.elements().unselect();
    core.elements().addClass('dimmed');
    selected.removeClass('dimmed').addClass('selected-context').select();
    if (selection.kind === 'node') {
      selected.connectedEdges().removeClass('dimmed').addClass('selected-context');
      selected.neighborhood('node').removeClass('dimmed').addClass('selected-context');
    } else {
      selected.connectedNodes().removeClass('dimmed').addClass('selected-context');
    }
  }, [selection, nodes, relationships]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = useMemo(() => {
    if (!index) return [];
    const searchableNodes = [...index.assets, ...(index.organizations ?? [])];
    if (!normalizedQuery) return searchableNodes.filter((node) => node.connection_count > 0).sort((a, b) => b.connection_count - a.connection_count).slice(0, 10);
    return searchableNodes.filter((node) => `${node.name} ${node.id} ${node.asset_type} ${node.owner}`.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 20);
  }, [index, normalizedQuery]);
  const selectedNode = selection?.kind === 'node' ? nodes.find((node) => node.id === selection.id) : undefined;
  const selectedRelationship = selection?.kind === 'relationship' ? relationships.find((relationship) => relationship.id === selection.id) : undefined;

  function resetGraph() {
    setNodes([]); setRelationships([]); setSelection(null); setCenterId('');
    loadedRef.current = new Set(); setLoadedIds([]);
  }

  return (
    <div className="page-stack relationship-graph-page">
      <div className="section-heading">
        <p className="eyebrow">Cross-cutting dataset view</p>
        <h2>Explore relationships</h2>
        <p>Search assets or organizations, open one local neighborhood, then expand only the connections you need. Owner, developer and operator/maintainer roles are represented as directed relationships.</p>
      </div>

      <section className="graph-loading-model">
        <div><strong>{index?.node_count ?? index?.asset_count ?? '—'}</strong><span>searchable nodes</span></div>
        <div><strong>{index?.relationship_count ?? '—'}</strong><span>graph relationships</span></div>
        <p><strong>Progressive loading:</strong> the browser first fetches a search index, then requests a small one-hop JSON file for each asset or organization you choose to expand.</p>
      </section>

      <section className="relationship-graph-shell">
        <aside className="graph-search-panel">
          <label><span>Find an asset or organization</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ecoinvent, SimaPro, PRé…" /></label>
          <p className="graph-result-label">{normalizedQuery ? `${results.length} search results` : 'Most connected nodes'}</p>
          <div className="graph-search-results">
            {results.map((asset) => <button key={asset.id} onClick={() => void loadNeighborhood(asset.id, true)} disabled={loadingId === asset.id}>
              <span><strong>{asset.name}</strong><small>{asset.asset_type}</small></span><b>{loadingId === asset.id ? 'Loading…' : `${asset.connection_count} links →`}</b>
            </button>)}
            {!index && !error && <p className="graph-muted">Loading the graph search index…</p>}
            {index && normalizedQuery && !results.length && <p className="graph-muted">No matching asset or organization in this release.</p>}
          </div>
        </aside>

        <div className="graph-stage-panel">
          <div className="graph-toolbar">
            <div><strong>{nodes.length}</strong><span>nodes</span><strong>{relationships.length}</strong><span>relationships</span><strong>{loadedIds.length}</strong><span>neighborhoods loaded</span></div>
            <div><label><span>Layout</span><select value={layout} onChange={(event) => setLayout(event.target.value as LayoutName)}><option value="cose">Network</option><option value="breadthfirst">Hierarchy</option><option value="circle">Circle</option><option value="grid">Grid</option></select></label><button onClick={() => coreRef.current?.fit(coreRef.current.elements(), 38)} disabled={!nodes.length}>Fit</button><button onClick={resetGraph} disabled={!nodes.length}>Clear</button></div>
          </div>
          <div className="graph-canvas-wrap">
            <div className="relationship-graph-canvas" ref={containerRef} aria-label="Interactive Global LCA Asset relationship graph" />
            {!nodes.length && <div className="graph-empty-state"><span>01</span><h3>Search and open a node</h3><p>Only that asset or organization and its immediate connections will be loaded.</p></div>}
          </div>
          {error && <p className="graph-error">{error}</p>}
        </div>

        <aside className="graph-detail-panel">
          {!selection && <div className="graph-detail-empty"><p className="eyebrow">Selected record</p><h3>Choose a node or relationship</h3><p>Details, interpretation cautions and public source links will appear here.</p></div>}
          {selectedNode && <div className="graph-detail-record">
            <p className="eyebrow">{selectedNode.kind === 'asset' ? 'Asset' : selectedNode.kind === 'organization' ? 'Organization' : 'External reference'}</p>
            <h3>{selectedNode.name}</h3>
            <span className="graph-record-id">{selectedNode.id}</span>
            <dl><div><dt>Type</dt><dd>{selectedNode.asset_type}</dd></div>{selectedNode.kind === 'organization' ? <div><dt>Identity status</dt><dd>{selectedNode.normalization_status || 'Exact public label'}</dd></div> : <><div><dt>Owner</dt><dd>{selectedNode.owner || 'Not publicly confirmed'}</dd></div><div><dt>Geography</dt><dd>{selectedNode.geography || 'Not publicly confirmed'}</dd></div></>}<div><dt>Connections in register</dt><dd>{selectedNode.connection_count}</dd></div></dl>
            {selectedNode.official_url && <a className="graph-official-link" href={selectedNode.official_url} target="_blank" rel="noreferrer">Open official source ↗</a>}
            {selectedNode.expandable && <button className="graph-expand-button" onClick={() => void loadNeighborhood(selectedNode.id)} disabled={loadedRef.current.has(selectedNode.id) || loadingId === selectedNode.id}>{loadedRef.current.has(selectedNode.id) ? 'Connections already loaded ✓' : loadingId === selectedNode.id ? 'Loading connections…' : `Expand ${selectedNode.connection_count} connections`}</button>}
          </div>}
          {selectedRelationship && <div className="graph-detail-record">
            <p className="eyebrow">Relationship</p><h3>{selectedRelationship.relationship_type}</h3><span className="graph-record-id">{selectedRelationship.id}</span>
            <dl><div><dt>Status</dt><dd>{selectedRelationship.status}</dd></div><div><dt>Evidence statement</dt><dd>{selectedRelationship.evidence || 'Not publicly confirmed'}</dd></div><div><dt>Constraint</dt><dd>{selectedRelationship.constraints || 'Not publicly confirmed'}</dd></div><div><dt>Next validation question</dt><dd>{selectedRelationship.validation_question || 'Not publicly confirmed'}</dd></div></dl>
            <SourceLinks urls={selectedRelationship.source_urls} />
            <p className="graph-caution">{selectedRelationship.id.startsWith('ACT-') ? 'This edge records only the actor role supported by the cited public evidence; other roles are not inferred.' : 'A documented relationship or compatibility claim is not evidence of a lossless conversion.'}</p>
          </div>}
        </aside>
      </section>
    </div>
  );
}
