import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const graphDir = join(process.cwd(), 'public/graph');
const index = JSON.parse(readFileSync(join(graphDir, 'index.json'), 'utf8')) as {
  asset_count: number;
  organization_count: number;
  node_count: number;
  relationship_count: number;
  asset_relationship_count: number;
  actor_relationship_count: number;
  expandable_relationship_count: number;
  assets: Array<{ id: string; connection_count: number }>;
  organizations: Array<{ id: string; name: string; connection_count: number }>;
};

describe('progressively loaded relationship graph data', () => {
  it('publishes searchable asset and organization nodes with one neighborhood per node', () => {
    expect(index.asset_count).toBe(301);
    expect(index.organization_count).toBe(385);
    expect(index.node_count).toBe(686);
    expect(index.relationship_count).toBe(912);
    expect(index.asset_relationship_count).toBe(391);
    expect(index.actor_relationship_count).toBe(521);
    expect(index.expandable_relationship_count).toBe(912);
    expect(index.assets).toHaveLength(301);
    expect(index.organizations).toHaveLength(385);
    expect(readdirSync(join(graphDir, 'neighborhoods')).filter((name) => name.endsWith('.json'))).toHaveLength(686);
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

  it('represents evidence-linked software actors as expandable organization nodes', () => {
    const organization = index.organizations.find((item) => item.name === 'PRé Sustainability B.V.');
    expect(organization).toBeDefined();
    const neighborhood = JSON.parse(readFileSync(join(graphDir, `neighborhoods/${organization!.id}.json`), 'utf8')) as {
      center_node_id: string;
      nodes: Array<{ id: string; kind: string }>;
      relationships: Array<{ id: string; source: string; target: string; relationship_type: string; source_urls: string[] }>;
    };
    expect(neighborhood.center_node_id).toBe(organization!.id);
    expect(neighborhood.nodes.some((node) => node.id === 'LCA-SW-0001' && node.kind === 'asset')).toBe(true);
    expect(neighborhood.relationships.some((relationship) => relationship.source === organization!.id && relationship.target === 'LCA-SW-0001' && relationship.relationship_type === 'developer' && relationship.source_urls.length > 0)).toBe(true);
  });
});
