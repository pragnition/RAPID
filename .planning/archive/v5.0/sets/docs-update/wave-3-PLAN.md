# PLAN: docs-update -- Wave 3

**Objective:** Rewrite `technical_documentation.md` from its current v3.0 content to accurately reflect v5.0. The rewrite follows the "thin companion" architecture decision: focus on how systems fit together (architecture narrative, cross-cutting concerns, design rationale), with summarize-and-link for topics covered in docs/. The current 545-line file needs a significant structural rewrite, not incremental patches.

**Input:** `.planning/sets/docs-update/GAP-ANALYSIS.md` (produced by Wave 1)
**Modified File:** `technical_documentation.md`

---

## Task 1: Rewrite Header, TOC, and Workflow Overview

**File:** `technical_documentation.md` (lines 1-43)

**Action:** Rewrite the opening to reflect v5.0 identity and the thin-companion role.

**Header changes:**
- Line 1: Keep title "# RAPID Technical Documentation"
- Line 3: Replace "v3.0" with "v5.0". Replace "26 agents" with "27 agents". Add sentence establishing the document's role: architectural narrative and cross-cutting design rationale, deferring per-topic detail to docs/.
- Add explicit cross-reference: "For command reference and quick lookup, see [DOCS.md](DOCS.md). For topic-specific detail, see the [docs/](docs/) directory."

**TOC restructure:** Reorganize to reflect the architectural narrative focus:
1. System Architecture (the narrative opening)
2. Agent Pipeline (how agents flow through the lifecycle)
3. State Machine Design (rationale, not just the diagram)
4. Planning and Execution Architecture
5. Review Cascade Architecture
6. Merge Strategy Architecture
7. Configuration and Environment
8. Cross-Cutting Concerns (memory, hooks, contracts, RAPID:RETURN, solo mode)
9. Reference Links (pointers to docs/ files)

**Workflow Overview:** Update the lifecycle diagram to use past-tense status names. Update the stage table to reflect current v5.0 command behavior (e.g., review is scoping-only, not the full pipeline).

**Verification:** `grep "v5.0" technical_documentation.md | head -3` shows v5.0 in the header. `grep "v3.0" technical_documentation.md` returns nothing.

---

## Task 2: Write System Architecture Narrative

**File:** `technical_documentation.md`

**Action:** Replace the current Project Initialization section (lines 46-92) and Set Lifecycle section (lines 94-153) with a unified "System Architecture" section that explains how RAPID's components fit together.

**Content to cover:**
- **Skills-as-dispatchers pattern:** Skills are their own dispatchers. No central coordination agent. Each `/rapid:*` command directly spawns the agents it needs.
- **Set isolation model:** Git worktrees provide filesystem isolation. Each set gets its own branch and working directory. File ownership is exclusive -- no two sets modify the same file.
- **State hierarchy:** Sets are the sole stateful entity in STATE.json. Waves and jobs exist as planning artifacts only. State is validated by Zod schemas at runtime.
- **Contract system:** CONTRACT.json defines machine-verifiable interface boundaries between sets. Contracts specify file ownership, exported functions/types, and imported dependencies.
- **Artifact-driven architecture:** The system bootstraps from STATE.json and disk artifacts. No conversation context is required -- fully self-contained after `/clear`. Crash recovery uses artifact scanning (WAVE-COMPLETE.md markers, git log) rather than in-memory state.

**Style:** Narrative prose explaining design rationale (why these choices were made), not just listing what exists. Reference relevant docs/ files with explicit links.

**What NOT to do:** Do not reproduce the full init pipeline or set lifecycle step-by-step -- that detail belongs in docs/planning.md.

**Verification:** The section contains at least one link to a docs/ file. The section does not contain step-by-step command instructions.

---

## Task 3: Rewrite Agent Pipeline Section

**File:** `technical_documentation.md`

**Action:** Replace the current Agent Reference section (lines 306-437) with a concise Agent Pipeline section.

