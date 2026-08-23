/** Browser plugin that registers interactive graph cards for graph-bearing LCA tools. */

import { GraphToolView } from './GraphToolView.js'
import { installGraphStyles } from './style.js'
import type { ClientContext } from './types.js'

const GRAPH_TOOLS = [
  'lca_get_asset',
  'lca_find_relationships',
  'lca_find_path',
  'lca_query_graph',
  'lca_run_readonly_cypher',
] as const

export const inject = ['slots']

/** Register one keyed graph renderer for every graph-bearing LCA tool. */
export function apply(ctx: ClientContext): void {
  ctx.effect(installGraphStyles, 'global-lca-graph-ui: styles')
  ctx.slots.inject('tool.call.toolview', function* () {
    for (const key of GRAPH_TOOLS) {
      yield ctx.slots.register({ name: 'tool.call.toolview', key }, GraphToolView)
    }
  })
}
