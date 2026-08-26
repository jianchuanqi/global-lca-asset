#!/usr/bin/env python3
"""Plan or submit a Global LCA Asset review pull request.

Without --submit this command is read-only and prints the exact push/PR plan.
With --submit it pushes the current branch and opens a GitHub pull request.
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import shutil
import subprocess
from pathlib import Path

ROOT_MARKER = ".global-lca-asset-root"
DEFAULT_BASE_REPOSITORY = "jianchuanqi/global-lca-asset"


def run(
    command: list[str],
    *,
    cwd: Path,
    capture: bool = True,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=check,
        text=True,
        capture_output=capture,
    )


def is_project_root(path: Path) -> bool:
    return (path / ".git").exists() and (path / "skills" / "global-lca-asset-review" / "SKILL.md").is_file()


def discover_project_root(explicit: Path | None = None) -> Path:
    candidates: list[Path] = []
    if explicit is not None:
        candidates.append(explicit.expanduser())
    configured = os.environ.get("GLOBAL_LCA_ASSET_ROOT")
    if configured:
        candidates.append(Path(configured).expanduser())

    skill_root = Path(__file__).resolve().parents[1]
    marker = skill_root / ROOT_MARKER
    if marker.is_file():
        marker_value = marker.read_text(encoding="utf-8").strip()
        if marker_value:
            candidates.append(Path(marker_value).expanduser())

    candidates.extend([skill_root, *skill_root.parents])
    current = Path.cwd().resolve()
    candidates.extend([current, *current.parents])
    for candidate in candidates:
        resolved = candidate.resolve()
        if is_project_root(resolved):
            return resolved
    raise SystemExit(
        "Global LCA Asset Git clone not found. Run the repository installer or set GLOBAL_LCA_ASSET_ROOT."
    )


def git(root: Path, *arguments: str) -> str:
    return run(["git", *arguments], cwd=root).stdout.strip()


def parse_github_repository(remote_url: str) -> tuple[str, str]:
    patterns = (
        r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$",
        r"^ssh://git@github\.com/([^/]+)/([^/]+?)(?:\.git)?$",
        r"^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
    )
    for pattern in patterns:
        match = re.match(pattern, remote_url)
        if match:
            return match.group(1), match.group(2)
    raise SystemExit(f"The selected push remote is not a supported GitHub URL: {remote_url}")


def require_pr_ready(root: Path, base_branch: str, remote: str) -> tuple[str, str, str]:
    branch = git(root, "branch", "--show-current")
    if not branch:
        raise SystemExit("Cannot create a PR from a detached HEAD.")
    if branch == base_branch:
        raise SystemExit(
            f"Refusing to create a PR directly from {base_branch}; create a review/* branch first."
        )

    status = git(root, "status", "--porcelain")
    if status:
        raise SystemExit(
            "The working tree is not clean. Review and commit the intended changes before submitting a PR."
        )
    git(root, "diff", "--check", f"{base_branch}...HEAD")

    remote_url = git(root, "remote", "get-url", remote)
    owner, repository = parse_github_repository(remote_url)
    return branch, owner, repository


def command_text(command: list[str]) -> str:
    return shlex.join(command)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Plan or submit the current review branch as a GitHub pull request."
    )
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--base-repo", default=DEFAULT_BASE_REPOSITORY)
    parser.add_argument("--base", default="main")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--title", required=True)
    parser.add_argument("--body-file", type=Path, required=True)
    parser.add_argument("--draft", action="store_true")
    parser.add_argument(
        "--submit",
        action="store_true",
        help="Actually push and open the PR. Omit for a read-only plan.",
    )
    args = parser.parse_args()

    root = discover_project_root(args.project_root)
    body_file = args.body_file.expanduser().resolve()
    if not body_file.is_file():
        raise SystemExit(f"PR body file not found: {body_file}")

    branch, origin_owner, origin_repository = require_pr_ready(root, args.base, args.remote)
    push_command = ["git", "push", "--set-upstream", args.remote, branch]
    head = branch if f"{origin_owner}/{origin_repository}" == args.base_repo else f"{origin_owner}:{branch}"
    pr_command = [
        "gh",
        "pr",
        "create",
        "--repo",
        args.base_repo,
        "--base",
        args.base,
        "--head",
        head,
        "--title",
        args.title,
        "--body-file",
        str(body_file),
    ]
    if args.draft:
        pr_command.append("--draft")

    print(f"Project: {root}")
    print(f"Branch: {branch}")
    print(f"Push: {command_text(push_command)}")
    print(f"PR: {command_text(pr_command)}")
    if not args.submit:
        print("Plan only. Rerun with --submit only after the user explicitly authorizes the external write.")
        return

    if shutil.which("gh") is None:
        raise SystemExit("GitHub CLI (gh) is required to submit the PR.")
    if shutil.which("pnpm") is None:
        raise SystemExit("pnpm is required to verify the data package before submitting the PR.")
    run(["pnpm", "data:verify"], cwd=root, capture=False)
    run(["gh", "auth", "status"], cwd=root, capture=False)
    run(push_command, cwd=root, capture=False)
    result = run(pr_command, cwd=root)
    print(result.stdout.strip())


if __name__ == "__main__":
    main()
