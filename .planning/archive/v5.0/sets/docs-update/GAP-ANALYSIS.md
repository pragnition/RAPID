# Gap Analysis: docs-update

This artifact catalogs every discrepancy between the two primary documentation files (DOCS.md, technical_documentation.md) and the actual v5.0 codebase. Organized by feature area. Each gap includes the current (wrong) text, the correct (v5.0) text, and the source of truth reference. Consumed by Waves 2 and 3.

---

## DOCS.md Gaps

### State Machine

- **Line 452:** Status names use present-tense gerunds: `pending --> discussing --> planning --> executing --> complete --> merged`. Actual v5.0 uses past-tense: `pending --> discussed --> planned --> executed --> complete --> merged`. Source: `src/lib/state-schemas.cjs` line 4 (`z.enum(['pending', 'discussed', 'planned', 'executed', 'complete', 'merged'])`).
- **Line 452:** Diagram shows only the linear chain. Missing transitions:
  - `pending -> planned` shortcut (skip discuss). Source: `src/lib/state-transitions.cjs` line 4.
  - `discussed -> discussed` self-loop (re-discussion). Source: `src/lib/state-transitions.cjs` line 5.
  - `executed -> executed` self-loop (crash recovery re-execution). Source: `src/lib/state-transitions.cjs` line 7.
  - Solo mode: `complete -> merged` auto-transition (no branch to merge). Source: `docs/state-machines.md` line 38, `src/lib/worktree.cjs` line 348+.
- **Line 455:** Text says "For full transition rules and crash recovery details, see docs/state-machines.md." This cross-reference is correct, but the inline diagram above it is misleading because it omits the skip/self-loop transitions that state-machines.md documents.

### Command Catalog

- **All 28 skill directories match.** The file tree (lines 474-501) correctly lists all 28 skill directories. No missing or stale entries.
- **Command descriptions are accurate for v5.0.** Each `/rapid:*` command section matches the current SKILL.md implementation. No stale command descriptions found.

### Agent Count and Categories

- **Line 3:** Claims "27 specialized agents" -- correct. Actual count: 27 files in `agents/`. Source: `ls agents/ | wc -l` = 27.
- **Line 438:** Claims "7 categories" -- correct. Categories listed: Core (4), Research (7), Review (7), Merge (2), Utility (6), Context (1). Total: 4+7+7+2+6+1 = 27. Matches `docs/agents.md`.
- **No gaps in agent section.**

### File Structure Tree

- **Lines 503-506:** The `src/` directory only shows `src/bin/rapid-tools.cjs`. The actual `src/` directory contains 6 subdirectories: `bin/`, `commands/`, `hooks/`, `lib/`, `modules/`, `schemas/`. While DOCS.md intentionally keeps the tree shallow, this may mislead readers about the codebase complexity. Low severity -- the tree is labeled as a high-level overview.
- **Lines 469-512:** Tree is missing several top-level files and directories that exist in the repo:
  - `config.json` (project root config)
  - `CONTRIBUTING.md`
  - `LICENSE`
  - `test/` and `tests/` directories
  - `web/` directory (Mission Control dashboard source)
  - `branding/` directory
  - `technical_documentation.md`
  Low severity -- the tree focuses on the plugin structure, not every repo file.

### Review Pipeline

- **Lines 156-207:** The review pipeline description is accurate for v5.0. It correctly describes the 4-skill split: `/rapid:review` (scoping), `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat`. No gaps.

### v5.0 Features

