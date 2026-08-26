from __future__ import annotations

import os
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_integration_smoke_reports_actionable_api_preflight_failure() -> None:
    environment = os.environ.copy()
    environment.update(
        {
            "GLOBAL_LCA_API_URL": "http://127.0.0.1:1",
            "GLOBAL_LCA_SMOKE_PREFLIGHT_TIMEOUT_MS": "500",
        }
    )

    result = subprocess.run(
        ["node", "scripts/smoke-test.mjs"],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )

    assert result.returncode == 1
    assert "Global LCA API health preflight could not reach" in result.stderr
    assert "docker compose up -d --build" in result.stderr
    assert "docker compose logs seed api" in result.stderr
    assert " at file:" not in result.stderr


def test_compose_waits_for_an_exact_seed_import_before_starting_api() -> None:
    compose = (PROJECT_ROOT / "compose.yaml").read_text(encoding="utf-8")
    assert 'command: ["global-lca", "import", "--replace", "--wait", "60"]' in compose
    assert "condition: service_completed_successfully" in compose
