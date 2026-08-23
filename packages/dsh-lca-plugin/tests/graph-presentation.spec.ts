import { describe, expect, it } from 'vitest'
import { graphPresentationMeta } from '../src/graph-presentation.js'

describe('graph presentation metadata', () => {
  const node = { uid: 'LCA-DB-0001', labels: ['Asset', 'Database'], name: 'ecoinvent', properties: {} }
  const relationship = {
    uid: 'uses:LCA-DB-0001:FMT-0001',
    type: 'USES_FORMAT',
    start_uid: 'LCA-DB-0001',
    end_uid: 'FMT-0001',
    properties: {},
  }

  it('extracts a direct neighborhood graph', () => {
    expect(graphPresentationMeta({ nodes: [node], relationships: [relationship], records: [] }))
      .toMatchObject({ kind: 'global-lca-graph', nodes: [node], relationships: [relationship] })
  })

  it('extracts a nested query graph and replayable Cypher context', () => {
    expect(graphPresentationMeta({
      graph: { nodes: [node], relationships: [relationship] },
      records: [{ database: 'ecoinvent' }],
      cypher: 'MATCH (n) RETURN n',
      parameters: { limit: 10 },
      truncated: true,
    })).toEqual({
      kind: 'global-lca-graph',
      version: 1,
      nodes: [node],
      relationships: [relationship],
      records: [{ database: 'ecoinvent' }],
      cypher: 'MATCH (n) RETURN n',
      parameters: { limit: 10 },
      truncated: true,
    })
  })

  it('returns null for results without graph material', () => {
    expect(graphPresentationMeta({ items: [] })).toBeNull()
  })
})
