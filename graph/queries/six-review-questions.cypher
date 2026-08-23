// Q1. How many LCA database families are captured at this evidence cutoff?
// This is a review lower bound, not proof of a final worldwide denominator.
MATCH (d:Asset:Database)
OPTIONAL MATCH (m:GraphMetadata {uid: 'graph:metadata'})
RETURN count(d) AS database_families,
       m.evidence_cutoff AS evidence_cutoff,
       m.source_file AS source_file;

// Q2. Which databases have an explicit open-licence signal, and where are they obtained?
MATCH (d:Asset:Database)
WHERE toLower(coalesce(d.open_data_status, '')) STARTS WITH 'open licence confirmed'
RETURN d.uid, d.name, d.current_version,
       d.open_data_status, d.licence_identifier_terms,
       d.redistribution_rights, d.registration, d.fee,
       d.canonical_access_download_url
ORDER BY d.name;

// Q2 companion. Show all access categories so free/public is not conflated with open licence.
MATCH (d:Asset:Database)
RETURN d.open_data_status AS access_category, count(*) AS databases
ORDER BY databases DESC, access_category;

// Q3. What formats/schemas are linked to databases, and what evidence status supports each link?
MATCH (d:Asset:Database)-[r:USES_FORMAT|USES_SCHEMA|COMPATIBLE_WITH]->(target:Asset)
RETURN d.uid, d.name, type(r) AS relationship,
       target.uid, target.name, target.asset_type,
       r.status, r.evidence_summary, r.constraints
ORDER BY d.name, relationship, target.name;

// Q3 companion. Distribution-level package, schema and software claims.
MATCH (d:Asset:Database)-[:HAS_DISTRIBUTION]->(dist:Distribution)
RETURN d.uid, d.name, dist.uid, dist.database_release,
       dist.distribution_package, dist.schema_profile, dist.schema_version,
       dist.compatible_software, dist.software_version,
       dist.claimed_tested_status, dist.access_route
ORDER BY d.name, dist.uid;

// Q4. Who develops/maintains each database, in which countries, and for which sectors?
MATCH (d:Asset:Database)
OPTIONAL MATCH (owner:Organization)-[:OWNS]->(d)
OPTIONAL MATCH (maintainer:Organization)-[:MAINTAINS]->(d)
RETURN d.uid, d.name,
       collect(DISTINCT owner.name) AS owners,
       collect(DISTINCT maintainer.name) AS maintainers,
       d.owner_country_countries, d.developer_country_countries,
       d.geographic_data_coverage, d.sector_scope
ORDER BY d.name;

// Q5. When were assets and their documented releases/milestones developed?
MATCH (a:Asset)-[:HAS_RELEASE]->(r:Release)
RETURN a.uid, a.name, a.asset_type,
       r.uid, r.release_line, r.first_development_release_year,
       r.version, r.release_date, r.lifecycle_status,
       r.predecessor_release, r.successor_release,
       r.release_evidence_url_s
ORDER BY a.name, r.release_date;

// Q6. Which mapping relationships exist, through which projects or studies, and with what test scope?
MATCH (source)<-[:MAPPING_SOURCE]-(m:MappingArtifact)-[:MAPPING_TARGET]->(target)
RETURN m.uid, m.name,
       source.uid, source.name, m.source_version,
       target.uid, target.name, m.target_version,
       m.direction, m.mapping_type, m.implementing_software_tool,
       m.project_study, m.claimed_tested, m.test_scope,
       m.known_loss_exception, m.status, m.artifact_url_doi,
       m.evidence_as_of
ORDER BY m.uid;
