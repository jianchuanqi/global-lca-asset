import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GraphToolView } from '../client/GraphToolView.js'
import { installGraphStyles } from '../client/style.js'
import { settledBlock } from './fixture.js'
import './preview.css'

installGraphStyles()

function App() {
  return (
    <main className="preview-shell">
      <header className="preview-brand">
        <span>Global LCA Asset</span>
        <small>DeepSeek Harness plugin preview</small>
      </header>
      <section className="preview-conversation">
        <div className="preview-prompt">Show the relationships between ecoinvent, its format, compatible software, releases and evidence.</div>
        <div className="preview-answer">
          <p>ecoinvent uses the ecoSpold2 format. The current evidence also connects that format to openLCA and Brightway, while the database remains licence-restricted.</p>
          <GraphToolView
            callId="preview-call"
            toolName="lca_find_relationships"
            block={settledBlock}
            inspect={() => {}}
          />
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
