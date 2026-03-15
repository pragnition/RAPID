# SET-OVERVIEW: command-cleanup

## Approach

This set performs a surgical deletion of six deprecated command families from the RAPID codebase: `set-init`, `discuss` (standalone), `wave-plan`, `plan-set`, `execute` (standalone), and `new-milestone`. These commands were superseded in v3.0 by their modern equivalents (`start-set`, `discuss-set`, `execute-set`, etc.) but their registry entries, CLI handlers, display mappings, and test fixtures were never removed. The primary risk is accidentally removing a current command that shares a prefix with a deprecated one (e.g., removing `discuss-set` when targeting `discuss`).

The work follows a bottom-up strategy: first identify every deprecated reference via grep-based audit, then remove entries from the two authoritative registries (TOOL_REGISTRY and ROLE_TOOL_MAP in tool-docs.cjs), then clean up the CLI handler (`handleSetInit` in rapid-tools.cjs), the USAGE help string, and the display stage maps (STAGE_VERBS, STAGE_BG in display.cjs). Finally, update all test files that assert on the deprecated entries and add a negative-assertion test confirming no deprecated keys survive. Because this set has zero imports, it can execute fully independently.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/tool-docs.cjs | TOOL_REGISTRY and ROLE_TOOL_MAP -- primary cleanup targets | Existing (modify) |
| src/lib/tool-docs.test.cjs | Tests for TOOL_REGISTRY/ROLE_TOOL_MAP integrity | Existing (modify) |
| src/bin/rapid-tools.cjs | CLI entry point: USAGE string, `set-init` case handler, `handleSetInit` function | Existing (modify) |
| src/lib/display.cjs | STAGE_VERBS and STAGE_BG maps with deprecated entries | Existing (modify) |
| src/lib/display.test.cjs | Tests asserting deprecated stages exist in STAGE_VERBS/STAGE_BG | Existing (modify) |
| src/lib/worktree.cjs | Contains `/set-init` reference in suggested actions | Existing (modify) |
| src/lib/worktree.test.cjs | Tests asserting `/set-init` in suggested actions | Existing (modify) |
| src/modules/roles/role-roadmapper.md | References `/rapid:wave-plan` in role documentation | Existing (modify) |
| src/lib/build-agents.test.cjs | Comment referencing deprecated wave-planner roles | Existing (minor) |

## Integration Points

- **Exports:** Cleaned TOOL_REGISTRY (no `set-init-*` or `wave-plan-*` keys) and cleaned ROLE_TOOL_MAP (no references to deprecated keys, specifically `wave-plan-validate` removed from `plan-verifier` role). These are consumed by `getToolDocsForRole()` which injects tool documentation into generated agent prompts.
- **Imports:** None. This set has zero dependencies on other sets.
- **Side Effects:** Generated agent `.md` files (produced by `build-agents`) will no longer include deprecated tool docs in their `<tools>` sections. The `plan-verifier` role loses access to `wave-plan-validate` and may need a replacement tool key or removal from ROLE_TOOL_MAP entirely if it has no remaining valid tools.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-deletion of `discuss` hitting `discuss-set` | High | Use exact-match patterns; grep for `'discuss'` (with quotes/boundaries), not substring |
| Over-deletion of `execute` hitting `execute-set`, `execute-prepare`, etc. | High | Only remove the standalone `execute` stage entry in display.cjs; all `execute-*` TOOL_REGISTRY keys are current and must stay |
| `plan-verifier` role left with dangling reference after `wave-plan-validate` removal | Medium | Audit ROLE_TOOL_MAP after deletion; either replace with current equivalent or remove role entry |
| `worktree.cjs` suggests `/set-init` to users for pending sets | Medium | Replace suggested action with `/rapid:start-set` equivalent |
| Display tests hardcode full stage lists including deprecated entries | Low | Update test fixtures to match new stage lists; tests are the validation layer |

## Wave Breakdown (Preliminary)

- **Wave 1:** Registry and documentation cleanup -- remove deprecated keys from TOOL_REGISTRY, ROLE_TOOL_MAP, USAGE string, and role markdown files. This is the core deletion work.
- **Wave 2:** Handler and display cleanup -- remove `handleSetInit` function and its case branch from rapid-tools.cjs, remove deprecated entries from STAGE_VERBS/STAGE_BG in display.cjs, update worktree.cjs suggested actions.
- **Wave 3:** Test updates and verification -- update all test fixtures to reflect removed entries, add negative-assertion tests confirming no deprecated references survive in source, run full test suite.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
