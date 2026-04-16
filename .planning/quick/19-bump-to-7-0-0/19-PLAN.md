# Quick Task 19: Bump Version to 7.0.0

**Scope:** Update RAPID version from `6.3.0` to `7.0.0` across all required files.
**Reference:** `bump-version.md` in project root.

---

## Task 1: Update version fields in config/manifest files

**Files:**
- `package.json` -- `"version"` field
- `.claude-plugin/plugin.json` -- `"version"` field
- `.planning/config.json` -- `"project.version"` field
- `.planning/STATE.json` -- `"rapidVersion"` field (line 3)

**Action:**
Replace the string `"6.3.0"` with `"7.0.0"` in the version field of each file. Use targeted edits (not replace_all) since these files contain other version-like strings that must not change (e.g., milestone IDs in STATE.json, dependency versions).

- `package.json`: `"version": "6.3.0"` -> `"version": "7.0.0"`
- `.claude-plugin/plugin.json`: `"version": "6.3.0"` -> `"version": "7.0.0"`
- `.planning/config.json`: `"version": "6.3.0"` -> `"version": "7.0.0"`
- `.planning/STATE.json`: `"rapidVersion": "6.3.0"` -> `"rapidVersion": "7.0.0"`

**Verification:**
```bash
grep -n '"version": "7.0.0"' package.json .claude-plugin/plugin.json .planning/config.json && \
grep -n '"rapidVersion": "7.0.0"' .planning/STATE.json
```
Expected: 4 matches total (one per file).

**Done when:** All four files show `7.0.0` in their respective version fields. No other fields changed.

---

## Task 2: Update CHANGELOG.md

**Files:**
- `docs/CHANGELOG.md`

**Action:**
1. Replace the current in-progress header:
   - `## [v6.3.0] (in progress)` -> `## [v7.0.0] (in progress)`
2. The v6.3.0 header becomes a shipped entry. Update it with today's ship date:
   - Add a new line after the v7.0.0 block: `## [v6.3.0] (shipped 2026-04-16)`

Concretely, the top of the changelog (after the preamble) should read:
```
## [v7.0.0] (in progress)

This milestone is currently under development. Subsections will be populated by `/rapid:documentation` when the milestone ships.

## [v6.3.0] (shipped 2026-04-16)

This milestone is currently under development. Subsections will be populated by `/rapid:documentation` when the milestone ships.
```

Note: Keep the existing v6.3.0 body text as-is (it will be populated by `/rapid:documentation` later). Only change the header line.

**Verification:**
```bash
head -15 docs/CHANGELOG.md | grep -E 'v7\.0\.0|v6\.3\.0'
```
Expected: Line with `[v7.0.0] (in progress)` and line with `[v6.3.0] (shipped 2026-04-16)`.

**Done when:** v7.0.0 header exists as in-progress, v6.3.0 header shows shipped date of 2026-04-16.

---

## Task 3: Update skill files (replace_all)

**Files:**
- `skills/help/SKILL.md` -- 2 occurrences of `6.3.0`
- `skills/install/SKILL.md` -- 7 occurrences of `6.3.0` (includes description frontmatter)
- `skills/status/SKILL.md` -- 5 occurrences of `6.3.0`

**Action:**
In each file, replace ALL occurrences of `6.3.0` with `7.0.0` using `replace_all: true`. This is safe because skill files only reference the current RAPID version.

**Verification:**
```bash
# Confirm no stale references remain in skill files
grep -c '6\.3\.0' skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md

# Confirm new references exist
grep -c '7\.0\.0' skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md
```
Expected: First command shows 0 for all three files. Second command shows 2, 7, 5 respectively.

**Done when:** Zero occurrences of `6.3.0` in skill files. All replaced with `7.0.0`.

---

## Final Verification

After all tasks, run the comprehensive grep from `bump-version.md` to confirm no stale `6.3.0` references remain in active files:

```bash
grep -rn "6\.3\.0" --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive --exclude-dir=archive --exclude-dir=.planning/archive --exclude-dir=.planning/research .
```

Expected: Zero matches (or only matches in archive/research/historical files which are excluded).

## Commit

Single commit: `chore: bump version to 7.0.0`
