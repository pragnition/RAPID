# Phase 26: Numeric ID Infrastructure - Research

**Researched:** 2026-03-09
**Domain:** CLI argument resolution, ID mapping, skill integration
**Confidence:** HIGH

## Summary

Phase 26 adds numeric shorthand for referencing sets and waves across the RAPID CLI and skill system. The user wants to type `/set-init 1` instead of `/set-init set-01-foundation`, and `/wave-plan 1.1` instead of full set+wave string IDs. The implementation centers on a new `src/lib/resolve.cjs` module with `resolveSet(input, cwd)` and `resolveWave(input, cwd)` functions, a new `resolve` CLI subcommand in `rapid-tools.cjs`, updates to 7+ skill files to call the resolver at the CLI boundary, and display changes to `/rapid:status` to show numeric indices inline.

The codebase already has well-established patterns for this work. `plan.listSets(cwd)` returns alphabetically-sorted set directory names (the data source for numeric indexing). `state-machine.cjs` has `readState()` for wave listings. All CLI subcommands return JSON to stdout. The existing `wave-plan resolve-wave` handler provides a direct precedent for how resolution flows through the system. Skills call `rapid-tools.cjs` via `node "${RAPID_TOOLS}" <command> <subcommand> <args>` -- the resolver follows the same invocation pattern.