**Content:**
- **27 agents in 7 categories** (not 26 in 6). List the categories with counts: Core (4), Research (7), Review (7), Merge (2), Utility (6), Context (1). Note that `rapid-auditor` was added in v4.2.1 (Utility is 6, not 5).
- **Hybrid build model:** 4 core agents (planner, executor, merger, reviewer) are hand-written. The remaining 23 are generated via `build-agents` with embedded tool docs and XML prompt structure.
- **Brief category descriptions** (1-2 sentences each) explaining the role of each category.
- **Summarize and link:** "For the complete agent catalog with spawn hierarchy, input/output specs, and dispatch map, see [docs/agents.md](docs/agents.md)."

**What NOT to do:** Do not reproduce the full agent tables or spawn hierarchy tree. That detail lives in docs/agents.md.

**Verification:** `grep "27" technical_documentation.md` confirms the agent count. `grep "rapid-auditor" technical_documentation.md` confirms the new agent is mentioned. `grep "docs/agents.md" technical_documentation.md` confirms the cross-reference.

---

## Task 4: Rewrite State Machine Section

**File:** `technical_documentation.md`

**Action:** Replace the current State Machine section (lines 441-467) with a design-focused section.

**Content:**
- **SetStatus lifecycle diagram** using past-tense names: `pending -> discussed -> planned -> executed -> complete -> merged`
- Include self-loops and shortcuts in the diagram (matching docs/state-machines.md)
- **Design rationale:** Why sets are the sole stateful entity. Why wave/job state is kept as planning artifacts rather than in STATE.json. Why independence (no cross-set transition blocking) enables safe parallelism.
- **Solo mode:** Solo sets skip worktree creation and auto-transition `complete -> merged`.
- **Crash recovery triad:** `detectCorruption`, `recoverFromGit`, atomic writes. Brief description with link.
- **Summarize and link:** "For the full transition table and wave/job lifecycles, see [docs/state-machines.md](docs/state-machines.md)."

**What NOT to do:** Do not reproduce the full transition table. Do not list every crash recovery step.

**Verification:** All status names use past-tense. `grep "docs/state-machines.md" technical_documentation.md` returns at least 1. The section mentions solo mode.

---

## Task 5: Write Review Cascade and Merge Strategy Sections

**File:** `technical_documentation.md`

**Action:** Replace the current Review section (lines 186-218) and Merge section (lines 222-263) with architecture-focused rewrites.

**Review Cascade Architecture:**
- **4-skill split** (v4.4+): `/rapid:review` scopes only (produces REVIEW-SCOPE.md). `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat` consume the scope independently.
- **Design rationale:** Why scoping was separated from testing. Why the three test skills run independently rather than sequentially.
- **Adversarial pattern:** Hunter-advocate-judge with iterative fix-and-rehunt cycles. Brief description of the pattern's purpose.
- **UAT architecture:** Plan-generation approach, human-verified loop, UAT-FAILURES.md. Only include if verified in the codebase.
- **Link:** "For the full review pipeline stages, see [docs/review.md](docs/review.md)."

**Merge Strategy Architecture:**
- **DAG-ordered merging:** Sets merge in dependency order from DAG.json.
- **Fast-path optimization:** `git merge-tree --write-tree` detects clean merges before spawning subagents.
- **5-level conflict detection** and **4-tier resolution cascade** (brief summary of levels and tiers).
- **Adaptive resolution:** Mid-confidence conflicts dispatched to `rapid-conflict-resolver` agents.
- **Solo mode:** Solo sets skip merge entirely (auto-transition).
- **MERGE-STATE.json:** Tracks processed sets for idempotent re-entry.
- **Bisection recovery:** Mention briefly with link.
- **Contract validation:** Pre-merge contract check.
- **Link:** "For the full merge pipeline, see [docs/merge-and-cleanup.md](docs/merge-and-cleanup.md)."

