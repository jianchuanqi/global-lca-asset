from __future__ import annotations

import importlib.util
import re
import shutil
import subprocess
import sys
from pathlib import Path
from types import ModuleType

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def installer() -> ModuleType:
    return load_module("global_lca_skill_installer", PROJECT_ROOT / "scripts" / "install-skill.py")


@pytest.fixture(scope="module")
def query_tool() -> ModuleType:
    return load_module(
        "global_lca_query_tool",
        PROJECT_ROOT / "skills" / "global-lca-asset-review" / "scripts" / "lca_query.py",
    )


@pytest.fixture(scope="module")
def pr_tool() -> ModuleType:
    return load_module(
        "global_lca_pr_tool",
        PROJECT_ROOT / "skills" / "global-lca-asset-review" / "scripts" / "review_pr.py",
    )


@pytest.fixture(scope="module")
def candidate_tool() -> ModuleType:
    return load_module(
        "global_lca_candidate_tool",
        PROJECT_ROOT / "skills" / "global-lca-asset-review" / "scripts" / "candidate_queue.py",
    )


def test_installer_links_both_agent_targets(
    installer: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source-skill"
    source.mkdir()
    (source / "SKILL.md").write_text("---\nname: test\ndescription: test\n---\n", encoding="utf-8")
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / "codex"))
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path / "claude"))

    targets = installer.install_targets("all")
    assert [target.name for target in targets] == ["Codex", "Claude Code"]
    for target in targets:
        message = installer.install_one(target, source, PROJECT_ROOT, "link", False)
        assert "installed" in message
        assert target.destination.is_symlink()
        assert target.destination.resolve() == source.resolve()
        assert "already linked" in installer.install_one(target, source, PROJECT_ROOT, "link", False)


def test_installer_copy_records_clone_root(installer: ModuleType, tmp_path: Path) -> None:
    source = tmp_path / "source-skill"
    source.mkdir()
    (source / "SKILL.md").write_text("---\nname: test\ndescription: test\n---\n", encoding="utf-8")
    destination = tmp_path / "installed" / "global-lca-asset-review"
    target = installer.InstallTarget("Codex", destination)

    installer.install_one(target, source, PROJECT_ROOT, "copy", False)

    assert not destination.is_symlink()
    assert (destination / "SKILL.md").is_file()
    assert (destination / installer.ROOT_MARKER).read_text(encoding="utf-8").strip() == str(PROJECT_ROOT)


def test_query_tool_finds_configured_clone(query_tool: ModuleType, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GLOBAL_LCA_ASSET_ROOT", str(PROJECT_ROOT))
    assert query_tool.discover_project_root() == PROJECT_ROOT
    assert query_tool.default_database().is_file()


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM assets",
        "UPDATE assets SET official_name = 'x'",
        "PRAGMA writable_schema = 1",
        "SELECT * FROM assets; DROP TABLE assets",
    ],
)
def test_query_tool_rejects_mutating_sql(query_tool: ModuleType, sql: str) -> None:
    with pytest.raises(ValueError, match="Only read-only"):
        query_tool.validate_readonly_sql(sql)


def test_query_tool_accepts_readonly_sql(query_tool: ModuleType) -> None:
    assert query_tool.validate_readonly_sql("SELECT COUNT(*) FROM assets;") == ("SELECT COUNT(*) FROM assets")


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("git@github.com:contributor/global-lca-asset.git", ("contributor", "global-lca-asset")),
        ("https://github.com/contributor/global-lca-asset.git", ("contributor", "global-lca-asset")),
        ("ssh://git@github.com/contributor/global-lca-asset.git", ("contributor", "global-lca-asset")),
    ],
)
def test_pr_tool_parses_github_remotes(pr_tool: ModuleType, url: str, expected: tuple[str, str]) -> None:
    assert pr_tool.parse_github_repository(url) == expected


def git(repository: Path, *arguments: str) -> None:
    subprocess.run(["git", *arguments], cwd=repository, check=True, capture_output=True, text=True)


