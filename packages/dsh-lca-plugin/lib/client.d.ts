/** HTTP client for the public Global LCA graph API. */
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export interface ClientOptions {
    apiBaseUrl: string;
    apiToken?: string;
    timeoutMs: number;
}
export declare class GlobalLcaApiError extends Error {
    readonly status: number;
    readonly body: string;
    constructor(status: number, body: string);
}
/** Small fetch client that never exposes API credentials as model tool arguments. */
export declare class GlobalLcaClient {
    readonly baseUrl: string;
    readonly apiToken: string | undefined;
    readonly timeoutMs: number;
    constructor(options: ClientOptions);
    get(path: string, query: Record<string, string | number | boolean | undefined>, signal: AbortSignal): Promise<JsonValue>;
    post(path: string, body: JsonValue, signal: AbortSignal): Promise<JsonValue>;
    private request;
}
//# sourceMappingURL=client.d.ts.map