/** Pure parsing, labeling, export, and table helpers for graph results. */
import type { GraphNode, GraphPresentationMeta, JsonValue, ToolCallBlock } from './types.js';
/** Validate replayed session metadata before it reaches Cytoscape. */
export declare function parseGraphMeta(value: unknown): GraphPresentationMeta | null;
/** Read durable metadata, with a JSON-text fallback for sessions created by plugin v0.1. */
export declare function graphMetaFromBlock(block: ToolCallBlock): GraphPresentationMeta | null;
export declare function argsFromBlock(block: ToolCallBlock): Record<string, unknown>;
export declare function primaryLabel(node: GraphNode): string;
export declare function nodeCategory(node: GraphNode): 'asset' | 'evidence' | 'organization' | 'mapping' | 'release' | 'context';
export declare function labelOptions(nodes: readonly GraphNode[]): string[];
export declare function relationshipLabel(type: string): string;
export declare function displayValue(value: JsonValue): string;
export declare function propertyEntries(properties: Record<string, JsonValue>): Array<[string, string]>;
export declare function evidenceNodes(meta: GraphPresentationMeta): GraphNode[];
export declare function toolTitle(toolName: string, block: ToolCallBlock): string;
export declare function exportCypher(meta: GraphPresentationMeta): string;
export declare function safeHttpUrl(value: unknown): string | null;
export declare function fileStem(toolName: string): string;
//# sourceMappingURL=model.d.ts.map