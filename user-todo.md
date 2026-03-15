# RAPID User Feature Requests & Bug Fixes

## Features

### 1. Solo Mode
**Motivation:** Many developers using RAPID are working alone. The worktree isolation model adds overhead (branch management, merge ceremonies, conflict resolution) that provides no value when there's only one contributor. Solo mode should make RAPID feel lightweight for individual use while preserving the full orchestration pipeline.

**Requirements:**
- Prompt during `/init`: "Will you be working solo or with a team?" — persist the answer in project config (`config.json` or `STATE.json`)
- Accept a `--solo` flag on `/start-set` as an override for per-set solo work in team projects
- In solo mode:
  - Skip worktree creation entirely — all sets work directly on the main branch
  - Skip merge ceremonies — `execute-set` commits land on main immediately
  - Skip conflict detection (no parallel branches to conflict with)
  - Preserve all other lifecycle steps: discuss, plan, execute, review
- All set lifecycle commands (`start-set`, `execute-set`, `merge`, `cleanup`) must check the solo flag and adjust behavior transparently
- The `/status` dashboard should indicate solo mode visibly

**Edge cases to consider:**
- Switching from solo to team mid-project (retroactive worktree creation?)
- Running `/merge` in solo mode should no-op gracefully with a message, not error

---

### 2. Project Scaffold Command (`/scaffold`)
**Motivation:** When RAPID decomposes a project into parallel sets, each set builds features independently. Without a shared foundation, sets end up creating conflicting directory structures, incompatible test setups, or duplicate boilerplate — leading to painful merges. A scaffold provides the common base that all sets build on top of.

**What this is NOT:** This is not a replacement for framework-specific scaffolders (`create-react-app`, `cargo init`, etc.). Users should still use those tools first. The RAPID scaffold is about establishing the *shared foundation layer* that parallel sets need — things like:
- A basic UI wireframe / layout shell that feature sets plug into (for webapps)
- A shared test harness and configuration that all sets can write tests against
- Common directory structure conventions so sets don't create conflicting layouts
- Shared types, interfaces, or contracts that multiple sets will import from
- Routing skeleton, API client setup, state management boilerplate — the glue code

**Requirements:**
- New skill `/scaffold` that runs after `/init` (or as part of init with a flag)
- Acts as "set-0" — an implicit dependency for all real sets in the milestone
- Should analyze the project type (detected during init) and generate an appropriate foundation:
  - **Webapp:** Layout shell, routing skeleton, shared component library, test setup
  - **API:** Route structure, middleware chain, error handling, DB connection boilerplate
  - **Library:** Module structure, public API surface, test framework config
  - **CLI:** Command router, argument parser, help system skeleton
- Scaffold commits land on main before any set branches are created
- The roadmapper should be aware of scaffold existence and plan sets that build *on top of* it rather than duplicating its work

**Open questions:**
- Should scaffold be interactive (ask what to include) or fully automatic based on project type?
- Should it be a one-time operation or re-runnable as new shared needs emerge?

---

