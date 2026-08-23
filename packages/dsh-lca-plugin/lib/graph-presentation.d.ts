/** Durable browser presentation metadata for graph-bearing tool results. */
import type { JsonValue } from './client.js';
export interface GraphPresentationNode {
    uid: string;
    labels: string[];
    name: string;
    properties: Record<string, JsonValue>;
}
export interface GraphPresentationRelationship {
    uid: string;
    type: string;
    start_uid: string;
    end_uid: string;
    properties: Record<string, JsonValue>;
}
export interface GraphPresentationMeta {
    kind: 'global-lca-graph';
    version: 1;
    nodes: GraphPresentationNode[];
    relationships: GraphPresentationRelationship[];
    records: Array<Record<string, JsonValue>>;
    truncated: boolean;
    cypher?: string;
    parameters?: Record<string, JsonValue>;
}
/**
 * Extract the bounded graph result into session-log metadata. The browser reads
 * this copy directly, so replay never depends on reparsing model-facing text.
 */
export declare function graphPresentationMeta(value: JsonValue): GraphPresentationMeta | null;
//# sourceMappingURL=graph-presentation.d.ts.map