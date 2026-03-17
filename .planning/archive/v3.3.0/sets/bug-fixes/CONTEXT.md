# CONTEXT: bug-fixes

**Set:** bug-fixes
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
This set addresses two discrete UX bugs in the daily RAPID workflow:
1. **DEFINITION.md path resolution failure** in `generateScopedClaudeMd()` — when `loadSet()` is called from a worktree context, the path resolves relative to the worktree root instead of the project root, causing DEFINITION.md reads to fail.
2. **Discuss-set "Let Claude Decide All" UX flaw** — the meta-action "Let Claude decide all" is presented as a peer checkbox alongside individual gray-area topics in a multiselect, conflating a skip-all action with per-topic selection.
</domain>

<decisions>
## Implementation Decisions

### DEFINITION.md Path Detection
- **Decision:** Auto-detect project root via `git rev-parse --show-toplevel` inside `loadSet()`. Callers should not need to change — the function internally resolves the correct project root regardless of whether `cwd` is a worktree path or the project root.
- Strict ID matching only — no fuzzy matching between set ID formats.

### Discuss-set Prompt Restructuring
- **Decision:** Use the implicit unselected model — remove "Let Claude decide all" as a peer option. Unselected topics automatically default to Claude's discretion.
- **Additional fix from todo.md:** When a gray area has multiple questions, each question should be its own AskUserQuestion header with prefilled options (including a "Claude decides" option per question), rather than bundling 2-3 questions into a single freeform text response. This means the `questions` array in AskUserQuestion should have one entry per question within the area.

### Error Behavior on Missing Files
- **Decision:** Keep throwing on missing DEFINITION.md. Improve the error message to distinguish between path resolution bugs (wrong cwd) and genuinely missing files.
- No fallback CLAUDE.md generation — if DEFINITION.md is missing, the error should surface clearly.

### Test Coverage Scope
- **Decision:** Both unit tests and integration tests.
  - Unit tests with mocked filesystem for the path resolution logic in `loadSet()`.
  - Integration test that creates real temporary directories mimicking worktree structure and verifies the behavioral invariant `definitionMdAlwaysFound` — running `generateScopedClaudeMd()` from a worktree context successfully finds DEFINITION.md.
</decisions>

<specifics>
## Specific Ideas
- Use `git rev-parse --show-toplevel` as the canonical way to find project root in `loadSet()`
- Each AskUserQuestion within a gray area deep-dive should use the multi-question feature (1-4 questions per call) with prefilled options per question, not a single freeform prompt
- The implicit model means the skill Step 5 presents only the 4 gray areas as multiSelect options — any unselected ones are recorded as "Claude's Discretion" without an explicit checkbox
</specifics>

<code_context>
## Existing Code Insights
- `plan.cjs:loadSet()` (line 139-160) reads DEFINITION.md from `path.join(cwd, '.planning', 'sets', setName)` — the `cwd` parameter is the root of confusion
- `worktree.cjs:generateScopedClaudeMd()` (line 566) calls `plan.loadSet(cwd, setName)` where `cwd` is passed by the caller — currently the worktree command handler may pass worktree path instead of project root
- `worktree.cjs:setInit()` (line 316) catches `generateScopedClaudeMd()` errors gracefully and continues with `claudeMdError` set
- `skills/discuss-set/SKILL.md` Step 5 (line 147-172) is where the multiselect with "Let Claude decide all" lives
- The existing `worktree.cjs:gitExec()` helper can be reused for `git rev-parse` calls
- CONTRACT.json has `behavioral.definitionMdAlwaysFound` and `behavioral.noAutoDecideCheckbox` as test-enforced invariants
</code_context>

<deferred>
## Deferred Ideas
- (none)
</deferred>
