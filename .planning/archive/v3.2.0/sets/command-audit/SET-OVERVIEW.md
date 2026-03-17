# SET-OVERVIEW: command-audit

## Approach

The v3.0 migration removed the `wave-plan` CLI subcommand family from the `rapid-tools.cjs` router, but left behind phantom references in three layers: the TOOL_REGISTRY/ROLE_TOOL_MAP in `src/lib/tool-docs.cjs`, skill markdown files (`skills/review/SKILL.md`, `skills/plan-set/SKILL.md`), and the `agents/rapid-plan-verifier.md` agent definition. These stale references cause `getToolDocsForRole('plan-verifier')` to throw at runtime (it hits the `wave-plan-validate` key which exists in ROLE_TOOL_MAP but references a phantom command) and mislead agent behavior by instructing them to call subcommands that do not exist.

The fix is surgical: remove four phantom entries from TOOL_REGISTRY (`wave-plan-resolve`, `wave-plan-create-dir`, `wave-plan-validate`, `wave-plan-list-jobs`), update ROLE_TOOL_MAP to drop any references to removed keys, and rewrite the specific skill/agent passages that invoke these commands -- replacing them with valid alternatives (e.g., `resolve wave`, filesystem globbing for job listing, or removing the instruction entirely where no replacement is needed).

A test will enforce the behavioral invariant going forward: every key in ROLE_TOOL_MAP must exist in TOOL_REGISTRY, and no skill/agent markdown may reference a `wave-plan` subcommand.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/tool-docs.cjs` | TOOL_REGISTRY and ROLE_TOOL_MAP definitions | Existing -- remove 4 phantom entries, update plan-verifier role |
| `skills/review/SKILL.md` | Review skill instructions | Existing -- remove `wave-plan list-jobs` invocation (lines 190-193) |
| `skills/plan-set/SKILL.md` | Plan-set skill instructions | Existing -- remove `wave-plan validate-contracts` invocation (line 280) |
| `agents/rapid-plan-verifier.md` | Plan verifier agent tools block | Existing -- remove `wave-plan-validate` from tools section (line 79) |
| `src/lib/display.cjs` | Display stage banners | Existing -- `wave-plan` is a valid display stage name (NOT a CLI subcommand), likely keep as-is |
| `skills/wave-plan/SKILL.md` | Deprecated redirect stub | Existing -- already redirects to plan-set, no changes needed |

## Integration Points

- **Exports:**
  - `src/lib/tool-docs.cjs` :: `TOOL_REGISTRY`, `ROLE_TOOL_MAP` -- cleaned registry with no phantom keys; `getToolDocsForRole()` safe to call for all roles
  - `skills/{review,plan-set}/SKILL.md` -- skills with valid CLI references only
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:**
  - `getToolDocsForRole('plan-verifier')` will stop throwing (currently crashes on missing `wave-plan-validate` key)
  - Agent `rapid-plan-verifier.md` will no longer instruct the agent to call a nonexistent subcommand
  - The review skill will need an alternative approach for listing job plans (glob-based filesystem scan instead of CLI call)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `display.cjs` uses `wave-plan` as a valid stage name for banners | Low | The display stage map is separate from CLI subcommands; `wave-plan` remains a valid stage alias for display purposes. Do not remove it from display.cjs. |
| Removing `wave-plan-validate` from plan-verifier leaves no contract validation path | Medium | Contract validation during planning is advisory only (per plan-set/SKILL.md line 283). The plan-verifier can validate contracts by reading CONTRACT.json directly rather than via a CLI subcommand. |
| Other files reference `wave-plan` in comments or test expectations | Low | `display.test.cjs` references `wave-plan` as a display stage (valid). `status-rename.test.cjs` and `build-agents.test.cjs` mention it in comments only. These are not phantom CLI calls and do not need changes. |
| Skill markdown changes could break agent behavior if replacement logic is wrong | Medium | Keep replacements minimal -- remove invalid CLI calls and replace with filesystem operations (Glob/Read) that agents already have access to. Do not invent new CLI subcommands. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Registry cleanup -- Remove 4 phantom entries from TOOL_REGISTRY, update ROLE_TOOL_MAP (drop `wave-plan-validate` from `plan-verifier`), update `agents/rapid-plan-verifier.md` tools block. Add consistency test asserting every ROLE_TOOL_MAP key exists in TOOL_REGISTRY.
- **Wave 2:** Skill audit -- Rewrite `skills/review/SKILL.md` section that calls `wave-plan list-jobs` (replace with glob-based job plan discovery). Rewrite `skills/plan-set/SKILL.md` section that calls `wave-plan validate-contracts` (replace with direct CONTRACT.json read or remove). Verify no other skill/agent files contain phantom CLI references.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
