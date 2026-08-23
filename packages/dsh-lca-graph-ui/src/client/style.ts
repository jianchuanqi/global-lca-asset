import css from './graph-card.css?inline'

const STYLE_ID = '@global-lca/dsh-lca-graph-ui/graph-card.css'

/** Install plugin-owned styles for the current client-plugin lifetime. */
export function installGraphStyles(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.plugin = '@global-lca/dsh-lca-graph-ui'
  style.dataset.pluginCss = STYLE_ID
  style.textContent = css
  document.head.append(style)
  return () => { style.remove() }
}
