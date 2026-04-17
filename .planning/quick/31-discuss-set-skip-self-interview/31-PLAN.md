# Quick Task 31: `/rapid:discuss-set --skip` should self-interview, not skip

## Problem

When `/rapid:discuss-set` is invoked with `--skip`, the current Step 4 branch
spawns a `rapid-research-stack` agent with a one-shot prompt that tells it to:

- fill the `decisions` section with *"All items marked as 'Claude's Discretion'
  (no user decisions captured)"*, and
- emit an empty `DEFERRED.md` with the note *"No deferred items identified
  (auto-skip mode)."*

In other words, the current `--skip` path produces a **deliberately thin
CONTEXT.md** -- it never reasons about the gray areas that Step 5/6 would have
surfaced, and never picks concrete approaches for them. Downstream `plan-set`
and `execute-set` then have nothing architectural to anchor on, so the
executor re-invents decisions ad hoc and quality suffers.

The user's direction: when `--skip` is used, the skill must **perform a
self-interview**. It should ask itself the same questions the interactive
path would have asked a human, then answer each one using the codebase +
CONTRACT.json + SET-OVERVIEW.md + DEFINITION.md + ROADMAP.md as evidence, and
write a CONTEXT.md that is structurally indistinguishable from the
interactive path's output (same 5 XML tags, populated `decisions` section with
real rationales, non-trivial `code_context`, proper `deferred` section
populated from scope-mismatched ideas the self-interview surfaced).

Interactive-path questions that the self-interview must reproduce (from
Step 5 of `skills/discuss-set/SKILL.md`):

- Gray area identification using the 4n count heuristic
  (`CONTRACT.json.definition.tasks.length` drives n=1/2/3 → 4/8/12 areas).
- Gray area categories: system architecture, API/interface design, state
  management, UI/UX (only when the set has user-facing components),
  performance/scaling tradeoffs.
- Per-area deep-dive: for each gray area, the interactive path asks 2+
  concrete questions in one of three formats (Format A pros/cons,
  Format B preview panels for UI layout, Format C key-factors block).
- Follow-up sweep to close remaining gaps.
- Deferred capture (Step 6.5): items that fall outside
  `CONTRACT.json.definition.scope`.

## Root Cause Analysis

The issue is entirely in the skill prompt, not in any backend/runtime
plumbing. Three pieces need updating in `skills/discuss-set/SKILL.md`:

1. **Step 4 (`--skip` branch, lines ~157-195)** — currently a ~20-line agent
   dispatch that explicitly tells the agent to leave decisions as "Claude's
   Discretion." Rewrite as a self-interview protocol.

2. **Step 7 note (lines ~476-478)** — currently says *"In --skip mode,
   CONTEXT.md was already written by the rapid-research-stack agent in Step 4"*.
   Still accurate after the rewrite (the self-interview agent still writes
   CONTEXT.md), but the note should be updated so the reader understands
   `--skip` CONTEXT.md is now structurally equivalent to interactive mode.

3. **Key Principles / Anti-Patterns (lines ~588-641)** —
   - the bullet *"--skip auto-context: The --skip flag spawns a
     rapid-research-stack agent to auto-generate CONTEXT.md and an empty
     DEFERRED.md without user interaction."* is now wrong on two counts:
     CONTEXT.md is no longer thin, and DEFERRED.md is no longer guaranteed
     empty.
   - No current anti-pattern forbids "emitting a stub CONTEXT.md in --skip
     mode"; add one.

No other skills, no backend, no frontend, and no CLI logic need to change --
the `--skip` behavior is expressed entirely through the skill-body prompt the
agent is given.

Note on the plugin cache: `/home/kek/.claude/plugins/cache/joey-plugins/rapid/7.0.0/skills/discuss-set/`
mirrors the installed plugin. It is regenerated from this repo's
`skills/discuss-set/` on plugin reinstall, so **do not edit the cache** —
only the repo source matters.

## Files to Modify

