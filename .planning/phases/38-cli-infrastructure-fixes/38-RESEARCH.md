# Phase 38: CLI Infrastructure Fixes - Research

**Researched:** 2026-03-12
**Domain:** Node.js CLI bug fixes (display.cjs, rapid-tools.cjs, SKILL.md)
**Confidence:** HIGH

## Summary

Phase 38 addresses three specific bugs introduced in Phase 37.1 that break the end-to-end flows of `/rapid:migrate` and `/rapid:quick` commands. All three bugs were identified by the v2.2 Milestone Audit and are well-documented with exact file locations, line numbers, and root causes. This is a pure fix phase with no design ambiguity.

The bugs are: (1) `display.cjs` missing `migrate` and `quick` stage entries in STAGE_VERBS and STAGE_BG maps, causing "Unknown stage" fallback banners; (2) `handleQuick` in `rapid-tools.cjs` using `args.join(' ')` for the `add` subcommand, which concatenates `--commit` and `--dir` flags into the description string instead of parsing them; (3) `skills/migrate/SKILL.md` Step 7 calling `display status` which is not a valid subcommand of `handleDisplay` (only `banner` is valid).

**Primary recommendation:** Fix all three bugs directly in the source files, update existing tests to cover the new stage entries and flag parsing, and verify end-to-end with CLI invocation tests.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-03 | /quick command with state tracking (gap closure) | display.cjs needs `quick` stage entries; handleQuick `add` needs --commit/--dir flag parsing instead of args.join(' ') |
| FIX-04 | /migrate command with framework detection (gap closure) | display.cjs needs `migrate` stage entries; migrate SKILL.md Step 7 must replace `display status` with a valid subcommand |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v25.8.0 (project runtime) | Runtime for all CLI tools | Project standard |
| node:test | built-in | Test runner | Already used across all 27+ test files in project |
| node:assert/strict | built-in | Test assertions | Already used across all test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (installed) | Schema validation for STATE.json | Already used by quick.cjs via state-schemas.cjs |

### Alternatives Considered
None. This is a bug fix phase operating on existing infrastructure with no new dependencies.

**Installation:**
No new packages needed. All fixes use existing project dependencies.

## Architecture Patterns

### Existing Project Structure (relevant files)
```
src/
├── bin/
│   └── rapid-tools.cjs        # CLI entry point, dispatch to handlers
├── lib/
│   ├── display.cjs             # Banner rendering (STAGE_VERBS, STAGE_BG, renderBanner)
│   ├── display.test.cjs        # Tests for display module (22 tests)
│   ├── quick.cjs               # Quick task library (addQuickTask accepts description, commitHash, directory)
│   ├── quick.test.cjs          # Tests for quick module (8 tests, including commitHash/directory test)
│   ├── migrate.cjs             # Migration library (detectFramework, backupPlanning, transformToRapid)
│   └── migrate.test.cjs        # Tests for migrate module (9 tests)
skills/
├── migrate/
│   └── SKILL.md                # Migration skill (Step 7 has the bug: `display status`)
└── quick/
    └── SKILL.md                # Quick task skill (Step 6 documents --commit/--dir flags)
```

### Pattern 1: Stage Map Extension
**What:** STAGE_VERBS and STAGE_BG are plain JS objects mapping stage name strings to display values. Adding a new stage requires adding entries to both maps.
**When to use:** Whenever a new RAPID stage/command needs a display banner.
**Example:**
```javascript
// Source: src/lib/display.cjs (existing pattern)
const STAGE_VERBS = {
  'init': 'INITIALIZING',
  'set-init': 'PREPARING',
  // ... existing entries ...
  'migrate': 'MIGRATING',     // NEW
  'quick': 'QUICK TASK',      // NEW
};

const STAGE_BG = {
  'init': '\x1b[104m',        // bright blue
  // ... existing entries ...
  'migrate': '\x1b[105m',     // bright magenta (utility stage)
  'quick': '\x1b[105m',       // bright magenta (utility stage)
};
```

**Color grouping convention (from display.cjs comments):**
- Planning stages (init, set-init, discuss, wave-plan, plan-set): bright blue `\x1b[104m`
- Execution stages (execute): bright green `\x1b[102m`
- Review stages (review, merge): bright red `\x1b[101m`
- Utility stages (migrate, quick): bright magenta `\x1b[105m` (suggested -- new group for non-lifecycle commands)

