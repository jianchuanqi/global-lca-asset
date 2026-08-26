#!/usr/bin/env python3
"""Install the repository-owned Skill for Codex and/or Claude Code.

The default link mode keeps the cloned repository as the single source of truth,
so edits made through either agent remain ordinary Git working-tree changes.
"""

from __future__ import annotations

import argparse
import os
import shutil
from dataclasses import dataclass
from pathlib import Path

SKILL_NAME = "global-lca-asset-review"
ROOT_MARKER = ".global-lca-asset-root"


@dataclass(frozen=True)
class InstallTarget:
    name: str
    destination: Path


def project_root() -> Path:
    root = Path(__file__).resolve().parents[1]
    required = [
        root / "skills" / SKILL_NAME / "SKILL.md",
        root / "data" / "package" / "current" / "manifest.json",
        root / ".git",
    ]
    missing = [path for path in required if not path.exists()]
    if missing:
        names = ", ".join(str(path) for path in missing)
        raise SystemExit(f"Run this installer from a complete Git clone; missing: {names}")
    return root


def install_targets(selected: str) -> list[InstallTarget]:
    targets: list[InstallTarget] = []
    if selected in {"codex", "all"}:
        codex_root = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
        targets.append(InstallTarget("Codex", codex_root / "skills" / SKILL_NAME))
    if selected in {"claude", "all"}:
        claude_root = Path(os.environ.get("CLAUDE_CONFIG_DIR", Path.home() / ".claude")).expanduser()
        targets.append(InstallTarget("Claude Code", claude_root / "skills" / SKILL_NAME))
    return targets


def destination_exists(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def already_linked(destination: Path, source: Path) -> bool:
    return destination.is_symlink() and destination.resolve() == source.resolve()


def install_one(target: InstallTarget, source: Path, root: Path, mode: str, dry_run: bool) -> str:
    destination = target.destination
    if already_linked(destination, source):
        return f"{target.name}: already linked at {destination}"
    if destination_exists(destination):
        raise SystemExit(
            f"{target.name} destination already exists: {destination}\n"
            "Move or remove it explicitly, then rerun the installer; existing Skills are never overwritten."
        )

    action = "link" if mode == "link" else "copy"
    if dry_run:
        return f"{target.name}: would {action} {source} -> {destination}"

    destination.parent.mkdir(parents=True, exist_ok=True)
    if mode == "link":
        destination.symlink_to(source, target_is_directory=True)
    else:
        shutil.copytree(source, destination)
        (destination / ROOT_MARKER).write_text(f"{root}\n", encoding="utf-8")
    return f"{target.name}: installed at {destination} ({mode})"


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Global LCA Asset Skill from this Git clone.")
    parser.add_argument(
        "--target",
        choices=("codex", "claude", "all"),
        default="all",
        help="Agent installation target (default: all)",
    )
    parser.add_argument(
        "--mode",
        choices=("link", "copy"),
        default="link",
        help="Link keeps the clone editable; copy is a fallback for systems without symlink support.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = project_root()
    source = root / "skills" / SKILL_NAME
    for target in install_targets(args.target):
        print(install_one(target, source, root, args.mode, args.dry_run))

    if not args.dry_run:
        print("Codex: start a new turn/session if the Skill is not immediately listed.")
        print("Claude Code: existing skill directories reload live; restart if the parent directory was new.")


if __name__ == "__main__":
    main()