- `skills/discuss-set/SKILL.md` — rewrite the `--skip` branch (Step 4),
  update Step 7 cross-reference note, fix Key Principles and Anti-Patterns
  bullets that describe the old behavior.
- `skills/discuss-set/SKILL.test.cjs` — add regression tests that lock in
  the self-interview protocol so future edits cannot silently regress Step 4
  back to a stub generator.

## Tasks

### Task 1: Rewrite Step 4 as a self-interview protocol

**Files:** `skills/discuss-set/SKILL.md` (Step 4 section, lines ~157-195)

**Action:** Replace the current Step 4 body with a self-interview protocol
that mirrors Steps 5, 6, and 6.5 but routes every question to the agent
itself (no user prompts). The new Step 4 must direct the spawned agent to:

1. **Banner line** — display *"Auto-generating CONTEXT.md for set '{SET_ID}'
   (--skip mode, self-interview)..."* so the user knows the mode.

2. **Phase A: Gray area identification (self-ask version of Step 5).**
   - Read the same sources the interactive path uses: `CONTRACT.json`,
     `DEFINITION.md`, `SET-OVERVIEW.md`, `ROADMAP.md` set description, and
     any source files referenced by `exports.functions` / `exports.types`
     in CONTRACT.json.
   - Apply the **4n heuristic** from Step 5 using
     `CONTRACT.json.definition.tasks.length` (1-3 → n=1 → 4 areas,
     4-6 → n=2 → 5-8 areas, 7+ → n=3 → 9+ areas). The total must be at
     least 4; must remain a multiple of 4 or 4n+{1..4} per the existing
     Step 5 rules.
   - Enumerate candidate gray areas across the same categories Step 5 uses
     (system architecture, API/interface, state, UI/UX *only when the set
     has user-facing components*, performance/scaling).
   - Record title + 1-sentence description for each.

