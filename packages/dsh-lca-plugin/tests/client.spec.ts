import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalLcaApiError, GlobalLcaClient } from '../src/client.js'

const signal = new AbortController().signal

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GlobalLcaClient', () => {
  it('encodes search parameters and keeps the token outside tool arguments', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const client = new GlobalLcaClient({ apiBaseUrl: 'http://localhost:8000/', apiToken: 'secret', timeoutMs: 1000 })

    await client.get('/api/assets', { q: 'open data', limit: 5, country: undefined }, signal)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('http://localhost:8000/api/assets?q=open+data&limit=5')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret')
  })

  it('posts JSON and parses a canonical JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ graph: { nodes: [] } }), { status: 200 }))
    const client = new GlobalLcaClient({ apiBaseUrl: 'http://localhost:8000', timeoutMs: 1000 })

    await expect(client.post('/api/query/plan', { nodes: [] }, signal)).resolves.toEqual({ graph: { nodes: [] } })
  })

  it('returns a bounded API error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not allowed', { status: 403 }))
    const client = new GlobalLcaClient({ apiBaseUrl: 'http://localhost:8000', timeoutMs: 1000 })

    await expect(client.get('/api/query/cypher', {}, signal)).rejects.toEqual(
      expect.objectContaining<Partial<GlobalLcaApiError>>({ status: 403, body: 'not allowed' }),
    )
  })
})
