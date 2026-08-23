/** Durable browser presentation metadata for graph-bearing tool results. */

import type { JsonValue } from './client.js'

export interface GraphPresentationNode {
  uid: string
  labels: string[]
  name: string
  properties: Record<string, JsonValue>
}

export interface GraphPresentationRelationship {
  uid: string
  type: string
  start_uid: string
  end_uid: string
  properties: Record<string, JsonValue>
}

export interface GraphPresentationMeta {
  kind: 'global-lca-graph'
  version: 1
  nodes: GraphPresentationNode[]
  relationships: GraphPresentationRelationship[]
  records: Array<Record<string, JsonValue>>
  truncated: boolean
  cypher?: string
  parameters?: Record<string, JsonValue>
}

function isObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function graphPayload(value: Record<string, JsonValue>): Record<string, JsonValue> | undefined {
  if (Array.isArray(value.nodes) && Array.isArray(value.relationships)) return value
  if (isObject(value.graph) && Array.isArray(value.graph.nodes) && Array.isArray(value.graph.relationships)) {
    return value.graph
  }
  return undefined
}

function node(value: JsonValue): GraphPresentationNode | undefined {
  if (!isObject(value) || typeof value.uid !== 'string' || typeof value.name !== 'string') return undefined
  if (!Array.isArray(value.labels) || !value.labels.every(label => typeof label === 'string')) return undefined
  return {
    uid: value.uid,
    name: value.name,
    labels: value.labels,
    properties: isObject(value.properties) ? value.properties : {},
  }
}

function relationship(value: JsonValue): GraphPresentationRelationship | undefined {
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
    properties: isObject(value.properties) ? value.properties : {},
  }
}

/**
 * Extract the bounded graph result into session-log metadata. The browser reads
 * this copy directly, so replay never depends on reparsing model-facing text.
 */
export function graphPresentationMeta(value: JsonValue): GraphPresentationMeta | null {
  if (!isObject(value)) return null
  const graph = graphPayload(value)
  if (graph === undefined) return null
  const nodes = (graph.nodes as JsonValue[]).map(node).filter(item => item !== undefined)
  const relationships = (graph.relationships as JsonValue[])
    .map(relationship)
    .filter(item => item !== undefined)
  const recordsSource = Array.isArray(value.records)
    ? value.records
    : Array.isArray(graph.records)
      ? graph.records
      : []
  const records = recordsSource.filter(isObject)
  return {
    kind: 'global-lca-graph',
    version: 1,
    nodes,
    relationships,
    records,
    truncated: value.truncated === true,
    ...(typeof value.cypher === 'string' ? { cypher: value.cypher } : {}),
    ...(isObject(value.parameters) ? { parameters: value.parameters } : {}),
  }
}