- **UAT workflow (v4.5 rewrite):** DOCS.md lines 199-207 describe `/rapid:uat` accurately. However, the UAT-FAILURES.md workflow (uat generates failures, bug-fix `--uat` flag consumes them) is not mentioned anywhere in DOCS.md. Source: `skills/bug-fix/SKILL.md` lines 8, 31-49, 294; `skills/uat/SKILL.md`. The `--uat` flag on `/rapid:bug-fix` should be documented in the bug-fix command section.
- **Bug-fix `--uat` flag:** Line 299-305 describes `/rapid:bug-fix` without mentioning the `--uat <set-id>` flag. Current text: "The user describes a bug, and the skill dispatches agents to investigate the codebase and apply a targeted fix." Missing: `--uat` flag reads UAT-FAILURES.md and fixes failures automatically. Source: `skills/bug-fix/SKILL.md` line 8.
- **Branding server:** `src/lib/branding-server.cjs` exists (serves branding assets via HTTP) but is not mentioned in DOCS.md. The `/rapid:branding` command section (lines 370-379) only describes the interview flow, not the asset server. Low severity -- the server is an implementation detail of the branding skill.
- **Generous planning granularity prompt:** Not mentioned in DOCS.md. The granularity concept is only in config.json (`granularity` key) and `src/modules/roles/role-roadmapper.md`. This is an implementation detail exposed via config, not a user-facing feature. Low severity.
- **`--gaps` flag:** Documented on line 132 for `/rapid:plan-set` and implicit in `/rapid:execute-set`. However, `/rapid:execute-set` (lines 143-151) does not mention `--gaps` at all. Source: `skills/execute-set/SKILL.md` lines 37, 61-99. The execute-set section should document the `--gaps` flag.
- **`--spec` flag:** `/rapid:new-version` (lines 242-250) correctly documents the `--spec <path>` flag. No gap.
- **Gap-closure mode:** Not explained in DOCS.md beyond the `--gaps` flag mention. The full workflow (GAPS.md discovery, gap-closure wave planning, re-execution) is undocumented. Source: `skills/plan-set/SKILL.md`, `skills/execute-set/SKILL.md`.

### Cross-References to docs/ Files

- **All 11 docs/ files are linked from DOCS.md.** Verified: setup.md, agents.md, state-machines.md, configuration.md, troubleshooting.md, CHANGELOG.md, planning.md, execution.md, review.md, merge-and-cleanup.md, auxiliary.md. No gaps.

### Troubleshooting Section

- **DOCS.md has no Troubleshooting section body.** Line 25 links to `docs/troubleshooting.md` in the ToC but there is no `## Troubleshooting` section with inline content. This is by design (deep-dive is in the linked file), but may benefit from a brief inline summary. Low severity.

### Configuration Section

- **DOCS.md has no Configuration section body.** Line 22 links to `docs/configuration.md` in the ToC but there is no `## Configuration` section in the document body. Missing entirely. The actual configuration details (env vars, config.json keys, state schema) are only available via the linked file. Medium severity -- a central reference hub should at least summarize the config surface.

---

## technical_documentation.md Gaps

### Version References

- **Line 2:** "RAPID v3.0" should be "RAPID v5.0". Source: `DOCS.md` line 5 (`Version: 5.0.0`), `package.json`.
- **Line 2:** "all 26 agents" should be "all 27 agents". Source: `ls agents/ | wc -l` = 27. The 27th is `rapid-auditor` (added v4.2.1).
- **Line 10:** "All 26 agents by category" should be "All 27 agents by category".
- **Line 308:** "RAPID v3.0 uses 26 specialized agents organized into 6 categories" should be "RAPID v5.0 uses 27 specialized agents organized into 7 categories". Source: `docs/agents.md` lines 5, 339 (Utility has 6 agents, not 5), line 411 (Context category with 1 agent).
- **Line 308:** "6 categories" should be "7 categories". The 7th category is Context (1 agent: `rapid-context-generator`). Source: `docs/agents.md` line 411.
- **Line 319:** Core agents section header says "Hand-written agents that define the v3.0 user experience" -- should say "v5.0".
- **Line 443:** "RAPID v3.0 tracks state at the set level only" should be "RAPID v5.0".
- **Line 540:** "4 core agents are hand-written... The remaining 22 agents are generated" should be "The remaining 23 agents are generated" (27 total - 4 core = 23).

### Agent Catalog

- **Lines 358-368:** Utility category header says "Utility (5 agents)" -- should be "Utility (6 agents)". Missing agent: `rapid-auditor`. Source: `agents/rapid-auditor.md`, `docs/agents.md` lines 398-407.
- **Lines 358-368:** The 5 listed utility agents are correct but incomplete. Missing entry:
  - `rapid-auditor` | `/rapid:audit-version` | Gap report at `.planning/v{version}-AUDIT.md`
