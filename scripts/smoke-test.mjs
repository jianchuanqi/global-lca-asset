import { apply } from '../packages/dsh-lca-plugin/lib/index.js'

const apiBaseUrl = process.env.GLOBAL_LCA_API_URL ?? 'http://127.0.0.1:8000'
const apiToken = process.env.GLOBAL_LCA_API_TOKEN
const configuredPreflightTimeout = Number.parseInt(
  process.env.GLOBAL_LCA_SMOKE_PREFLIGHT_TIMEOUT_MS ?? '5000',
  10,
)
const preflightTimeoutMs = Number.isFinite(configuredPreflightTimeout) && configuredPreflightTimeout > 0
  ? configuredPreflightTimeout
  : 5000

function startupGuidance() {
  return [
    'Start the local integration stack with: docker compose up -d --build',
    'Then inspect readiness with: docker compose ps -a',
    'If seed or API is not ready, run: docker compose logs seed api',
    'For a remote API, set GLOBAL_LCA_API_URL and, when required, GLOBAL_LCA_API_TOKEN.',
  ].join('\n')
}

async function requireHealthyApi() {
  let healthUrl
  try {
    healthUrl = new URL('/health', apiBaseUrl)
  } catch {
    throw new Error(`GLOBAL_LCA_API_URL is not a valid absolute URL: ${apiBaseUrl}`)
  }

  let response
  try {
    response = await fetch(healthUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(preflightTimeoutMs),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Global LCA API health preflight could not reach ${healthUrl} within ${preflightTimeoutMs} ms: ${detail}\n${startupGuidance()}`,
    )
  }

  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      `Global LCA API health preflight returned HTTP ${response.status} from ${healthUrl}: ${body.slice(0, 500)}\n${startupGuidance()}`,
    )
  }

  let health
  try {
    health = JSON.parse(body)
  } catch {
    throw new Error(`Global LCA API health preflight returned non-JSON content from ${healthUrl}.\n${startupGuidance()}`)
  }
  if (health?.status !== 'ok') {
    throw new Error(
      `Global LCA API is reachable at ${healthUrl}, but status is ${JSON.stringify(health?.status ?? 'missing')}.\n${startupGuidance()}`,
    )
  }
  return health
}

async function main() {
  const health = await requireHealthyApi()
  const tools = []
  const ctx = {
    tools: { register(tool) { tools.push(tool); return () => {} } },
    systemPrompt: { section() { return () => {} } },
  }

  apply(ctx, {
    apiBaseUrl,
    ...(apiToken ? { apiToken } : {}),
    enableCypher: false,
    timeoutMs: 30_000,
    maxResultChars: 40_000,
  })

  const signal = new AbortController().signal
  const run = async (name, args) => {
    const tool = tools.find(candidate => candidate.name === name)
    if (tool === undefined) throw new Error(`tool not registered: ${name}`)
    return tool.execute(args, { signal })
  }

  const statistics = await run('lca_graph_statistics', {})
  if (statistics.assets !== 214 || statistics.evidence !== 252) {
    throw new Error(`unexpected graph counts: ${JSON.stringify(statistics)}`)
  }

  const path = await run('lca_find_path', {
    source_uid: 'LCA-DB-0001',
    target_uid: 'LCA-FMT-0001',
    max_depth: 4,
  })
  if (path.nodes.length !== 2 || path.relationships[0]?.type !== 'USES_FORMAT') {
    throw new Error(`expected ecoinvent → ecoSpold2 path: ${JSON.stringify(path)}`)
  }

  const query = await run('lca_query_graph', {
    plan: {
      nodes: [{ alias: 'd', label: 'Database' }],
      filters: [{ alias: 'd', property: 'open_data_status', operator: 'contains', value: 'open' }],
      return_aliases: ['d'],
      limit: 3,
    },
  })
  if (query.records.length === 0 || !query.cypher.includes('LIMIT $query_limit')) {
    throw new Error(`structured graph query failed: ${JSON.stringify(query)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl,
    backend: health.backend,
    registeredTools: tools.length,
    nodes: statistics.nodes,
    relationships: statistics.relationships,
    assets: statistics.assets,
    evidence: statistics.evidence,
    path: path.relationships.map(relationship => relationship.type),
    structuredQueryRows: query.records.length,
  }, null, 2))
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Global LCA integration smoke failed:\n${message}`)
  process.exitCode = 1
}
