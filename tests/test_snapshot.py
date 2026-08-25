from collections import Counter

from global_lca_asset.models import GraphSnapshot


def test_seed_builds_complete_public_graph(snapshot: GraphSnapshot) -> None:
    assert snapshot.metadata["asset_count"] == 214
    assert snapshot.metadata["evidence_count"] == 252
    assert snapshot.metadata["release_count"] == 310
    assert snapshot.metadata["distribution_count"] == 170
    assert snapshot.metadata["mapping_count"] == 25
    assert snapshot.metadata["relationship_assertion_count"] == 310
    assert len(snapshot.nodes) == 1903
    assert len(snapshot.relationships) == 2721

    labels = Counter(label for node in snapshot.nodes for label in node.labels)
    assert labels["Asset"] == 214
    assert labels["Database"] == 79
    assert labels["Software"] == 43
    assert labels["Schema"] == 14
    assert labels["Assertion"] == 310


def test_snapshot_has_no_dangling_relationships(snapshot: GraphSnapshot) -> None:
    node_ids = {node.uid for node in snapshot.nodes}
    relationship_ids = {relationship.uid for relationship in snapshot.relationships}
    assert len(relationship_ids) == len(snapshot.relationships)
    assert all(rel.start_uid in node_ids and rel.end_uid in node_ids for rel in snapshot.relationships)


def test_public_seed_excludes_restricted_person_fields(snapshot: GraphSnapshot) -> None:
    forbidden = {"contact_information", "reviewer_notes"}
    assert all(forbidden.isdisjoint(node.properties) for node in snapshot.nodes)
    serialized = snapshot.model_dump_json().casefold()
    assert "@gmail.com" not in serialized
    assert "@qq.com" not in serialized


def test_six_review_question_baselines(snapshot: GraphSnapshot) -> None:
    nodes = {node.uid: node for node in snapshot.nodes}
    databases = [node for node in snapshot.nodes if "Database" in node.labels]
    explicitly_open = [
        node
        for node in databases
        if str(node.properties.get("open_data_status", "")).casefold().startswith("open licence confirmed")
    ]
    database_format_links = [
        rel
        for rel in snapshot.relationships
        if rel.type in {"USES_FORMAT", "USES_SCHEMA", "COMPATIBLE_WITH"}
        and "Database" in nodes[rel.start_uid].labels
        and "Asset" in nodes[rel.end_uid].labels
    ]

    assert len(databases) == 79
    assert len(explicitly_open) == 9
    assert len(database_format_links) == 37
    assert sum("Release" in node.labels for node in snapshot.nodes) == 310
    assert sum("MappingArtifact" in node.labels for node in snapshot.nodes) == 25