3. **Phase B: Per-area self-deep-dive (self-ask version of Step 6).**
   For each gray area from Phase A (all of them — there is no "user
   selection" in `--skip`):
   - Draft at least 2 concrete architect-level questions, one thing per
     question, same constraints as interactive Step 6.
   - For each question, pick the most appropriate of Format A / B / C
     (the agent should default to Format A unless the question is a
     visual/layout one that benefits from Format B, or a multi-factor
     tradeoff that needs Format C).
   - **Answer each question** using codebase evidence, contract details,
     and the stated ROADMAP description. Each answer must include a
     **rationale** (1-2 sentences explaining *why* the chosen option wins
     given the concrete evidence gathered — not generic reasoning).
   - If evidence is genuinely absent (e.g., the set has no existing code
     to scan because it's greenfield), the answer may fall back to
     *"Claude's Discretion"* **for that specific question only**, with a
     rationale explaining what evidence was sought and not found. This is
     the only path to a *"Claude's Discretion"* entry in `--skip` mode.

4. **Phase C: Self-surfaced deferred items (self-ask version of Step 6.5).**
   - Read `CONTRACT.json.definition.scope` and compare against everything
     raised during Phase A/B.
   - Any idea that was surfaced during the self-interview but falls
     outside the scope boundary goes into `DEFERRED.md` using the same
     format Step 6.5 documents.
   - If no deferred items were surfaced (common for narrow sets), write
     DEFERRED.md with an empty table and the standard empty-note.
     DEFERRED.md is always written.

5. **Phase D: Write CONTEXT.md** using the **same format as Step 7**
   (the interactive-path format) — all 5 XML tags
   (`<domain>`, `<decisions>`, `<specifics>`, `<code_context>`,
   `<deferred>`), populated with the Phase A/B/C answers.
   - The frontmatter `**Mode:**` line should be `auto-skip (self-interview)`
     so downstream consumers can tell this was a self-interview run.
   - Every decision in `<decisions>` must carry a `**Rationale:**` line
     sourced from the Phase B answer, not a boilerplate string.
   - `<code_context>` must reflect patterns actually discovered during
     Phase A source-file scans, not a placeholder.

6. **Verification hook** — after the agent returns, keep the existing
   post-check:

   ```bash
   # (env preamble here)
   [ -f ".planning/sets/${SET_ID}/CONTEXT.md" ] && echo "CONTEXT.md created" || echo "ERROR: CONTEXT.md not found"
   [ -f ".planning/sets/${SET_ID}/DEFERRED.md" ] && echo "DEFERRED.md created" || echo "ERROR: DEFERRED.md not found"
   ```
   Extend it to also verify DEFERRED.md (currently only CONTEXT.md is
   checked — DEFERRED.md absence should also be a post-condition failure).

7. **Control-flow preservation** — after the agent finishes, still jump to
   Step 8 (State Transition and Commit); the final mutation and commit
   flow is shared by both paths and must not change.

The rewritten Step 4 should explicitly name this as a *self-interview* in
both the banner string and the agent's task prompt so the behavior is
self-documenting when read by a human.

**Done criteria:**

- Step 4 no longer contains the phrase *"All items marked as 'Claude's
  Discretion' (no user decisions captured)"* or any variant that tells the
  agent to bulk-mark decisions as discretionary.
- Step 4 no longer contains the phrase *"No deferred items identified
  (auto-skip mode)"* as an unconditional directive — that phrase may only
  appear as the fallback written *when* the self-interview surfaces no
  out-of-scope items.
- Step 4 explicitly names *"self-interview"* at least once.
- Step 4's agent prompt references all 5 XML tags of CONTEXT.md (same as
  Step 7's format), not a reduced subset.
- Step 4's agent prompt references the 4n gray-area heuristic and routes
  back to `CONTRACT.json.definition.tasks.length`.
- The verification hook at the end of Step 4 checks both CONTEXT.md AND
  DEFERRED.md.

**Verify:**

```bash
# Self-interview must be named.
grep -c "self-interview" skills/discuss-set/SKILL.md
# Expect: >= 3 (banner, agent prompt, and at least one reference in
# Key Principles/Anti-Patterns from Task 3).

# Old stub-generation directives must be gone from Step 4.
awk '/^## Step 4/,/^## Step 5/' skills/discuss-set/SKILL.md | grep -c "no user decisions captured"
# Expect: 0.
awk '/^## Step 4/,/^## Step 5/' skills/discuss-set/SKILL.md | grep -c "No deferred items identified (auto-skip mode)"
# Expect: 0 as a literal unconditional directive. The phrase may survive
# elsewhere as the empty-table fallback string, but not as a standing order.

# The 4n heuristic must reach Step 4.
awk '/^## Step 4/,/^## Step 5/' skills/discuss-set/SKILL.md | grep -Ec "CONTRACT\.json.*definition\.tasks|4n heuristic|n=1|n=2|n=3"
# Expect: >= 1.

# All 5 XML tags must be referenced in Step 4's agent prompt.
awk '/^## Step 4/,/^## Step 5/' skills/discuss-set/SKILL.md | grep -Eo "<(domain|decisions|specifics|code_context|deferred)>" | sort -u | wc -l
# Expect: 5.

# Verification hook covers both artifacts.
awk '/^## Step 4/,/^## Step 5/' skills/discuss-set/SKILL.md | grep -c "DEFERRED.md"
# Expect: >= 1.
```

### Task 2: Update Step 7 cross-reference note, Key Principles, and Anti-Patterns

**Files:** `skills/discuss-set/SKILL.md` (Step 7 header note ~line 476-478,
Key Principles ~line 609, Anti-Patterns ~line 616-641)

**Action:**

1. **Step 7 note** — Replace the current one-line note with a short
   paragraph explaining that the `--skip` path produces a CONTEXT.md that
   is **structurally identical** to the interactive path, because Step 4
   runs a self-interview over the same questions Steps 5/6/6.5 would ask
   a human. Keep the redirect ("skip this step and go directly to Step 8")
   intact.

2. **Key Principles bullet** — The existing bullet reads:

   > **--skip auto-context:** The --skip flag spawns a rapid-research-stack
   > agent to auto-generate CONTEXT.md and an empty DEFERRED.md without
   > user interaction.

   Rewrite as:

   > **--skip self-interview:** The --skip flag spawns a
   > rapid-research-stack agent that conducts a **self-interview** —
   > reproducing the Step 5/6 gray-area questions and answering each one
   > from CONTRACT.json + SET-OVERVIEW.md + ROADMAP.md + source-file
   > scans. Output is a fully-populated CONTEXT.md (all 5 XML tags,
   > real rationales) and a DEFERRED.md populated from self-surfaced
   > scope-mismatched ideas (empty only if none were surfaced).
   > *"Claude's Discretion"* may appear per-question only when evidence
   > for that question is genuinely absent, never as a blanket default.

3. **Anti-Patterns** — Add a new bullet immediately after the existing
   `--skip` / capture-vision bullets:

   > - Do NOT emit a stub CONTEXT.md in `--skip` mode. `--skip` is a
   >   **self-interview**, not a skip. CONTEXT.md must have populated
   >   `<decisions>` entries with real per-question rationales and a
   >   `<code_context>` sourced from actual codebase scans, not
   >   placeholder text. Blanket *"Claude's Discretion"* across all
   >   decisions is a regression.

**Done criteria:**

- Step 7 note names the self-interview and asserts structural equivalence
  with interactive mode.
- Key Principles has the `--skip self-interview:` bullet with the
  rephrased description.
- Anti-Patterns has the new "Do NOT emit a stub CONTEXT.md" bullet.
- No surviving reference in Key Principles or Anti-Patterns describes the
  old "empty DEFERRED.md" or "all items marked Claude's Discretion" as the
  `--skip` default behavior.

**Verify:**

```bash
# Principles bullet renamed and updated.
grep -c "\\-\\-skip self-interview" skills/discuss-set/SKILL.md
# Expect: >= 1.

# Old auto-context wording removed from Key Principles.
awk '/^## Key Principles/,/^## Anti-Patterns/' skills/discuss-set/SKILL.md | grep -c "auto-generate CONTEXT.md and an empty DEFERRED.md"
# Expect: 0.

# New anti-pattern present.
awk '/^## Anti-Patterns/,EOF' skills/discuss-set/SKILL.md | grep -c "Do NOT emit a stub CONTEXT.md"
# Expect: 1.

# Step 7 note mentions self-interview.
awk '/^## Step 7/,/^## Step 8/' skills/discuss-set/SKILL.md | grep -c "self-interview"
# Expect: >= 1.
```

### Task 3: Regression tests in SKILL.test.cjs

**Files:** `skills/discuss-set/SKILL.test.cjs` (extend the existing
`describe('discuss-set SKILL.md structural assertions', ...)` block)

**Action:** Add tests that lock in the self-interview protocol so a future
edit cannot silently revert Step 4 to stub generation. Use the same
conventions as the existing tests (plain `node:test` + `node:assert/strict`,
no extra deps, slice Step 4 via
`content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m)`).

Required new tests:

1. **Step 4 names self-interview.** Assert the Step 4 slice contains the
   literal string `self-interview`.

2. **Step 4 drops the old stub directives.** Assert the Step 4 slice does
   NOT contain `no user decisions captured`, and does NOT contain the
   exact literal `No deferred items identified (auto-skip mode)` as an
   unconditional directive. (If the phrase appears inside a quoted
   fallback string for the empty-items case, the test should use a
   tighter regex tied to the directive context; the simplest safe form is
   to assert the exact sentence fragment appears **zero** times at the
   top level of the Step 4 prose and only optionally appears as a
   quoted empty-DEFERRED fallback. Start with the strict-zero form and
   relax only if the Task 1 implementation needs the fallback string.)

3. **Step 4 references all 5 CONTEXT.md XML tags.** Assert each of
   `<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, `<deferred>`
   appears at least once inside the Step 4 slice.

4. **Step 4 references the 4n gray-area heuristic.** Assert the Step 4
   slice contains either `CONTRACT.json` with `definition.tasks` or the
   phrase `4n` or `n=1` (any one suffices — the heuristic routing must
   be explicit in the agent's instructions).

5. **Step 4 post-check verifies DEFERRED.md.** Assert the Step 4 slice
   contains `DEFERRED.md` in the verification/post-check area.

6. **Key Principles bullet updated.** Assert the Key Principles slice
   contains `--skip self-interview` and does NOT contain
   `auto-generate CONTEXT.md and an empty DEFERRED.md`.

7. **Anti-Patterns forbids stub CONTEXT.md.** Assert the Anti-Patterns
   slice contains `Do NOT emit a stub CONTEXT.md`.

Each new test should be a separate `it(...)` block so failures point at
the specific invariant that broke.

**Done criteria:**

- `node skills/discuss-set/SKILL.test.cjs` passes after Tasks 1 and 2 land.
- The test file contains at least 7 new `it(...)` blocks covering the
  invariants above, in addition to the 13 already-existing tests.
- Running the test suite against the **current** (pre-fix) SKILL.md should
  **fail** on all 7 new tests — this is the regression guard's purpose.
  (Do not verify this pre-fix step by running tests against the old file;
  the ordering is: Task 1 + Task 2 rewrite → Task 3 tests → run to
  confirm green. But a reviewer reading the test names and assertions
  should be able to tell at a glance that they would fail against the
  current Step 4.)

**Verify:**

```bash
node --test skills/discuss-set/SKILL.test.cjs
# Expect: all tests pass, exit code 0.

# Sanity-check the count of `it(` blocks grew.
grep -c "^  it(" skills/discuss-set/SKILL.test.cjs
# Expect: >= 20 (13 original + at least 7 new).
```

## Success Criteria

- `/rapid:discuss-set --skip <set>` produces a CONTEXT.md with populated
  `<decisions>` entries that each carry a real per-question rationale
  (not "Claude's Discretion" blanket-style).
- `<code_context>` reflects patterns the spawned agent actually observed
  in the codebase during Phase A.
- DEFERRED.md is populated with items the self-interview surfaced as
  out-of-scope (or empty-with-note only if the self-interview genuinely
  surfaced none — not as an unconditional default).
- Downstream `plan-set` and `execute-set` consuming a `--skip`-generated
  CONTEXT.md find the same structural richness they'd get from the
  interactive path.
- `node --test skills/discuss-set/SKILL.test.cjs` passes.
- The skill changes live in the repo source at
  `/home/kek/Projects/RAPID/skills/discuss-set/SKILL.md`, NOT in the
  plugin cache at
  `/home/kek/.claude/plugins/cache/joey-plugins/rapid/7.0.0/skills/discuss-set/`
  (the cache is regenerated from source on reinstall).

## Out of Scope

- Do NOT change the interactive Steps 5, 6, 6.5, 7, or 8. `--skip` should
  converge on the same CONTEXT.md/DEFERRED.md shape those steps produce,
  not invent a new shape.
- Do NOT change `rapid-tools.cjs`, state schemas, or the state-transition
  flow. The `pending → discussed` transition at Step 8 is shared and must
  stay shared.
- Do NOT touch the `rapid-research-stack` agent definition itself — the
  change is entirely in the task prompt Step 4 hands to that agent.
- Do NOT remove the `--skip` flag or its parsing in Step 2 — only the
  branch behavior in Step 4 changes.
- Do NOT add backend/frontend/MCP changes — `--skip` is a CLI-only flag
  that never goes through `AskUserQuestion` or the web bridge; there are
  no user prompts in either path of `--skip`.
- Do NOT modify other skills (e.g., `add-set`, `plan-set`, `execute-set`)
  even if they reference `--skip` in their own text; this task is
  scoped to `discuss-set` alone.
