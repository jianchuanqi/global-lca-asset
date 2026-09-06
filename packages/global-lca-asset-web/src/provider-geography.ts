import type { Dataset } from './GlobalLcaAsset';

type ProviderLocation = Dataset['providerLocations'][number];
const splitLocations = (value: unknown) => String(value ?? '').split(';').map((part) => part.trim()).filter(Boolean);

export function providerGeography(data: Pick<Dataset, 'assets' | 'assetOrganizations' | 'providerLocations'>) {
  const reviewed = new Map(data.providerLocations.map((row) => [String(row.organization_id), row]));
  const providers = new Map<string, Set<string>>();
  const assetIndex = new Map(data.assets.map((asset) => [String(asset.asset_id), asset]));
  const directory = new Map<string, {
    id: string; name: string; aliases: Set<string>; roles: Set<string>;
    assets: Map<string, Dataset['assets'][number]>; evidence: Map<string, ProviderLocation>;
  }>();
  const assetProviders = new Map<string, Map<string, ProviderLocation>>();
  for (const relation of data.assetOrganizations) {
    if (!['owner', 'operator/maintainer'].includes(String(relation.relationship_type))) continue;
    const location = reviewed.get(String(relation.organization_id));
    if (!location || location.is_provider !== 'Yes') continue;
    const providerId = String(location.provider_id);
    if (!providers.has(providerId)) providers.set(providerId, new Set());
    for (const country of splitLocations(location.country_regions)) providers.get(providerId)!.add(country);
    const assetId = String(relation.asset_id);
    if (!directory.has(providerId)) directory.set(providerId, {
      id: providerId, name: String(location.provider_name), aliases: new Set(), roles: new Set(), assets: new Map(), evidence: new Map(),
    });
    const provider = directory.get(providerId)!;
    provider.aliases.add(String(location.organization_label));
    provider.roles.add(String(relation.relationship_type));
    provider.evidence.set(String(location.organization_id), location);
    const asset = assetIndex.get(assetId);
    if (asset) provider.assets.set(assetId, asset);
    if (!assetProviders.has(assetId)) assetProviders.set(assetId, new Map());
    // Keep role-label evidence available even when several labels share one identity.
    assetProviders.get(assetId)!.set(String(location.organization_id), location);
  }
  const counts = new Map<string, number>();
  let located = 0;
  for (const countries of providers.values()) {
    if (countries.size) located++;
    for (const country of countries.size ? countries : ['Not publicly confirmed']) counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  const assetCountries = new Map<string, string[]>();
  for (const asset of data.assets) {
    const countries = new Set<string>();
    for (const provider of assetProviders.get(String(asset.asset_id))?.values() ?? []) {
      const locations = providers.get(String(provider.provider_id))!;
      for (const location of locations.size ? locations : ['Not publicly confirmed']) countries.add(location);
    }
    assetCountries.set(String(asset.asset_id), [...countries].sort());
  }
  return {
    directory: [...directory.values()].map((provider) => ({
      id: provider.id, name: provider.name, aliases: [...provider.aliases], roles: [...provider.roles].sort(),
      countries: [...(providers.get(provider.id)!.size ? providers.get(provider.id)! : ['Not publicly confirmed'])].sort(),
      assets: [...provider.assets.values()].sort((a, b) => String(a.official_name).localeCompare(String(b.official_name))),
      evidence: [...provider.evidence.values()],
    })).sort((a, b) => a.name.localeCompare(b.name)),
    total: providers.size,
    located,
    counts: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    assetCountries,
    assetProviders,
  };
}
