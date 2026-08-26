# Git contribution and pull request workflow

Read this reference when the user wants a branch, commit, push, or pull request for reviewed data changes.

## Repository model

The cloned Git repository is the single source of truth. Install the Skill in link mode so Codex and Claude Code execute the same `SKILL.md` and edit the same working tree:

```bash
python3 scripts/install-skill.py --target all
```

Use `--target codex` or `--target claude` for one client. Use `--mode copy` only when links are unavailable; the installer writes a repository-root marker so query and PR helpers still locate the clone.

## Branch and remote model

- Base repository: `jianchuanqi/global-lca-asset`
- Base branch: `main`
- Contributors without base-repository write permission work from a personal fork.
- Keep `origin` as the writable fork and optionally add the base repository as `upstream`.
- Create one `review/<date>-<slug>` branch per coherent evidence review or correction.
- Never commit directly to `main`, force-push, merge, or rewrite unrelated user work.

## Local contribution flow

1. Inspect `git status`, current branch, remotes, and the diff base.
2. If still on `main`, create a review branch before making the contribution.
3. Make only the authorized data, Skill, documentation, baseline, and generated-output changes.
4. Run the validation sequence in `data-editing.md`.
5. Show the user the material data changes, evidence, count impact, remaining warnings, and tests.
6. Stage only intended paths and create a descriptive commit when the user has asked for a commit or PR.
7. Prepare a PR body from `assets/review-pr-body.md`.

## External-write boundary

- If the user asks only to modify or prepare a contribution, stop with a validated local branch and PR-ready body.
- Push and create a PR only when the user explicitly asks to open, create, submit, or directly make the PR.
- Before submission, require a clean working tree and a non-`main` branch. Never include unrelated pre-existing edits.
- Creating a PR does not authorize merging it.

Preview the exact external commands without changing GitHub:

```bash
skills/global-lca-asset-review/scripts/review_pr.py \
  --title "data: review <topic>" \
  --body-file /path/to/pr-body.md
```

After explicit authorization, rerun with `--submit`. The helper pushes the current branch to `origin`, then uses `gh pr create` against `jianchuanqi/global-lca-asset:main`. It refuses detached HEAD, `main`, a dirty tree, unsupported remotes, and missing GitHub CLI authentication.

## PR content

The PR must state:

- the affected asset and evidence IDs;
- the exact factual claims changed;
- public URLs and access dates;
- counting, identity, access, compatibility, mapping, and release impact;
- package version/evidence cutoff changes;
- validation commands and outcomes;
- remaining uncertainty or expert-review questions.