def test_pr_tool_requires_clean_non_main_branch(pr_tool: ModuleType, tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    git(repository, "init", "-b", "main")
    git(repository, "config", "user.name", "Test User")
    git(repository, "config", "user.email", "test@example.invalid")
    (repository / "skills" / "global-lca-asset-review").mkdir(parents=True)
    (repository / "skills" / "global-lca-asset-review" / "SKILL.md").write_text(
        "---\nname: global-lca-asset-review\ndescription: test\n---\n", encoding="utf-8"
    )
    git(repository, "add", ".")
    git(repository, "commit", "-m", "initial")
    git(repository, "remote", "add", "origin", "git@github.com:contributor/global-lca-asset.git")

    with pytest.raises(SystemExit, match="directly from main"):
        pr_tool.require_pr_ready(repository, "main", "origin")

    git(repository, "switch", "-c", "review/example")
    (repository / "review.txt").write_text("reviewed\n", encoding="utf-8")
    git(repository, "add", "review.txt")
    git(repository, "commit", "-m", "review data")
    assert pr_tool.require_pr_ready(repository, "main", "origin") == (
        "review/example",
        "contributor",
        "global-lca-asset",
    )

    (repository / "dirty.txt").write_text("not committed\n", encoding="utf-8")
    with pytest.raises(SystemExit, match="working tree is not clean"):
        pr_tool.require_pr_ready(repository, "main", "origin")


def candidate_payload() -> dict[str, object]:
    return {
        "schema_version": "1.0",
        "candidate_id": "CAND-2026-example-database",
        "status": "candidate",
        "official_name": "Example Database",
        "asset_type": "Database / dataset",
        "discovery_date": "2026-08-26",
        "summary": "Public evidence lead for identity and scope review.",
        "public_sources": [
            {
                "url": "https://example.org/database",
                "source_title": "Example database",
                "publisher": "Example organization",
                "access_date": "2026-08-26",
                "supported_claims": ["The provider describes a database."],
            }
        ],
        "duplicate_check": {
            "searched_asset_ids": [],
            "conclusion": "Pending identity and duplicate review",
        },
        "review_questions": ["Is this a distinct database family?"],
    }


def test_candidate_queue_accepts_public_evidence_candidate(candidate_tool: ModuleType) -> None:
    assert candidate_tool.validate_candidate(candidate_payload()) == []


def test_candidate_queue_rejects_personal_email(candidate_tool: ModuleType) -> None:
    payload = candidate_payload()
    payload["summary"] = "Contact reviewer@example.org"
    assert "candidate records must not contain email addresses" in candidate_tool.validate_candidate(payload)


def test_data_update_example_is_linked_from_both_readmes() -> None:
    example = PROJECT_ROOT / "docs" / "data-update-example.md"
    assert example.is_file()
    assert "<NEW_VERSION>" in example.read_text(encoding="utf-8")
    for name in ("README.md", "README.zh-CN.md"):
        readme = (PROJECT_ROOT / name).read_text(encoding="utf-8")
        assert "(docs/data-update-example.md)" in readme


@pytest.mark.parametrize(
    "relative_path",
    ["docs/data-update-example.md", "docs/skill-installation-and-contribution.md"],
)
def test_skill_documentation_shell_examples_are_parseable(relative_path: str) -> None:
    content = (PROJECT_ROOT / relative_path).read_text(encoding="utf-8")
    blocks = re.findall(r"```bash\n(.*?)```", content, flags=re.DOTALL)
    assert blocks
    shell = shutil.which("zsh") or shutil.which("sh")
    assert shell is not None
    for index, block in enumerate(blocks, start=1):
        assert re.search(r"<[^>\n]+>", block) is None, f"unsafe placeholder in block {index}"
        result = subprocess.run([shell, "-n", "-c", block], capture_output=True, text=True)
        assert result.returncode == 0, f"block {index}: {result.stderr}"