**Primary recommendation:** Build `resolve.cjs` as a pure-function library (no I/O side effects beyond reading `.planning/sets/` and `STATE.json`), wire it into `rapid-tools.cjs` as a `resolve` command, then update each skill's argument-handling step to call the resolver first and use the resolved string ID for all subsequent operations.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Numeric IDs are 1-based indices into the alphabetically-sorted set list from `.planning/sets/`
- Dot notation for waves: `1.1` = set 1, wave 1 (wave index within set's waves[] array, also 1-based)
- If input matches `/^\d+$/`, always treat as numeric index -- never try string match for bare integers
- Full string IDs (e.g., `set-01-foundation`) still work identically to before (UX-03)
- Scope: sets and waves only -- job numeric references deferred to a future phase
- New module: `src/lib/resolve.cjs` with `resolveSet(input, cwd)` and `resolveWave(input, cwd)` functions
- `rapid-tools.cjs` exposes a `resolve` CLI subcommand: `rapid-tools resolve set 1` and `rapid-tools resolve wave 1.1`
- Skills call the resolve subcommand at the CLI boundary -- resolution happens once, before dispatching to handlers
- Single call for waves: `resolve wave 1.1` returns both set and wave info in one response
- Resolver output shape for sets: `{"resolvedId": "set-01-foundation", "numericIndex": 1, "wasNumeric": true}`
- Resolver output shape for waves: `{"setId": "set-01-foundation", "waveId": "wave-01", "setIndex": 1, "waveIndex": 1, "wasNumeric": true}`
- Always includes `numericIndex` even when input was a full string ID (enables consistent display)
- Error messages: Out-of-range, zero/negative, malformed dot notation, no STATE.json/no sets -- all with specific wording
- Strict validation: wave dot notation must match `/^\d+\.\d+$/`
- `/rapid:status` shows numeric indices inline: "1: set-01-foundation [executing]"
- Waves indented with dot notation: "  1.1: wave-01 [complete]"
- Jobs shown with triple dot notation in display only: "    1.1.1: job-setup [complete]" (display hint, not functional ref)
- Next-step suggestions from skills use numeric shorthand: "Next: /rapid:wave-plan 1.1"

### Claude's Discretion
- Internal implementation details of resolve.cjs (caching, function signatures beyond the public API)
- Exact error message wording refinements
- Whether resolve subcommand supports a `--format` flag or always outputs JSON
- Test file organization for the new module

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | User can reference sets by numeric index (`/set-init 1`, `/discuss 1`) | `resolveSet()` in resolve.cjs maps numeric input to set string ID via `plan.listSets()` sorted array. Skills updated to call resolver first. |
| UX-02 | User can reference waves by dot notation (`/wave-plan 1.1` = set 1, wave 1) | `resolveWave()` in resolve.cjs parses `N.M` format, resolves set by index then wave by index within `state.milestones[].sets[].waves[]`. |
| UX-03 | Full string IDs still work (backward compatible) | Resolver detects numeric vs string input via regex; string IDs pass through unchanged with `wasNumeric: false`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | N/A | Read `.planning/sets/` directory and `STATE.json` | Already used by `plan.cjs` and `state-machine.cjs` |
| Node.js built-in `path` | N/A | Path manipulation | Already used throughout codebase |
| Zod (existing dep) | existing | Validate resolver input/output shapes | Already used in `state-schemas.cjs` for state validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in (Node 25.8) | Unit testing for resolve.cjs | All resolver tests |
| `node:assert/strict` | built-in | Assertions | All test assertions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reading `.planning/sets/` for set list | Reading STATE.json for set list | Sets directory is the canonical source per `plan.listSets()`. STATE.json is the source for waves within sets. Both are needed. |

**Installation:**
No new dependencies required. All tools are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    resolve.cjs          # NEW: resolveSet(), resolveWave() pure functions
    resolve.test.cjs     # NEW: unit tests for resolve.cjs
    plan.cjs             # EXISTING: listSets() -- data source for set indexing
    state-machine.cjs    # EXISTING: readState() -- data source for wave indexing
    wave-planning.cjs    # EXISTING: resolveWave() -- replaced by new resolver for numeric inputs
  bin/
    rapid-tools.cjs      # MODIFIED: add 'resolve' case to main switch
skills/
  set-init/SKILL.md      # MODIFIED: add resolver step
  discuss/SKILL.md       # MODIFIED: add resolver step
  wave-plan/SKILL.md     # MODIFIED: add resolver step
  execute/SKILL.md       # MODIFIED: add resolver step
  review/SKILL.md        # MODIFIED: add resolver step
  merge/SKILL.md         # MODIFIED: add resolver step
  status/SKILL.md        # MODIFIED: add numeric indices to display
  pause/SKILL.md         # MODIFIED: add resolver step
  resume/SKILL.md        # MODIFIED: add resolver step
  cleanup/SKILL.md       # MODIFIED: add resolver step
  assumptions/SKILL.md   # MODIFIED: add resolver step
```

### Pattern 1: Resolver Module (resolve.cjs)
**What:** Pure-function library that maps numeric indices to string IDs
**When to use:** Called by rapid-tools.cjs `resolve` handler and potentially directly by other lib modules
**Example:**
```javascript
// Source: derived from plan.cjs listSets() and state-machine.cjs patterns
'use strict';

const fs = require('fs');
const path = require('path');

const NUMERIC_SET_PATTERN = /^\d+$/;
const NUMERIC_WAVE_PATTERN = /^\d+\.\d+$/;

/**
 * Resolve a set reference (numeric index or string ID) to full set info.
 *
 * @param {string} input - Numeric index (e.g., "1") or string ID (e.g., "set-01-foundation")
 * @param {string} cwd - Project root directory
 * @returns {{ resolvedId: string, numericIndex: number, wasNumeric: boolean }}
 */
function resolveSet(input, cwd) {
  const plan = require('./plan.cjs');
  const sets = plan.listSets(cwd);

  if (sets.length === 0) {
    throw new Error('No sets found. Run /rapid:plan first to create a project plan with sets.');
  }

  if (NUMERIC_SET_PATTERN.test(input)) {
    const index = parseInt(input, 10);
    if (index <= 0) {
      throw new Error('Invalid index: must be a positive integer.');
    }
    if (index > sets.length) {
      throw new Error(`Set ${index} not found. Valid range: 1-${sets.length}. Use /rapid:status to see available sets.`);
    }
    return {
      resolvedId: sets[index - 1],
      numericIndex: index,
      wasNumeric: true,
    };
  }

  // String ID -- verify it exists and find its index
  const idx = sets.indexOf(input);
  if (idx === -1) {
    throw new Error(`Set '${input}' not found. Available sets: ${sets.join(', ')}`);
  }
  return {
    resolvedId: input,
    numericIndex: idx + 1,
    wasNumeric: false,
  };
}

/**
 * Resolve a wave reference (dot notation or string IDs) to full wave info.
 *
 * @param {string} input - Dot notation (e.g., "1.1") or wave string ID
 * @param {string} cwd - Project root directory
 * @returns {{ setId: string, waveId: string, setIndex: number, waveIndex: number, wasNumeric: boolean }}
 */
function resolveWave(input, cwd) {
  // Implementation reads STATE.json for wave data
  // ...see detailed approach below
}

module.exports = { resolveSet, resolveWave };
```

### Pattern 2: CLI Integration (rapid-tools.cjs resolve handler)
**What:** New `resolve` case in main switch dispatching to resolveSet/resolveWave
**When to use:** Skills call this at the CLI boundary before all other operations
**Example:**
```javascript
// In rapid-tools.cjs main switch:
case 'resolve': {
  const resolveLib = require('../lib/resolve.cjs');
  const target = subcommand; // 'set' or 'wave'
  const input = args[0];

  if (target === 'set') {
    try {
      const result = resolveLib.resolveSet(input, cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(1);
    }
  } else if (target === 'wave') {
    try {
      const result = resolveLib.resolveWave(input, cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      process.exit(1);
    }
  } else {
    error('Usage: rapid-tools resolve set <input> | wave <input>');
    process.exit(1);
  }
  break;
}
```

### Pattern 3: Skill Integration (argument resolution at CLI boundary)
**What:** Each skill adds a resolver step at the beginning before using the set/wave ID
**When to use:** In every skill that accepts set or wave arguments
**Example (set-init/SKILL.md):**
```markdown
## Step 1.5: Resolve Set Reference (NEW)

If a set argument was provided, resolve it through the numeric ID resolver:

\```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>")
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
\```

If the resolve returns an error, display the error message and STOP.
Use `SET_NAME` for all subsequent operations.
```

### Pattern 4: Status Display with Numeric Indices
**What:** `worktree status-v2` or a new status formatting function adds numeric prefixes
**When to use:** In `/rapid:status` skill output
**Example output:**
```
## v2.1 -- Set Dashboard

1: set-01-foundation     [executing]  W1: 3/5 done   .rapid-worktrees/set-01-foundation
2: set-02-api            [pending]    -               not created
3: set-03-ui             [planning]   W1: 0/3 pending .rapid-worktrees/set-03-ui

  1.1: wave-01 [complete]
    1.1.1: job-setup [complete]
    1.1.2: job-schema [complete]
  1.2: wave-02 [executing]
    1.2.1: job-api [executing]
    1.2.2: job-tests [pending]
```

### Anti-Patterns to Avoid
- **Mutating the resolver input in skills:** The resolver is called ONCE at the boundary. After resolution, always use the string ID for all subsequent CLI calls. Never pass numeric IDs deeper into the system.
- **Hardcoding the set list source:** Always use `plan.listSets(cwd)` (reads `.planning/sets/` directory, filters directories, sorts alphabetically). Do not reimplement this logic.
- **Resolving waves by reading sets directory:** Wave indices come from STATE.json, not the filesystem. The set index comes from the sorted directory list, but the wave index comes from the `waves[]` array within the set in STATE.json (matching the `currentMilestone`).
- **Making the resolver async when it doesn't need to be:** `plan.listSets()` is synchronous (uses `readdirSync`). For set resolution, keep it sync. For wave resolution, `readState()` is async, so `resolveWave()` must be async.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Set directory listing | Custom fs.readdir + filter | `plan.listSets(cwd)` | Already handles directory filtering and alphabetical sort |
| STATE.json reading | Custom JSON.parse | `state-machine.readState(cwd)` | Already handles Zod validation, missing file, and error reporting |
| Wave ID lookup in state | Custom nested loop | Consider wrapping existing `wave-planning.resolveWave()` | Already handles ambiguous matches and error messages |

**Key insight:** The set resolution path is simple (sorted directory listing + index lookup). The wave resolution path is more complex because it needs STATE.json data and the existing `wave-planning.resolveWave()` already handles string-based wave ID lookup with ambiguity detection. The new resolver should reuse that logic for string wave IDs and add the numeric path.

## Common Pitfalls

### Pitfall 1: Off-by-One Errors in 1-Based Indexing
**What goes wrong:** Using 0-based array indices when the user expects 1-based numbers, or vice versa
**Why it happens:** JavaScript arrays are 0-based but the user-facing IDs are 1-based
**How to avoid:** Always convert: `sets[index - 1]` for lookup, `idx + 1` for display. Unit test boundaries: index 1 (first), index N (last), index 0 (invalid), index N+1 (out of range).
**Warning signs:** Tests pass for middle elements but fail for first or last

### Pitfall 2: Wave Index Source Mismatch
**What goes wrong:** Wave numeric index doesn't match what the user expects because waves are indexed differently in STATE.json vs display
**Why it happens:** STATE.json `waves[]` array order within a set is the canonical source. If sets have different wave counts or wave IDs are non-sequential, the 1-based index into the array must be used consistently.
**How to avoid:** Always index waves by their position in `set.waves[]` array (1-based). Document that wave 1.1 = first wave in set 1's waves array, regardless of the wave's string ID.
**Warning signs:** `/rapid:status` shows "1.2: wave-03" but user expects wave-02

### Pitfall 3: String IDs That Look Numeric
**What goes wrong:** A set named exactly "1" or "123" would be treated as a numeric index instead of a string ID
**Why it happens:** The regex `/^\d+$/` matches both numeric indices and all-digit string IDs
**How to avoid:** Per the locked decision, if input matches `/^\d+$/`, ALWAYS treat as numeric index. This means set names that are pure digits are not supported as string IDs (they always resolve as indices). This is acceptable since set names in practice are descriptive strings like "set-01-foundation".
**Warning signs:** Edge case in tests -- ensure bare digits always route to numeric resolution

### Pitfall 4: Inconsistent Set Ordering Between Calls
**What goes wrong:** Set 1 resolves to different sets in different calls because the set list changed
**Why it happens:** Sets are indexed by alphabetical order of `.planning/sets/` directory entries. If a set is added or removed between calls, indices shift.
**How to avoid:** Document that numeric indices are ephemeral (not persistent IDs). Include the resolved string ID in all output so users can verify. Status display always shows both: "1: set-01-foundation".
**Warning signs:** User complains "I ran /set-init 1 but got a different set than what /status showed"

### Pitfall 5: Forgetting to Update a Skill
**What goes wrong:** Some skills support numeric IDs but others don't, causing inconsistent UX
**Why it happens:** There are 10+ skill files that accept set/wave arguments. Easy to miss one.
**How to avoid:** Enumerate ALL skills that accept set/wave args. Create a checklist. Verify each skill file was updated.
**Warning signs:** User can use `/set-init 1` but not `/discuss 1`

### Pitfall 6: Async/Sync Mismatch for resolveWave
**What goes wrong:** `resolveWave()` calls `readState()` which is async, but caller treats it as sync
**Why it happens:** `resolveSet()` can be sync (plan.listSets is sync), but `resolveWave()` needs state data from async readState()
**How to avoid:** Make `resolveWave()` async. The CLI handler already uses async/await pattern. Or: provide a sync version that accepts pre-read state as a parameter (recommended for testability).
**Warning signs:** Promise returned instead of result object

## Code Examples

Verified patterns from the existing codebase:

### Set Directory Listing (Existing - plan.cjs)
```javascript
// Source: /home/kek/Projects/RAPID/src/lib/plan.cjs lines 170-182
function listSets(cwd) {
  const setsDir = path.join(cwd, '.planning', 'sets');
  if (!fs.existsSync(setsDir)) {
    return [];
  }
  const entries = fs.readdirSync(setsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
```

### State Reading Pattern (Existing - state-machine.cjs)
```javascript
// Source: /home/kek/Projects/RAPID/src/lib/state-machine.cjs lines 43-63
async function readState(cwd) {
  const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
  if (!fs.existsSync(stateFile)) {
    return null;
  }
  const raw = fs.readFileSync(stateFile, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { valid: false, errors: [{ message: `Invalid JSON: ${err.message}` }] };
  }
  const result = ProjectState.safeParse(parsed);
  if (result.success) {
    return { valid: true, state: result.data };
  }
  return { valid: false, errors: result.error.issues };
}
```

### CLI Handler Pattern (Existing - rapid-tools.cjs)
```javascript
// Source: /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs lines 1109-1170
// The handleSetInit pattern shows how CLI subcommands are structured:
// - Parse args, validate input
// - Call library function
// - Output JSON to stdout
// - Handle errors with JSON error output + process.exit(1)
async function handleSetInit(cwd, subcommand, args) {
  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools set-init create <set-name>');
        process.exit(1);
      }
      try {
        const result = await wt.setInit(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }
    // ...
  }
}
```

### Module Export Pattern (Existing - codebase convention)
```javascript
// CommonJS module.exports pattern used throughout:
module.exports = {
  resolveSet,
  resolveWave,
};
```

### Test Pattern (Existing - wave-planning.test.cjs)
```javascript
// Source: /home/kek/Projects/RAPID/src/lib/wave-planning.test.cjs
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-resolve-test-'));
}
// Tests use temp directories, set up fixtures in beforeEach, clean up in afterEach
```

### Skill Environment Preamble (Existing - all skills)
```bash
# Every skill starts with this env loading block:
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full string IDs only | Numeric shorthand + string IDs | Phase 26 (this phase) | Users type shorter commands |
| `wave-plan resolve-wave <waveId>` for wave lookup | `resolve wave <input>` for unified numeric/string | Phase 26 (this phase) | Single entry point for all resolution |
| Status shows set IDs only | Status shows "N: set-id [status]" | Phase 26 (this phase) | Users can see which number maps to which set |

**Note on existing `wave-plan resolve-wave`:** The current wave resolver (`wave-planning.resolveWave()`) takes a string wave ID and searches STATE.json by matching `wave.id`. The new resolver adds a numeric path (dot notation `N.M`) that resolves to set index + wave index, then delegates to the existing lookup for string inputs. The existing resolver remains in place for backward compatibility -- skills that already call `wave-plan resolve-wave` directly will still work. The new `resolve wave` command adds the numeric layer on top.

## Open Questions

1. **Should resolveWave() be sync or async?**
   - What we know: `readState()` is async (returns Promise). `listSets()` is sync.
   - What's unclear: Whether to make resolveWave async (calls readState internally) or accept pre-read state as a parameter (sync, more testable)
   - Recommendation: Accept `state` as a parameter for the library function (sync, testable). The CLI handler reads state and passes it in. This matches how `wave-planning.resolveWave(state, waveId)` works today.

2. **Should resolveSet also accept state for string ID validation?**
   - What we know: Currently `resolveSet` only needs the filesystem (`.planning/sets/` directory). But STATE.json contains set IDs too.
   - What's unclear: Whether string set IDs should be validated against STATE.json (more correct) or just the filesystem (simpler, matches current `listSets`)
   - Recommendation: Use filesystem only via `plan.listSets()`, matching the locked decision that "Numeric IDs are 1-based indices into the alphabetically-sorted set list from `.planning/sets/`". The filesystem is the canonical source for set enumeration.

3. **How to handle the wave-plan resolve-wave backward compatibility?**
   - What we know: Skills currently call `wave-plan resolve-wave <waveId>` for string wave resolution.
   - What's unclear: Whether to update those skills to use `resolve wave` instead, or keep both paths
   - Recommendation: Update skills to use `resolve wave` as the single entry point. Keep `wave-plan resolve-wave` for backward compatibility but skills should prefer the new command. The new resolver handles both numeric and string inputs.

## Skills Requiring Updates

Complete inventory of skills that accept set or wave arguments:

| Skill | Accepts | Current Pattern | Update Needed |
|-------|---------|-----------------|---------------|
| `/rapid:set-init` | set name | Direct argument or AskUserQuestion list | Add resolver step for direct argument |
| `/rapid:discuss` | wave ID (optional set ID) | `wave-plan resolve-wave <waveId>` | Replace with `resolve wave` |
| `/rapid:wave-plan` | wave ID (optional set ID) | `wave-plan resolve-wave <waveId>` | Replace with `resolve wave` |
| `/rapid:execute` | set ID | Direct argument or AskUserQuestion | Add resolver step for direct argument |
| `/rapid:review` | set ID (optional wave ID) | Direct argument or AskUserQuestion | Add resolver step for set, optional wave |
| `/rapid:merge` | set name (optional) | Direct from DAG order or argument | Add resolver step if user provides set arg |
| `/rapid:status` | none (read-only display) | Reads state directly | Update display to show numeric indices |
| `/rapid:pause` | set name | Direct argument or from executing list | Add resolver step for direct argument |
| `/rapid:resume` | set name | Direct argument or from paused list | Add resolver step for direct argument |
| `/rapid:cleanup` | set name | Direct argument or AskUserQuestion | Add resolver step for direct argument |
| `/rapid:assumptions` | set name | Direct argument or AskUserQuestion list | Add resolver step for direct argument |

**Total skills to update:** 11 (10 with resolver step + 1 with display changes)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (Node 25.8) |
| Config file | none -- uses `node --test` directly |
| Quick run command | `node --test src/lib/resolve.test.cjs` |
| Full suite command | `node --test src/lib/resolve.test.cjs src/lib/wave-planning.test.cjs src/lib/plan.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | resolveSet("1") returns first alphabetical set | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-01 | resolveSet("3") returns third set | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-01 | resolveSet("0") throws error | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-01 | resolveSet("99") throws out-of-range error | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-02 | resolveWave("1.1") returns set 1, wave 1 | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-02 | resolveWave("2.3") returns set 2, wave 3 | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-02 | resolveWave("1.") throws malformed error | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-02 | resolveWave("1.0") throws zero index error | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-02 | resolveWave("1.1.1") throws malformed error | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-03 | resolveSet("set-01-foundation") returns same ID with wasNumeric=false | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-03 | resolveWave("wave-01") delegates to existing resolveWave | unit | `node --test src/lib/resolve.test.cjs` | Wave 0 |
| UX-01 | CLI `resolve set 1` outputs correct JSON | integration | `node --test src/bin/rapid-tools.test.cjs` | Wave 0 |
| UX-02 | CLI `resolve wave 1.1` outputs correct JSON | integration | `node --test src/bin/rapid-tools.test.cjs` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test src/lib/resolve.test.cjs`
- **Per wave merge:** `node --test src/lib/resolve.test.cjs src/lib/wave-planning.test.cjs src/lib/plan.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/resolve.cjs` -- core resolver module (does not exist yet)
- [ ] `src/lib/resolve.test.cjs` -- covers UX-01, UX-02, UX-03
- [ ] No framework install needed -- `node:test` is built-in

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/lib/plan.cjs` -- `listSets()` function at lines 170-182 (verified alphabetical sort)
- Codebase inspection: `src/lib/state-machine.cjs` -- `readState()`, `findSet()`, `findWave()` patterns
- Codebase inspection: `src/lib/wave-planning.cjs` -- existing `resolveWave()` at lines 20-56
- Codebase inspection: `src/bin/rapid-tools.cjs` -- CLI handler patterns, switch/case structure
- Codebase inspection: `src/lib/state-schemas.cjs` -- Zod schemas for SetState, WaveState (string IDs, nested arrays)
- Codebase inspection: All 11 skill SKILL.md files -- argument patterns and integration points

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- locked by user during discussion phase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified in codebase
- Architecture: HIGH -- resolver pattern directly mirrors existing `wave-planning.resolveWave()` and CLI handler patterns
- Pitfalls: HIGH -- identified through direct codebase analysis of existing patterns and edge cases

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- internal codebase patterns)
