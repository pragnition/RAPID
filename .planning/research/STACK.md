# Stack Research: docs-version-bump

## Core Task Assessment

This set performs two operations: (1) bump all version references from 5.0.0 to 6.0.0 across the codebase, and (2) author a comprehensive CHANGELOG.md entry for v6.0.0 summarizing all five completed sets. No runtime code changes, no dependency modifications, no new modules. The research below covers the complete file inventory for the version bump, the changelog source material for each set, edge cases, and verification strategy.

## File Inventory: Version Bump (5.0.0 -> 6.0.0)

### Primary Target Files (from bump-version.md)

| File | Field / Location | Current Value | New Value |
|------|-----------------|---------------|-----------|
| `package.json` | `"version"` (line 3) | `"5.0.0"` | `"6.0.0"` |
| `.claude-plugin/plugin.json` | `"version"` (line 3) | `"5.0.0"` | `"6.0.0"` |
| `.planning/config.json` | `"version"` (line 4) | `"5.0.0"` | `"6.0.0"` |
| `.planning/STATE.json` | `"rapidVersion"` (line 3) | `"5.0.0"` | `"6.0.0"` |
| `docs/CHANGELOG.md` | Add new `## [v6.0.0]` section | N/A | New entry |
| `skills/help/SKILL.md` | Lines 20, 108 -- 2 occurrences of `v5.0.0` | `v5.0.0` | `v6.0.0` |
| `skills/install/SKILL.md` | Lines 2, 7, 9, 28, 92, 319, 331 -- 7 occurrences | `v5.0.0` / `5.0.0` | `v6.0.0` / `6.0.0` |
| `skills/status/SKILL.md` | Lines 6, 8, 124, 146, 171 -- 5 occurrences | `v5.0.0` / `5.0.0` | `v6.0.0` / `6.0.0` |

### Additional Files Found by Grep (beyond canonical 8)

| File | Line(s) | Current Reference | Action |
|------|---------|-------------------|--------|
| `DOCS.md` | 5, 438 | `5.0.0` / `v5.0.0` | UPDATE -- user-facing documentation |
| `README.md` | 6 | `version-5.0.0` in shields.io badge URL | UPDATE -- user-facing badge |
| `README.md` | 9 | `Node.js-18%2B` in shields.io badge URL | UPDATE to `Node.js-20%2B` -- prereqs.cjs and package.json engines now require Node 20+ (changed by bug-fixes-foundation) |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | 9 | `placeholder: "e.g., v5.0.0"` | UPDATE -- user-facing template |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | 9 | `placeholder: "e.g., v5.0.0"` | UPDATE -- user-facing template |

### Files to SKIP (per bump-version.md exclusion rules)

| File / Path | Reason |
|-------------|--------|
| `.planning/research/v6.0.0-research-*.md` | Historical research files |
| `.planning/ROADMAP.md` | Line 52 references "5.0.0" in the docs-version-bump set description -- this is the description of the task, not a version reference to update. Past milestone entries (v5.0) are historical. |
| `.planning/sets/docs-version-bump/*.md` | Set planning artifacts referencing 5.0.0 as the source version -- these are historical records of the set's task |
| `.planning/STATE.json` milestone IDs | Past milestone IDs like `"id": "v5.0"` are historical and must NOT be changed |
| `web/frontend/package-lock.json` | The `5.0.0` reference there is `sugarss: "^5.0.0"` -- an unrelated dependency version |
| `node_modules/` | Excluded by grep |

## Changelog Source Material

### v6.0.0 "Scale & Quality" -- 6 sets (5 merged + 1 in progress)

The changelog entry should summarize the 5 completed sets. The docs-version-bump set itself should also be listed since the changelog entry IS part of this set's output.

#### Set 1: bug-fixes-foundation
**Deliverables confirmed from VERIFICATION-REPORT (PASS):**
- Fixed: REQUIREMENTS.md overwrite by scaffoldProject() -- content guard prevents clobbering user-approved encoded criteria
- Fixed: `--desc` / `--description` flag mismatch in init CLI parser -- added `--description` alias
- Fixed: Roadmapper Step 9 overwrites STATE.json -- implemented `mergeStatePartial()` for atomic state merging
- Changed: Bumped Node.js minimum from 18 to 20+ in prereqs.cjs and package.json engines
- Changed: Replaced `execSync` with `execFileSync` in worktree.cjs to prevent shell injection (5 call sites)
- Added: `fileOwnership` field to CONTRACT_META_SCHEMA
- Fixed: `recalculateDAG()` now preserves existing node annotations (group, priority, description)

#### Set 2: dag-central-grouping
**Deliverables confirmed from VERIFICATION-REPORT (PASS_WITH_GAPS, non-blocking):**
- Added: DAGv3 schema with optional `group`, `priority`, `description` fields on nodes and top-level `groups` summary
- Added: Auto-migration from v1/v2 to v3 via `tryLoadDAG()` with version auto-detection
- Added: Developer group partitioning algorithm in new `group.cjs` module (`partitionIntoGroups()`, `annotateDAGWithGroups()`, `generateGroupReport()`)
- Added: `syncDAGStatus()` centralizing DAG-to-STATE status synchronization
- Added: `dag groups` and `dag regroup --team-size N` CLI subcommands
- Changed: `dag show` extended with group badges and cross-group edge markers
- Changed: Roadmapper role module outputs group assignment guidance for team-size > 1

