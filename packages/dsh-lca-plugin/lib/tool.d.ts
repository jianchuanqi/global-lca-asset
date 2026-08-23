/** Minimal raw ToolDefinition adapter for out-of-tree DSH plugins. */
type ToolArgs = Record<string, any>;
interface AuthorSchema {
    type: 'json' | 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
    description?: string;
    required?: true;
    additionalProperties?: boolean;
    properties?: Record<string, AuthorSchema>;
    items?: AuthorSchema;
}
interface ToolExecutionContext {
    signal: AbortSignal;
}
interface ToolView {
    card: string;
    [key: string]: unknown;
}
interface ToolOptions {
    name: string;
    description: string;
    parameters: Record<string, AuthorSchema>;
    output: {
        schema: AuthorSchema;
        render(args: ToolArgs, value: any): Array<{
            type: 'text';
            text: string;
        }>;
        presentationMeta?(args: ToolArgs, value: any): any;
    };
    execute(args: ToolArgs, exec: ToolExecutionContext): Promise<any>;
    presentCall?(args: ToolArgs): ToolView;
    presentResult?(args: ToolArgs, result: unknown): ToolView;
    isConcurrencySafe?(args: ToolArgs): boolean;
}
/** Convert the compact author schema into DSH's public raw ToolDefinition fields. */
export declare function defineTool(options: ToolOptions): unknown;
export {};
//# sourceMappingURL=tool.d.ts.map