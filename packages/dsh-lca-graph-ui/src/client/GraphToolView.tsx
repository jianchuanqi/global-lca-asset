import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  IconChevronDownOutline14,
  IconCloseOutline16,
  IconDataOutline16,
  IconDownloadOutline16,
  IconFullscreenOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  argsFromBlock,
  displayValue,
  evidenceNodes,
  exportCypher,
  fileStem,
  graphMetaFromBlock,
  labelOptions,
  primaryLabel,
  propertyEntries,
  relationshipLabel,
  safeHttpUrl,
  toolTitle,
} from './model.js'
import { GraphCanvas, type GraphController, type GraphSelection, type LayoutName } from './GraphCanvas.js'
import type { GraphNode, GraphPresentationMeta, JsonValue, ToolCallViewProps } from './types.js'

type Tab = 'graph' | 'data' | 'evidence'

const TAB_LABELS: Record<Tab, string> = {
  graph: 'Graph',
  data: 'Data',
  evidence: 'Evidence',
}

const LAYOUT_LABELS: Record<LayoutName, string> = {
  cose: 'Connected',
  breadthfirst: 'Hierarchy',
  circle: 'Circle',
  grid: 'Grid',
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 1_000)
}

function saveText(text: string, filename: string, type: string): void {
  saveBlob(new Blob([text], { type }), filename)
}

function fallbackText(block: ToolCallViewProps['block']): string {
  if (!('kind' in block)) return 'Querying the Global LCA graph…'
  if (block.isError) {
    const content = block.content.find(item => item.type === 'text')
    return content !== undefined && 'text' in content && typeof content.text === 'string'
      ? content.text
      : `${block.error?.name ?? 'Query'} failed`
  }
  return 'The query completed without graph nodes.'
}

function Summary({ meta }: { meta: GraphPresentationMeta }) {
  return (
    <span className="lca-graph-summary">
      {meta.nodes.length} nodes · {meta.relationships.length} relationships
      {meta.truncated ? ' · limited view' : ''}
    </span>
  )
}

function Legend() {
  const items = [
    ['asset', 'Asset'], ['evidence', 'Evidence'], ['organization', 'Organization'],
    ['mapping', 'Mapping'], ['release', 'Release'], ['context', 'Context'],
  ] as const
  return (
    <div className="lca-graph-legend" aria-label="Node type legend">
      {items.map(([kind, label]) => (
        <span key={kind}><i data-kind={kind} aria-hidden />{label}</span>
      ))}
    </div>
  )
}

