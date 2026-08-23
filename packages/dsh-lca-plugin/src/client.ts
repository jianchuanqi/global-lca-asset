/** HTTP client for the public Global LCA graph API. */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface ClientOptions {
  apiBaseUrl: string
  apiToken?: string
  timeoutMs: number
}

export class GlobalLcaApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`Global LCA API returned HTTP ${status}: ${body}`)
    this.name = 'GlobalLcaApiError'
    this.status = status
    this.body = body
  }
}

/** Small fetch client that never exposes API credentials as model tool arguments. */
export class GlobalLcaClient {
  readonly baseUrl: string
  readonly apiToken: string | undefined
  readonly timeoutMs: number

  constructor(options: ClientOptions) {
    this.baseUrl = options.apiBaseUrl.replace(/\/+$/, '')
    this.apiToken = options.apiToken
    this.timeoutMs = options.timeoutMs
  }

  async get(path: string, query: Record<string, string | number | boolean | undefined>, signal: AbortSignal): Promise<JsonValue> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    return this.request(url, { method: 'GET' }, signal)
  }

  async post(path: string, body: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    return this.request(
      new URL(`${this.baseUrl}${path}`),
      { method: 'POST', body: JSON.stringify(body) },
      signal,
    )
  }

  private async request(url: URL, init: RequestInit, parentSignal: AbortSignal): Promise<JsonValue> {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const signal = AbortSignal.any([parentSignal, timeout])
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.apiToken !== undefined && this.apiToken !== '') headers.Authorization = `Bearer ${this.apiToken}`
    const response = await fetch(url, { ...init, headers, signal })
    const text = await response.text()
    if (!response.ok) throw new GlobalLcaApiError(response.status, text.slice(0, 2000))
    if (text === '') return null
    return JSON.parse(text) as JsonValue
  }
}
