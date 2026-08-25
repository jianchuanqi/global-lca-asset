import { apply } from '../packages/dsh-lca-plugin/lib/index.js'

const apiBaseUrl = process.env.GLOBAL_LCA_API_URL ?? 'http://127.0.0.1:8000'
const tools = []
const ctx = {
  tools: { register(tool) { tools.push(tool); return () => {} } },
  systemPrompt: { section() { return () => {} } },
}

apply(ctx, {
  apiBaseUrl,
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
  registeredTools: tools.length,
  nodes: statistics.nodes,
  relationships: statistics.relationships,
  assets: statistics.assets,
  evidence: statistics.evidence,
  path: path.relationships.map(relationship => relationship.type),
  structuredQueryRows: query.records.length,
}, null, 2))