Alternatively, `migrate` could use bright blue (planning-adjacent) and `quick` could use bright green (execution-adjacent). The choice is at the planner/executor's discretion.

### Pattern 2: CLI Flag Parsing in handleQuick
**What:** The `handleQuick` function's `add` case currently does `args.join(' ')` to build the description. It needs to parse `--commit` and `--dir` flags before joining the remaining args as description.
**When to use:** This is the fix for `handleQuick` in rapid-tools.cjs.
**Example:**
```javascript
// Source: src/bin/rapid-tools.cjs handleQuick (current broken code)
case 'add': {
  const description = args.join(' ');  // BUG: --commit and --dir become part of description
  // ...
}

// FIXED version:
case 'add': {
  let commitHash = null;
  let directory = null;
  const descParts = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--commit' && i + 1 < args.length) {
      commitHash = args[++i];
    } else if (args[i] === '--dir' && i + 1 < args.length) {
      directory = args[++i];
    } else {
      descParts.push(args[i]);
    }
  }

  const description = descParts.join(' ');
  if (!description) {
    error('Description required. Usage: rapid-tools quick add <description> [--commit <hash>] [--dir <dir>]');
    process.exit(1);
  }
  const task = await addQuickTask(statePath, description, commitHash, directory);
  output(JSON.stringify(task));
  break;
}
```

### Pattern 3: SKILL.md Step 7 Fix (migrate)
**What:** `skills/migrate/SKILL.md` line 178 calls `node "${RAPID_TOOLS}" display status` but `handleDisplay` only accepts `banner` as a subcommand.
**When to use:** The fix for migrate SKILL.md Step 7.
**Options:**
1. Replace with `node "${RAPID_TOOLS}" state get --all` -- outputs full STATE.json (machine-readable, may be verbose)
2. Replace with prose output -- just print a success message and suggest `/rapid:status`
3. Replace with `node "${RAPID_TOOLS}" display banner migrate "Migration Complete"` -- at least shows a styled banner

**Recommended:** Option 2 -- remove the CLI call entirely and replace with prose. The Step 7 purpose is verification output for the user, not programmatic state retrieval. The SKILL.md already says "Display: Migration complete" as prose after the CLI call. The `display status` call was attempting to show project status, but no such subcommand exists and `state get --all` would dump raw JSON which is not user-friendly. Simply display the completion message as prose and suggest `/rapid:status` as next step.

### Anti-Patterns to Avoid
- **Concatenating all args without flag parsing:** This is the exact bug in handleQuick. Always parse known flags before joining remaining args as a free-text value.
- **Assuming subcommands exist without checking:** The `display status` call in SKILL.md was written without verifying that `handleDisplay` actually handles `status`. Always cross-reference SKILL.md instructions against the actual CLI handler.
- **Adding display subcommands for one-off needs:** Don't create a `display status` handler just to make the broken SKILL.md work. The correct fix is to update SKILL.md to use existing infrastructure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flag parsing | Custom regex-based parser | Simple loop extraction (see Pattern 2) | This is a 3-flag max case; a library like yargs/commander is overkill for a handler that parses 2 optional flags |
| ANSI color codes | Color library (chalk, etc.) | Raw ANSI escape codes | Project convention -- display.cjs explicitly uses raw codes for zero dependencies |

**Key insight:** This phase fixes bugs in existing code. No new infrastructure is needed. The fixes are surgical edits to existing patterns.

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests
**What goes wrong:** display.test.cjs has hard-coded "8 stages" counts and explicit stage lists. Adding migrate/quick entries will cause existing test assertions to fail if the test expectations are not updated.
**Why it happens:** Tests enumerate expected stages explicitly (lines 19, 48, 150, 170).
**How to avoid:** Update test expectations to include 10 stages (8 existing + migrate + quick). Update every stage list in the test file.
**Warning signs:** Test assertion "maps all 8 stages" fails immediately.

