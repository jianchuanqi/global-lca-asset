/** DeepSeek Harness plugin for evidence-backed Global LCA asset queries. */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "global-lca-asset";
export declare const inject: string[];
export interface Config {
    apiBaseUrl?: string;
    apiToken?: string;
    enableCypher?: boolean;
    timeoutMs?: number;
    maxResultChars?: number;
}
export declare const Config: z<Config>;
/** Register the LCA graph tool family and its evidence-use guidance. */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map