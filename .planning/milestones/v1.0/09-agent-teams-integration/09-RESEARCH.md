# Phase 9: Agent Teams Integration - Research

**Researched:** 2026-03-05
**Domain:** Claude Code Agent Teams API, dual-mode execution orchestration
**Confidence:** MEDIUM

## Summary

Phase 9 adds a second execution pathway to RAPID's `/rapid:execute` skill that uses Claude Code's experimental Agent Teams feature for enhanced parallel execution, while preserving the existing subagent pipeline as the default fallback. The core challenge is building a dual-mode abstraction where the execute skill detects `EXPERIMENTAL_AGENT_TEAMS` availability at startup, prompts the user for mode selection, and then dispatches to either the teams-based or subagent-based execution path -- with identical verification, reconciliation, and status output regardless of mode.

Agent Teams is an experimental Claude Code feature (released February 2026) that coordinates multiple independent Claude Code instances working in parallel. Unlike subagents (which run within a single session and report back), agent teams use a shared task list with dependency tracking, inter-teammate messaging, and native completion events. However, there is a known open bug (#13533, originally surfaced as #23506) where custom agents launched with `--agent` cannot access the Task tool for spawning subagents into teams. Since RAPID runs as a **plugin with skills** (not via `--agent`), this bug likely does not affect RAPID's execution context -- but this must be validated early.

**Primary recommendation:** Implement a thin execution mode abstraction layer (`teams.cjs`) that wraps agent team lifecycle operations (detect, spawn team, create teammates, track completion, teardown) while reusing ALL existing verification, reconciliation, and status infrastructure unchanged. The execute skill gets a mode selection step at the top and a mode-aware dispatch in Step 7 (Execute Phase); all other steps remain identical.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Detection uses both settings.json (to set the env var) AND runtime env var check
- Check happens once at `/rapid:execute` start -- mode is locked for the entire execution run
- When agent teams are detected, prompt the user via AskUserQuestion: "Agent teams available. Use teams or subagents?"
- Prompt is clean -- no explanation of detection source, just the choice
- If env var is not set or detection fails, silently use subagent mode (no prompt)
- One team per wave -- create a team when a wave starts, teammates are the sets in that wave, team dissolves after wave completes
- Each teammate gets its own worktree, same as subagent mode -- reuse existing worktree.cjs infrastructure
- No inter-teammate messaging -- teammates work in isolation, contracts replace the need for communication
- Track teammate completion using agent teams' native TaskCompleted events
- /rapid:status shows a mode indicator line: "Execution mode: Agent Teams" or "Execution mode: Subagents"
- wave-status and reconcile commands use the same logic in both modes -- read worktree registry, run contract tests, produce same output format
- Teams mode changes HOW sets execute, not how we verify or report
- Wave summaries (WAVE-{N}-SUMMARY.md) include which execution mode was used for that wave
- Fallback occurs at both detection time AND mid-execution
- If team operation fails mid-execution (team spawn fails, teammate crashes), auto-retry the failed wave using subagent mode
- Print a visible warning when fallback happens: "Agent teams failed for wave N. Falling back to subagent execution."
- Generic fallback for any failure -- do not special-case bug #23506 or any specific error signature
- Mode prompt (AskUserQuestion) uses the standard Claude Code pattern with two options

### Claude's Discretion
- Internal architecture for the dual-mode abstraction layer
- How to structure the team creation/teardown lifecycle
- TaskCompleted hook implementation details
- Error detection and retry timing for mid-execution fallback

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-06 | RAPID detects EXPERIMENTAL_AGENT_TEAMS env var and offers agent teams execution mode with subagent fallback | Detection via `process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, AskUserQuestion prompt for mode selection, teams.cjs abstraction layer for team lifecycle, generic try/catch fallback at wave level |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Code Agent Teams API | Experimental (Feb 2026) | Parallel teammate execution via shared task list | First-party Claude Code feature, the only way to get true independent parallel Claude sessions with native coordination |
| Node.js built-in (process.env) | 18+ | Environment variable detection | Zero-dependency, standard approach for feature flags |
| Node.js built-in (node:test) | 18+ | Unit testing | Already used across all RAPID modules (project convention from Phase 1) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Claude Code Hooks API | Current | TaskCompleted event tracking | When using agent teams mode to detect when teammates finish tasks |
| Existing worktree.cjs | Current | Worktree creation and registry | Both modes -- teammates get worktrees just like subagents |
| Existing execute.cjs | Current | Verification, reconciliation, prompts | Both modes -- teams mode reuses all post-execution infrastructure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent Teams | Multiple subagents (current) | Subagents work within one session's context; teams are independent sessions. Teams provide true parallelism but higher token cost |
| TaskCompleted hook | Polling teammate status | Hooks are event-driven (efficient); polling adds complexity and latency |
| AskUserQuestion | settings.json config-only | User decision at runtime is locked requirement; settings.json could be a future enhancement |

**Installation:**
No new dependencies needed. Agent Teams is a built-in Claude Code feature enabled via environment variable. All supporting libraries are already part of RAPID.

## Architecture Patterns

### Recommended Project Structure
```
rapid/
├── src/lib/
│   ├── teams.cjs           # NEW: Agent teams abstraction layer
│   ├── teams.test.cjs      # NEW: Unit tests for teams module
│   ├── execute.cjs          # MODIFIED: Add execution mode to wave summary
│   └── worktree.cjs         # MODIFIED: Add mode indicator to status output
├── skills/
│   └── execute/
│       └── SKILL.md         # MODIFIED: Add mode detection + dual dispatch
└── src/bin/
    └── rapid-tools.cjs      # MODIFIED: New CLI subcommands for teams
```

### Pattern 1: Dual-Mode Execution Abstraction
**What:** A `teams.cjs` module that encapsulates all agent teams operations behind a clean API, with each function having a clear subagent-mode equivalent. The execute skill calls the same sequence of steps regardless of mode -- only the "spawn and wait" step differs.

**When to use:** Always. This is the core architectural pattern for the entire phase.

**Example:**
```javascript
// Source: Architectural pattern derived from official docs
// teams.cjs -- Agent Teams abstraction layer

/**
 * Detect if agent teams are available.
 * Checks process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'
 * Returns { available: boolean }
 */
function detectAgentTeams() {
  const envVal = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  return { available: envVal === '1' };
}

/**
 * Create a team for a wave's sets.
 * Team name follows convention: rapid-wave-{N}
 * Returns { teamName: string, created: boolean }
 */
function createWaveTeam(waveNum) {
  // Team creation is done via natural language in the execute skill
  // This function provides the naming convention and metadata
  return {
    teamName: `rapid-wave-${waveNum}`,
    waveNum,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build the teammate spawn prompt for a set.
 * Reuses existing prepareSetContext + assembleExecutorPrompt
 * but formats for teammate context (CLAUDE.md in worktree).
 */
function buildTeammatePrompt(cwd, setName, worktreePath, plan) {
  const execute = require('./execute.cjs');
  const ctx = execute.prepareSetContext(cwd, setName);
  // Teammate gets the same prompt as subagent executor
  return execute.assembleExecutorPrompt(cwd, setName, 'execute', plan);
}
```

### Pattern 2: Wave-Level Fallback with Generic Error Handling
**What:** Each wave's team execution is wrapped in a try/catch. On any team-related failure, the wave is auto-retried using subagent mode. The fallback is generic -- it does not inspect error types.

**When to use:** During Step 7 (Execute Phase) of the execute skill, when teams mode is active.

**Example:**
```javascript
// Conceptual pattern for the execute skill's wave dispatch
// In the SKILL.md orchestration logic:

// If mode === 'teams':
//   try:
//     Create team for wave N
//     Spawn teammates (one per set in wave)
//     Wait for all teammates to complete (via TaskCompleted tracking)
//     Verify results (same as subagent mode)
//   catch (any error):
//     Print warning: "Agent teams failed for wave N. Falling back to subagent execution."
//     Execute wave N using subagent mode (existing Step 7 logic)
```

### Pattern 3: TaskCompleted Hook for Teammate Tracking
**What:** A `.claude/hooks/` script that fires on TaskCompleted events, writes completion status to a tracking file that the execute skill can poll for wave completion.

**When to use:** When teams mode is active, to know when all teammates in a wave have finished.

**Example:**
```bash
#!/bin/bash
# .claude/hooks/rapid-task-completed.sh
# TaskCompleted hook -- writes completion record for RAPID tracking

INPUT=$(cat)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id')
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name // "unknown"')
TEAM=$(echo "$INPUT" | jq -r '.team_name // "unknown"')

# Only process RAPID team tasks
if echo "$TEAM" | grep -q "^rapid-wave-"; then
  TRACKING_DIR=".planning/teams"
  mkdir -p "$TRACKING_DIR"

  # Append completion record
  echo "{\"task_id\":\"$TASK_ID\",\"subject\":\"$TASK_SUBJECT\",\"teammate\":\"$TEAMMATE\",\"team\":\"$TEAM\",\"completed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$TRACKING_DIR/$TEAM-completions.jsonl"
fi

exit 0
```

### Pattern 4: Mode-Aware Status Output
**What:** The `/rapid:status` command and `wave-status` CLI add a mode indicator line. Wave summaries include execution mode metadata.

**When to use:** Always, in both modes.

**Example:**
```javascript
// In generateWaveSummary -- add executionMode parameter
function generateWaveSummary(waveNum, reconcileResult, timestamp, executionMode) {
  const lines = [
    `# Wave ${waveNum} Reconciliation Summary`,
    '',
    `**Reconciled:** ${timestamp}`,
    `**Result:** ${reconcileResult.overall}`,
    `**Execution Mode:** ${executionMode || 'Subagents'}`,
    '',
    // ... rest of existing summary
  ];
}
```

### Anti-Patterns to Avoid
- **Separate code paths for verification:** Both modes MUST use the same `verifySetExecution`, `reconcileWave`, and `generateWaveSummary` functions. Teams mode changes HOW work is dispatched, not how it's verified.
- **Complex error classification in fallback:** The fallback is generic. Do NOT build error type switches (e.g., "if TeamSpawnError then fallback, if TimeoutError then retry"). Any failure in team operations triggers subagent fallback.
- **Storing execution mode globally:** Mode is determined per-execution-run, not persisted in config. A fresh `/rapid:execute` re-detects and re-prompts.
- **Inter-teammate messaging:** The user explicitly decided against this. Teammates work in isolation. Do NOT use SendMessage or broadcast between teammates.
- **Nested teams:** Teammates cannot spawn their own teams (Claude Code limitation). The execute skill remains the sole orchestrator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Team creation/teardown | Custom team management protocol | Claude Code's native agent team API (Teammate tool, spawnTeam, cleanup) | Teams are managed by Claude Code runtime; custom management would conflict |
| Task dependency tracking | Custom dependency graph for teammates | Claude Code's native shared task list with blocking | The task list already supports `blocks` and `blockedBy` relationships |
| Teammate spawning | Custom process management | Claude Code's built-in teammate spawning via team lead | The team lead handles process lifecycle |
| Completion detection | Custom polling loop | TaskCompleted hook + tracking file | Event-driven is more reliable than polling |
| Mode detection | Settings.json parser for env block | `process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` check | The env var is set by Claude Code runtime from settings.json; reading it directly is canonical |

**Key insight:** Agent teams are a Claude Code runtime feature, not a library RAPID needs to manage. RAPID's job is to TRANSLATE its wave/set execution model into agent team operations (team = wave, teammate = set), then use all existing RAPID infrastructure for verification and reconciliation. The less RAPID tries to manage team internals, the more robust it will be.

## Common Pitfalls

### Pitfall 1: Bug #13533 -- Task Tool Missing in Custom Agent Context
**What goes wrong:** When Claude Code is launched with `--agent`, the Task tool (for spawning subagents into teams) is unavailable, making teams non-functional.
**Why it happens:** Known open bug in Claude Code (Issue #13533, duplicated from #23506). The Task tool is not inherited by custom agents even when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set.
**How to avoid:** RAPID runs as a **plugin with skills**, not via `--agent`. Skills execute in the main Claude Code session context, which has full access to the Teammate/Task tools. Validate this early in Phase 9 implementation by testing team creation from a skill context.
**Warning signs:** Team operations fail silently (no error message, tool just doesn't appear). If detection succeeds but team creation fails, this bug may be the cause. The generic fallback handles this gracefully.

### Pitfall 2: Team Cleanup Failures Leaving Orphaned Resources
**What goes wrong:** If a team isn't properly cleaned up (e.g., crash, timeout), team config files persist in `~/.claude/teams/{team-name}/` and tasks persist in `~/.claude/tasks/{team-name}/`.
**Why it happens:** Claude Code requires explicit cleanup via the team lead. If the lead session ends unexpectedly, resources can be orphaned.
**How to avoid:** Always attempt cleanup at the end of each wave, even if execution failed. Include cleanup in the error handler. For leftover resources, document manual cleanup: `ls ~/.claude/teams/rapid-wave-*`.
**Warning signs:** "A team already exists" errors when creating a new wave team. "Cannot create team" errors.

### Pitfall 3: Token Cost Explosion with Large Waves
**What goes wrong:** Each teammate is a full independent Claude Code session. A wave with 5 sets means 5 concurrent sessions, each consuming tokens independently.
**Why it happens:** Agent teams have significantly higher token cost than subagents (which share the parent session's context).
**How to avoid:** Document the cost tradeoff in the mode prompt. Consider adding a "team size > N" warning. For RAPID, this is mitigated because sets are designed to be independent anyway -- the overhead is mainly the parallel session cost, not wasted coordination tokens.
**Warning signs:** API rate limit errors, unexpectedly high token usage.

### Pitfall 4: Teammates Editing Same Files (Cross-Set Bleed)
**What goes wrong:** Two teammates in the same wave modify the same file, causing conflicts.
**Why it happens:** File ownership boundaries are enforced by RAPID's scoped CLAUDE.md deny list, not by Claude Code itself. If a teammate ignores the deny list, cross-set bleed occurs.
**How to avoid:** Each teammate's worktree gets a scoped CLAUDE.md (already implemented in worktree.cjs). This is identical to subagent mode. Teams mode does NOT change isolation guarantees.
**Warning signs:** Merge conflicts during reconciliation. Ownership violations in `verifySetExecution`.

### Pitfall 5: Race Condition in Registry Updates During Parallel Team Execution
**What goes wrong:** Multiple teammates updating the worktree registry simultaneously could corrupt it.
**Why it happens:** Teammates are independent sessions without shared locking awareness.
**How to avoid:** Registry updates already use `acquireLock` from lock.cjs (mkdir-based atomic locking). This works across processes. Teammates running in separate sessions will contend on the lock correctly. No changes needed.
**Warning signs:** Malformed REGISTRY.json, missing entries.

### Pitfall 6: No Session Resumption with In-Process Teammates
**What goes wrong:** If `/rapid:execute` is interrupted and resumed, in-process teammates are lost and cannot be reconnected.
**Why it happens:** Known Claude Code limitation: `/resume` and `/rewind` do not restore in-process teammates.
**How to avoid:** RAPID already handles this via its pause/resume infrastructure (HANDOFF.md). If a team execution is interrupted, the fallback path re-executes incomplete sets via subagent mode on the next `/rapid:execute` run. The key: check registry state at startup to determine what's already done.
**Warning signs:** Lead attempts to message teammates that no longer exist. Sets stuck in "Executing" phase after a session restart.

## Code Examples

### Detection and Mode Selection (execute skill Step 1 addition)
```javascript
// Source: Official Claude Code docs + RAPID conventions
// In the execute skill, before wave processing:

// Step 0: Detect execution mode
// Run detection via CLI:
// node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute detect-mode
//
// Returns: { "agentTeamsAvailable": true/false }
//
// If available, prompt user:
//   "Agent teams available. Use teams or subagents?"
//   Options: "Agent Teams" / "Subagents"
// If not available, silently use subagents (no prompt)
```

### teams.cjs Core API
```javascript
// Source: Derived from official Claude Code agent teams docs
'use strict';

/**
 * Detect if EXPERIMENTAL_AGENT_TEAMS is enabled.
 * @returns {{ available: boolean }}
 */
function detectAgentTeams() {
  return {
    available: process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1',
  };
}

/**
 * Generate metadata for a wave team.
 * @param {number} waveNum
 * @returns {{ teamName: string, waveNum: number }}
 */
function waveTeamMeta(waveNum) {
  return {
    teamName: `rapid-wave-${waveNum}`,
    waveNum,
  };
}

/**
 * Generate the teammate spawn configuration for a set.
 * Produces the prompt and worktree path for the teammate.
 * @param {string} cwd - Project root
 * @param {string} setName - Set name
 * @param {string} worktreePath - Worktree path for this set
 * @param {string} plan - Implementation plan from planning phase
 * @returns {{ name: string, prompt: string, worktreePath: string }}
 */
function buildTeammateConfig(cwd, setName, worktreePath, plan) {
  const execute = require('./execute.cjs');
  const prompt = execute.assembleExecutorPrompt(cwd, setName, 'execute', plan);
  return {
    name: setName,
    prompt,
    worktreePath,
  };
}

/**
 * Read team completion tracking data.
 * @param {string} cwd - Project root
 * @param {string} teamName - Team name (e.g., rapid-wave-1)
 * @returns {Array<Object>} Completion records from JSONL file
 */
function readCompletions(cwd, teamName) {
  const fs = require('fs');
  const path = require('path');
  const trackingFile = path.join(cwd, '.planning', 'teams', `${teamName}-completions.jsonl`);
  try {
    const content = fs.readFileSync(trackingFile, 'utf-8');
    return content.trim().split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

module.exports = {
  detectAgentTeams,
  waveTeamMeta,
  buildTeammateConfig,
  readCompletions,
};
```

### Hook Configuration for TaskCompleted Tracking
```json
// Source: Official Claude Code hooks reference
// In .claude/settings.json (or project .claude/settings.json):
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./rapid/src/hooks/rapid-task-completed.sh"
          }
        ]
      }
    ]
  }
}
```

### Modified generateWaveSummary with Execution Mode
```javascript
// Source: Existing execute.cjs pattern
function generateWaveSummary(waveNum, reconcileResult, timestamp, executionMode) {
  const { overall, hardBlocks, softBlocks, setResults } = reconcileResult;
  const lines = [
    `# Wave ${waveNum} Reconciliation Summary`,
    '',
    `**Reconciled:** ${timestamp}`,
    `**Result:** ${overall}`,
    `**Execution Mode:** ${executionMode || 'Subagents'}`,
    '',
    '## Sets',
    '',
  ];
  // ... rest unchanged
}
```

### Modified formatStatusTable with Mode Indicator
```javascript
// Source: Existing worktree.cjs pattern
function formatStatusOutput(worktrees, dagJson, executionMode) {
  const lines = [];
  if (executionMode) {
    lines.push(`Execution mode: ${executionMode}`);
    lines.push('');
  }
  lines.push(formatStatusTable(worktrees, dagJson));
  return lines.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-session subagents only | Agent Teams for true parallel sessions | Feb 2026 | Independent context windows, native task coordination, but experimental status |
| Task tool (renamed from Agent) | Agent tool (v2.1.63+) | Feb 2026 | Task tool renamed to Agent; old Task references still work as aliases |
| No hook-based completion tracking | TaskCompleted + TeammateIdle hooks | Feb 2026 | Event-driven quality gates for agent team workflows |

**Deprecated/outdated:**
- The `Task` tool name was renamed to `Agent` in v2.1.63. Both names work but `Agent` is canonical going forward. RAPID already uses `Agent` in skill definitions.

## Open Questions

1. **Plugin skill context and team spawning**
   - What we know: Bug #13533 shows `--agent` sessions lack the Task tool for team spawning. RAPID runs as a plugin with skills, not via `--agent`.
   - What's unclear: Whether plugin skill contexts have the same limitation. The official docs say teammates load CLAUDE.md, MCP servers, and skills -- but don't explicitly address plugin skill contexts.
   - Recommendation: First task in implementation should be a smoke test: from a RAPID skill context, attempt to detect teams and spawn a minimal team. If this fails, the fallback to subagents is the safety net, and the feature becomes "detection + offer, but fallback is always triggered."

2. **Teammate worktree assignment**
   - What we know: Teammates can work in any directory. Worktrees are created by RAPID before execution.
   - What's unclear: Whether teammates automatically get the team lead's working directory or need explicit cwd assignment. The docs say each teammate "has its own context window" and loads project context from the working directory.
   - Recommendation: When spawning teammates, explicitly set the working directory to the set's worktree path via the spawn prompt instructions. This is consistent with how subagent mode works.

3. **Team cleanup timing and reliability**
   - What we know: Teams must be cleaned up by the lead. Cleanup fails if teammates are still active. Orphaned tmux sessions can persist.
   - What's unclear: What happens if cleanup is attempted after a teammate crashes (vs. finishes normally). Whether there's a force-cleanup option.
   - Recommendation: Attempt cleanup after each wave. If cleanup fails, log a warning and document manual cleanup steps. The next `/rapid:execute` run should not fail due to leftover team resources.

4. **In-process vs split-pane mode for RAPID teammates**
   - What we know: Two display modes exist: in-process (default) and split-pane (tmux/iTerm2). RAPID's teammates don't need user interaction -- they follow a prompt and execute.
   - What's unclear: Whether in-process mode has any functional differences from split-pane mode beyond display. Whether the execute skill can control display mode.
   - Recommendation: Use the default (`auto`) display mode. Do not attempt to configure display mode from the skill. Let the user's own `teammateMode` setting control this.

## Sources

### Primary (HIGH confidence)
- [Claude Code Agent Teams Official Docs](https://code.claude.com/docs/en/agent-teams) - Full feature documentation: enabling, architecture, task list, hooks, limitations
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - TaskCompleted and TeammateIdle hook schemas, exit codes, configuration
- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents) - Subagent vs agent teams comparison, Agent tool API, isolation options
- Context7 `/anthropics/claude-code` - Plugin settings, multi-agent-swarm patterns, agent configuration examples
- Existing RAPID codebase: `execute.cjs`, `worktree.cjs`, `execute/SKILL.md`, `merge/SKILL.md` - Current execution architecture and patterns

### Secondary (MEDIUM confidence)
- [GitHub Issue #13533](https://github.com/anthropics/claude-code/issues/13533) - Open bug: Task tool missing in `--agent` sessions (confirmed OPEN as of 2026-03-05)
- [GitHub Issue #23506](https://github.com/anthropics/claude-code/issues/23506) - Duplicate of #13533, closed. Confirms the Task tool/teams spawning issue in custom agent contexts
- [Boris Cherny on X](https://x.com/bcherny/status/2019472394696683904) - Agent Teams release announcement, confirms experimental status

### Tertiary (LOW confidence)
- [Daniel Avila Medium article](https://medium.com/@dan.avila7/agent-teams-in-claude-code-d6bb90b3333b) - Community usage patterns (not verified against official docs)
- [Addy Osmani blog post](https://addyosmani.com/blog/claude-code-agent-teams/) - Architecture overview (aligns with official docs but community source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Agent Teams API is well-documented in official Claude Code docs; all supporting infrastructure is existing RAPID code
- Architecture: MEDIUM - Dual-mode abstraction is a sound pattern, but the interaction between plugin skill contexts and team spawning has not been verified in practice
- Pitfalls: MEDIUM - Known bugs (#13533) documented, but cleanup edge cases and real-world team behavior in plugin contexts are untested

**Research date:** 2026-03-05
**Valid until:** 2026-03-19 (14 days -- agent teams is experimental and actively evolving)
