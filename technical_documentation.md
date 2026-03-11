# RAPID Technical Documentation

This is the power-user reference for RAPID. It covers every skill command with full argument syntax, all 31 agents and their spawn relationships, configuration options, state machine transitions, and common failure modes. If you're looking for a quick overview or getting-started guide, see the [README](README.md).

## Table of Contents

1. [Setup](docs/setup.md) -- Install the plugin, initialize a project with parallel research agents, and generate codebase context documents.
2. [Planning](docs/planning.md) -- Decompose work into parallelizable sets, discuss implementation vision per wave, plan jobs with contract validation, and surface assumptions.
3. [Execution](docs/execution.md) -- Dispatch parallel job-executor subagents across waves, handle smart re-entry, retry failed jobs, and fix review issues.
4. [Review](docs/review.md) -- Run the adversarial review pipeline: scoping, unit testing, three-stage bug hunt (hunter, devil's advocate, judge), and browser-automated UAT.
5. [Merge and Cleanup](docs/merge-and-cleanup.md) -- Merge completed sets into main with 5-level conflict detection and 4-tier resolution, clean up worktrees, and advance to the next milestone.
6. [Agent Reference](docs/agents.md) -- All 31 agents with type badges, spawn hierarchy, and structured cards.
7. [Configuration](docs/configuration.md) -- Environment variables, project config, STATE.json schema, and directory layout.
8. [State Machines](docs/state-machines.md) -- Set, wave, and job lifecycle transitions with ASCII diagrams and derived status rules.
9. [Troubleshooting](docs/troubleshooting.md) -- Common failure modes with symptom, cause, and fix for each.

## Utility Commands

These four commands don't belong to a specific lifecycle stage -- use them at any point during development.

### `/rapid:status`

Cross-set progress dashboard showing the full set > wave > job hierarchy with completion status, numeric shorthand index, and actionable next steps.

See [skills/status/SKILL.md](skills/status/SKILL.md) for full details.

### `/rapid:pause <set-id>`

Saves a set's execution state to a HANDOFF.md file for later resumption. Blocks if the set is not currently executing. Shows a warning after 3 pause cycles suggesting the set scope may be too large.

See [skills/pause/SKILL.md](skills/pause/SKILL.md) for full details.

### `/rapid:resume <set-id>`

Resumes a paused set from its last checkpoint. Loads the HANDOFF.md context and transitions the set back to executing phase. The executor picks up from the first incomplete task automatically.

See [skills/resume/SKILL.md](skills/resume/SKILL.md) for full details.

### `/rapid:help`

Static command reference and workflow guide. Outputs all available commands grouped by lifecycle stage with one-line descriptions.

See [skills/help/SKILL.md](skills/help/SKILL.md) for full details.

---

Each skill section includes full argument syntax. For implementation details, see the linked SKILL.md files.
