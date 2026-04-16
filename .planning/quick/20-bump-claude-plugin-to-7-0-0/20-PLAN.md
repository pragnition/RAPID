# Quick Task 20: Bump claude-plugin version refs to 7.0.0

**Scope:** The main RAPID project was bumped to v7.0.0 by quick task 19, but user-facing documentation files and planning context files still reference v6.2.0 and v6.3.0. Update all stale version references in these files to v7.0.0.

**Note:** Config/manifest files (`package.json`, `.claude-plugin/plugin.json`, `.planning/config.json`, `.planning/STATE.json`, skill files, CHANGELOG) were already handled by task 19. This task covers the documentation files that were missed.

---

## Task 1: Update user-facing documentation (README.md, DOCS.md, technical_documentation.md)

**Files:**
- `README.md` -- 2 stale references
- `DOCS.md` -- 2 stale references
- `technical_documentation.md` -- 3 stale references

**Action:**

In `README.md`:
1. Line 6: Replace `version-6.2.0` with `version-7.0.0` in the shields.io badge URL
2. Line 142: Replace the changelog line. Change `**v6.3.0** (2026-04-08) -- branding server with SSE auto-reload, opt-in init branding step, deferred update-reminder banner, runtime dependency pinning, context-file refresh.` to `**v7.0.0** (in progress)` since v7.0.0 is the current in-progress milestone

In `DOCS.md`:
1. Line 5: Replace `**Version:** 6.2.0` with `**Version:** 7.0.0`
2. Line 479: Replace `RAPID v6.3.0` with `RAPID v7.0.0`

In `technical_documentation.md`:
1. Line 3: Replace `RAPID v6.3.0` with `RAPID v7.0.0`
2. Line 73: Replace `RAPID v6.3.0` with `RAPID v7.0.0`
3. Line 96: Replace `RAPID v6.3.0` with `RAPID v7.0.0`

**Verification:**
```bash
grep -n '6\.[0-3]\.0' README.md DOCS.md technical_documentation.md | grep -v -E '^\s*$'
```
Expected: Zero matches.

```bash
grep -c '7\.0\.0' README.md DOCS.md technical_documentation.md
```
Expected: README.md: 2, DOCS.md: 2, technical_documentation.md: 3.

**Done when:** No occurrences of `6.2.0` or `6.3.0` remain in README.md, DOCS.md, or technical_documentation.md. All replaced with `7.0.0`.

---

## Task 2: Update planning context files

**Files:**
- `.planning/context/CODEBASE.md` -- 1 stale reference (line 134: `v6.2.0`)
- `.planning/context/ARCHITECTURE.md` -- 2 stale references (line 109: `v6.2.0`, line 111: `v6.2.0`)

**Action:**
In `.planning/context/CODEBASE.md`:
1. Line 134: Replace `v6.2.0` with `v7.0.0`

In `.planning/context/ARCHITECTURE.md`:
1. Line 109: Replace `v6.2.0` with `v7.0.0` in the section header
2. Line 111: Replace `v6.2.0` with `v7.0.0`

**Verification:**
```bash
grep -n '6\.[0-3]\.0' .planning/context/CODEBASE.md .planning/context/ARCHITECTURE.md
```
Expected: Zero matches.

**Done when:** No stale version references remain in `.planning/context/` active files.

---

## Task 3: Final sweep and commit

**Action:**
Run a comprehensive grep to confirm no stale `6.2.0` or `6.3.0` references remain in active (non-archive, non-research, non-node_modules) files:

```bash
grep -rn "6\.2\.0\|6\.3\.0" \
  --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive \
  --exclude-dir=archive --exclude-dir=web . \
  | grep -v '.planning/archive/' \
  | grep -v '.planning/research/' \
  | grep -v '.planning/quick/' \
  | grep -v 'housekeeping.test.cjs' \
  | grep -v 'docs/CHANGELOG.md' \
  | grep -v 'ux-audit.test.cjs'
```

Expected: Zero matches. The exclusions are:
- `.planning/archive/` -- historical records
- `.planning/research/` -- version-specific research
- `.planning/quick/` -- quick task plans reference old versions in their descriptions
- `housekeeping.test.cjs` -- contains intentional historical version checks
- `ux-audit.test.cjs` -- references a historical audit file path
- `docs/CHANGELOG.md` -- historical changelog entries
- `web/` -- dependency versions in package.json/package-lock.json (unrelated to RAPID version)

**Commit:** Single commit with all changes.
```
quick(bump-claude-plugin-to-7-0-0): update stale version refs in docs and context files to 7.0.0
```

Then push to origin.

**Done when:** Commit is on the branch and pushed. No stale RAPID version references remain in active user-facing files.
