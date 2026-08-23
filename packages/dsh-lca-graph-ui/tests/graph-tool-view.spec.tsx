import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GraphToolView } from '../src/client/GraphToolView.js'
import { settledBlock } from '../src/preview/fixture.js'

describe('GraphToolView', () => {
  it('shows a settled graph result expanded on first render', () => {
    const markup = renderToStaticMarkup(
      <GraphToolView callId="preview-call" toolName="lca_find_relationships" block={settledBlock} />,
    )

    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('class="lca-graph-workspace"')
    expect(markup).toContain('Interactive LCA relationship graph')
  })
})
