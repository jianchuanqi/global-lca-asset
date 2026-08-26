import { describe, expect, it, vi } from 'vitest';
import { loadDataset } from './GlobalLcaAsset';
import dataset from './data/dataset.json';

describe('runtime dataset loading', () => {
  it('loads the generated JSON asset without compiling it into the app chunk', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(dataset), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const loaded = await loadDataset(fetcher);

    expect(loaded.meta.packageVersion).toBe(dataset.meta.packageVersion);
    expect(loaded.assets).toHaveLength(214);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('dataset.json');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ Accept: 'application/json' });
  });

  it('reports an HTTP failure before attempting to render the dataset', async () => {
    const fetcher = vi.fn(async () => new Response('unavailable', { status: 503 }));
    await expect(loadDataset(fetcher)).rejects.toThrow('Dataset request failed with HTTP 503.');
  });

  it('rejects a JSON response with the wrong public-package shape', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    await expect(loadDataset(fetcher)).rejects.toThrow('does not match the expected public package shape');
  });
});
