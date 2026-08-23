import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'

describe('DeepSeek Harness plugin registration', () => {
  it('registers the safe public tool set and one prompt section', () => {
    const tools: Array<{ name: string }> = []
    const sections: Array<{ name: string }> = []
    const ctx = {
      tools: { register(tool: unknown) { tools.push(tool as { name: string }); return () => {} } },
      systemPrompt: { section(section: { name: string }) { sections.push(section); return () => {} } },
    }

    apply(ctx, {
      apiBaseUrl: 'http://127.0.0.1:8000',
      enableCypher: false,
      timeoutMs: 30_000,
      maxResultChars: 40_000,
    })

    expect(tools.map(tool => tool.name)).toEqual([
      'lca_graph_statistics',
      'lca_schema',
      'lca_search_assets',
      'lca_get_asset',
      'lca_find_relationships',
      'lca_find_path',
      'lca_compare_assets',
      'lca_get_timeline',
      'lca_get_evidence',
      'lca_query_graph',
    ])
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ name: 'tool:global-lca-asset' })
  })

  it('only adds direct Cypher when explicitly enabled', () => {
    const names: string[] = []
    const ctx = {
      tools: { register(tool: unknown) { names.push((tool as { name: string }).name); return () => {} } },
      systemPrompt: { section() { return () => {} } },
    }

    apply(ctx, {
      apiBaseUrl: 'http://127.0.0.1:8000',
      enableCypher: true,
      timeoutMs: 30_000,
      maxResultChars: 40_000,
    })

    expect(names).toContain('lca_run_readonly_cypher')
  })
})
