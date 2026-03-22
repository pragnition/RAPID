# CONTEXT: unit-test-improvements

**Set:** unit-test-improvements
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Removes the 5-concern-group limit from the unit-test skill and makes the test runner framework-agnostic by auto-detecting the project's native test tooling during init research. Owned files: `skills/unit-test/SKILL.md`, `src/lib/context.cjs`, `skills/init/SKILL.md`, `.planning/config.json`. No dependencies on other sets -- self-contained.
</domain>

<decisions>
## Implementation Decisions

### Batch Size & Approval UX

- **Batch size:** Dynamic based on total concern group count -- use `ceil(total / 3)` so there are always approximately 3 batches regardless of how many groups the scoper produces.
- **Approval gate:** Auto-continue between batches. Only prompt the user if a batch has test failures. This minimizes friction for clean runs while preserving user control when things go wrong.

### Detection Heuristics

- **Multi-framework projects:** Store an array of detected frameworks, one entry per detected language. The unit-test skill selects the appropriate runner per-file based on file extension → language → framework entry. This supports polyglot/monorepo projects natively.
- **Detection failure fallback:** When no recognizable test framework is detected for a language, Claude autonomously picks the best framework for that language (e.g., pytest for Python, cargo test for Rust, go test for Go, node --test for JavaScript/TypeScript). No user prompt, no hardcoded default.

### Config Schema & Overrides

- **Config shape:** `testFrameworks` field in config.json as an array of `{lang, framework, runner}` objects. Example: `[{"lang": "javascript", "framework": "node:test", "runner": "node --test"}, {"lang": "python", "framework": "pytest", "runner": "pytest"}]`.
- **Manual overrides:** Manual edits to config.json win over auto-detection. If a user modifies `testFrameworks` entries, subsequent init runs preserve those values and do not overwrite them. Detection only fills in missing entries.

### Skill Prompt Rewrite Scope

- **SKILL.md changes:** Surgical edits only. Replace the hardcoded "up to 5 concern groups maximum" with dynamic batching logic, swap `node --test` references with config-based runner lookup. Keep the overall SKILL.md structure and step numbering intact.
- **Fixer agent:** The retry/fixer agent in Step 5a becomes runner-aware -- receives the detected runner command so it re-runs tests with the correct framework instead of hardcoded `node --test`.
</decisions>

<specifics>
## Specific Ideas
- Batch formula: `ceil(totalGroups / 3)` ensures ~3 batches for any group count
- Config field name: `testFrameworks` (plural) as array, not singular `testFramework`
- Detection order in context.cjs: package.json → Cargo.toml → pyproject.toml → go.mod → requirements.txt
- Manual override detection: compare existing config entries by `lang` key; if entry already exists and has been modified (differs from what detection would produce), preserve it
</specifics>

<code_context>
## Existing Code Insights

- `src/lib/context.cjs` already has `MANIFESTS` array with language detection (package.json → javascript, Cargo.toml → rust, pyproject.toml → python, go.mod → go). The `detectCodebase()` function returns `languages[]` which can be used to drive framework selection.
- `skills/unit-test/SKILL.md` Step 3 has the hardcoded "up to 5 concern groups maximum" limit. Step 5 hardcodes `node --test` in agent prompts. Step 5a fixer agent also hardcodes `node --test`.
- The init skill (`skills/init/SKILL.md`) has a research phase where codebase detection runs -- this is the natural place to add test framework detection and config population.
- `.planning/config.json` already exists as a project config file -- adding `testFrameworks` array extends the existing schema.
- `PY_FRAMEWORKS` and `JS_FRAMEWORKS` constants in context.cjs detect application frameworks (React, FastAPI, etc.) but not test frameworks -- test framework detection is a new capability to add alongside these.
</code_context>

<deferred>
## Deferred Ideas
- Per-directory test framework overrides for complex monorepos (out of scope -- array-per-language covers most cases)
- Test coverage reporting integration (separate set)
- Parallel batch execution within a single batch (would require agent pool management)
</deferred>
