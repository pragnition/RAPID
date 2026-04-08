# Gaps: backlog-system

## Gap 1: Hand-managed agent files not updated (W3.4)

**Severity:** HIGH
**Criterion:** Agent definitions in `agents/` are rebuilt (or source files updated if hand-managed)
**Details:** `agents/rapid-executor.md` and `agents/rapid-planner.md` are hand-written agents with condensed `<role>` sections (marked `<!-- CORE: Hand-written agent -- do not overwrite with build-agents -->`). The source role files at `src/modules/roles/` were updated correctly with Backlog Capture sections, but the agent files themselves were not updated to include the Backlog Capture section. Since these agents are the ones that actually run during execution, they need to be manually updated.

**Resolution:** Add a condensed Backlog Capture hint to the `<role>` sections of `agents/rapid-executor.md` and `agents/rapid-planner.md`.

**Status:** Resolved -- Commits 0c6611f (executor) and dcfb892 (planner) added Backlog Capture sections inside `<role>` blocks of both hand-written agents.
