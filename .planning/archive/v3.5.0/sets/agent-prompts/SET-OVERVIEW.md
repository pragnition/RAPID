# SET-OVERVIEW: agent-prompts

## Approach

This set addresses two related prompt-correctness issues that cause user-visible failures: agents hallucinating CLI subcommands that do not exist (F1), and discuss-set presenting 5 gray area options when AskUserQuestion enforces a hard limit of 4 (F3). Both are prompt engineering fixes -- no library or state machine code changes are required.

The core strategy is to establish a canonical CLI command reference inside `src/modules/core/core-identity.md` so that every agent built by `build-agents` automatically receives the correct command catalog. This eliminates the class of bugs where agents fabricate subcommands like `state set-status` or `state --help`. The TOOL_REGISTRY in `src/lib/tool-docs.cjs` already maintains per-role command subsets, but the human-readable reference that agents rely on for general orientation is missing from the identity module. Adding it there ensures propagation through the build pipeline to all 26 agents without manual per-agent editing.

For the discuss-set fix, the template in `skills/discuss-set/SKILL.md` Step 5 lists 5 numbered options despite the heading saying "4 gray areas." The Key Principles section also says "2-5 gray areas" instead of "2-4." Both must be corrected to match the AskUserQuestion 4-option platform constraint. After the template fix, `build-agents` must be re-run to regenerate all agent files so the CLI reference propagates.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/modules/core/core-identity.md` | Shared identity module for all agents -- add CLI command reference section | Existing (modify) |
| `src/lib/tool-docs.cjs` | TOOL_REGISTRY and ROLE_TOOL_MAP -- source of truth for CLI commands | Existing (verify, possibly test) |
| `src/commands/build-agents.cjs` | Build pipeline that assembles agent prompts from modules | Existing (run after changes) |
| `skills/discuss-set/SKILL.md` | discuss-set skill with gray area option template | Existing (modify) |
| `agents/*.md` | All 26 generated agent files -- rebuilt by build-agents | Existing (regenerated) |
| `src/lib/tool-docs.test.cjs` | Tests for tool-docs module | Existing (extend) |

## Integration Points

- **Exports:**
  - `cli-reference-in-core-identity` -- A complete CLI command reference section in `core-identity.md` that all agents inherit via the build pipeline
  - `corrected-agent-commands` -- All 26 agents rebuilt with correct CLI command references from the updated `core-identity.md`
  - `four-option-discuss` -- discuss-set presents exactly 4 gray area options matching the AskUserQuestion limit

- **Imports:** None -- this set has no dependencies on other sets

- **Side Effects:**
  - All 26 agent `.md` files in `agents/` will be regenerated (content changes, not new files)
  - The `core-identity.md` module grows by approximately 2KB with the embedded CLI reference

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| CLI reference in core-identity inflates prompt token budget | Low | Use condensed format (one-liners); estimated ~2KB is well within budget. Per-role tool docs already filter to relevant commands. |
| TOOL_REGISTRY drifts from actual CLI commands after this fix | Medium | Add automated test that compares TOOL_REGISTRY keys against the USAGE string in `rapid-tools.cjs` to catch future drift |
| Regenerated agents overwrite hand-written core agents (executor, planner, merger, reviewer) | High | build-agents already respects `<!-- CORE: Hand-written agent -->` comment -- verify this guard works before running rebuild |
| discuss-set Key Principles section has other inconsistencies besides option count | Low | Do a full audit of the SKILL.md during implementation; fix any remaining mismatches between heading text and option counts |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add CLI command reference section to `core-identity.md` sourced from TOOL_REGISTRY. Fix discuss-set SKILL.md to use exactly 4 options in Step 5 and update Key Principles from "2-5" to "2-4". Add test validating TOOL_REGISTRY against actual CLI USAGE.
- **Wave 2:** Run `build-agents` to regenerate all 26 agents. Audit generated agents to confirm CLI reference is embedded and hand-written agents are preserved. Verify no agent references a nonexistent subcommand.
- **Wave 3:** Final validation -- run existing tests, confirm behavioral invariants (no hallucinated commands, discuss option limit, build-agents propagation).

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
