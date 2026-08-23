# Global LCA graph UI for DeepSeek Harness

This browser-side companion renders graph-bearing Global LCA Asset tool results as interactive cards inside the DeepSeek Harness conversation. It reads replayable `global-lca-graph` presentation metadata from the session log and never calls the graph API directly.

The card provides a bounded query-subgraph canvas, type and text filters, connected/hierarchical/circle/grid layouts, node and relationship inspection, a tabular view, an evidence view, fullscreen mode, and PNG/SVG/JSON/Cypher export. Selecting a node highlights its immediate neighborhood. The card deliberately does not load the complete knowledge graph.

The package registers keyed views for `lca_get_asset`, `lca_find_relationships`, `lca_find_path`, `lca_query_graph`, and the optional `lca_run_readonly_cypher` tool. Install it through the `@global-lca/dsh-lca-plugin` bundle rather than as a separate end-user step.
