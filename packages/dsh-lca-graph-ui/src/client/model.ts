/** Pure parsing, labeling, export, and table helpers for graph results. */

import type {
  GraphNode, GraphPresentationMeta, GraphRelationship, JsonValue, SettledToolCall, ToolCallBlock,
} from './types.js'

const LABEL_PRIORITY = [
  'Database', 'Software', 'Schema', 'Format', 'Platform', 'MappingArtifact', 'Nomenclature',
  'Method', 'QualitySystem', 'Organization', 'Release', 'Distribution', 'Evidence', 'Assertion',
  'Geography', 'Sector', 'SearchStream', 'ExternalReference', 'Asset',
]

const GRAPH_NODE_LIMIT = 500
const GRAPH_RELATIONSHIP_LIMIT = 1_500

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asJsonObject(value: unknown): Record<string, JsonValue> | undefined {
  return isObject(value) ? value as Record<string, JsonValue> : undefined
}

function parseNode(value: unknown): GraphNode | undefined {
  if (!isObject(value) || typeof value.uid !== 'string' || typeof value.name !== 'string') return undefined
  if (!Array.isArray(value.labels) || !value.labels.every(label => typeof label === 'string')) return undefined
  return {
    uid: value.uid,
    name: value.name,
    labels: value.labels,
    properties: asJsonObject(value.properties) ?? {},
  }
}

function parseRelationship(value: unknown): GraphRelationship | undefined {
  if (!isObject(value)) return undefined
  if (
    typeof value.uid !== 'string'
    || typeof value.type !== 'string'
    || typeof value.start_uid !== 'string'
    || typeof value.end_uid !== 'string'
  ) return undefined
  return {
    uid: value.uid,
    type: value.type,
    start_uid: value.start_uid,
    end_uid: value.end_uid,
    properties: asJsonObject(value.properties) ?? {},
  }
}

/** Validate replayed session metadata before it reaches Cytoscape. */
export function parseGraphMeta(value: unknown): GraphPresentationMeta | null {
  if (!isObject(value) || value.kind !== 'global-lca-graph' || value.version !== 1) return null
  if (!Array.isArray(value.nodes) || !Array.isArray(value.relationships)) return null
  const nodes = value.nodes.map(parseNode).filter(item => item !== undefined).slice(0, GRAPH_NODE_LIMIT)
  const nodeIds = new Set(nodes.map(item => item.uid))
  const relationships = value.relationships
    .map(parseRelationship)
    .filter((item): item is GraphRelationship =>
      item !== undefined && nodeIds.has(item.start_uid) && nodeIds.has(item.end_uid))
    .slice(0, GRAPH_RELATIONSHIP_LIMIT)
  const records = Array.isArray(value.records)
    ? value.records.map(asJsonObject).filter(item => item !== undefined)
    : []
  return {
    kind: 'global-lca-graph',
    version: 1,
    nodes,
    relationships,
    records,
    truncated: value.truncated === true
      || value.nodes.length > GRAPH_NODE_LIMIT
      || value.relationships.length > GRAPH_RELATIONSHIP_LIMIT,
    ...(typeof value.cypher === 'string' ? { cypher: value.cypher } : {}),
    ...(asJsonObject(value.parameters) === undefined ? {} : { parameters: asJsonObject(value.parameters)! }),
  }
}

function textResult(block: SettledToolCall): string {
  return block.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n')
}

/** Read durable metadata, with a JSON-text fallback for sessions created by plugin v0.1. */
export function graphMetaFromBlock(block: ToolCallBlock): GraphPresentationMeta | null {
  if (!('kind' in block)) return null
  const durable = parseGraphMeta(block.meta)
  if (durable !== null) return durable
  const text = textResult(block)
  if (text === '') return null
  try {
    const value = JSON.parse(text) as unknown
    if (!isObject(value)) return null
    const graph = isObject(value.graph) ? value.graph : value
    return parseGraphMeta({
      kind: 'global-lca-graph',
      version: 1,
      nodes: graph.nodes,
      relationships: graph.relationships,
      records: Array.isArray(value.records) ? value.records : Array.isArray(graph.records) ? graph.records : [],
      truncated: value.truncated === true,
      cypher: value.cypher,
      parameters: value.parameters,
    })
  } catch {
    return null
  }
}

