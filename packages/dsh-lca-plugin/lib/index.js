/** DeepSeek Harness plugin for evidence-backed Global LCA asset queries. */
import z from '@deepseek-ai/schemastery';
import { GlobalLcaClient } from './client.js';
import { graphPresentationMeta } from './graph-presentation.js';
import { defineTool } from './tool.js';
export const name = 'global-lca-asset';
export const inject = ['tools', 'systemPrompt'];
export const Config = z.object({
    apiBaseUrl: z.string().default('http://127.0.0.1:8000'),
    apiToken: z.string(),
    enableCypher: z.boolean().default(false),
    timeoutMs: z.natural().min(1000).default(30_000),
    maxResultChars: z.natural().min(1000).default(40_000),
});
const JSON_OUTPUT = { type: 'json' };
function renderJson(value, maxChars) {
    const text = JSON.stringify(value, null, 2);
    if (text.length <= maxChars)
        return text;
    return `${text.slice(0, maxChars)}\n… [truncated ${text.length - maxChars} characters]`;
}
function output(maxChars) {
    return {
        schema: JSON_OUTPUT,
        render: (_args, value) => [{ type: 'text', text: renderJson(value, maxChars) }],
        presentationMeta: (_args, value) => graphPresentationMeta(value),
    };
}
/** Register the LCA graph tool family and its evidence-use guidance. */
export function apply(ctx, config) {
    const resolved = config;
    const client = new GlobalLcaClient({
        apiBaseUrl: resolved.apiBaseUrl,
        ...(resolved.apiToken === undefined ? {} : { apiToken: resolved.apiToken }),
        timeoutMs: resolved.timeoutMs,
    });
    const toolOutput = output(resolved.maxResultChars);
    ctx.systemPrompt.section({
        name: 'tool:global-lca-asset',
        order: 116,
        text: `Use the Global LCA Asset tools for questions about LCA databases, datasets, software, schemas, formats, repositories, nomenclatures, methods, QA systems, releases, distributions, mappings, organizations, countries and sectors.

Start with lca_graph_statistics or lca_search_assets for broad questions. Use lca_get_asset, lca_get_timeline and lca_get_evidence before making precise claims. Use lca_schema then lca_query_graph for multi-entity analysis. Treat mapping/alignment claims separately from tested, lossless conversion. Cite evidence URLs returned by the tools and state when a fact is only claimed, unresolved, restricted, or not publicly confirmed. The inventory is a public-evidence lower bound, so never present its current count as a proven worldwide total.`,
    });
    ctx.tools.register(defineTool({
        name: 'lca_graph_statistics',
        description: 'Return graph counts, evidence cutoff, asset-type counts, and relationship-type counts.',
        parameters: {},
        output: toolOutput,
        execute: (_args, exec) => client.get('/api/statistics', {}, exec.signal),
        presentCall: () => ({ card: 'generic', title: 'Global LCA graph statistics' }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_schema',
        description: 'Return the allowlisted graph labels, relationships, properties, operators, and a query-plan example.',
        parameters: {},
        output: toolOutput,
        execute: (_args, exec) => client.get('/api/schema', {}, exec.signal),
        presentCall: () => ({ card: 'generic', title: 'Global LCA graph schema' }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_search_assets',
        description: 'Search public LCA assets by text, asset type, country, sector, or open-data signal. Filters can be combined.',
        parameters: {
            query: { type: 'string', description: 'Free-text search over name, acronym and description.' },
            asset_type: { type: 'string', description: 'Exact asset type, such as Database / dataset or Software / API / tool.' },
            country: { type: 'string', description: 'Country or geography text.' },
            sector: { type: 'string', description: 'Sector, product or process text.' },
            open_only: { type: 'boolean', description: 'When true, keep records whose public metadata has an open-data signal.' },
            limit: { type: 'integer', description: 'Maximum results, from 1 to 200.' },
            offset: { type: 'integer', description: 'Pagination offset.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get('/api/assets', {
            q: args.query,
            asset_type: args.asset_type,
            country: args.country,
            sector: args.sector,
            open_only: args.open_only,
            limit: args.limit,
            offset: args.offset,
        }, exec.signal),
        presentCall: args => ({
            card: 'generic',
            kind: 'search',
            title: `Search LCA assets${args.query ? `: ${args.query}` : ''}`,
            rawInput: args.query ?? undefined,
        }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_get_asset',
        description: 'Get one canonical asset and its immediate relationship graph. Use an ID such as LCA-DB-0001.',
        parameters: {
            asset_id: { type: 'string', required: true, description: 'Canonical Global LCA Asset ID.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get(`/api/assets/${encodeURIComponent(args.asset_id)}`, {}, exec.signal),
        presentCall: args => ({ card: 'generic', title: `LCA asset ${args.asset_id}` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_find_relationships',
        description: 'Return a visualization-ready neighborhood around any asset, release, distribution, evidence, or mapping node.',
        parameters: {
            uid: { type: 'string', required: true, description: 'Graph node UID.' },
            depth: { type: 'integer', description: 'Relationship depth from 1 to 3.' },
            limit: { type: 'integer', description: 'Maximum graph nodes from 1 to 500.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get('/api/graph/neighborhood', {
            uid: args.uid,
            depth: args.depth,
            limit: args.limit,
        }, exec.signal),
        presentCall: args => ({ card: 'generic', title: `Relationships around ${args.uid}` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_find_path',
        description: 'Find the shortest documented relationship path between two graph nodes.',
        parameters: {
            source_uid: { type: 'string', required: true, description: 'Starting node UID.' },
            target_uid: { type: 'string', required: true, description: 'Target node UID.' },
            max_depth: { type: 'integer', description: 'Maximum path length from 1 to 8.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get('/api/graph/path', {
            source_uid: args.source_uid,
            target_uid: args.target_uid,
            max_depth: args.max_depth,
        }, exec.signal),
        presentCall: args => ({ card: 'generic', title: `LCA path: ${args.source_uid} → ${args.target_uid}` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_compare_assets',
        description: 'Compare two to ten canonical assets using their public metadata fields.',
        parameters: {
            asset_ids: {
                type: 'array',
                required: true,
                description: 'Two to ten canonical asset IDs.',
                items: { type: 'string' },
            },
        },
        output: toolOutput,
        execute: (args, exec) => client.post('/api/compare', { asset_ids: args.asset_ids }, exec.signal),
        presentCall: args => ({ card: 'generic', title: `Compare ${args.asset_ids.length} LCA assets` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_get_timeline',
        description: 'Return the documented release and milestone timeline for one asset family.',
        parameters: {
            asset_id: { type: 'string', required: true, description: 'Canonical Global LCA Asset ID.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get(`/api/assets/${encodeURIComponent(args.asset_id)}/timeline`, {}, exec.signal),
        presentCall: args => ({ card: 'generic', title: `Timeline for ${args.asset_id}` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_get_evidence',
        description: 'Get one evidence record, source URL, reliability, access restriction, excerpt and supported assets.',
        parameters: {
            evidence_id: { type: 'string', required: true, description: 'Evidence UID, such as E-0001 or EVD-0205.' },
        },
        output: toolOutput,
        execute: (args, exec) => client.get(`/api/evidence/${encodeURIComponent(args.evidence_id)}`, {}, exec.signal),
        presentCall: args => ({ card: 'generic', title: `Evidence ${args.evidence_id}` }),
        isConcurrencySafe: () => true,
    }));
    ctx.tools.register(defineTool({
        name: 'lca_query_graph',
        description: 'Run a validated structured graph query. Call lca_schema first, then pass a plan using only the returned vocabulary.',
        parameters: {
            plan: {
                type: 'object',
                required: true,
                additionalProperties: true,
                description: 'GraphQueryPlan with nodes, relationships, filters, return_aliases, order_by, distinct and limit.',
                properties: {},
            },
        },
        output: toolOutput,
        execute: (args, exec) => client.post('/api/query/plan', args.plan, exec.signal),
        presentCall: () => ({ card: 'generic', title: 'Query Global LCA graph' }),
        isConcurrencySafe: () => true,
    }));
    if (resolved.enableCypher) {
        ctx.tools.register(defineTool({
            name: 'lca_run_readonly_cypher',
            description: 'Expert-only direct Cypher. The API rejects writes, procedures and multiple statements; use lca_query_graph for normal analysis.',
            parameters: {
                cypher: { type: 'string', required: true, description: 'One read-only Cypher statement.' },
                parameters: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Cypher parameters as a JSON object.',
                    properties: {},
                },
                limit: { type: 'integer', description: 'Maximum returned rows from 1 to 500.' },
            },
            output: toolOutput,
            execute: (args, exec) => client.post('/api/query/cypher', {
                cypher: args.cypher,
                parameters: (args.parameters ?? {}),
                limit: args.limit ?? 200,
            }, exec.signal),
            presentCall: () => ({ card: 'generic', title: 'Read-only LCA Cypher' }),
            isConcurrencySafe: () => true,
        }));
    }
}
//# sourceMappingURL=index.js.map