### 3. Review Pipeline Decomposition
**Motivation:** The current `/review` skill runs the entire review pipeline (scoping, unit tests, bug hunt, devil's advocate, judge, bugfix, UAT) in a single session. This consumes enormous context, makes it impossible to re-run a single stage, and forces users through stages they may not need. Decomposing into independent skills gives users control and reduces per-session context load.

**Requirements:**
- Split the monolithic `/review` into independent, composable skills:
  - **`/review`** (scope only) — runs the scoping agent, writes `REVIEW-SCOPE.md` with categorized concerns, file chunks, and cross-cutting analysis. This is the entry point that all other review skills depend on.
  - **`/unit-test`** — reads `REVIEW-SCOPE.md`, runs unit test validation against scoped files, writes `REVIEW-UNIT.md`
  - **`/bug-hunt`** — reads `REVIEW-SCOPE.md`, runs bug hunter + devil's advocate + judge pipeline, writes `REVIEW-BUGS.md`. Each ruling should display the judge's leaning (accept/reject/uncertain) with a confidence indicator.
  - **`/uat`** — reads `REVIEW-SCOPE.md`, runs user acceptance testing against CONTRACT.json criteria, writes `REVIEW-UAT.md`
- Each skill is independently invocable — user picks which stages to run based on the set's needs
- No prompting needed to select review stages (the current "which review stages?" question goes away)
- Skills should detect if `REVIEW-SCOPE.md` exists and prompt the user to run `/review` first if missing
- Re-running a stage overwrites the previous output file (idempotent)

**Judge leaning display example:**
```
Finding #3: Unchecked null dereference in merge.cjs:245
  Hunter: HIGH severity — crashes on empty MERGE-STATE
  Devil's Advocate: Disagrees — MERGE-STATE is always initialized by detect
  Judge: ACCEPT (leaning: strong accept, confidence: 0.85)
```

---

### 4. Context-Aware Internal Compaction
**Motivation:** Long-running RAPID sessions (especially during execute-set with many waves, or review with multiple cycles) accumulate enormous context. When context approaches limits, Claude Code's built-in compression kicks in, but it's generic — it doesn't understand RAPID's structure. A RAPID-aware compaction layer could preserve the right information while aggressively summarizing completed work.

**Requirements:**
- Target: keep working context below ~120k tokens during orchestration
- Compaction must be context-aware, not blind truncation:
  - **Safe to compact:** Completed wave results (keep summary, discard full output), resolved discussions, old agent returns that have been acted on, superseded plan versions
  - **Must preserve:** Current task context, active contracts and their state, unresolved blockers, in-progress wave data, error context for debugging
  - **Trigger points:** Between waves during execute-set, between review cycles, after agent returns are processed
- Compaction should produce a structured summary that agents can still reason about
- Must be transparent — if compaction discards something that's later needed, there should be a way to recover (artifact files on disk serve as the source of truth)

**Risks & open questions:**
- This fights against Claude Code's built-in context management — the two systems could interact poorly
- Determining "what's safe to discard" requires understanding future agent needs, which is inherently speculative
- Implementation complexity is high; subtle bugs here silently degrade output quality in hard-to-debug ways
- May be better to focus on reducing context generation (shorter agent prompts, leaner returns) rather than compacting after the fact
- Could a simpler approach work? E.g., always read from disk artifacts rather than relying on conversation context

---

## Bugs

### 5. Missing DEFINITION.md on Start-Set
**Symptom:**
```
Warning: Scoped CLAUDE.md could not be generated (missing DEFINITION.md).
Let me check what files exist for this set.
```
This appears when running `/start-set` on sets that should have been fully initialized.

**Expected behavior:** `DEFINITION.md` should always exist at `.planning/sets/{setId}/DEFINITION.md` by the time `/start-set` is invoked, since it's created during `/init` by the roadmapper agent.

**Likely root causes (investigate in order):**
1. Path resolution bug — `start-set` looking in wrong directory for `DEFINITION.md`
2. Timing issue — `start-set` invoked before `/init` has finished writing all set artifacts
3. Roadmapper regression — agent no longer generating `DEFINITION.md` for every set in the roadmap
4. Set ID mismatch — resolved set ID doesn't match the directory name used during init

**Files to investigate:**
- `skills/start-set/SKILL.md` — where the warning originates
- `src/lib/worktree.cjs` — `generateScopedClaudeMd()` function
- `src/modules/roles/role-roadmapper.md` — agent instructions for DEFINITION.md generation

---

### 6. Discuss-Set Shows "Let Claude Decide All" as a Peer Option
**Symptom:** When the discuss agent identifies gray areas for a set, it presents options like:
```
1. [ ] Let Claude decide all
   Skip discussion, all 4 decisions at Claude's discretion
2. [✔] Banner color choice
   ...
3. [✔] Discuss-set batching
   ...
4. [✔] Audit scope boundaries
   ...
```
"Let Claude decide all" appears as a checkbox alongside individual topics, allowing nonsensical combinations (e.g., selecting "Let Claude decide all" AND specific topics).

**Expected behavior:** "Let Claude decide all" is a *meta-action*, not a discussion topic. It should either:
- Be a separate prompt before the topic selection ("Would you like to discuss specific areas or let Claude decide?")
- Not appear at all — if the user deselects all topics, that implicitly means "Claude decides"
- Appear as a button/action outside the multi-select list

**Files to investigate:**
- `skills/discuss-set/SKILL.md` — where AskUserQuestion is constructed with the gray area options
- The skill's Step 5-6 logic for gray area question assembly