export function argsFromBlock(block: ToolCallBlock): Record<string, unknown> {
  const raw = 'kind' in block ? block.call?.argsRaw : block.argsRaw
  if (raw === undefined) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function primaryLabel(node: GraphNode): string {
  return LABEL_PRIORITY.find(label => node.labels.includes(label))
    ?? node.labels.find(label => label !== 'Entity')
    ?? 'Entity'
}

export function nodeCategory(node: GraphNode): 'asset' | 'evidence' | 'organization' | 'mapping' | 'release' | 'context' {
  const label = primaryLabel(node)
  if (['Database', 'Software', 'Schema', 'Format', 'Platform', 'Nomenclature', 'Method', 'QualitySystem', 'Asset'].includes(label)) return 'asset'
  if (label === 'Evidence') return 'evidence'
  if (label === 'Organization') return 'organization'
  if (['MappingArtifact', 'Assertion'].includes(label)) return 'mapping'
  if (['Release', 'Distribution'].includes(label)) return 'release'
  return 'context'
}

export function labelOptions(nodes: readonly GraphNode[]): string[] {
  return [...new Set(nodes.map(primaryLabel))].sort((left, right) => left.localeCompare(right))
}

export function relationshipLabel(type: string): string {
  return type.toLowerCase().replaceAll('_', ' ')
}

export function displayValue(value: JsonValue): string {
  if (value === null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function propertyEntries(properties: Record<string, JsonValue>): Array<[string, string]> {
  return Object.entries(properties)
    .filter(([, value]) => value !== '' && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key.replaceAll('_', ' '), displayValue(value)])
}

export function evidenceNodes(meta: GraphPresentationMeta): GraphNode[] {
  return meta.nodes.filter(node => node.labels.includes('Evidence'))
}

export function toolTitle(toolName: string, block: ToolCallBlock): string {
  const args = argsFromBlock(block)
  switch (toolName) {
    case 'lca_get_asset': return `Asset graph · ${String(args.asset_id ?? 'LCA asset')}`
    case 'lca_find_relationships': return `Relationship graph · ${String(args.uid ?? 'LCA asset')}`
    case 'lca_find_path': return `Shortest path · ${String(args.source_uid ?? '?')} → ${String(args.target_uid ?? '?')}`
    case 'lca_query_graph': return 'Global LCA graph query'
    case 'lca_run_readonly_cypher': return 'Cypher graph result'
    default: return 'Global LCA asset graph'
  }
}

function cypherParams(meta: GraphPresentationMeta): Record<string, JsonValue> {
  return {
    node_uids: meta.nodes.map(node => node.uid),
    relationship_uids: meta.relationships.map(relationship => relationship.uid),
  }
}

export function exportCypher(meta: GraphPresentationMeta): string {
  if (meta.cypher !== undefined) {
    const params = meta.parameters ?? {}
    return `// Parameters\n// ${JSON.stringify(params, null, 2).replaceAll('\n', '\n// ')}\n${meta.cypher}\n`
  }
  return `// Parameters\n// ${JSON.stringify(cypherParams(meta), null, 2).replaceAll('\n', '\n// ')}\nMATCH (source:Entity)-[relationship]->(target:Entity)\nWHERE source.uid IN $node_uids\n  AND target.uid IN $node_uids\n  AND relationship.uid IN $relationship_uids\nRETURN source, relationship, target\n`
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function fileStem(toolName: string): string {
  return `${toolName}-${new Date().toISOString().slice(0, 10)}`
}
