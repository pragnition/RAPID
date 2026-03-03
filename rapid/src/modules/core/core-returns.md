# Structured Return Protocol

Every RAPID agent invocation MUST end with a structured return. The return uses a hybrid format: a human-readable Markdown table AND a machine-parseable JSON payload in an HTML comment.

**Critical rule:** Generate the JSON payload FIRST, then render the Markdown table FROM the JSON. Never generate them independently -- this prevents desync between what humans see and what machines parse.

The HTML comment marker is: `<!-- RAPID:RETURN { ... } -->`

## Return Statuses

### COMPLETE

Use when all assigned tasks are finished successfully.

**Standard fields:** status, artifacts, commits, tasks_completed, tasks_total, duration_minutes, next_action, warnings, notes

```markdown
## COMPLETE

| Field | Value |
|-------|-------|
| Status | COMPLETE |
| Artifacts | `file1.cjs`, `file2.cjs` |
| Commits | `abc1234`, `def5678` |
| Tasks | 4/4 |
| Duration | 12m |
| Next | Execute Plan 01-03 |
| Notes | All tests passing |

<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file1.cjs","file2.cjs"],"commits":["abc1234","def5678"],"tasks_completed":4,"tasks_total":4,"duration_minutes":12,"next_action":"Execute Plan 01-03","warnings":[],"notes":["All tests passing"]} -->
```

### CHECKPOINT

Use when pausing mid-execution to hand off to another agent or await a decision. Include full handoff context so the next agent can resume without re-reading the plan.

**Handoff fields:** handoff_done, handoff_remaining, handoff_decisions, handoff_blockers, handoff_resume

```markdown
## CHECKPOINT

| Field | Value |
|-------|-------|
| Status | CHECKPOINT |
| Tasks | 2/4 |
| Done | Tasks 1-2: state manager and lock system |
| Remaining | Tasks 3-4: assembler and CLI wiring |
| Decisions | Used proper-lockfile for mkdir locking |
| Resume | Start at Task 3 in 01-02-PLAN.md |

<!-- RAPID:RETURN {"status":"CHECKPOINT","tasks_completed":2,"tasks_total":4,"handoff_done":"Tasks 1-2: state manager and lock system","handoff_remaining":"Tasks 3-4: assembler and CLI wiring","handoff_decisions":"Used proper-lockfile for mkdir locking","handoff_blockers":"","handoff_resume":"Start at Task 3 in 01-02-PLAN.md"} -->
```

### BLOCKED

Use when you cannot continue due to an external dependency, missing permission, need for clarification, or an unrecoverable error.

**Blocker fields:** blocker_category (DEPENDENCY | PERMISSION | CLARIFICATION | ERROR), blocker, resolution

```markdown
## BLOCKED

| Field | Value |
|-------|-------|
| Status | BLOCKED |
| Category | DEPENDENCY |
| Blocker | Plugin manifest (plugin.json) not yet created |
| Resolution | Complete Phase 2 (Plugin Shell) first |
| Tasks | 2/4 |
| Duration | 8m |

<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"DEPENDENCY","blocker":"Plugin manifest (plugin.json) not yet created","resolution":"Complete Phase 2 (Plugin Shell) first","tasks_completed":2,"tasks_total":4,"duration_minutes":8} -->
```

**Blocker categories:**
- **DEPENDENCY** -- Waiting on another set or phase to complete
- **PERMISSION** -- Need access credentials, API keys, or elevated permissions
- **CLARIFICATION** -- Plan is ambiguous; need human decision before proceeding
- **ERROR** -- Unrecoverable error encountered during execution
