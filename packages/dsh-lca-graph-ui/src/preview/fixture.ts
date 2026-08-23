import type { GraphPresentationMeta, SettledToolCall } from '../client/types.js'

export const graphMeta: GraphPresentationMeta = {
  kind: 'global-lca-graph',
  version: 1,
  truncated: false,
  records: [
    { database: 'ecoinvent database', format: 'ecoSpold2', software: 'openLCA' },
    { database: 'ecoinvent database', format: 'ecoSpold2', software: 'Brightway' },
  ],
  cypher: 'MATCH (database:Database)-[:USES_FORMAT]->(format:Format) RETURN database, format',
  parameters: {},
  nodes: [
    {
      uid: 'LCA-DB-0001', labels: ['Entity', 'Asset', 'Database'], name: 'ecoinvent database',
      properties: {
        current_version: 'v3.12', owner_country_countries: 'Switzerland', open_data_status: 'Commercial / proprietary',
        official_url: 'https://ecoinvent.org/database/', confidence_level: 'High',
      },
    },
    {
      uid: 'FMT-0001', labels: ['Entity', 'Asset', 'Format'], name: 'ecoSpold2',
      properties: { schema_data_model: 'XML', public_evidence_status: 'Public specification verified' },
    },
    {
      uid: 'LCA-SW-0001', labels: ['Entity', 'Asset', 'Software'], name: 'openLCA',
      properties: { source_code_openness: 'Open source', developer_country_countries: 'Germany' },
    },
    {
      uid: 'LCA-SW-0002', labels: ['Entity', 'Asset', 'Software'], name: 'Brightway',
      properties: { source_code_openness: 'Open source', language: 'Python' },
    },
    {
      uid: 'org:ecoinvent', labels: ['Entity', 'Organization'], name: 'ecoinvent Association',
      properties: { country: 'Switzerland', role_source: 'maintainer' },
    },
    {
      uid: 'RLS-0004', labels: ['Entity', 'Release'], name: 'v3.12',
      properties: { release_date: '2025-11-05', lifecycle_status: 'Current release' },
    },
    {
      uid: 'MAP-0001', labels: ['Entity', 'MappingArtifact'], name: 'ecoinvent to openLCA conversion',
      properties: { mapping_status: 'Documented conversion; losslessness not publicly confirmed' },
    },
    {
      uid: 'E-0001', labels: ['Entity', 'Evidence'], name: 'ecoinvent Database',
      properties: {
        source_type: 'Official product page', source_reliability: 'Primary / high', access_restriction: 'Full database restricted',
        evidence_excerpt: 'The provider states annual updates and licence-based access to the database.',
        url_or_file: 'https://ecoinvent.org/database/',
      },
    },
    {
      uid: 'E-0002', labels: ['Entity', 'Evidence'], name: 'ecoinvent Version 3.12',
      properties: {
        source_type: 'Official release page', source_reliability: 'Primary / high', access_restriction: 'Some detailed files restricted',
        evidence_excerpt: 'Version 3.12 was released 5 November 2025 with multi-sector updates and supporting reports.',
        url_or_file: 'https://support.ecoinvent.org/ecoinvent-version-3.12',
      },
    },
    {
      uid: 'geo:global', labels: ['Entity', 'Geography'], name: 'Global',
      properties: {},
    },
  ],
  relationships: [
    { uid: 'r1', type: 'USES_FORMAT', start_uid: 'LCA-DB-0001', end_uid: 'FMT-0001', properties: {} },
    { uid: 'r2', type: 'COMPATIBLE_WITH', start_uid: 'LCA-SW-0001', end_uid: 'FMT-0001', properties: { evidence_status: 'Publicly documented' } },
    { uid: 'r3', type: 'COMPATIBLE_WITH', start_uid: 'LCA-SW-0002', end_uid: 'FMT-0001', properties: { evidence_status: 'Publicly documented' } },
    { uid: 'r4', type: 'OWNS', start_uid: 'org:ecoinvent', end_uid: 'LCA-DB-0001', properties: {} },
    { uid: 'r5', type: 'HAS_RELEASE', start_uid: 'LCA-DB-0001', end_uid: 'RLS-0004', properties: {} },
    { uid: 'r6', type: 'MAPPING_SOURCE', start_uid: 'MAP-0001', end_uid: 'LCA-DB-0001', properties: {} },
    { uid: 'r7', type: 'MAPPING_TARGET', start_uid: 'MAP-0001', end_uid: 'LCA-SW-0001', properties: {} },
    { uid: 'r8', type: 'SUPPORTED_BY', start_uid: 'LCA-DB-0001', end_uid: 'E-0001', properties: {} },
    { uid: 'r9', type: 'SUPPORTED_BY', start_uid: 'RLS-0004', end_uid: 'E-0002', properties: {} },
    { uid: 'r10', type: 'COVERS_GEOGRAPHY', start_uid: 'LCA-DB-0001', end_uid: 'geo:global', properties: {} },
  ],
}

export const settledBlock: SettledToolCall = {
  kind: 'tool-result',
  callId: 'preview-call',
  call: { name: 'lca_find_relationships', argsRaw: '{"uid":"LCA-DB-0001","depth":1}' },
  content: [{ type: 'text', text: JSON.stringify({ nodes: graphMeta.nodes, relationships: graphMeta.relationships }) }],
  isError: false,
  meta: graphMeta,
}
