import { useEffect, useRef } from 'react'
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions } from 'cytoscape'
import { nodeCategory, primaryLabel, relationshipLabel } from './model.js'
import type { GraphNode, GraphPresentationMeta, GraphRelationship } from './types.js'

export type GraphSelection =
  | { kind: 'node'; value: GraphNode }
  | { kind: 'relationship'; value: GraphRelationship }
  | null

export interface GraphController {
  fit(): void
  runLayout(name: LayoutName): void
  png(): Promise<Blob>
  svg(): string
}

export type LayoutName = 'cose' | 'breadthfirst' | 'circle' | 'grid'

interface GraphCanvasProps {
  meta: GraphPresentationMeta
  query: string
  label: string
  layout: LayoutName
  onSelection(selection: GraphSelection): void
  onReady(controller: GraphController | null): void
}

function elementDefinitions(meta: GraphPresentationMeta): ElementDefinition[] {
  return [
    ...meta.nodes.map(node => ({
      data: {
        id: node.uid,
        label: node.name,
        type: primaryLabel(node),
        category: nodeCategory(node),
        value: node,
      },
    })),
    ...meta.relationships.map(relationship => ({
      data: {
        id: relationship.uid,
        source: relationship.start_uid,
        target: relationship.end_uid,
        label: relationshipLabel(relationship.type),
        type: relationship.type,
        value: relationship,
      },
    })),
  ]
}

function resolvedColor(container: HTMLElement, localVariable: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${localVariable})`
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  container.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function styleSheet(container: HTMLElement): cytoscape.StylesheetJson {
  const colors = {
    asset: resolvedColor(container, '--lca-node-asset'),
    evidence: resolvedColor(container, '--lca-node-evidence'),
    organization: resolvedColor(container, '--lca-node-organization'),
    mapping: resolvedColor(container, '--lca-node-mapping'),
    release: resolvedColor(container, '--lca-node-release'),
    context: resolvedColor(container, '--lca-node-context'),
    text: resolvedColor(container, '--lca-graph-label'),
    edge: resolvedColor(container, '--lca-graph-edge'),
    surface: resolvedColor(container, '--lca-graph-surface'),
    selected: resolvedColor(container, '--lca-graph-selected'),
  }
  return [
    {
      selector: 'node',
      style: {
        'background-color': colors.context,
        'border-color': colors.surface,
        'border-width': 2,
        color: colors.text,
        label: 'data(label)',
        'font-family': getComputedStyle(container).fontFamily,
        'font-size': 10,
        'font-weight': 500,
        height: 32,
        width: 32,
        'min-zoomed-font-size': 7,
        'text-background-color': colors.surface,
        'text-background-opacity': 0.86,
        'text-background-padding': '2px',
        'text-margin-y': 7,
        'text-max-width': '108px',
        'text-valign': 'bottom',
        'text-wrap': 'ellipsis',
      },
    },
    { selector: 'node[category = "asset"]', style: { 'background-color': colors.asset, shape: 'round-rectangle', width: 38, height: 30 } },
    { selector: 'node[category = "evidence"]', style: { 'background-color': colors.evidence, shape: 'diamond', width: 30, height: 30 } },
    { selector: 'node[category = "organization"]', style: { 'background-color': colors.organization, shape: 'hexagon' } },
    { selector: 'node[category = "mapping"]', style: { 'background-color': colors.mapping, shape: 'round-tag' } },
    { selector: 'node[category = "release"]', style: { 'background-color': colors.release, shape: 'ellipse', width: 28, height: 28 } },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'line-color': colors.edge,
        'target-arrow-color': colors.edge,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.7,
        width: 1.25,
        opacity: 0.72,
        label: 'data(label)',
        color: colors.text,
        'font-size': 7,
        'min-zoomed-font-size': 6,
        'text-background-color': colors.surface,
        'text-background-opacity': 0.78,
        'text-background-padding': '1px',
        'text-rotation': 'autorotate',
      },
    },
    { selector: '.dimmed', style: { opacity: 0.12, 'text-opacity': 0.05 } },
    { selector: '.matched', style: { 'border-color': colors.selected, 'border-width': 5, 'z-index': 20 } },
    { selector: ':selected', style: { 'border-color': colors.selected, 'border-width': 5, 'z-index': 30 } },
  ]
}

function layoutOptions(name: LayoutName): LayoutOptions {
  switch (name) {
    case 'breadthfirst': return { name, directed: true, padding: 28, spacingFactor: 1.15, animate: false }
    case 'circle': return { name, padding: 28, spacingFactor: 1.1, animate: false }
    case 'grid': return { name, padding: 28, avoidOverlap: true, animate: false }
    default: return {
      name: 'cose',
      animate: false,
      fit: true,
      padding: 28,
      nodeRepulsion: () => 7600,
      idealEdgeLength: () => 88,
      edgeElasticity: () => 90,
      nestingFactor: 1.1,
      gravity: 0.5,
      numIter: 700,
      randomize: true,
    }
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function svgDocument(core: Core): string {
  const bounds = core.elements(':visible').boundingBox({ includeLabels: true })
  const padding = 36
  const width = Math.max(1, bounds.w + padding * 2)
  const height = Math.max(1, bounds.h + padding * 2)
  const left = bounds.x1 - padding
  const top = bounds.y1 - padding
  const container = core.container()!
  const background = resolvedColor(container, '--lca-graph-surface')
  const edgeColor = resolvedColor(container, '--lca-graph-edge')
  const labelColor = resolvedColor(container, '--lca-graph-label')
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="${left} ${top} ${width} ${height}">`,
    `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${escapeXml(background)}"/>`,
    '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor"/></marker></defs>',
    `<g fill="none" stroke="${escapeXml(edgeColor)}" color="${escapeXml(edgeColor)}" stroke-width="1.5" marker-end="url(#arrow)">`,
  ]
  core.edges(':visible').forEach(edge => {
    const source = edge.source().position()
    const target = edge.target().position()
    parts.push(`<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"/>`)
  })
  parts.push('</g>')
  core.nodes(':visible').forEach(node => {
    const position = node.position()
    const backgroundColor = String(node.style('background-color'))
    parts.push(`<circle cx="${position.x}" cy="${position.y}" r="15" fill="${escapeXml(backgroundColor)}" stroke="${escapeXml(background)}" stroke-width="2"/>`)
    parts.push(`<text x="${position.x}" y="${position.y + 27}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="${escapeXml(labelColor)}">${escapeXml(String(node.data('label')))}</text>`)
  })
  parts.push('</svg>')
  return parts.join('')
}

