# CONTEXT: quick-and-addset

**Set:** quick-and-addset
**Generated:** 2026-03-17
**Mode:** interactive

<domain>
## Set Boundary
Two lightweight enhancements bundled together:
1. **Quick task logging** -- Persistent append-only JSONL log at `.planning/memory/quick-tasks.jsonl` recording each `/rapid:quick` execution with CLI query commands (`rapid-tools quick list/show`).
2. **add-set CLI refactor** -- Replace direct STATE.json file writes in `/rapid:add-set` with a proper CLI-backed `rapid-tools state add-set` command that uses `withStateTransaction` for atomic mutation and always recalculates DAG.json and OWNERSHIP.json.

Both features converge on the CLI backbone (`src/bin/rapid-tools.cjs`) as their integration point. Neither requires new npm dependencies.
</domain>

<decisions>
## Implementation Decisions

### Quick Task ID Strategy

- **Monotonic counter**: Read max ID from `quick-tasks.jsonl` (parse all lines, find max `id` field) and use max + 1. The JSONL log becomes the source of truth for the next ID, replacing the current `ls | wc -l` directory counting approach. Human-friendly sequential IDs (1, 2, 3...).

### add-set State Mutation

- **Always recalculate DAG**: Every `state add-set` call regenerates both DAG.json and OWNERSHIP.json after adding the set to STATE.json. No opt-in flags -- consistency is guaranteed by default. DAG creation via `dag.createDAG` is fast enough that the cost is negligible.

### Quick Log Query UX

- **JSON-only output**: Both `rapid-tools quick list` and `rapid-tools quick show` output JSON, consistent with all other rapid-tools CLI commands. Human readability is handled at the skill layer, not the CLI layer.

### SKILL.md Refactor Scope

- **Full fix**: All three changes applied together:
  1. Add JSONL log append call to `skills/quick/SKILL.md` Step 6
  2. Refactor `skills/add-set/SKILL.md` Steps 5-6 to call `rapid-tools state add-set` CLI command instead of direct STATE.json writes
  3. Fix quick task ID generation to use monotonic counter from JSONL (replacing `ls | wc -l`)
  4. Add anti-pattern notes to add-set SKILL.md forbidding direct STATE.json Write tool usage
</decisions>

<specifics>
## Specific Ideas
- The `quick log` CLI subcommand should handle the append operation (called by the skill after execution completes)
- `state add-set` should accept `--milestone`, `--set-id`, `--set-name`, and optional `--deps` flags per the CONTRACT.json signature
- `state add-set` should validate dependency references against existing sets before calling `dag.createDAG`
- The JSONL append in `quick-log.cjs` should use `fs.appendFileSync` for atomic single-line writes
</specifics>

<code_context>
## Existing Code Insights

- **CLI router** (`src/bin/rapid-tools.cjs`): Switch-based command dispatch with `handleX` functions imported from `src/commands/`. New commands need a handler module and a case in the switch.
- **State transactions** (`src/lib/state-machine.cjs`): `withStateTransaction(cwd, mutationFn)` acquires lock, reads state, calls mutationFn for in-place mutation, validates via Zod, writes atomically via tmp+rename. This is the pattern `state add-set` must use.
- **DAG creation** (`src/lib/dag.cjs`): `createDAG(nodes, edges)` handles toposort, wave assignment, and full DAG object construction. Already validates for cycles and duplicate IDs.
- **Contract/Ownership** (`src/lib/contract.cjs`): `createOwnershipMap` builds OWNERSHIP.json from CONTRACT.json files.
- **Plan module** (`src/lib/plan.cjs`): `writeDAG` and `writeOwnership` persist DAG.json and OWNERSHIP.json to disk.
- **Memory convention**: `.planning/memory/` directory established by the merged memory-system set. JSONL append pattern already used by `DECISIONS.jsonl` and `CORRECTIONS.jsonl`.
- **Current add-set SKILL.md** (Step 5): Reads STATE.json via CLI, mutates in JavaScript, writes back with Write tool -- this is the pattern being replaced with `state add-set` CLI command.
- **Current quick SKILL.md** (Step 2): Uses `ls .planning/quick/ | wc -l` for ID generation -- collision-prone when directories are deleted or tasks fail mid-execution.
</code_context>

<deferred>
## Deferred Ideas
- Quick task search/filter by date range or description keyword (beyond basic list/show)
- Quick task cleanup/archival command for old `.planning/quick/` directories
- `state remove-set` companion command for undoing `state add-set`
</deferred>