- **Lines 370-375:** Context category (1 agent) IS listed at lines 370-375. However, line 308 says "6 categories" instead of "7 categories", contradicting the presence of this 7th category section. The category section exists but the summary count is wrong.
- **Spawn hierarchy (lines 378-437):** Missing spawn entries:
  - `/rapid:bug-fix` dispatching `rapid-bugfix`. Source: `docs/agents.md` lines 86-87.
  - `/rapid:documentation` (skill-level orchestration, no subagent). Source: `docs/agents.md` lines 89-90.
  - `/rapid:context` dispatching `rapid-context-generator`. Source: `docs/agents.md` lines 83-84.
  Wait -- `/rapid:context` IS listed at lines 434-436. But `/rapid:bug-fix` and `/rapid:documentation` are missing from the spawn hierarchy.

### Command Reference

- **Lines 7-19 (Table of Contents):** Section 8 "Auxiliary Commands" lists only 5 commands: status, install, new-version, add-set, quick. Section 9 "Utility Commands" lists only 6 commands: assumptions, pause, resume, context, cleanup, help. Combined total: 11 commands + 7 lifecycle commands (init, start-set, discuss-set, plan-set, execute-set, review, merge) = 18 commands documented. Actual skill count: 28.
- **10 missing commands not documented anywhere in technical_documentation.md:**
  1. `/rapid:bug-fix` -- Not documented. Source: `skills/bug-fix/`.
  2. `/rapid:branding` -- Not documented. Source: `skills/branding/`.
  3. `/rapid:scaffold` -- Not documented. Source: `skills/scaffold/`.
  4. `/rapid:audit-version` -- Not documented. Source: `skills/audit-version/`.
  5. `/rapid:migrate` -- Not documented. Source: `skills/migrate/`.
  6. `/rapid:documentation` -- Not documented. Source: `skills/documentation/`.
  7. `/rapid:register-web` -- Not documented. Source: `skills/register-web/`.
  8. `/rapid:unit-test` -- Not documented (review section describes it as part of `/rapid:review`). Source: `skills/unit-test/`.
  9. `/rapid:bug-hunt` -- Not documented (review section describes it as part of `/rapid:review`). Source: `skills/bug-hunt/`.
  10. `/rapid:uat` -- Not documented (review section describes it as part of `/rapid:review`). Source: `skills/uat/`.

### State Machine

- **Line 448:** `pending --> discussing --> planning --> executing --> complete --> merged`. Same present-tense issue as DOCS.md. Should be: `pending --> discussed --> planned --> executed --> complete --> merged`. Source: `src/lib/state-schemas.cjs` line 4.
- **Lines 451-458:** Transition table uses present-tense status names throughout (`discussing`, `planning`, `executing`). Every occurrence should use past-tense (`discussed`, `planned`, `executed`). Source: `src/lib/state-transitions.cjs`.
- **Lines 451-458:** Missing transitions:
  - `pending -> planned` (skip discuss shortcut). Source: `src/lib/state-transitions.cjs` line 4.
  - `discussed -> discussed` (re-discussion self-loop). Source: `src/lib/state-transitions.cjs` line 5.
  - `executed -> executed` (crash recovery self-loop). Source: `src/lib/state-transitions.cjs` line 7.
- **Lines 451-458:** Missing description of solo mode `complete -> merged` auto-transition. Source: `docs/state-machines.md` line 38.
- **Lines 493-514:** STATE.json schema uses the old format with `project.milestone` wrapper. The actual v5.0 schema (from `src/lib/state-schemas.cjs`) uses: `{ version, rapidVersion, projectName, currentMilestone, milestones: [{ id, name, sets: [{ id, status, waves }] }], lastUpdatedAt, createdAt }`. The documented schema is structurally wrong.
- **Lines 493-514:** The documented schema uses old status names in the enum comment: `"pending | discussing | planning | executing | complete | merged"`. Should be: `"pending | discussed | planned | executed | complete | merged"`.
- **Lines 493-514:** The documented schema does not show waves or jobs within sets. The actual schema nests waves (with status) and jobs (with status) inside each set. Source: `src/lib/state-schemas.cjs` lines 15-25.