### Pitfall 2: Banner Width Inconsistency
**What goes wrong:** display.test.cjs line 180-196 checks that all banners have consistent padded width (50 chars visible). New stage verbs with different lengths could affect this.
**Why it happens:** `renderBanner` pads to 50 chars. If a verb like "MIGRATING" + "RAPID" + decorations exceeds 50 chars, the padding becomes zero but the test expects consistent width.
**How to avoid:** Choose verb strings that keep the banner within 50 chars. "MIGRATING" (9 chars) and "QUICK TASK" (10 chars) are both safe -- the longest existing verb is "PLANNING SET" (12 chars).
**Warning signs:** Width consistency test fails after adding new stages.

### Pitfall 3: Flag Order Sensitivity in handleQuick
**What goes wrong:** If the flag parser assumes a fixed order (e.g., description first, then --commit, then --dir), CLI calls with different orderings will break.
**Why it happens:** SKILL.md shows `quick add "{description}" --commit "{hash}" --dir "{dir}"` but callers might reorder.
**How to avoid:** Use a loop that handles flags in any position (see Pattern 2 above). All non-flag args become the description.
**Warning signs:** Tests with reordered flags fail.

### Pitfall 4: Quoted Strings with Spaces in CLI Args
**What goes wrong:** When SKILL.md calls `node "${RAPID_TOOLS}" quick add "Fix login button" --commit "abc123"`, the shell splits this into `['Fix', 'login', 'button', '--commit', 'abc123']` (without quotes). The flag parser must handle multi-word descriptions.
**Why it happens:** Shell word splitting removes quotes before Node.js sees the args.
**How to avoid:** The loop approach naturally handles this -- all non-flag tokens get joined with spaces. The description `"Fix login button"` arrives as three separate args `['Fix', 'login', 'button']` which get joined back to `'Fix login button'`.
**Warning signs:** Single-word descriptions work but multi-word descriptions get truncated.

## Code Examples

Verified patterns from the actual codebase:

### Current display.cjs State (needs fix)
```javascript
// Source: src/lib/display.cjs lines 21-50
// Missing: 'migrate' and 'quick' entries in both maps
const STAGE_VERBS = {
  'init': 'INITIALIZING',
  'set-init': 'PREPARING',
  'discuss': 'DISCUSSING',
  'wave-plan': 'PLANNING',
  'plan-set': 'PLANNING SET',
  'execute': 'EXECUTING',
  'review': 'REVIEWING',
  'merge': 'MERGING',
};

const STAGE_BG = {
  'init': '\x1b[104m',
  'set-init': '\x1b[104m',
  'discuss': '\x1b[104m',
  'wave-plan': '\x1b[104m',
  'plan-set': '\x1b[104m',
  'execute': '\x1b[102m',
  'review': '\x1b[101m',
  'merge': '\x1b[101m',
};
```

### Current handleQuick (needs fix)
```javascript
// Source: src/bin/rapid-tools.cjs lines 2839-2872
case 'add': {
  const description = args.join(' ');  // BUG: flags become part of description
  if (!description) {
    error('Description required. Usage: rapid-tools quick add <description>');
    process.exit(1);
  }
  const task = await addQuickTask(statePath, description);  // BUG: commitHash and directory never passed
  output(JSON.stringify(task));
  break;
}
```

### addQuickTask Signature (already correct)
```javascript
// Source: src/lib/quick.cjs lines 67-86
// Already accepts commitHash and directory -- just not called with them
async function addQuickTask(statePath, description, commitHash, directory) {
  // ...
  if (commitHash) newTask.commitHash = commitHash;
  if (directory) newTask.directory = directory;
  // ...
}
```

### Current migrate SKILL.md Step 7 (needs fix)
```markdown
<!-- Source: skills/migrate/SKILL.md lines 174-178 -->
## Step 7: Verification
Display: "Migration complete. Running `/rapid:status` to verify..."
```bash
node "${RAPID_TOOLS}" display status   <!-- BUG: 'status' is not a valid display subcommand -->
```

### handleDisplay (only accepts 'banner')
```javascript
// Source: src/bin/rapid-tools.cjs lines 2817-2837
function handleDisplay(subcommand, args) {
  const { renderBanner } = require('../lib/display.cjs');
  switch (subcommand) {
    case 'banner': {  // ONLY valid subcommand
      // ...
    }
    default:
      error(`Unknown display subcommand: ${subcommand}`);
      process.exit(1);
  }
}
```

### Test Pattern (node:test framework)
```javascript
// Source: src/lib/display.test.cjs (project test convention)
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
// Tests use node:test built-in runner, run with: node --test <file>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 8 stages in display maps | Needs 10 (+ migrate, quick) | Phase 37.1 added commands | Banners show "Unknown stage" fallback |
| args.join(' ') for quick add | Needs flag parsing | Phase 37.1 added quick skill | --commit/--dir flags corrupted into description |
| display status in SKILL.md | Needs valid subcommand | Phase 37.1 wrote SKILL.md | Migrate flow breaks at Step 7 |

