# REVIEW-SCOPE: quick-and-addset

<!-- SCOPE-META {"setId":"quick-and-addset","date":"2026-03-17T10:00:00.000Z","postMerge":false,"worktreePath":".rapid-worktrees/quick-and-addset","totalFiles":11,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | quick-and-addset |
| Date | 2026-03-17T10:00:00.000Z |
| Post-Merge | false |
| Worktree Path | .rapid-worktrees/quick-and-addset |
| Total Files | 11 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `skills/add-set/SKILL.md` | wave-3 |
| `skills/quick/SKILL.md` | wave-3 |
| `src/bin/rapid-tools.cjs` | wave-2 |
| `src/commands/quick.cjs` | wave-1 |
| `src/commands/state.cjs` | wave-2 |
| `src/lib/add-set.cjs` | wave-2 |
| `src/lib/add-set.test.cjs` | wave-2 |
| `src/lib/quick-log.cjs` | wave-1 |
| `src/lib/quick-log.test.cjs` | wave-1 |

## Dependent Files
| File |
|------|
| `src/bin/rapid-tools.test.cjs` |
| `src/commands/commands.test.cjs` |

## Directory Chunks
### Chunk 1: .
- `skills/add-set/SKILL.md`
- `skills/quick/SKILL.md`
- `src/bin/rapid-tools.cjs`
- `src/commands/quick.cjs`
- `src/commands/state.cjs`
- `src/lib/add-set.cjs`
- `src/lib/add-set.test.cjs`
- `src/lib/quick-log.cjs`
- `src/lib/quick-log.test.cjs`
- `src/bin/rapid-tools.test.cjs`
- `src/commands/commands.test.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `skills/add-set/SKILL.md` | wave-3 |
| `skills/quick/SKILL.md` | wave-3 |
| `src/bin/rapid-tools.cjs` | wave-2 |
| `src/commands/quick.cjs` | wave-1 |
| `src/commands/state.cjs` | wave-2 |
| `src/lib/add-set.cjs` | wave-2 |
| `src/lib/add-set.test.cjs` | wave-2 |
| `src/lib/quick-log.cjs` | wave-1 |
| `src/lib/quick-log.test.cjs` | wave-1 |
| `src/bin/rapid-tools.test.cjs` | unattributed |
| `src/commands/commands.test.cjs` | unattributed |

## Concern Scoping

### Concern 1: quick-task-feature
- `skills/quick/SKILL.md` — Skill definition for /rapid:quick interactive pipeline
- `src/commands/quick.cjs` — CLI command handler dispatching quick log/list/show subcommands
- `src/lib/quick-log.cjs` — Core JSONL persistence layer for quick tasks (append, list, show with monotonic IDs)
- `src/lib/quick-log.test.cjs` — Unit tests covering appendQuickTask, listQuickTasks, showQuickTask

### Concern 2: add-set-feature
- `skills/add-set/SKILL.md` — Skill definition for /rapid:add-set interactive discovery flow
- `src/lib/add-set.cjs` — Core library for atomic set insertion into milestones with DAG/OWNERSHIP recalculation
- `src/lib/add-set.test.cjs` — Unit tests for addSetToMilestone and recalculateDAG

### Concern 3: cli-wiring
- `src/bin/rapid-tools.cjs` — Main CLI entry point that imports and dispatches all commands including handleQuick
- `src/commands/state.cjs` — State command handler containing add-set CLI wiring

### Concern 4: test-infrastructure
- `src/bin/rapid-tools.test.cjs` — Broad CLI integration tests (does not contain quick or add-set specific tests)
- `src/commands/commands.test.cjs` — Handler CliError validation tests across all command handlers

## Acceptance Criteria
1. [wave-1] `src/lib/quick-log.cjs` exports `appendQuickTask`, `listQuickTasks`, `showQuickTask`
2. [wave-1] All 18 unit tests in `src/lib/quick-log.test.cjs` pass
3. [wave-1] `rapid-tools quick log --description "test" --outcome "COMPLETE" --slug "test-task" --branch "main"` appends a JSONL entry and outputs the record
4. [wave-1] `rapid-tools quick list` returns JSON array of entries
5. [wave-1] `rapid-tools quick show 1` returns JSON object for the entry
6. [wave-1] USAGE help includes all quick subcommands
7. [wave-2] `src/lib/add-set.cjs` exports `addSetToMilestone` and `recalculateDAG`
8. [wave-2] All 11 unit tests in `src/lib/add-set.test.cjs` pass
9. [wave-2] `rapid-tools state add-set --milestone <id> --set-id <id> --set-name <name>` atomically adds a set to STATE.json
10. [wave-2] After `add-set`, DAG.json is regenerated with all sets from the milestone
11. [wave-2] After `add-set`, OWNERSHIP.json is regenerated from CONTRACT.json files
12. [wave-2] Duplicate set ID and invalid dependency are rejected with descriptive errors
13. [wave-2] USAGE help includes the `state add-set` line
14. [wave-3] `skills/quick/SKILL.md` Step 2 uses monotonic counter from JSONL log (no more `ls | wc -l`)
15. [wave-3] `skills/quick/SKILL.md` Step 6 appends to JSONL log via `quick log` CLI command
16. [wave-3] `skills/add-set/SKILL.md` Step 5 uses `state add-set` CLI command exclusively
17. [wave-3] `skills/add-set/SKILL.md` contains anti-pattern notes forbidding direct STATE.json writes
18. [wave-3] No references to direct STATE.json Write tool usage remain in add-set/SKILL.md Step 5
19. [wave-3] Both SKILL.md files remain valid Markdown with correct front matter
