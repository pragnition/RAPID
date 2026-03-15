# RAPID User Feature Requests & Bug Fixes

## Features

### 1. Solo Mode
- Ask during `/init` or accept a `--solo` flag on `/start-set`
- Persist the setting in project config (e.g. `config.json` or `STATE.json`)
- In solo mode: skip worktree creation, work directly on the main branch
- All set lifecycle commands should respect this flag transparently

### 2. Project Scaffold Command (`/scaffold`)
- New skill that runs after `/init` to generate a project skeleton (build tooling, test harness, directory structure, etc.)
- Acts as a "set-0" that all real sets implicitly depend on
- Should be template-aware: detect project type (webapp, CLI, library, etc.) and generate an appropriate scaffold
- Ensures consistent testing setup and cleaner merges across sets

### 3. Review Pipeline Decomposition
- **Problem:** The current `/review` skill is too context-heavy — it runs scoping, unit tests, bug hunt, UAT, and judging in a single session
- **Solution:** Split into independent skills the user invokes separately:
  - `/review` — runs the scoping agent only, writes output to `REVIEW-SCOPE.md`
  - `/unit-test` — runs unit test validation against the scoped files
  - `/bug-hunt` — runs bug hunter + devil's advocate + judge pipeline
  - `/uat` — runs user acceptance testing
- User chooses which stages to run — no prompting needed
- Additionally: show the judge's leaning (accept/reject/uncertain) alongside each ruling

### 4. Context-Aware Internal Compaction
- Keep agent context length permanently below ~120k tokens
- Implement compaction that is context-aware (not just truncation — summarize completed work, preserve active state)
- This is non-trivial; needs a comprehensive design covering:
  - What gets compacted (completed wave results, old agent returns, resolved discussions)
  - What must be preserved (current task, active contracts, unresolved blockers)
  - When compaction triggers (token count threshold, between waves, etc.)

---

## Bugs

### 5. Missing DEFINITION.md on Start-Set
- **Symptom:** `Warning: Scoped CLAUDE.md could not be generated (missing DEFINITION.md)` appears when starting sets
- **Root cause:** TBD — likely a timing issue where `start-set` runs before `init` has written `DEFINITION.md` for the set, or a path resolution bug
- **Expected:** `DEFINITION.md` should always exist by the time `start-set` is invoked

### 6. Discuss-Set Shows "Let Claude Decide All" as a Selectable Option
- **Symptom:** When the discuss agent identifies gray areas, it presents "Let Claude decide all" as one of the multi-select options alongside the actual discussion topics
- **Expected:** "Let Claude decide all" should either be a separate action (skip discussion entirely) or not appear at all — it should not sit alongside individual topic checkboxes as a peer option
