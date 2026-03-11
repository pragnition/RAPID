# Planning

Six skills handle work decomposition, wave-level discussion, detailed job planning, and assumption validation. Planning runs after initialization and before execution.

**Argument patterns:** Commands accepting `<set-id>` support both string IDs (e.g., `auth-system`) and numeric indices (e.g., `1`). Commands accepting `<wave-id>` support dot notation (e.g., `1.1` for set 1, wave 1), string IDs (e.g., `wave-1`), or the two-argument `<set-id> <wave-id>` form.

## `/rapid:plan`

Decomposes the project's work into parallelizable sets -- independent workstreams that run simultaneously in isolated worktrees. Spawns a planner subagent that analyzes REQUIREMENTS.md, PROJECT.md, and any existing codebase context to propose sets with strict file ownership, interface contracts (JSON Schema), dependency edges, and a DAG. The proposal goes through a review loop: you approve, request modifications, or cancel. On approval, writes DEFINITION.md, CONTRACT.json, DAG.json, OWNERSHIP.json, and GATES.json to `.planning/sets/`.

See [skills/plan/SKILL.md](../skills/plan/SKILL.md) for full details.

## `/rapid:set-init <set-id>`

Claims a set for development by creating an isolated git worktree and branch (`rapid/{set-name}`), generating a scoped CLAUDE.md with set-specific contracts and deny lists, and spawning a set-planner subagent to produce SET-OVERVIEW.md. The worktree gives each developer a clean workspace -- Developer A's changes to Set 1 don't affect Developer B working on Set 2.

See [skills/set-init/SKILL.md](../skills/set-init/SKILL.md) for full details.

## `/rapid:discuss <wave-id>` or `<set-id> <wave-id>`

Captures implementation vision for a wave before autonomous planning begins. Reads the set's CONTRACT.json, DEFINITION.md, and SET-OVERVIEW.md, then identifies 5-8 gray areas where multiple valid approaches exist. You select which areas to discuss, then a structured 2-round conversation (approach selection followed by specifics confirmation) locks decisions for each. Decisions and Claude's discretion areas are written to WAVE-CONTEXT.md. Supports "Let Claude decide all" for full delegation.

See [skills/discuss/SKILL.md](../skills/discuss/SKILL.md) for full details.

## `/rapid:wave-plan <wave-id>` or `<set-id> <wave-id>`

Runs the full planning pipeline for a single wave: spawns a research agent for implementation specifics, a wave planner for job decomposition and file assignments, per-job planners for detailed implementation steps (parallel when 3+ jobs), and a plan verifier for coverage and consistency checks. Contract validation runs after verification -- major violations are escalated. Writes WAVE-RESEARCH.md, WAVE-PLAN.md, per-job JOB-PLAN.md files, and VERIFICATION-REPORT.md.

See [skills/wave-plan/SKILL.md](../skills/wave-plan/SKILL.md) for full details.

## `/rapid:plan-set <set-id>`

Plans all waves in a set with a single command. Spawns a wave-analyzer agent to detect dependencies between waves, groups them into parallel batches, then runs the full wave-plan pipeline (research, wave plan, job plans, verify, validate) for each wave in dependency order. Independent waves plan in parallel batches; dependent waves plan sequentially with predecessor artifacts available. Supports smart re-entry -- re-running after partial completion skips already-planned waves and plans only remaining ones. Fails fast if any wave has not been discussed.

See [skills/plan-set/SKILL.md](../skills/plan-set/SKILL.md) for full details.

## `/rapid:assumptions <set-id>`

Surfaces Claude's mental model about how a set will be implemented so you can catch misunderstandings before execution begins. Read-only -- reviews the set's DEFINITION.md and CONTRACT.json to present scope understanding, file boundaries, contract assumptions, dependency assumptions, and risk factors. If assumptions are wrong, the fix is to re-run `/rapid:plan` with the re-plan option.

See [skills/assumptions/SKILL.md](../skills/assumptions/SKILL.md) for full details.

---

Next: [Execution](execution.md)