**Root cause of all three bugs:** Phase 37.1 created the library code (quick.cjs, migrate.cjs), test files, and SKILL.md files in separate plans (37.1-01 for libraries, 37.1-04 for skills), but the CLI handler (rapid-tools.cjs handleQuick) and display module (display.cjs) were not updated to match the SKILL.md expectations.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (Node.js built-in, v25.8.0) |
| Config file | none (built-in, no config needed) |
| Quick run command | `node --test src/lib/display.test.cjs src/lib/quick.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs src/bin/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-03a | display.cjs STAGE_VERBS has `quick` entry | unit | `node --test src/lib/display.test.cjs` | Exists but needs update (currently checks 8 stages, needs 10) |
| FIX-03b | handleQuick `add` parses --commit flag | unit | `node --test src/lib/quick.test.cjs` | Exists (tests addQuickTask with commitHash) but no CLI-level test |
| FIX-03c | handleQuick `add` parses --dir flag | unit | `node --test src/lib/quick.test.cjs` | Exists (tests addQuickTask with directory) but no CLI-level test |
| FIX-04a | display.cjs STAGE_VERBS has `migrate` entry | unit | `node --test src/lib/display.test.cjs` | Exists but needs update |
| FIX-04b | migrate SKILL.md Step 7 uses valid subcommand | manual | Read SKILL.md, verify no `display status` call | N/A (prose fix) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/display.test.cjs src/lib/quick.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs src/bin/*.test.cjs`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `src/lib/display.test.cjs` -- update stage count from 8 to 10, add migrate/quick to all stage lists
- [ ] CLI-level test for `handleQuick add` with --commit/--dir flags (could be added to rapid-tools.test.cjs or as inline test in quick.test.cjs)

## Open Questions

1. **Color choice for migrate and quick stages**
   - What we know: Existing color groups are blue (planning), green (execution), red (review). migrate and quick don't fit neatly into any existing group.
   - What's unclear: Whether to create a new "utility" color group (magenta) or assign to existing groups.
   - Recommendation: Use bright magenta (`\x1b[105m`) for both as a new "utility" group. This visually distinguishes them from lifecycle stages. Planner has discretion.

2. **Verb choice for quick stage**
   - What we know: Other verbs are gerund form (INITIALIZING, PLANNING, EXECUTING, etc.)
   - What's unclear: Best verb -- "QUICK TASK" breaks the gerund pattern. Alternatives: "EXECUTING" (same as execute stage, confusing) or just "QUICK" (terse).
   - Recommendation: "QUICK TASK" is acceptable since it maps to the concept. Alternatively "RUNNING" as a generic gerund.

## Sources

### Primary (HIGH confidence)
- `src/lib/display.cjs` -- read directly, verified STAGE_VERBS/STAGE_BG maps missing migrate/quick
- `src/bin/rapid-tools.cjs` -- read directly, verified handleQuick `add` case uses args.join(' ') without flag parsing, handleDisplay only accepts 'banner'
- `src/lib/quick.cjs` -- read directly, verified addQuickTask already accepts commitHash and directory params
- `skills/migrate/SKILL.md` -- read directly, verified Step 7 calls `display status`
- `skills/quick/SKILL.md` -- read directly, verified Step 6 documents --commit/--dir flag usage
- `src/lib/display.test.cjs` -- read directly, verified 22 tests checking exactly 8 stages
- `src/lib/quick.test.cjs` -- read directly, verified 8 tests including commitHash/directory test
- `.planning/v2.2-MILESTONE-AUDIT.md` -- read directly, all three bugs documented with root cause analysis

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct source code inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all fixes use existing project infrastructure
- Architecture: HIGH - all patterns are direct readings of existing source code
- Pitfalls: HIGH - identified from actual test file analysis and code structure

**Research date:** 2026-03-12
**Valid until:** Indefinite (bug fix research against stable source code)
