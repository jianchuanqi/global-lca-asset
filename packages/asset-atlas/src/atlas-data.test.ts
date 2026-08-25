import { describe, expect, it } from 'vitest';
import atlas from './data/atlas.json';

describe('Atlas public evidence package', () => {
  it('matches the reviewed baseline and six-question structure', () => {
    expect(atlas.meta.validationStatus).toBe('passed');
    expect(atlas.assets).toHaveLength(199);
    expect(atlas.evidence).toHaveLength(205);
    expect(atlas.relations).toHaveLength(233);
    expect(atlas.releases).toHaveLength(290);
    expect(atlas.distributions).toHaveLength(128);
    expect(atlas.mappings).toHaveLength(18);
    expect(atlas.answerability).toHaveLength(6);
  });

  it('retains the two explicit database counting scopes', () => {
    expect(atlas.summaries.overview.core_database_families).toBe(69);
    expect(atlas.summaries.overview.extended_data_bearing_assets).toBe(77);
  });
});
