import { describe, expect, it } from 'vitest';
import dataset from './data/dataset.json';

describe('Global LCA Asset public evidence package', () => {
  it('matches the reviewed baseline and six-question structure', () => {
    expect(dataset.meta.validationStatus).toBe('passed');
    expect(dataset.assets).toHaveLength(214);
    expect(dataset.evidence).toHaveLength(252);
    expect(dataset.relations).toHaveLength(310);
    expect(dataset.distributions).toHaveLength(170);
    expect(dataset.mappings).toHaveLength(25);
    expect(dataset.answerability).toHaveLength(6);
  });

  it('retains the two explicit database counting scopes', () => {
    expect(dataset.summaries.overview.core_database_families).toBe(80);
    expect(dataset.summaries.overview.extended_data_bearing_assets).toBe(88);
  });

  it('reconciles every public openLCA Nexus DATA catalog entry', () => {
    const catalogDistributions = dataset.distributions.filter((row) => row.distribution_package.startsWith('openLCA Nexus catalog family'));
    const nexusAssetIds = new Set(dataset.relations.filter((row) => row.target_asset_id === 'LCA-REP-0001').map((row) => row.source_asset_id));
    expect(catalogDistributions).toHaveLength(37);
    expect(nexusAssetIds.size).toBe(37);
    expect(dataset.assets.some((row) => row.official_name === 'My-Wood LCI')).toBe(true);
    expect(dataset.assets.some((row) => row.official_name === 'openLCA LCIA Methods')).toBe(true);
  });

  it('aligns schema/profile synonyms without discarding source labels', () => {
    const originalLabels = new Set(dataset.distributions.map((row) => row.schema_profile_original));
    const alignedLabels = new Set(dataset.distributions.map((row) => row.schema_profile));
    expect(originalLabels.size).toBe(78);
    expect(alignedLabels.size).toBeLessThan(originalLabels.size);
    expect(dataset.distributions.every((row) => row.schema_profile_class && row.schema_profile_original)).toBe(true);
    expect(dataset.distributions.find((row) => row.schema_profile_original === 'TIDAS JSON / JSON Schema')?.schema_profile_class).toBe('TIDAS');
    expect(dataset.distributions.find((row) => row.schema_profile_original === 'HESTIA API / JSON-LD')?.schema_profile_class).toBe('HESTIA');
  });

  it('keeps software products and branded schemas as different mapping endpoints', () => {
    const importer = dataset.mappings.find((row) => row.mapping_artifact_id === 'MAP-0011');
    const schemaMapping = dataset.mappings.find((row) => row.mapping_artifact_id === 'MAP-0003');
    expect(importer?.target_endpoint).toBe('openLCA software');
    expect(importer?.target_endpoint_kind).toBe('Software importer');
    expect(schemaMapping?.target_endpoint).toBe('openLCA JSON-LD');
    expect(schemaMapping?.target_endpoint_kind).toBe('Schema / exchange format');
  });

  it('retains current and historical ecoinvent and openLCA compatibility evidence', () => {
    const relation = dataset.relations.find((row) => row.relationship_id === 'REL-0234');
    const historicalDistribution = dataset.distributions.find((row) => row.distribution_id === 'DST-0133');
    const currentDistribution = dataset.distributions.find((row) => row.distribution_id === 'DST-0135');
    expect(relation?.source_asset_id).toBe('LCA-DB-0001');
    expect(relation?.target_asset_id).toBe('LCA-SW-0003');
    expect(relation?.status).toContain('historical 3.9.1');
    expect(historicalDistribution?.software_version).toContain('openLCA 1.11');
    expect(historicalDistribution?.known_constraint_next_test).toContain('do not infer current ecoinvent 3.12/openLCA 2.6.2 compatibility');
    expect(currentDistribution?.software_version).toContain('openLCA 2.5.0 or newer');
  });

  it('publishes a complete dated version audit for the database scope', () => {
    expect(dataset.versionAudit).toHaveLength(88);
    expect(dataset.versionAudit.find((row) => row.asset_id === 'LCA-DB-0005')?.reviewed_version).toBe('BAFU:2026 Version 1');
  });

  it('aligns the TianGong LCA Data System aliases to one asset', () => {
    const tidas = dataset.assets.find((row) => row.asset_id === 'LCA-SYS-0001');
    const platformRelation = dataset.relations.find((row) => row.relationship_id === 'REL-0020');
    expect(tidas?.official_name).toBe('TIDAS (TianGong Data System)');
    expect(tidas?.alternative_name_acronym).toContain('TianGong LCA Data System');
    expect(tidas?.alternative_name_acronym).toContain('TianGong Data System');
    expect(tidas?.alternative_name_acronym).toContain('TIDAS');
    expect(platformRelation?.target_asset_id).toBe('LCA-SYS-0001');
  });

  it('separates the TIDAS schema from the TIDAS Tools implementation and its mapping endpoints', () => {
    const tidas = dataset.assets.find((row) => row.asset_id === 'LCA-SYS-0001');
    const tools = dataset.assets.find((row) => row.asset_id === 'LCA-SW-0043');
    const toolMappings = dataset.mappings.filter((row) => row.implementing_software_tool === 'TIDAS Tools v0.2.0');
    const forward = dataset.mappings.find((row) => row.mapping_artifact_id === 'MAP-0019');
    const openLcaJsonLd = dataset.mappings.find((row) => row.mapping_artifact_id === 'MAP-0024');
    const openLcaXlsx = dataset.mappings.find((row) => row.mapping_artifact_id === 'MAP-0025');
    expect(tidas?.asset_type).toBe('Data schema / exchange format');
    expect(tools?.asset_type).toBe('Software / API / tool');
    expect(toolMappings).toHaveLength(7);
    expect(forward?.source_endpoint).toBe('TIDAS');
    expect(forward?.target_endpoint).toBe('ILCD / eILCD');
    expect(openLcaJsonLd?.source_endpoint_kind).toBe('Schema / exchange format');
    expect(openLcaJsonLd?.known_loss_exception).toContain('.zolca');
    expect(openLcaXlsx?.source_endpoint_kind).toBe('Software exchange format');
  });
});
