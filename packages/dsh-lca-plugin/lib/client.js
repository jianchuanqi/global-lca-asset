/** HTTP client for the public Global LCA graph API. */
export class GlobalLcaApiError extends Error {
    status;
    body;
    constructor(status, body) {
        super(`Global LCA API returned HTTP ${status}: ${body}`);
        this.name = 'GlobalLcaApiError';
        this.status = status;
        this.body = body;
    }
}
/** Small fetch client that never exposes API credentials as model tool arguments. */
export class GlobalLcaClient {
    baseUrl;
    apiToken;
    timeoutMs;
    constructor(options) {
        this.baseUrl = options.apiBaseUrl.replace(/\/+$/, '');
        this.apiToken = options.apiToken;
        this.timeoutMs = options.timeoutMs;
    }
    async get(path, query, signal) {
        const url = new URL(`${this.baseUrl}${path}`);
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined)
                url.searchParams.set(key, String(value));
        }
        return this.request(url, { method: 'GET' }, signal);
    }
    async post(path, body, signal) {
        return this.request(new URL(`${this.baseUrl}${path}`), { method: 'POST', body: JSON.stringify(body) }, signal);
    }
    async request(url, init, parentSignal) {
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const signal = AbortSignal.any([parentSignal, timeout]);
        const headers = { Accept: 'application/json' };
        if (init.body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (this.apiToken !== undefined && this.apiToken !== '')
            headers.Authorization = `Bearer ${this.apiToken}`;
        const response = await fetch(url, { ...init, headers, signal });
        const text = await response.text();
        if (!response.ok)
            throw new GlobalLcaApiError(response.status, text.slice(0, 2000));
        if (text === '')
            return null;
        return JSON.parse(text);
    }
}
//# sourceMappingURL=client.js.map