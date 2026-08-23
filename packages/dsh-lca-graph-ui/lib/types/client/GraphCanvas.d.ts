import type { GraphNode, GraphPresentationMeta, GraphRelationship } from './types.js';
export type GraphSelection = {
    kind: 'node';
    value: GraphNode;
} | {
    kind: 'relationship';
    value: GraphRelationship;
} | null;
export interface GraphController {
    fit(): void;
    runLayout(name: LayoutName): void;
    png(): Promise<Blob>;
    svg(): string;
}
export type LayoutName = 'cose' | 'breadthfirst' | 'circle' | 'grid';
interface GraphCanvasProps {
    meta: GraphPresentationMeta;
    query: string;
    label: string;
    layout: LayoutName;
    onSelection(selection: GraphSelection): void;
    onReady(controller: GraphController | null): void;
}
/** Cytoscape canvas kept isolated from the rest of the card's React state. */
export declare function GraphCanvas({ meta, query, label, layout, onSelection, onReady }: GraphCanvasProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=GraphCanvas.d.ts.map