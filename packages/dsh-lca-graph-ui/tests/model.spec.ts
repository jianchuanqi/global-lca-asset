import { describe, expect, it } from 'vitest'
import { exportCypher, graphMetaFromBlock, nodeCategory, parseGraphMeta, safeHttpUrl } from '../src/client/model.js'

const node = { uid: 'a', labels: ['Entity', 'Database'], name: 'Database A', properties: {} }
const other = { uid: 'b', labels: ['Entity', 'Format'], name: 'Format B', properties: {} }
const relationship = { uid: 'r', type: 'USES_FORMAT', start_uid: 'a', end_uid: 'b', properties: {} }

describe('graph result model', () => {
  it('validates durable metadata and removes dangling relationships', () => {
    expect(parseGraphMeta({
      kind: 'global-lca-graph', version: 1, nodes: [node],
      relationships: [relationship], records: [], truncated: false,
    })).toMatchObject({ nodes: [node], relationships: [] })
  })

  it('supports model-text fallback for pre-metadata session logs', () => {
    expect(graphMetaFromBlock({
      kind: 'tool-result', callId: '1', call: null, isError: false,
      content: [{ type: 'text', text: JSON.stringify({ nodes: [node, other], relationships: [relationship] }) }],
    })?.relationships).toHaveLength(1)
  })

  it('categorizes graph concepts and rejects unsafe source links', () => {
    expect(nodeCategory(node)).toBe('asset')
    expect(safeHttpUrl('https://example.org/source')).toBe('https://example.org/source')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
  })

  it('exports a reproducible default Cypher query', () => {
    const meta = parseGraphMeta({
      kind: 'global-lca-graph', version: 1, nodes: [node, other],
      relationships: [relationship], records: [], truncated: false,
    })!
    expect(exportCypher(meta)).toContain('relationship.uid IN $relationship_uids')
    expect(exportCypher(meta)).toContain('"r"')
  })
})