function controller(core: Core): GraphController {
  return {
    fit() { core.fit(core.elements(':visible'), 28) },
    runLayout(name) { core.elements(':visible').layout(layoutOptions(name)).run() },
    async png() {
      const result = core.png({ output: 'blob', full: true, scale: 2, bg: resolvedColor(core.container()!, '--lca-graph-surface') })
      return result instanceof Promise ? await result : result
    },
    svg() { return svgDocument(core) },
  }
}

/** Cytoscape canvas kept isolated from the rest of the card's React state. */
export function GraphCanvas({ meta, query, label, layout, onSelection, onReady }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<Core | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    const core = cytoscape({
      container,
      elements: elementDefinitions(meta),
      style: styleSheet(container),
      layout: layoutOptions(layout),
      boxSelectionEnabled: false,
      minZoom: 0.18,
      maxZoom: 3.2,
    })
    coreRef.current = core
    onReady(controller(core))
    core.on('tap', 'node', event => {
      const value = event.target.data('value') as GraphNode
      onSelection({ kind: 'node', value })
      core.elements().addClass('dimmed')
      event.target.removeClass('dimmed')
      event.target.connectedEdges().removeClass('dimmed')
      event.target.neighborhood('node').removeClass('dimmed')
    })
    core.on('tap', 'edge', event => {
      const value = event.target.data('value') as GraphRelationship
      onSelection({ kind: 'relationship', value })
      core.elements().addClass('dimmed')
      event.target.removeClass('dimmed')
      event.target.connectedNodes().removeClass('dimmed')
    })
    core.on('tap', event => {
      if (event.target !== core) return
      core.elements().removeClass('dimmed')
      core.elements().unselect()
      onSelection(null)
    })
    return () => {
      onReady(null)
      coreRef.current = null
      core.destroy()
    }
  }, [meta, onReady, onSelection])

  useEffect(() => {
    const core = coreRef.current
    if (core === null) return
    core.elements().removeClass('matched')
    const normalized = query.trim().toLocaleLowerCase()
    if (normalized === '') return
    core.nodes().forEach(node => {
      const searchable = `${String(node.data('label'))} ${node.id()} ${String(node.data('type'))}`.toLocaleLowerCase()
      if (searchable.includes(normalized)) node.addClass('matched')
    })
    const matches = core.nodes('.matched')
    if (matches.length > 0) core.fit(matches, 72)
  }, [query])

  useEffect(() => {
    const core = coreRef.current
    if (core === null) return
    core.elements().style('display', 'element')
    if (label !== '') {
      core.nodes().forEach(node => {
        if (node.data('type') !== label) node.style('display', 'none')
      })
      core.edges().forEach(edge => {
        if (!edge.source().visible() || !edge.target().visible()) edge.style('display', 'none')
      })
    }
    core.elements(':visible').layout(layoutOptions(layout)).run()
    core.fit(core.elements(':visible'), 28)
  }, [label, layout])

  return <div className="lca-graph-canvas" ref={containerRef} aria-label="Interactive LCA relationship graph" />
}
