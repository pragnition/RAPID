[DOCS.md](../DOCS.md) > Planning

# Planning

These commands handle set lifecycle setup, discussion, and planning. The init command runs the 6-researcher pipeline, discuss-set captures implementation vision with 4-gray-area discovery, and plan-set runs the 3-step researcher-planner-verifier pipeline.

## `/rapid:start-set <set-id>`

Claims a set for development by creating an isolated git worktree and branch (`rapid/{set-name}`), generating a scoped CLAUDE.md with set-specific contracts and deny lists, and spawning a `rapid-set-planner` subagent to produce SET-OVERVIEW.md. The worktree gives each developer a clean workspace -- Developer A's changes to Set 1 do not affect Developer B working on Set 2.

Set IDs support both string names (e.g., `auth-system`) and numeric indices (e.g., `1`).

See [skills/start-set/SKILL.md](../skills/start-set/SKILL.md) for full details.

## `/rapid:discuss-set <set-id>` or `--skip`

Captures implementation vision for a set before autonomous planning begins. The skill identifies exactly 4 gray areas where multiple valid approaches exist, then asks batched questions (2-3 per area) via structured conversation. Decisions are recorded in CONTEXT.md for the planner.

**`--skip` flag:** Spawns a `rapid-research-stack` agent that auto-generates CONTEXT.md from the roadmap and codebase scan without user interaction. Use this for full delegation.

**State transition:** `pending` -> `discussed`

See [skills/discuss-set/SKILL.md](../skills/discuss-set/SKILL.md) for full details.

## `/rapid:plan-set <set-id> [--gaps]`

Runs a 3-step planning pipeline that produces per-wave PLAN.md files in 2-4 total agent spawns:

1. **Research** -- `rapid-research-stack` investigates implementation specifics for the set's scope
2. **Planning** -- `rapid-planner` decomposes the set into waves with per-wave PLAN.md files containing tasks, file assignments, and acceptance criteria
3. **Verification** -- `rapid-plan-verifier` validates plans for coverage, implementability, and consistency

Contract enforcement runs after verification to validate that planned work respects interface boundaries defined in CONTRACT.json.

The `--gaps` flag enables gap-closure mode, allowing re-planning for merged sets that had PASS_WITH_GAPS verification results. Gap-closure waves are numbered sequentially after existing waves.

**State transition:** `discussed` -> `planned` (or `pending` -> `planned` if discuss was skipped)

See [skills/plan-set/SKILL.md](../skills/plan-set/SKILL.md) for full details.

## `/rapid:quick <description>`

Ad-hoc tasks without set structure. Runs a lightweight 3-agent pipeline: planner, plan-verifier, and executor. Quick tasks are excluded from STATE.json sets to avoid polluting the `/rapid:status` dashboard.

See [skills/quick/SKILL.md](../skills/quick/SKILL.md) for full details.

## `/rapid:add-set <set-name>`

Adds new sets to an existing milestone mid-stream through a lightweight interactive discovery flow. Creates DEFINITION.md and CONTRACT.json, updates STATE.json and ROADMAP.md. No subagent spawns.

See [skills/add-set/SKILL.md](../skills/add-set/SKILL.md) for full details.

## `/rapid:assumptions <set-id>`

Surfaces Claude's mental model about how a set will be implemented so you can catch misunderstandings before execution begins. Read-only -- reviews the set's artifacts to present scope understanding, contract assumptions, dependency assumptions, and risk factors.

**Note:** This is a utility command that does not advance set state. If assumptions are wrong, re-run `/rapid:plan-set` to re-plan.

See [skills/assumptions/SKILL.md](../skills/assumptions/SKILL.md) for full details.

---

Next: [Execution](execution.md)