function PropertyList({ entries }: { entries: Array<[string, string]> }) {
  if (entries.length === 0) return <p className="lca-graph-muted">No additional properties.</p>
  return (
    <dl className="lca-graph-properties">
      {entries.map(([key, value]) => {
        const url = safeHttpUrl(value)
        return (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{url === null ? value : <a href={url} target="_blank" rel="noreferrer">{value}</a>}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function InspectorFrame({
  eyebrow, title, identity, properties, onClose, children,
}: {
  eyebrow: string
  title: string
  identity: string
  properties: Record<string, JsonValue>
  onClose(): void
  children: ReactNode
}) {
  return (
    <aside className="lca-graph-inspector" aria-label={`${eyebrow} details`}>
      <div className="lca-graph-inspector-header">
        <div>
          <span>{eyebrow}</span>
          <h4>{title}</h4>
        </div>
        <button type="button" aria-label="Close details" onClick={onClose}><IconCloseOutline16 /></button>
      </div>
      <div className="lca-graph-identity">{identity}</div>
      {children}
      <PropertyList entries={propertyEntries(properties)} />
    </aside>
  )
}

function Inspector({ selection, onClose }: { selection: Exclude<GraphSelection, null>; onClose(): void }) {
  if (selection.kind === 'relationship') {
    const value = selection.value
    return (
      <InspectorFrame
        eyebrow="Relationship"
        title={relationshipLabel(value.type)}
        identity={value.uid}
        properties={value.properties}
        onClose={onClose}
      >
        <div className="lca-graph-route">
          <span>{value.start_uid}</span>
          <strong>{value.type}</strong>
          <span>{value.end_uid}</span>
        </div>
      </InspectorFrame>
    )
  }
  const value = selection.value
  return (
    <InspectorFrame
      eyebrow={primaryLabel(value)}
      title={value.name}
      identity={value.uid}
      properties={value.properties}
      onClose={onClose}
    >
        <div className="lca-graph-labels">{value.labels.filter(label => label !== 'Entity').map(label => <span key={label}>{label}</span>)}</div>
    </InspectorFrame>
  )
}

function rowSource(meta: GraphPresentationMeta): Array<Record<string, JsonValue>> {
  if (meta.records.length > 0) return meta.records
  return meta.nodes.map(node => ({ uid: node.uid, name: node.name, type: primaryLabel(node), ...node.properties }))
}

function tableColumns(rows: Array<Record<string, JsonValue>>): string[] {
  const priority = ['uid', 'name', 'type', 'asset_type', 'current_version', 'official_url']
  const keys = new Set(rows.flatMap(row => Object.keys(row)))
  return [
    ...priority.filter(key => keys.delete(key)),
    ...[...keys].sort((left, right) => left.localeCompare(right)),
  ].slice(0, 8)
}

function cellText(value: JsonValue | undefined): string {
  const text = value === undefined ? '—' : displayValue(value)
  return text.length > 240 ? `${text.slice(0, 237)}…` : text
}

function DataTable({ meta }: { meta: GraphPresentationMeta }) {
  const rows = rowSource(meta).slice(0, 100)
  const columns = tableColumns(rows)
  if (rows.length === 0) return <EmptyState title="No tabular records" text="This query returned no rows or graph nodes." />
  return (
    <div className="lca-graph-table-wrap">
      <table className="lca-graph-table">
        <thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={typeof row.uid === 'string' ? row.uid : index}>
              {columns.map(column => <td key={column} title={cellText(row[column])}>{cellText(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rowSource(meta).length > 100 ? <p className="lca-graph-footnote">Showing the first 100 rows.</p> : null}
    </div>
  )
}

function EvidenceList({ meta, onSelect }: { meta: GraphPresentationMeta; onSelect(node: GraphNode): void }) {
  const evidence = evidenceNodes(meta)
  if (evidence.length === 0) {
    return <EmptyState title="No evidence nodes in this result" text="Ask for an asset neighborhood or evidence-backed path to include sources." />
  }
  return (
    <div className="lca-graph-evidence-list">
      {evidence.map(node => {
        const properties = node.properties
        const url = safeHttpUrl(properties.url_or_file)
        return (
          <article key={node.uid}>
            <button type="button" onClick={() => { onSelect(node) }}>
              <span>{String(properties.source_type ?? 'Public evidence')}</span>
              <h4>{node.name}</h4>
              <p>{String(properties.evidence_excerpt ?? 'No excerpt recorded.')}</p>
              <footer>
                <span>{String(properties.source_reliability ?? 'Reliability not stated')}</span>
                <span>{String(properties.access_restriction ?? 'Access not stated')}</span>
              </footer>
            </button>
            {url === null ? null : <a href={url} target="_blank" rel="noreferrer">Open source</a>}
          </article>
        )
      })}
    </div>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="lca-graph-empty">
      <IconDataOutline16 size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function ToolbarButton({ label, children, onClick }: { label: string; children: ReactNode; onClick(): void }) {
  return <button type="button" className="lca-graph-icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function GraphWorkspace({ meta, toolName }: { meta: GraphPresentationMeta; toolName: string }) {
  const [tab, setTab] = useState<Tab>('graph')
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')
  const [layout, setLayout] = useState<LayoutName>('cose')
  const [selection, setSelection] = useState<GraphSelection>(null)
  const [controller, setController] = useState<GraphController | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const labels = useMemo(() => labelOptions(meta.nodes), [meta.nodes])
  const select = useCallback((next: GraphSelection) => { setSelection(next) }, [])
  const ready = useCallback((next: GraphController | null) => { setController(next) }, [])

  const exportPng = async () => {
    if (controller === null) return
    saveBlob(await controller.png(), `${fileStem(toolName)}.png`)
  }
  const exportSvg = () => {
    if (controller === null) return
    saveText(controller.svg(), `${fileStem(toolName)}.svg`, 'image/svg+xml')
  }
  const exportJson = () => {
    saveText(JSON.stringify(meta, null, 2), `${fileStem(toolName)}.json`, 'application/json')
  }
  const exportQuery = () => {
    saveText(exportCypher(meta), `${fileStem(toolName)}.cypher`, 'text/plain')
  }
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === cardRef.current) {
      await document.exitFullscreen()
    } else {
      await cardRef.current?.requestFullscreen()
    }
  }

  return (
    <div className="lca-graph-workspace" ref={cardRef}>
      <div className="lca-graph-tabs" role="tablist" aria-label="Graph result views">
        {(Object.keys(TAB_LABELS) as Tab[]).map(key => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key) }}>
            {TAB_LABELS[key]}
            {key === 'evidence' ? <span>{evidenceNodes(meta).length}</span> : null}
          </button>
        ))}
        <div className="lca-graph-tab-actions">
          <ToolbarButton label="Fullscreen" onClick={() => { void toggleFullscreen() }}><IconFullscreenOutline16 /></ToolbarButton>
        </div>
      </div>

      {tab === 'graph' ? (
        <>
          <div className="lca-graph-toolbar">
            <label className="lca-graph-search">
              <IconSearchOutline16 size={14} />
              <span className="lca-graph-visually-hidden">Find a node</span>
              <input value={query} onChange={event => { setQuery(event.target.value) }} placeholder="Find node" />
            </label>
            <label>
              <span className="lca-graph-visually-hidden">Filter by node type</span>
              <select value={label} onChange={event => { setLabel(event.target.value) }}>
                <option value="">All types</option>
                {labels.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span className="lca-graph-visually-hidden">Graph layout</span>
              <select value={layout} onChange={event => { setLayout(event.target.value as LayoutName) }}>
                {(Object.keys(LAYOUT_LABELS) as LayoutName[]).map(option => <option key={option} value={option}>{LAYOUT_LABELS[option]}</option>)}
              </select>
            </label>
            <ToolbarButton label="Fit graph" onClick={() => { controller?.fit() }}><IconRefreshOutline16 /></ToolbarButton>
            <div className="lca-graph-export" aria-label="Export graph">
              <IconDownloadOutline16 size={14} />
              <button type="button" onClick={() => { void exportPng() }}>PNG</button>
              <button type="button" onClick={exportSvg}>SVG</button>
              <button type="button" onClick={exportJson}>JSON</button>
              <button type="button" onClick={exportQuery}>Cypher</button>
            </div>
          </div>
          <div className="lca-graph-stage">
            {meta.nodes.length === 0 ? (
              <EmptyState title="No connected graph found" text="The query is valid but returned no graph nodes." />
            ) : (
              <GraphCanvas
                meta={meta}
                query={query}
                label={label}
                layout={layout}
                onSelection={select}
                onReady={ready}
              />
            )}
            {selection === null ? null : <Inspector selection={selection} onClose={() => { setSelection(null) }} />}
          </div>
          <div className="lca-graph-footer">
            <Legend />
            <span>Drag nodes · scroll to zoom · select to inspect</span>
          </div>
        </>
      ) : tab === 'data' ? (
        <DataTable meta={meta} />
      ) : (
        <EvidenceList meta={meta} onSelect={node => { setSelection({ kind: 'node', value: node }); setTab('graph') }} />
      )}
    </div>
  )
}

/** Keyed DSH Tool row for graph-bearing Global LCA calls. */
export function GraphToolView({ toolName, block, inspect }: ToolCallViewProps) {
  const meta = useMemo(() => graphMetaFromBlock(block), [block])
  const title = toolTitle(toolName, block)
  const running = !('kind' in block)
  const failed = 'kind' in block && block.isError
  const args = argsFromBlock(block)
  const canExpand = !running && !failed && meta !== null
  const [expanded, setExpanded] = useState(canExpand)
  const autoExpanded = useRef(canExpand)

  // A tool row commonly mounts while its call is still running. Open it once
  // when graph metadata arrives, but never fight a later manual collapse.
  useEffect(() => {
    if (!canExpand || autoExpanded.current) return
    autoExpanded.current = true
    setExpanded(true)
  }, [canExpand])

  return (
    <div className="lca-graph-card" data-running={running || undefined} data-error={failed || undefined}>
      <button
        type="button"
        className="lca-graph-card-header"
        aria-expanded={canExpand ? expanded : undefined}
        onClick={() => { if (canExpand) setExpanded(value => !value) }}
      >
        <span className="lca-graph-card-icon"><IconDataOutline16 size={14} /></span>
        <strong>{title}</strong>
        <span className="lca-graph-card-separator" aria-hidden />
        {meta === null ? <span className="lca-graph-summary">{fallbackText(block)}</span> : <Summary meta={meta} />}
        {canExpand ? <IconChevronDownOutline14 className="lca-graph-chevron" /> : null}
      </button>
      {expanded && meta !== null ? <GraphWorkspace meta={meta} toolName={toolName} /> : null}
      {!running && !failed && meta === null && Object.keys(args).length > 0 ? (
        <pre className="lca-graph-fallback">{JSON.stringify(args, null, 2)}</pre>
      ) : null}
      {expanded && inspect !== undefined ? <button type="button" className="lca-graph-inspect-call" onClick={inspect}>Inspect tool call</button> : null}
    </div>
  )
}