### Review Pipeline

- **Line 39 (Workflow Overview table):** `/rapid:review` is described as "Adversarial pipeline: unit tests, bug hunt, UAT". This is wrong. Since v4.4, `/rapid:review` only produces REVIEW-SCOPE.md. The downstream review skills (`/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat`) are separate commands. Source: `skills/review/SKILL.md`, `docs/agents.md` lines 49-62.
- **Lines 186-218 (Review section):** The entire section describes a single `/rapid:review` command that runs scoping, unit testing, bug hunting, and UAT in a unified pipeline. This is the pre-v4.4 architecture. Current v5.0 architecture: `/rapid:review` only runs scoping. `/rapid:unit-test`, `/rapid:bug-hunt`, and `/rapid:uat` are independent commands. Source: DOCS.md lines 156-207, `docs/review.md`, `docs/agents.md` lines 49-62.
- **Lines 208-214 (Review output):** Lists `REVIEW-SUMMARY.md` as a review output. This file is not produced by the current review pipeline. The outputs are `REVIEW-SCOPE.md` (from `/rapid:review`), `REVIEW-UNIT.md` (from `/rapid:unit-test`), `REVIEW-BUGS.md` (from `/rapid:bug-hunt`), `REVIEW-UAT.md` (from `/rapid:uat`). Source: `docs/agents.md`.
- **Line 216:** "The set must be in `complete` status to start review" -- status name should use past-tense: `complete` is correct (it's not a gerund). However, the context around it uses wrong names elsewhere.

### Configuration

- **Lines 470-478 (Environment section):** Only lists `RAPID_TOOLS` as the sole environment variable. Missing:
  - `NO_COLOR` -- Suppresses ANSI color codes in banner output. Source: `src/lib/display.cjs` lines 102-103.
  - `RAPID_WEB` -- Enables Mission Control web dashboard features. Source: `src/lib/web-client.cjs` line 72+.
  - `RAPID_WEB_HOST` / `RAPID_WEB_PORT` -- Override dashboard host/port. Source: `src/lib/web-client.cjs` lines 108-109.
  Source: `docs/configuration.md` lines 13-15 (canonical config reference).
- **Lines 493-514 (STATE.json schema):** Schema is structurally wrong (see State Machine section above). The schema uses a `project.milestone` wrapper that does not exist in v5.0.
- **Lines 516-533 (Directory layout):** Missing entries:
  - `.rapid-web/` -- Per-project web dashboard data. Source: `docs/configuration.md` line 113.
  - `web/` -- Web dashboard source. Source: top-level `ls`.
  - `branding/` -- Branding assets directory. Source: top-level `ls`.
- **Missing config.json keys:** The document mentions no config.json keys at all. The actual v5.0 config surface includes: `lock_timeout_ms`, `agent_size_warn_kb`, `mode`, `parallelization`, `commit_docs`, `model_profile`, `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `granularity`, `solo`. Source: `docs/configuration.md` lines 35-47, `src/lib/core.cjs` line 109.
- **Missing flags documentation:** The `--gaps` flag (plan-set, execute-set), `--spec` flag (new-version), `--skip` flag (discuss-set), and `--uat` flag (bug-fix) are not documented in their respective command sections. Some flags are mentioned in passing but not in the command reference format.

### Merge Pipeline

- **Lines 222-263:** The merge section accurately describes the clean merge fast-path, 5-level conflict detection, 4-tier resolution cascade, and contract validation. However:
  - **Missing: Solo mode handling.** Solo sets auto-transition from `complete` to `merged` without branch merging. Source: `docs/state-machines.md` line 38, `src/lib/worktree.cjs`.
  - **Missing: DAG-ordered merging.** Line 226 mentions "Sets merge in dependency order defined by the DAG" but does not explain DAG.json or how ordering works. Source: `src/lib/dag.cjs`, `src/commands/dag.cjs`.
  - **Missing: MERGE-STATE.json.** Per-set merge tracking file that enables idempotent re-entry and bisection recovery. Source: `src/lib/merge.cjs` lines 37, 140-230.
  - **Missing: Bisection recovery.** The merge pipeline includes bisection recovery for detecting which merge introduced a regression. Source: `src/lib/merge.cjs` lines 1824-1913.

### Mission Control / Web Dashboard

- **Entirely absent.** The v4.0 web dashboard (Mission Control) is not documented anywhere in technical_documentation.md. The dashboard provides state views, worktree tracking, knowledge graph (DAG), codebase mapping, kanban board, and markdown notes. Gated by `RAPID_WEB=true`. Source: `docs/configuration.md` lines 120-128, `src/lib/web-client.cjs`, `web/` directory.

### Missing Systems (Not Documented Anywhere)

- **Gap-closure mode:** The full workflow (GAPS.md discovery, `--gaps` flag, gap-closure wave planning and execution) is undocumented. Source: `skills/plan-set/SKILL.md` lines 55-96, `skills/execute-set/SKILL.md` lines 61-99.
- **Memory system:** `rapid-tools.cjs` exposes `memory log-decision` and `memory log-correction` commands for agent decision logging. Not documented. Source: `src/commands/memory.cjs`, `src/bin/rapid-tools.cjs`.
- **Hook system:** Post-task verification hooks (`hooks run`, `hooks list`) and the verify shell script. Not documented. Source: `src/commands/hooks.cjs`, `src/hooks/rapid-verify.sh`, `src/lib/hooks.cjs`.
- **Quality profiles:** Agent output artifact verification against quality profile anti-patterns. Not documented. Source: `src/lib/quality.cjs` lines 697-748.
- **UI contracts:** Not documented in technical_documentation.md.
- **Branding system:** The branding interview flow, BRANDING.md artifact, and branding asset server. Not documented. Source: `skills/branding/`, `src/lib/branding-server.cjs`.
- **RAPID:RETURN protocol:** Structured return format (COMPLETE/CHECKPOINT/BLOCKED) used by all agents. Not documented. Source: `src/lib/returns.cjs`, `src/modules/core/core-returns.md`.
- **DAG.json:** Dependency graph for sets. Referenced in merge ordering but structure and generation not documented. Source: `src/lib/dag.cjs`, `src/commands/dag.cjs`, `.planning/sets/DAG.json`.
- **Worktree registry:** `REGISTRY.json` tracking active worktrees, branches, and solo mode entries. Not documented. Source: `src/lib/worktree.cjs`, `.planning/worktrees/REGISTRY.json`.
- **DEFERRED.md auto-discovery:** `/rapid:new-version` scans for DEFERRED.md files in active sets and archived milestones. Not documented. Source: `skills/new-version/SKILL.md` lines 101, 173-207.

### Spawn Hierarchy Completeness

- **Lines 378-437:** Missing entries compared to `docs/agents.md`:
  - `/rapid:bug-fix` dispatching `rapid-bugfix`. Source: `docs/agents.md` lines 86-87.
  - `/rapid:documentation` (skill-level orchestration, no subagent). Source: `docs/agents.md` lines 89-90.

---

## Cross-Reference Checklist

- [x] DOCS.md links to all 11 docs/ files (setup.md, agents.md, state-machines.md, configuration.md, troubleshooting.md, CHANGELOG.md, planning.md, execution.md, review.md, merge-and-cleanup.md, auxiliary.md)
- [ ] technical_documentation.md links to all 11 docs/ files -- **FAIL**: Only has 2 generic references to `docs/` directory (lines 20, 545). No specific file links. Should link to individual docs/ files where relevant.
- [ ] Explicit cross-references between DOCS.md and technical_documentation.md -- **PARTIAL**: technical_documentation.md line 545 links to DOCS.md. DOCS.md does not link to technical_documentation.md at all.
- [ ] technical_documentation.md references canonical state-machines.md -- **FAIL**: Inline state machine documentation is stale. Should reference `docs/state-machines.md` as source of truth.
- [ ] technical_documentation.md references canonical configuration.md -- **FAIL**: Inline configuration is incomplete. Should reference `docs/configuration.md`.
- [ ] technical_documentation.md references canonical agents.md -- **FAIL**: Inline agent catalog is stale. Should reference `docs/agents.md` for the current catalog.
