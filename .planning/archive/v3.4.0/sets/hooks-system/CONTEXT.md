# CONTEXT: hooks-system

**Set:** hooks-system
**Generated:** 2026-03-17
**Mode:** interactive

<domain>
## Set Boundary
Node.js hook system that verifies project state is updated after agent task completion. Extends the existing Claude Code hook infrastructure (rapid-task-completed.sh) with state verification, artifact checking, and remediation prompts. Includes a RAPID-internal verification config and CLI commands for managing which checks run.
</domain>

<decisions>
## Implementation Decisions

### Hook Architecture

- **Claude Code native hooks:** Build on Claude Code's existing hook system, NOT a separate RAPID hook registry. The existing `src/hooks/rapid-task-completed.sh` is the integration point — extend it (or add a companion script) to include state verification logic that fires on the TaskCompleted event.
- **No separate hooks.json registry:** Instead of `hooks/hooks.json` as a standalone registry, use a RAPID verification config file that controls which built-in checks are enabled/disabled. The Claude Code hook entry in settings stays static.

### Hook Config Location

- **RAPID verification config:** A config file (within .planning/ or src/hooks/) that controls which verification checks are active. The CLI commands manage this config, not Claude Code's settings.json.
- **Auto-generated during init:** Config created during project initialization with state-verify hook pre-registered and enabled.

### State Verification Scope

- **Comprehensive verification:** Cross-check all of the following after RAPID:RETURN:
  - STATUS.json status transitions match reported status
  - Reported artifacts actually exist on disk
  - Commit hashes present in git log
  - Task counts (tasks_completed/tasks_total) match
  - Wave progress consistency
- **Read-only STATE.json access** via `readState()` — no write locks (behavioral contract).

### Hook Extensibility

- **Built-in checks only:** Ship with fixed verification checks (state, artifacts, commits). Users toggle them on/off via CLI but cannot add custom checks. Keeps surface area minimal.

### CLI Output

- **Match rapid-tools style:** JSON-first output matching existing rapid-tools command patterns. Structured, parseable by skills and agents.

### Claude's Discretion

- Specific config file format and schema
- Error message wording and remediation prompt text
- Internal code organization (single file vs directory for verification checks)
- Test structure and coverage granularity
</decisions>

<specifics>
## Specific Ideas
- Extend rapid-task-completed.sh rather than replacing it — maintain backward compatibility with existing team tracking
- Verification runs non-blocking: failures produce warnings + remediation prompts but never halt the pipeline
- Idempotent: running hooks multiple times on the same RAPID:RETURN produces identical results
</specifics>

<code_context>
## Existing Code Insights

- `src/hooks/rapid-task-completed.sh` — existing Claude Code hook that tracks task completion to `.planning/teams/` JSONL files. Currently only processes `rapid-wave-*` team tasks. This is the integration point.
- `src/lib/state-machine.cjs:readState()` (line 47) — async, lock-free read of STATE.json. Returns null if missing. This is the read-only path hooks must use.
- `src/lib/returns.cjs:parseReturn()` (line 26) — extracts RAPID:RETURN JSON from agent output text.
- `src/lib/returns.cjs:validateReturn()` (line 74) — validates parsed return data structure.
- `src/lib/core.cjs:findProjectRoot()` — locates project root by searching for `.planning/` directory.
- CLI registration pattern: commands in `src/commands/*.cjs`, registered in `src/bin/rapid-tools.cjs` router, documented in `src/lib/tool-docs.cjs` TOOL_REGISTRY.
- All rapid-tools commands output structured JSON for agent consumption.
</code_context>

<deferred>
## Deferred Ideas
- Future: pluggable user-defined verification scripts (decided against for now to keep surface area minimal)
- Future: hook system could be extended to fire on other events beyond task completion (e.g., pre-merge, post-plan)
- Future: dashboard/reporting on hook verification history over time
</deferred>
