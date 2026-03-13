---
phase: 39-tool-docs-registry-core-module-refactor
verified: 2026-03-12T08:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 13/14
  gaps_closed:
    - "Generated rapid-executor.md contains tags in order: <identity>, <conventions>, <tools>, <role>, <returns>"
  gaps_remaining: []
  regressions: []
---

# Phase 39: Tool Docs Registry + Core Module Refactor Verification Report

**Phase Goal:** Every agent prompt contains only the CLI commands it needs, rendered in a validated XML structure with compact YAML tool blocks
**Verified:** 2026-03-12T08:00:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (Plan 04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getToolDocsForRole('executor') returns a compact YAML block containing only executor commands | VERIFIED | Returns `# rapid-tools.cjs commands\n  state-get: ...\n  state-transition-set: ...\n  verify-light: ...`; 25/25 tool-docs tests pass |
| 2 | getToolDocsForRole('research-synthesizer') returns null (role has no CLI commands) | VERIFIED | Test "returns null for research-synthesizer" passes; rapid-research-synthesizer.md has no `<tools>` tag |
| 3 | Every key in every ROLE_TOOL_MAP entry exists in TOOL_REGISTRY | VERIFIED | Test "every key referenced in ROLE_TOOL_MAP exists in TOOL_REGISTRY" passes; all 18 roles validated |
| 4 | Tool docs for any single role estimate under 1000 tokens | VERIFIED | Token budget test suite passes; all 18 roles confirmed under 1000 estimated tokens |
| 5 | assembleAgentPrompt() injects tool docs between core modules and role module, wrapped in `<tools>` tags | VERIFIED | Lines 641-644 of rapid-tools.cjs; test "rapid-executor.md contains `<tools>` section with expected commands" passes |
| 6 | Roles with no CLI commands get no `<tools>` section in their generated agent file | VERIFIED | Test "roles without CLI commands have no `<tools>` section" passes; research-synthesizer confirmed |
| 7 | ROLE_CORE_MAP references only 3 modules: core-identity.md, core-conventions.md, core-returns.md | VERIFIED | All 31 entries in ROLE_CORE_MAP use only these 3 files; no old module references in production code |
| 8 | Generated rapid-executor.md contains `<identity>`, `<conventions>`, `<tools>`, `<role>`, `<returns>` tags in that order | VERIFIED | Tag positions confirmed: identity(267), conventions(3694), tools(4780), role(5078), returns(8000). ORDER: CORRECT. Fix committed in 44f2788. |
| 9 | rapid-executor.md `<tools>` section contains executor-specific commands (state-get, state-transition-set, verify-light) | VERIFIED | All 3 executor commands confirmed present in agent file |
| 10 | Build-time warning fires for any role whose tool docs exceed 1000 estimated tokens | VERIFIED | Lines 641-644 of rapid-tools.cjs; token estimate check + warning output implemented |
| 11 | All build-agents tests pass including new XML structure and tool injection tests | VERIFIED | 12/12 tests pass; assembly order test now asserts returnsStart > roleStart |
| 12 | core-identity.md contains RAPID_TOOLS env var setup block | VERIFIED | Lines 43-46 of core-identity.md contain the setup bash block |
| 13 | core-conventions.md exists with git commit conventions | VERIFIED | Contains "Commit Message Format" with type(scope): description format and 4 rules |
| 14 | PROMPT-SCHEMA.md documents exactly 5 allowed tags plus conventions | VERIFIED | Documents identity, role, returns (required) + conventions, tools, context (optional) with assembly order |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/tool-docs.cjs` | TOOL_REGISTRY, ROLE_TOOL_MAP, getToolDocsForRole(), estimateTokens() | VERIFIED | 187 lines; 59 TOOL_REGISTRY entries; 18-role ROLE_TOOL_MAP; all 4 exports present |
| `src/lib/tool-docs.test.cjs` | Unit tests for tool-docs module (min 60 lines) | VERIFIED | 227 lines; 25 tests across 6 describe blocks; all pass |
| `src/modules/core/core-identity.md` | Agent identity + tool invocation + context loading + state rules | VERIFIED | Contains RAPID_TOOLS setup, Context Loading (5 rules), State Rules (5 rules) |
| `src/modules/core/core-conventions.md` | Git commit conventions | VERIFIED | Contains "Commit Message Format" section with all git conventions |
| `src/modules/PROMPT-SCHEMA.md` | XML schema reference for agent prompts with assembly order documented | VERIFIED | Documents 6 tags, assembly order, and rules; 52 lines |
| `src/bin/rapid-tools.cjs` | Updated ROLE_CORE_MAP, assembleAgentPrompt() with tool doc injection and deferred returns emission | VERIFIED | ROLE_CORE_MAP at lines 572-605; core-returns.md deferred to Step 5 in assembleAgentPrompt(); returns emitted after `<role>` at line 661 |
| `src/lib/build-agents.test.cjs` | Updated tests for 3-module core, 5-tag XML schema, tool injection, assembly order (min 150 lines) | VERIFIED | 248+ lines; 12 tests; assembly order test asserts `returnsStart > roleStart` |
| `agents/rapid-executor.md` | Agent with correct XML structure + embedded tool docs, returns last | VERIFIED | identity(267) < conventions(3694) < tools(4780) < role(5078) < returns(8000); ORDER: CORRECT |
| `src/modules/core/core-context-loading.md` (deleted) | Must not exist | VERIFIED | File does not exist |
| `src/modules/core/core-state-access.md` (deleted) | Must not exist | VERIFIED | File does not exist |
| `src/modules/core/core-git.md` (deleted) | Must not exist | VERIFIED | File does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/bin/rapid-tools.cjs` | `src/lib/tool-docs.cjs` | `require('../lib/tool-docs.cjs')` | WIRED | Line 454: `const { getToolDocsForRole, estimateTokens } = require('../lib/tool-docs.cjs');` |
| `src/bin/rapid-tools.cjs` | `src/modules/core/core-identity.md` | ROLE_CORE_MAP file references | WIRED | All 31 ROLE_CORE_MAP entries include `'core-identity.md'` |
| `src/bin/rapid-tools.cjs` | `src/modules/core/core-conventions.md` | ROLE_CORE_MAP file references | WIRED | 8 roles include `'core-conventions.md'`; planner, executor, orchestrator, job-executor, bugfix, merger, set-merger, conflict-resolver |
| `src/bin/rapid-tools.cjs` | `src/modules/core/core-returns.md` | assembleAgentPrompt() deferred emission (Step 5) | WIRED | `returnsModule` variable holds core-returns.md aside during core loop; emitted at line 661 after `<role>` |
| `agents/rapid-executor.md` | `src/lib/tool-docs.cjs` | `<tools>` section generated from getToolDocsForRole('executor') | WIRED | `<tools>` tag present with correct executor commands; generated by build pipeline |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-05 | Plan 01 | Tool docs registry (tool-docs.cjs) with per-role command specs and 1000-token budget per agent | SATISFIED | tool-docs.cjs with 59-command TOOL_REGISTRY, 18-role ROLE_TOOL_MAP, 25 passing unit tests; all roles under 1000 estimated tokens |
| AGENT-02 | Plans 02, 03, 04 | XML-formatted prompt structure with defined schema document (allowed tags, nesting rules) | SATISFIED | PROMPT-SCHEMA.md documents 6 tags with assembly order; all 31 agents have required tags; tag order now matches schema: identity < conventions < tools < role < returns; assembly order test enforces returnsStart > roleStart |
| AGENT-01 | Plan 03 | Each agent prompt embeds inline YAML of only the rapid-tools.cjs commands it needs | SATISFIED | assembleAgentPrompt() injects role-specific tool docs via getToolDocsForRole(); executor gets only its 3 commands; no-CLI roles get no `<tools>` section; 12/12 build tests pass |

All 3 required requirement IDs (AGENT-01, AGENT-02, AGENT-05) are accounted for. AGENT-02 closed its final gap in Plan 04. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/tool-docs.cjs` | 7 | Stale comment references deleted file: `// Source: rapid-tools.cjs USAGE + core-state-access.md + role modules` | Info | No functional impact |

No blocker or warning anti-patterns found.

### Human Verification Required

None identified. All critical behaviors are verifiable programmatically through tests and file inspection.

### Re-verification Summary

**Gap closed:** The single gap from the initial verification (XML tag assembly order) is fully resolved.

**Root cause fix:** `assembleAgentPrompt()` in `src/bin/rapid-tools.cjs` was modified to use a `returnsModule` variable that holds `core-returns.md` aside during the core module loop (Step 2), then emits it as Step 5 after the `<role>` section (Step 4). Simply reordering the `ROLE_CORE_MAP` arrays was insufficient because the loop emitted all core modules before `<role>`.

**ROLE_CORE_MAP also reordered** for 8 three-element roles (planner, executor, orchestrator, job-executor, bugfix, merger, set-merger, conflict-resolver): `['core-identity.md', 'core-conventions.md', 'core-returns.md']`. This keeps array order consistent with emission order for clarity.

**Test strengthened:** `build-agents.test.cjs` assembly order test now asserts `returnsStart > roleStart` in addition to the previous `<tools>` position checks.

**All 31 agents rebuilt** in commit `44f2788`. Spot-checked: rapid-planner, rapid-orchestrator, rapid-merger, rapid-bugfix, rapid-job-executor, rapid-reviewer, rapid-wave-researcher -- all report ORDER OK.

**No regressions** found. All previously passing items confirmed still passing:
- 12/12 build-agents tests pass
- 25/25 tool-docs tests pass (37 total)
- Deleted modules still absent (core-context-loading.md, core-state-access.md, core-git.md)
- All key artifacts present and wired

---

## Commit Verification

| Commit | Message | Plan |
|--------|---------|------|
| `efd4e67` | test(39-01): add failing tests for tool-docs module | Plan 01 RED |
| `1c62121` | feat(39-01): implement tool-docs module with registry, role map, and helpers | Plan 01 GREEN |
| `992a35a` | feat(39-02): consolidate core modules and create PROMPT-SCHEMA.md | Plan 02 |
| `9d7715f` | feat(39-03): update ROLE_CORE_MAP and add tool doc injection to assembleAgentPrompt | Plan 03 Task 1 |
| `e925bdb` | feat(39-03): update build-agents tests for 31 roles, 3-module core, tool injection, and rebuild all agents | Plan 03 Task 2 |
| `44f2788` | fix(39-04): reorder ROLE_CORE_MAP and assembleAgentPrompt to emit `<returns>` after `<role>` | Plan 04 |

---

_Verified: 2026-03-12T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