**Verification:** `grep "REVIEW-SCOPE.md" technical_documentation.md` confirms the 4-skill split is documented. `grep "DAG" technical_documentation.md` confirms DAG-ordered merging. Both sections link to their respective docs/ files.

---

## Task 6: Rewrite Configuration Section and Add Cross-Cutting Concerns

**File:** `technical_documentation.md`

**Action:** Replace the current Configuration section (lines 470-542) and add a new Cross-Cutting Concerns section.

**Configuration (brief):**
- **Environment variables:** RAPID_TOOLS (required), NO_COLOR (optional), RAPID_WEB (optional for Mission Control).
- **.env file:** Loaded by all skills as fallback. Contains RAPID_TOOLS, optional API keys.
- **config.json:** Key settings -- model_profile, granularity, workflow toggles (research, plan_check, verifier), lock_timeout_ms, solo mode.
- **Link:** "For the full configuration reference, see [docs/configuration.md](docs/configuration.md)."

**Cross-Cutting Concerns (new section):**
- **Memory system:** How agents build and query project memory across sessions.
- **Hook system:** Pre/post hooks on lifecycle transitions.
- **RAPID:RETURN protocol:** Structured return format (COMPLETE/CHECKPOINT/BLOCKED) used by all agents for machine-parseable handoff.
- **DAG.json and worktree registry:** How parallel set ordering and worktree tracking work.
- **Quality profiles:** Model profiles and granularity settings that shape agent behavior.
- **DEFERRED.md auto-discovery:** How `/rapid:new-version` discovers deferred items across sets.
- **Gap-closure mode:** `--gaps` flag on plan-set and execute-set for post-merge gap remediation.

For each concern: 2-4 sentences explaining what it is and why it matters architecturally. Do not write exhaustive detail -- this is the thin-companion role.

**Verification:** The configuration section links to docs/configuration.md. The cross-cutting concerns section mentions at least 5 of the 7 listed systems.

---

## Task 7: Write Reference Links Section and Final Polish

**File:** `technical_documentation.md`

**Action:** Add a "Reference Links" section at the end that explicitly links to all 11 docs/ files with a one-line description of each.

**Format:**
```markdown
## Reference Links

| Document | Coverage |
|----------|----------|
| [docs/agents.md](docs/agents.md) | Full agent catalog, spawn hierarchy, I/O specs |
| [docs/state-machines.md](docs/state-machines.md) | SetStatus lifecycle, wave/job states, transition rules |
| ... |
```

**Also:**
- Add explicit cross-reference to DOCS.md in the header area
- Remove any remaining v3.0 references (search for "v3.0", "26 agents", "5 agents" in Utility context)
- Remove any descriptions of removed/deprecated features (silent removal per CONTEXT.md decision)
- Ensure the file ends cleanly with the reference links table

**Verification:**
- `grep -c "docs/" technical_documentation.md` returns at least 11 (one per docs/ file)
- `grep "v3.0" technical_documentation.md` returns nothing
- `grep "26 agents" technical_documentation.md` returns nothing
- `grep "DOCS.md" technical_documentation.md` returns at least 1

---

## Success Criteria

1. technical_documentation.md reflects v5.0 throughout -- no v3.0 references remain
2. 27 agents in 7 categories are documented (not 26 in 6)
3. All 10 previously missing commands are represented (at minimum via the cross-cutting concerns or reference links)
4. State machine uses past-tense status names with self-loops and shortcuts
5. Review pipeline reflects the 4-skill split architecture
6. Merge pipeline includes DAG ordering, solo mode, MERGE-STATE.json
7. Configuration includes all current env vars and config.json keys
8. Cross-cutting concerns section covers memory, hooks, RAPID:RETURN, DAG, quality profiles, DEFERRED auto-discovery, gap-closure
9. All 11 docs/ files are linked with descriptions
10. Explicit cross-references to DOCS.md are present
11. The document reads as an architectural narrative (how systems fit together) rather than a command reference (that role belongs to DOCS.md)
