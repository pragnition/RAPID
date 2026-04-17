# Plan: start-set pending dropdown uses canonical DAG wave order

## Objective

When `/rapid:start-set` is invoked with no set argument, it lists pending sets via `rapid-tools set-init list-available` and presents them as a dropdown. Today that list reflects STATE.json insertion order only. The user preference (and the ordering already used by `/rapid:status`) is **canonical DAG wave order**: sets grouped wave-by-wave, in the same order `getExecutionOrder(dag)` produces for the status dashboard.

This plan reuses the existing ordering helpers in `src/lib/dag.cjs` (`tryLoadDAG` + `getExecutionOrder`) rather than reimplementing wave ordering. The fix is a targeted change to the `list-available` branch of `src/commands/set-init.cjs` plus a small test and a one-line help-text tweak. No SKILL.md change is required -- the skill already consumes whatever order the CLI returns.

## Investigation summary (context for the executor)

- **Entry point:** `skills/start-set/SKILL.md` Step 1 (no-argument branch, lines 75-93) calls:
  ```bash
  node "${RAPID_TOOLS}" set-init list-available
  ```
  and feeds the `available[]` array straight into AskUserQuestion. Whatever order the CLI returns is the order the user sees.
- **Current implementation:** `src/commands/set-init.cjs` case `'list-available'` (lines 41-72). It iterates `milestone.sets` in STATE.json insertion order and filters by `status === 'pending'` and "not in the worktree registry". No DAG lookup happens.
- **Canonical ordering helper (already exists):** `src/lib/dag.cjs` exports `tryLoadDAG(cwd)` and `getExecutionOrder(dag)`. `/rapid:status` uses exactly this pair (see `src/commands/dag.cjs` case `'show'`, lines 45-59). `getExecutionOrder` returns `string[][]` -- an array of waves, each an array of set IDs in DAG-declared order.
- **Graceful fallback:** `tryLoadDAG` returns `{ dag: null, ... }` when `.planning/DAG.json` is absent. `/rapid:status` already handles this (falls back to STATE.json insertion order). We mirror that behavior.
- **Numeric-resolution coherence:** `resolveSet("1", ...)` in `src/lib/resolve.cjs` uses STATE.json insertion order (not DAG order). The dropdown passes **set IDs** (string), not numeric indexes, to AskUserQuestion (per SKILL.md line 89: "Option name: the set ID"). Reordering the dropdown therefore does NOT break `/rapid:start-set N` resolution. No change to `resolve.cjs` is needed.
- **Zero/one pending set:** `getExecutionOrder` on an empty filtered set is a no-op; with one pending set the order is a single-element list either way. Behavior is preserved automatically.

## Tasks

### Task 1 -- Reorder `list-available` by DAG waves with insertion-order fallback

**Files to modify:**

- `src/commands/set-init.cjs` (case `'list-available'`, lines 41-72)

**Action:**

1. At the top of the `list-available` case, after the existing `readState` call, add a `require('../lib/dag.cjs')` to pull in `tryLoadDAG` and `getExecutionOrder`. Place the require inside the case (colocated with the existing `require('../lib/state-machine.cjs')`) to preserve the lazy-load pattern already used in this file.
2. Build the current `available` array exactly as today (STATE.json iteration + registry filter), but also build a **map** `availableById` keyed on `set.id` so the DAG reorder step can look up each eligible set in O(1).
3. Attempt `tryLoadDAG(cwd)`. If `dag` is non-null:
   - Call `getExecutionOrder(dag)` to get `waves: string[][]`.
   - Iterate waves in order; within each wave, iterate set IDs in the DAG-declared order; for each ID present in `availableById`, push the corresponding entry onto a new `ordered[]` array and delete it from the map.
   - After walking all waves, append any remaining entries still in `availableById` to `ordered[]` in STATE.json insertion order (handles sets that exist in STATE.json but not in DAG.json -- e.g., a set added after `dag generate` last ran; we must not drop them).
   - Return `{ available: ordered }`.
4. If `tryLoadDAG` returns `{ dag: null }` **or** throws (malformed JSON, unreadable file), fall back to the existing STATE.json-order `available[]`. Wrap the DAG lookup in a try/catch that swallows the error and logs nothing -- this matches `/rapid:status` Step 2's "non-fatal" philosophy (`src/commands/dag.cjs` case `'show'`, lines 49-53, does `try { await syncDAGStatus(cwd); } catch { /* non-fatal */ }`).
5. The JSON shape of stdout must be unchanged: a single object with an `available` array whose entries still have `{ id, milestone, status }`. Only the **order** changes. The existing error path (`{ available: [], error: 'STATE.json not found or invalid' }`) is preserved verbatim.

**Done criteria:**

- The file still exports `handleSetInit` and still handles the `create` subcommand unchanged.
- The `list-available` case loads DAG via `tryLoadDAG` from `src/lib/dag.cjs` (no new ordering logic written inline).
- When DAG.json is present, pending sets are emitted grouped by wave in DAG-declared order, with intra-wave order matching `getExecutionOrder`.
- When DAG.json is absent or malformed, output matches current behavior exactly (STATE.json insertion order).
- Sets present in STATE.json but missing from DAG.json are still emitted (appended after wave-ordered entries), not silently dropped.
- Zero pending sets still yields `{ "available": [] }`; one pending set yields a single-element array.

**Verification:**

```bash
cd /home/kek/Projects/RAPID
# Lint / syntax check
node --check src/commands/set-init.cjs
# Exercise the CLI against the live project (should print a JSON object with `available`)
node src/bin/rapid-tools.cjs set-init list-available | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); if(!Array.isArray(d.available)){console.error('FAIL: available not array');process.exit(1)} console.log('OK ordered ids:', d.available.map(s=>s.id).join(', '))"
```

