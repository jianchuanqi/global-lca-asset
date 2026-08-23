import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.js'

describe('graph UI plugin', () => {
  it('registers only graph-bearing LCA tools in the keyed Tool slot', () => {
    const registrations: string[] = []
    const effects: string[] = []
    const ctx = {
      effect(_effect: () => void, label?: string) { effects.push(label ?? '') },
      slots: {
        inject(name: string, factory: () => Generator<() => void>) {
          expect(name).toBe('tool.call.toolview')
          ;[...factory()]
        },
        register(options: { key: string }) {
          registrations.push(options.key)
          return () => {}
        },
      },
    }

    apply(ctx as never)

    expect(inject).toEqual(['slots'])
    expect(effects).toEqual(['global-lca-graph-ui: styles'])
    expect(registrations).toEqual([
      'lca_get_asset',
      'lca_find_relationships',
      'lca_find_path',
      'lca_query_graph',
      'lca_run_readonly_cypher',
    ])
  })
})