#### Set 3: init-enhancements
**Deliverables confirmed from VERIFICATION-REPORT (PASS_WITH_GAPS, non-blocking):**
- Added: `--spec <path>` flag for `/rapid:init` to seed research pipeline with pre-written spec content
- Added: Meta-principles capture during init -- new `principles.cjs` module with `generatePrinciplesMd()`, `generateClaudeMdSection()`, `loadPrinciples()`
- Added: `.planning/PRINCIPLES.md` generated during init when principles are captured
- Changed: Worktree-scoped CLAUDE.md files gain optional principles summary section
- Changed: All 6 research role modules updated to accept and tag spec-sourced assertions with `[FROM SPEC]`

#### Set 4: scaffold-overhaul
**Deliverables confirmed from VERIFICATION-REPORT (PASS_WITH_GAPS, non-blocking):**
- Changed: `generateStub()` rewritten for high-fidelity return values with `// RAPID-STUB` first-line marker and `.rapid-stub` zero-byte sidecar files
- Added: Group-aware stub orchestration via `generateGroupStubs()` consuming DAG group partitions
- Added: `createFoundationSet()` for optional foundation set #0 with `foundation:true` DAG annotation
- Added: `scaffold verify-stubs` CLI subcommand for stub replacement status reporting
- Added: Scaffold-report v2 with groups, stubs, and foundationSet fields
- Added: Merge pipeline T0 auto-resolution rule (`tryStubAutoResolve()`) -- real implementation wins over stubs
- Added: `isRapidStub()` detection for first-line marker

#### Set 5: agent-namespace-enforcement
**Deliverables confirmed from VERIFICATION-REPORT (PASS):**
- Changed: Strengthened Namespace Isolation in `core-identity.md` with imperative MUST/MUST NOT directives and explicit deny-list
- Fixed: Swept 10 role module files to fix 43 unprefixed agent/skill references
- Changed: All 27 agents regenerated with updated identity module (4 SKIP agents manually synced, 23 rebuilt via `build-agents`)

## Changelog Entry Format

Based on the existing CHANGELOG.md format (Keep a Changelog), the new entry should follow this structure:

```markdown
## [v6.0.0] Scale & Quality (shipped YYYY-MM-DD)

### Added
- [items from all sets]

### Changed
- [items from all sets]

### Fixed
- [items from all sets]
```

Each line item should include the set ID in parentheses at the end, e.g., `(bug-fixes-foundation)`. The shipped date should be the date the version bump is merged.

## Edge Cases and Risks

### Version String Matching
- **Risk:** Regex `5\.0\.0` could match unrelated strings. In this codebase, the only false positive found is `sugarss: "^5.0.0"` in `web/frontend/package-lock.json`, which is correctly excluded.
- **Mitigation:** The grep command from bump-version.md with `--exclude-dir` flags handles this cleanly.

### Node.js Badge in README.md
- **Finding:** The `bug-fixes-foundation` set bumped Node.js minimum from 18 to 20 in both `prereqs.cjs` (line 115) and `package.json` engines. However, the README.md badge still says `Node.js-18%2B`. This should be updated to `Node.js-20%2B` as part of this version bump to reflect the actual requirement.
- **Confidence:** Confirmed via codebase inspection -- `prereqs.cjs` line 115 shows `minVersion: '20'` and `package.json` line 7 shows `"node": ">=20"`.

### STATE.json Historical Milestone IDs
- **Risk:** The STATE.json contains historical milestone IDs like `"id": "v5.0"` that must NOT be changed. Only the `rapidVersion` field at the top level should be updated.
- **Mitigation:** Use targeted field-level edits, not global find-and-replace on STATE.json.

### ROADMAP.md docs-version-bump Description
- **Finding:** ROADMAP.md line 52 contains the text "bump all version references from 5.0.0 to 6.0.0" as the description of the docs-version-bump set. This is a task description, not a version reference. It should NOT be changed.
- **Confidence:** High -- this describes what the set does, not what version the project is.

## Verification Strategy

After completing all edits, run this command to verify no stale references remain:

```bash
grep -rn "5\.0\.0" --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive --exclude-dir=archive .
```

Expected remaining hits (all acceptable):
- `.planning/research/v6.0.0-research-*.md` -- historical research files
- `.planning/sets/docs-version-bump/*.md` -- set planning artifacts describing the 5.0.0->6.0.0 task
- `.planning/ROADMAP.md` -- docs-version-bump set description referencing "from 5.0.0 to 6.0.0"
- `.planning/STATE.json` -- historical milestone ID `"v5.0"`
- `web/frontend/package-lock.json` -- unrelated `sugarss: "^5.0.0"` dependency

## Summary

Total files requiring edits: **13** (8 canonical + 5 additional found by grep sweep)

| Category | Files | Edit Type |
|----------|-------|-----------|
| JSON config (4) | package.json, plugin.json, config.json, STATE.json | Field-level version bump |
| Skill markdown (3) | help/SKILL.md, install/SKILL.md, status/SKILL.md | Global find-replace `5.0.0` -> `6.0.0` |
| User-facing docs (2) | DOCS.md, README.md | Version string + Node.js badge update |
| GitHub templates (2) | bug-report.yml, feature-request.yml | Placeholder version update |
| Changelog (1) | docs/CHANGELOG.md | New v6.0.0 section with set summaries |
| Read-only (1) | bump-version.md | Reference guide -- DO NOT MODIFY |