Do NOT introduce new dependencies. Do NOT log from the CLI path (stdout must stay a single JSON line -- this is how SKILL.md parses it).

---

### Task 2 -- Unit test locking in DAG-order behavior

**Files to create:**

- `src/commands/set-init.test.cjs`

**Action:**

Write a Node-native test suite (matches the pattern used by existing sibling tests such as `src/commands/plan.test.cjs` and `src/lib/dag.test.cjs` -- check one of those for the exact `node:test` / `node:assert` import style and `describe`/`it` structure before writing). The suite should exercise `handleSetInit(cwd, 'list-available', [])` with a temp-dir fixture and capture `process.stdout` to assert on the emitted JSON.

Cover four cases:

1. **DAG present, multi-wave:** STATE.json with 4 pending sets; DAG.json placing set-B and set-D in wave 1 and set-A and set-C in wave 2 (order B, D, A, C). Assert `available` IDs come out as `['set-B','set-D','set-A','set-C']` -- i.e., DAG wave order, not alphabetical, not STATE insertion order.
2. **DAG absent (ENOENT):** Same STATE.json, no DAG.json on disk. Assert `available` IDs come out in STATE.json insertion order (the existing fallback).
3. **DAG present but missing a set:** STATE.json has 3 pending sets `[A, B, C]`; DAG.json mentions only A and C (in that order). Assert `available` is `[A, C, B]` -- DAG-ordered sets first, then the STATE-only leftover appended. This proves we never drop sets.
4. **Zero pending sets:** STATE.json has sets but all are already past `pending`. Assert `available` is `[]` regardless of DAG presence.

Use the worktree registry file (`.planning/worktrees/registry.json` or whatever path `src/lib/worktree.cjs`'s `readRegistry` reads -- inspect it before writing the test) to control the "no worktree registered" filter; an empty registry is fine for all four cases. If there is no such helper for tests already, hand-write the minimal registry file in the fixture.

**Done criteria:**

- New file `src/commands/set-init.test.cjs` exists and passes.
- All four cases above are covered with explicit assertions on the emitted `available[].id` order.
- The test follows the same `node:test` / `node:assert/strict` style used by `src/commands/plan.test.cjs` (confirm that file's import and `describe`/`it` shape before writing; do NOT introduce a new test framework).
- Tests clean up their temp directories (use `fs.mkdtempSync(path.join(os.tmpdir(), ...))` and `fs.rmSync(..., { recursive: true, force: true })` in `afterEach` -- again, match the project's existing test pattern).

**Verification:**

```bash
cd /home/kek/Projects/RAPID
node --test src/commands/set-init.test.cjs
```

The command must exit 0 with all four subtests passing. Do NOT skip cases with `test.skip` -- if a case cannot be expressed with the current fixture helpers, report BLOCKED with category CLARIFICATION rather than suppressing coverage.

---

### Task 3 -- Update CLI help text

**Files to modify:**

- `src/bin/rapid-tools.cjs` (line 67 -- the help-text entry)
- `src/lib/tool-docs.cjs` (line 68 -- the `'set-init-list'` entry)

**Action:**

Update both help strings so the description reflects the new behavior. Current text:

```
set-init list-available        List pending sets without worktrees
```

New text (keep the column alignment in `rapid-tools.cjs` -- match existing whitespace in that file):

```
set-init list-available        List pending sets without worktrees, ordered by DAG waves
```

Apply the equivalent wording change to `src/lib/tool-docs.cjs` line 68 so the tool-docs matches. Do NOT change any other help lines. Do NOT change the command name, argument shape, or JSON output schema.

**Done criteria:**

- Both help strings mention DAG-wave ordering.
- `node src/bin/rapid-tools.cjs --help` (or whatever top-level help flag this CLI uses -- check the file) renders the updated line with no broken column alignment.
- No other lines in either file are modified.

**Verification:**

```bash
cd /home/kek/Projects/RAPID
node --check src/bin/rapid-tools.cjs
node --check src/lib/tool-docs.cjs
# Visual check the line updated
node src/bin/rapid-tools.cjs 2>&1 | grep -F "set-init list-available"
```

The grep output must contain the phrase `ordered by DAG waves`.

---

## Out of scope (do NOT touch)

- `skills/start-set/SKILL.md` -- the skill already consumes whatever order the CLI returns; no change needed.
- `src/lib/resolve.cjs` -- numeric resolution (`/rapid:start-set 1`) must continue to use STATE.json insertion order; the dropdown passes set IDs, not indexes, so nothing is broken.
- `src/commands/dag.cjs` -- already uses `getExecutionOrder` correctly for `/rapid:status`.
- `src/lib/dag.cjs` -- the helpers exist and work; do not modify them.
- Any other `set-init` subcommand (`create`, solo mode) -- untouched.
- ROADMAP.md parsing -- the task specifies DAG wave order as the canonical source, matching `/rapid:status`. Do not introduce a separate ROADMAP.md-based ordering path.

## Success criteria (whole plan)

1. `node src/bin/rapid-tools.cjs set-init list-available` in a project with multiple pending sets across multiple DAG waves emits them in DAG wave order.
2. The same command in a project without DAG.json still emits STATE.json insertion order (unchanged from today).
3. `node --test src/commands/set-init.test.cjs` passes all four cases.
4. Help text in both `rapid-tools.cjs` and `tool-docs.cjs` mentions DAG-wave ordering.
5. No unrelated files are modified; no new dependencies are added.
