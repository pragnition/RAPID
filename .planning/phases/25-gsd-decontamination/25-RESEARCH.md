# Phase 25: GSD Decontamination - Research

**Researched:** 2026-03-09
**Domain:** Source code renaming, YAML frontmatter migration, file archival
**Confidence:** HIGH

## Summary

Phase 25 is a well-scoped cleanup task with minimal risk. The contamination surface is very small: exactly 3 files contain GSD references in product code (`src/lib/init.cjs` line 53, `src/lib/init.test.cjs` lines 90-92, `test/.planning/STATE.md` line 2). All SKILL.md files and agent assembler code already use RAPID-native naming (`rapid-{role}`). The work also includes archiving two legacy directories (`mark2-plans/`, `.review/`) and adding a silent auto-migration function to `rapid-tools.cjs`.

The codebase was audited with case-insensitive grep across all `*.cjs`, `*.js`, and `*.json` files in `src/`. The only GSD references are in `init.cjs` (the STATE.md template string) and its test file. The `skills/` directory is fully clean. The `src/lib/assembler.cjs` already generates `name: rapid-${role}` frontmatter for all agent roles.

**Primary recommendation:** This is a straightforward search-and-replace + migration function + directory move. All changes are verified by running `node --test src/lib/init.test.cjs` (53 tests, currently all passing).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rename `gsd_state_version: 1.0` to `rapid_state_version: 1.0` in `src/lib/init.cjs` (the STATE.md template RAPID generates for user projects)
- Key rename only -- version stays at 1.0 (it represents the state format version, not RAPID's product version)
- Update `src/lib/init.test.cjs` assertions to match the new key name
- Update `test/.planning/STATE.md` test fixture to use `rapid_state_version: 1.0`
- Do NOT modify `.planning/` files in this repo -- those are GSD workflow tool artifacts, not RAPID product code
- Only RAPID product code (src/, skills/, test fixtures) gets cleaned
- Move `mark2-plans/` directory to `.archive/mark2-plans/` -- entire directory is v2.0 planning artifacts, all historical
- Move `.review/` directory to `.archive/review/` -- old review scope artifacts from v1.0/v1.1
- Use `.archive/` (hidden directory) to keep repo root clean
- Add auto-migration logic in `src/bin/rapid-tools.cjs` -- a shared function that any skill calling rapid-tools can trigger
- When `gsd_state_version` is detected in a user's STATE.md, silently rewrite it to `rapid_state_version` (preserving the version number)
- Migration is silent -- no user-facing notice, just do it
- Clean break for new projects: `/rapid:init` generates `rapid_state_version: 1.0` from the start

### Claude's Discretion
- Exact placement of migration function within rapid-tools.cjs
- Whether to add .archive/ to .gitignore or keep it tracked
- Any additional GSD references found during implementation in comments/strings that the grep missed

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLEAN-01 | All GSD references removed from source code, skill files, and agent type definitions | Grep audit confirms only 3 files affected: `src/lib/init.cjs:53`, `src/lib/init.test.cjs:90-92`, `test/.planning/STATE.md:2`. Skills and assembler already clean. |
| CLEAN-02 | Agent types renamed from `gsd-*` to RAPID-native names across all skill files | Already done. `src/lib/assembler.cjs` generates `name: rapid-${role}`. All SKILL.md files reference `rapid-tools:*` and `rapid-{role}`. Zero GSD references in `skills/` directory. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `node:test` | Built-in (Node 18+) | Test runner | Already used by all 53 init tests |
| Node.js `node:assert/strict` | Built-in | Assertions | Already used throughout test suite |
| Node.js `node:fs` | Built-in | File I/O for migration | Already used by init.cjs and rapid-tools.cjs |
| Node.js `node:path` | Built-in | Path manipulation | Already used everywhere |

### Supporting
No additional libraries needed. This phase uses only Node.js built-ins already in the project.

### Alternatives Considered
None -- no new dependencies required.

## Architecture Patterns

### Recommended Project Structure
No new directories or structural changes to `src/`. The only structural change is:
```
.archive/               # NEW: hidden archive directory
  mark2-plans/          # MOVED from mark2-plans/
  review/               # MOVED from .review/
```

### Pattern 1: Silent Auto-Migration in rapid-tools.cjs

**What:** A function that detects `gsd_state_version` in a user's STATE.md and silently rewrites it to `rapid_state_version`.

**When to use:** Called once per rapid-tools invocation, after `findProjectRoot()` succeeds (line ~127 in main()), before dispatching to command handlers.

**Recommended placement:** Define a `migrateStateVersion(cwd)` function near the top of rapid-tools.cjs (after imports, before `main()`). Call it in `main()` right after `cwd = findProjectRoot()` succeeds (line 127), before the `switch (command)` block. This ensures migration happens for ALL commands that need a project root, but NOT for root-free commands (prereqs, init, context).

**Example:**
```javascript
// Source: Derived from existing codebase patterns in rapid-tools.cjs
/**
 * Silently migrate gsd_state_version -> rapid_state_version in STATE.md.
 * Preserves the version number. Runs once per invocation, no-op if already migrated.
 *
 * @param {string} cwd - Project root directory
 */
function migrateStateVersion(cwd) {
  const fs = require('fs');
  const path = require('path');
  const stateMdPath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(stateMdPath)) return;

  const content = fs.readFileSync(stateMdPath, 'utf-8');
  if (!content.includes('gsd_state_version')) return;

  const migrated = content.replace(/gsd_state_version/g, 'rapid_state_version');
  fs.writeFileSync(stateMdPath, migrated);
}
```

**Integration point in main():**
```javascript
// After findProjectRoot() succeeds, before switch(command):
cwd = findProjectRoot();
migrateStateVersion(cwd);  // Silent migration
```

### Pattern 2: Template String Modification

**What:** Direct string replacement in `generateStateMd()` template literal.

**Where:** `src/lib/init.cjs` line 53.

**Change:** Replace `gsd_state_version: 1.0` with `rapid_state_version: 1.0` in the template literal string.

### Pattern 3: Directory Archival via git mv

**What:** Move legacy directories to `.archive/` using `git mv` to preserve history.

**Commands:**
```bash
mkdir -p .archive
git mv mark2-plans .archive/mark2-plans
git mv .review .archive/review
```

### Anti-Patterns to Avoid
- **Modifying `.planning/` files:** The CONTEXT.md explicitly states these are workflow tool artifacts, not product code. Do NOT touch `.planning/STATE.md` in this repo -- it belongs to the GSD workflow tool, not to RAPID product code.
- **Adding version bumps to the migration:** The version number (1.0) stays the same. It represents STATE.md format version, not RAPID product version.
- **Noisy migration:** The migration is silent. No console output, no warnings, no user notifications.
- **Regex over-matching in migration:** Use exact string match `gsd_state_version`, not a broad regex that could catch unintended content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing for migration | Custom YAML parser | Simple string `.includes()` + `.replace()` | The `gsd_state_version` key appears in a well-known position in STATE.md YAML frontmatter. A full YAML parser is overkill; string replacement is safe because the key name is unique and unambiguous. |
| Directory archival | Custom file-by-file copy | `git mv` | Preserves git history tracking. `git mv` handles the move atomically. |

**Key insight:** The contamination surface is so small (3 files, 1 YAML key) that simple string operations are the correct tool. No frameworks or parsers needed.

## Common Pitfalls

### Pitfall 1: Forgetting to update test assertions alongside source changes
**What goes wrong:** Renaming `gsd_state_version` in `init.cjs` but leaving the old assertion in `init.test.cjs` causes test failure.
**Why it happens:** The test name at line 90 says `'contains gsd_state_version'` and the assertion at line 92 checks for the literal string `'gsd_state_version: 1.0'`.
**How to avoid:** Update BOTH the test description string AND the assertion value. Then run `node --test src/lib/init.test.cjs` to verify.
**Warning signs:** Test failure on `generateStateMd > contains gsd_state_version`.

### Pitfall 2: Forgetting the test fixture file
**What goes wrong:** `test/.planning/STATE.md` still contains `gsd_state_version: 1.0` at line 2.
**Why it happens:** It is a fixture file, not source code, and is easy to overlook.
**How to avoid:** The CONTEXT.md explicitly lists this file. Update line 2.
**Warning signs:** A post-implementation grep for `gsd_state_version` across the whole repo still finds hits.

### Pitfall 3: Migrating this repo's own .planning/STATE.md
**What goes wrong:** Editing `.planning/STATE.md` in RAPID's own repo violates the scope decision.
**Why it happens:** A global grep finds it and the developer "fixes" it.
**How to avoid:** The CONTEXT.md decision is clear: ".planning/ files in this repo are GSD workflow tool artifacts, not RAPID product code." Do not touch them.
**Warning signs:** `git diff` shows changes to `.planning/STATE.md`.

### Pitfall 4: Migration function throws on missing STATE.md
**What goes wrong:** A project without STATE.md (e.g., freshly `init`'d with only STATE.json) crashes rapid-tools.
**Why it happens:** Not guarding against missing file.
**How to avoid:** Check `fs.existsSync()` before reading. Return early (no-op) if file does not exist.
**Warning signs:** Any rapid-tools command fails with ENOENT in a project that has STATE.json but no STATE.md.

### Pitfall 5: .archive/ not being tracked in git
**What goes wrong:** If `.archive/` is added to `.gitignore`, the archived files are lost for collaborators.
**Why it happens:** Developer assumes archive = ignored.
**How to avoid:** **Recommendation: keep `.archive/` tracked in git.** These are historical planning artifacts that should be preserved in the repo history. They are not secrets, build artifacts, or generated files. The `.gitignore` currently only ignores: `.rapid-worktrees/`, lock files, `.env`, `node_modules/`, and `agents/`. Archive files are a different category.
**Warning signs:** `git status` shows untracked `.archive/` after the move.

## Code Examples

### Example 1: Updated generateStateMd() in init.cjs (line 53)
```javascript
// Source: src/lib/init.cjs - line 52-53 (before/after)
// BEFORE:
return `---
gsd_state_version: 1.0

// AFTER:
return `---
rapid_state_version: 1.0
```

### Example 2: Updated test assertion in init.test.cjs (lines 90-92)
```javascript
// Source: src/lib/init.test.cjs - lines 90-92 (before/after)
// BEFORE:
it('contains gsd_state_version', () => {
  const result = generateStateMd();
  assert.ok(result.includes('gsd_state_version: 1.0'));
});

// AFTER:
it('contains rapid_state_version', () => {
  const result = generateStateMd();
  assert.ok(result.includes('rapid_state_version: 1.0'));
});
```

### Example 3: Updated test fixture in test/.planning/STATE.md (line 2)
```yaml
# Source: test/.planning/STATE.md - line 2 (before/after)
# BEFORE:
---
gsd_state_version: 1.0

# AFTER:
---
rapid_state_version: 1.0
```

### Example 4: Migration function for rapid-tools.cjs
```javascript
// Source: Recommended new function for src/bin/rapid-tools.cjs
/**
 * Silently migrate gsd_state_version -> rapid_state_version in STATE.md.
 * Preserves the version number. No-op if already migrated or file missing.
 *
 * @param {string} cwd - Project root directory
 */
function migrateStateVersion(cwd) {
  const fs = require('fs');
  const path = require('path');
  const stateMdPath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(stateMdPath)) return;

  const content = fs.readFileSync(stateMdPath, 'utf-8');
  if (!content.includes('gsd_state_version')) return;

  const migrated = content.replace(/gsd_state_version/g, 'rapid_state_version');
  fs.writeFileSync(stateMdPath, migrated);
}
```

### Example 5: Directory archival commands
```bash
# Move legacy directories to .archive/
mkdir -p .archive
git mv mark2-plans .archive/mark2-plans
git mv .review .archive/review
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gsd_state_version` in STATE.md template | `rapid_state_version` | This phase (v2.1) | New projects get RAPID-native key; existing projects auto-migrated |
| `mark2-plans/` and `.review/` at repo root | `.archive/mark2-plans/` and `.archive/review/` | This phase (v2.1) | Cleaner repo root, historical artifacts preserved |

**Already current (no action needed):**
- Agent assembler: Already uses `rapid-${role}` (all roles)
- SKILL.md files: Already reference `rapid-tools:*` and RAPID naming
- `src/modules/roles/`: Zero GSD references
- `src/modules/core/`: Zero GSD references

## Open Questions

1. **Whether to add `.archive/` to `.gitignore`**
   - What we know: Current `.gitignore` only ignores runtime artifacts (worktrees, locks, env, node_modules, generated agents). Archive files are historical planning docs.
   - What's unclear: User preference on repo cleanliness vs. preservability.
   - Recommendation: **Keep `.archive/` tracked** (do NOT add to `.gitignore`). These are historical artifacts with value for future reference. Using `git mv` preserves full history. The `.archive/` prefix (hidden directory) keeps the repo root visually clean without needing gitignore.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (Node 18+) |
| Config file | None needed -- tests are self-contained `.test.cjs` files |
| Quick run command | `node --test src/lib/init.test.cjs` |
| Full suite command | `node --test src/lib/init.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEAN-01 | `generateStateMd()` outputs `rapid_state_version: 1.0` | unit | `node --test src/lib/init.test.cjs` | Exists (update assertion) |
| CLEAN-01 | Test fixture uses `rapid_state_version` | unit | `grep -c rapid_state_version test/.planning/STATE.md` (manual verify) | Exists (update content) |
| CLEAN-01 | Migration function rewrites `gsd_state_version` to `rapid_state_version` | unit | New test needed (see Wave 0 Gaps) | No -- Wave 0 |
| CLEAN-01 | Migration is no-op when already migrated | unit | New test needed (see Wave 0 Gaps) | No -- Wave 0 |
| CLEAN-01 | Migration is no-op when STATE.md missing | unit | New test needed (see Wave 0 Gaps) | No -- Wave 0 |
| CLEAN-02 | Agent types use `rapid-{role}` naming | unit | `node --test src/lib/assembler.test.cjs` | Exists (already passing) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/init.test.cjs`
- **Per wave merge:** `node --test src/lib/init.test.cjs && node --test src/lib/assembler.test.cjs`
- **Phase gate:** Full suite green + `grep -ri 'gsd' src/ --include='*.cjs' --include='*.js'` returns only non-product hits

### Wave 0 Gaps
- [ ] Migration function tests -- new test file or section in `src/lib/init.test.cjs` or `src/bin/rapid-tools.cjs` test:
  - Test: migration rewrites `gsd_state_version` to `rapid_state_version` in a temp STATE.md
  - Test: migration preserves version number
  - Test: migration is no-op when `rapid_state_version` already present
  - Test: migration is no-op when STATE.md does not exist
  - Test: migration does not corrupt other STATE.md content

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection via Grep and Read tools:
  - `src/lib/init.cjs` -- confirmed `gsd_state_version` at line 53 (only GSD reference in source)
  - `src/lib/init.test.cjs` -- confirmed test assertions at lines 90-92
  - `test/.planning/STATE.md` -- confirmed fixture with `gsd_state_version` at line 2
  - `src/lib/assembler.cjs` -- confirmed `rapid-${role}` naming (zero GSD references)
  - `skills/` directory -- confirmed zero GSD references (grep returned empty)
  - `src/modules/` -- confirmed zero GSD references
  - `src/bin/rapid-tools.cjs` -- confirmed zero GSD references, confirmed `findProjectRoot()` at line 127 as migration insertion point
  - `.gitignore` -- confirmed current ignore patterns (no `.archive/` entry)
  - `mark2-plans/` -- confirmed exists with legacy content (`gsd_merge_agent/` subdirectory)
  - `.review/` -- confirmed exists with old review scope artifacts

### Secondary (MEDIUM confidence)
- None needed -- all findings from direct codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, only built-in Node.js modules already in use
- Architecture: HIGH -- migration pattern is simple string replacement; placement in rapid-tools.cjs main() is deterministic
- Pitfalls: HIGH -- all pitfalls identified from direct code inspection, not speculation
- Contamination audit: HIGH -- exhaustive case-insensitive grep across all source files confirms the exact scope

**Research date:** 2026-03-09
**Valid until:** Indefinite -- this is a one-time cleanup phase with no external dependencies
