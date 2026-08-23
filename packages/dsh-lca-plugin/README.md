# Global LCA Asset plugin for DeepSeek Harness

This out-of-tree plugin turns the Global LCA knowledge graph into model-facing DSH tools. It does not contain or modify DeepSeek Harness and it never gives the model a Neo4j credential.

The plugin provides asset search, asset detail, relationship neighborhoods, shortest paths, comparisons, timelines, evidence lookup, graph statistics and validated structured queries. Graph-bearing results open in an interactive Graph/Data/Evidence card compiled into the same installable bundle from the internal `@global-lca/dsh-lca-graph-ui` module. Direct Cypher is optional and disabled by default.

The API base URL is configured with `GLOBAL_LCA_API_URL`. Set both `GLOBAL_LCA_ENABLE_CYPHER=true` and the API's `LCA_ENABLE_EXPERT_CYPHER=true` only for an expert deployment backed by a read-only Neo4j account.
