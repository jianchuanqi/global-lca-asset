import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const graphDir = join(process.cwd(), 'public/graph');
const index = JSON.parse(readFileSync(join(graphDir, 'index.json'), 'utf8')) as {
  asset_count: number;
  relationship_count: number;
  expandable_relationship_count: number;
  assets: Array<{ id: string; connection_count: number }>;
};

describe('progressively loaded relationship graph data', () => {
  it('publishes a small asset index and one neighborhood per asset', () => {
    expect(index.asset_count).toBe(214);
    expect(index.relationship_count).toBe(310);
    expect(index.expandable_relationship_count).toBe(304);
    expect(index.assets).toHaveLength(214);
    expect(readdirSync(join(graphDir, 'neighborhoods')).filter((name) => name.endsWith('.json'))).toHaveLength(214);
  });

  it('keeps each neighborhood internally referentially complete', () => {
    const asset = index.assets.find((item) => item.id === 'LCA-DB-0001');
    expect(asset).toBeDefined();
    const neighborhood = JSON.parse(readFileSync(join(graphDir, 'neighborhoods/LCA-DB-0001.json'), 'utf8')) as {
      center_asset_id: string;
      nodes: Array<{ id: string }>;
      relationships: Array<{ id?: string; source: string; target: string }>;
    };
    const nodeIds = new Set(neighborhood.nodes.map((node) => node.id));
    expect(neighborhood.center_asset_id).toBe('LCA-DB-0001');
    expect(neighborhood.relationships).toHaveLength(asset!.connection_count);
    expect(neighborhood.relationships.every((relationship) => nodeIds.has(relationship.source) && nodeIds.has(relationship.target))).toBe(true);
    expect(neighborhood.relationships.some((relationship) => relationship.id === 'REL-0234')).toBe(true);
  });
});
