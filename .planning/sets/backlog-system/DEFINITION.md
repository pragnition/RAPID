# Set: backlog-system

**Created:** 2026-04-06 (via /add-set)
**Milestone:** v6.1.0

## Scope
Add a backlog skill (`/rapid:backlog`) that captures out-of-scope feature requests during development. When an agent or user encounters a feature idea that doesn't belong in the current set or roadmap, they call the backlog skill to persist it. Backlog items are stored as individual files in `.planning/backlog/`. The audit-version command is updated to parse the backlog and suggest either adding items as deferred items in the next version or creating additional sets in the current milestone.

## Key Deliverables
1. New `/rapid:backlog` skill file — callable by users via slash command AND by agents programmatically
2. `.planning/backlog/` directory with individual backlog item files (structured format)
3. Updated `audit-version` skill to parse and surface backlog items
4. Updated `discuss-set` skill (and other relevant agent prompts) to hint at backlog usage when out-of-scope ideas arise
5. Agent-callable interface so subagents can invoke backlog capture without user interaction

## Dependencies
None

## Files and Areas
- New skill: `skills/backlog/` (new skill directory)
- Modified skill: `skills/audit-version/` (parse backlog, suggest deferred items or new sets)
- Modified skill: `skills/discuss-set/` (hint at backlog usage for out-of-scope ideas)
- Other agent prompts that may encounter out-of-scope features (execute-set, plan-set agents)
- New directory: `.planning/backlog/` (runtime artifact storage)
