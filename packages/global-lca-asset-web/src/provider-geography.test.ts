import { describe, expect, it } from 'vitest';
import dataset from './data/dataset.json';
import { providerGeography } from './provider-geography';

const location = (org: string, provider: string, countries: string, isProvider = 'Yes') => ({
  organization_id: org, organization_label: org, provider_id: provider, provider_name: provider, country_regions: countries, is_provider: isProvider,
});

describe('provider location counts', () => {
  it('includes operators, deduplicates aliases and assets, and separates locations from data coverage', () => {
    const result = providerGeography({
      assets: [{ asset_id: 'a', geographic_coverage: 'Global' }, { asset_id: 'b' }, { asset_id: 'c' }],
      assetOrganizations: [
        { asset_id: 'a', organization_id: 'one', relationship_type: 'owner' },
        { asset_id: 'a', organization_id: 'alias', relationship_type: 'operator/maintainer' },
        { asset_id: 'b', organization_id: 'one', relationship_type: 'owner' },
        { asset_id: 'b', organization_id: 'community', relationship_type: 'operator/maintainer' },
        { asset_id: 'c', organization_id: 'unknown', relationship_type: 'owner' },
        { asset_id: 'c', organization_id: 'developer', relationship_type: 'developer' },
        { asset_id: 'c', organization_id: 'placeholder', relationship_type: 'operator/maintainer' },
      ],
      providerLocations: [location('one', 'institution', 'Germany'), location('alias', 'institution', 'Germany; Netherlands'), location('community', 'community', 'Global community'), location('unknown', 'unknown', ''), location('developer', 'developer', 'France'), location('placeholder', '', '', 'No')],
    });
    expect(result.total).toBe(3);
    expect(result.directory).toHaveLength(3);
    const institution = result.directory.find((row) => row.id === 'institution')!;
    expect(institution.assets.map((row) => row.asset_id).sort()).toEqual(['a', 'b']);
    expect(institution.roles).toEqual(['operator/maintainer', 'owner']);
    expect(institution.aliases.sort()).toEqual(['alias', 'one']);
    expect(result.located).toBe(2);
    expect(Object.fromEntries(result.counts.map((row) => [row.label, row.count]))).toEqual({ Germany: 1, Netherlands: 1, 'Global community': 1, 'Not publicly confirmed': 1 });
    expect(result.assetCountries.get('b')).toEqual(['Germany', 'Global community', 'Netherlands']);
    expect(result.assetCountries.get('c')).toEqual(['Not publicly confirmed']);
  });

  it('has reviewed every owner/operator label with provenance while retaining one unresolved provider', () => {
    const expectedActors = new Set(dataset.assetOrganizations.filter((row) => ['owner', 'operator/maintainer'].includes(row.relationship_type)).map((row) => row.organization_id));
    expect(new Set(dataset.providerLocations.map((row) => row.organization_id))).toEqual(expectedActors);
    expect(dataset.providerLocations).toHaveLength(expectedActors.size);
    expect(dataset.providerLocations.filter((row) => row.is_provider === 'Yes').every((row) => row.provider_id && row.evidence_urls && row.evidence_note && row.source_reviewed_at)).toBe(true);
    const result = providerGeography({ ...dataset, assets: dataset.assets.map(({ asset_id }) => ({ asset_id })) });
    expect(result.total - result.located).toBe(1);
    expect(result.directory).toHaveLength(result.total);
    expect(new Set(result.directory.map((row) => row.id)).size).toBe(result.total);
    expect(result.directory.every((row) => new Set(row.assets.map((asset) => asset.asset_id)).size === row.assets.length)).toBe(true);
    expect(result.counts.find((row) => row.label === 'Global community')?.count).toBeGreaterThan(0);
    expect(result.assetCountries.get('LCA-SW-0001')).toEqual(['Finland', 'Netherlands']);
    expect(dataset.providerLocations.find((row) => row.organization_label.startsWith('International Organization for Standardization'))?.country_regions).toBe('Switzerland');
    expect(dataset.providerLocations.find((row) => row.organization_label === 'Worldly')?.country_regions).toBe('United States');
    expect(dataset.providerLocations.find((row) => row.organization_label === 'Kleis Technology')?.country_regions).toBe('Switzerland');
  });
});
