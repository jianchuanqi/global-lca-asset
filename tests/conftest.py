from pathlib import Path

import pytest

from global_lca_asset.models import GraphSnapshot
from global_lca_asset.repository import InMemoryGraphRepository
from global_lca_asset.snapshot import build_snapshot_from_path


@pytest.fixture(scope="session")
def seed_path() -> Path:
    return Path(__file__).parents[1] / "data" / "seed" / "inventory-v2.public.json"


@pytest.fixture(scope="session")
def snapshot(seed_path: Path) -> GraphSnapshot:
    return build_snapshot_from_path(seed_path)


@pytest.fixture()
def memory_repository(snapshot: GraphSnapshot) -> InMemoryGraphRepository:
    return InMemoryGraphRepository(snapshot)
