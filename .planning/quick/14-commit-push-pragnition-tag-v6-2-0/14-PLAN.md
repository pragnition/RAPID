# Quick Task 14: Commit, Push to pragnition/RAPID, and Tag v6.2.0

## Objective

Stage all current working tree changes, commit them, push to the `pragnition` remote on `main`, and create + push the `v6.2.0` tag.

## Context

Current working tree state:
- **Modified**: `.rapid-web/kanban/board.json` (new kanban card for shell update bug)
- **Deleted**: `todo.md` (removed)
- **Untracked**: `tood.md` (feature/bug notes file)

No existing v6.x tags exist in the local repo. The latest commit is `71e6094` (v6.2.0 audit report).

---

## Task 1: Stage and Commit All Changes

**Files**: `.rapid-web/kanban/board.json`, `todo.md` (deletion), `tood.md` (new)

**Action**:
1. Stage the modified file: `git add .rapid-web/kanban/board.json`
2. Stage the deletion: `git rm todo.md` (or `git add todo.md` to stage the delete)
3. Stage the new file: `git add tood.md`
4. Commit with message: `chore: update kanban board and task notes for v6.2.0`

**Verification**:
```bash
git status --short
# Should show nothing (clean working tree)
git log -1 --oneline
# Should show the new commit with the expected message
```

**Done when**: `git status` reports a clean working tree and the commit exists at HEAD.

---

## Task 2: Push to pragnition/RAPID and Tag v6.2.0

**Files**: None (git operations only)

**Action**:
1. Push `main` to the `pragnition` remote: `git push pragnition main`
2. Create an annotated tag: `git tag -a v6.2.0 -m "Release v6.2.0"`
3. Push the tag: `git push pragnition v6.2.0`

**Verification**:
```bash
git log -1 --oneline pragnition/main
# Should match local HEAD
git tag -l v6.2.0
# Should output: v6.2.0
git ls-remote --tags pragnition v6.2.0
# Should show the tag ref on the remote
```

**Done when**: `pragnition/main` matches local `main` HEAD, and the `v6.2.0` tag exists both locally and on the `pragnition` remote.
