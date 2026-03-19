# SET-OVERVIEW: quick-and-addset

## Approach

This set bundles two trivial-scope features that share a common pattern: extending RAPID's CLI with new commands and logging infrastructure. The first feature adds an append-only JSONL log for quick tasks so that ad-hoc work is queryable after completion (`rapid-tools quick list/show`). The second feature refactors the existing `/rapid:add-set` skill to use a proper CLI-backed command (`rapid-tools state add-set`) that atomically mutates STATE.json via `withStateTransaction` and then recalculates DAG.json and OWNERSHIP.json.

The overall strategy is: (1) build the quick task log writer and CLI query commands first since they are self-contained and establish the JSONL append pattern under `.planning/memory/`, and (2) then build the `state add-set` CLI command that wraps the existing `plan.cjs` and `dag.cjs` infrastructure with transactional safety. The quick log feature has no cross-set dependencies. The add-set feature has no imports either -- it re-uses existing library functions (`dag.createDAG`, `contract.createOwnershipMap`, `plan.writeDAG`, `plan.writeOwnership`) and `state-machine.withStateTransaction`.

Both features converge on the CLI backbone (`src/bin/rapid-tools.cjs`) as their integration point. Neither feature requires new npm dependencies. The memory-system set (already merged) provides the `.planning/memory/` directory convention and `memory.cjs` module, which this set can optionally leverage for the quick task log location.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/bin/rapid-tools.cjs` | CLI command router -- add `quick list`, `quick show`, `quick log`, and `state add-set` subcommands | Existing (modify) |
| `src/lib/quick-log.cjs` | Quick task JSONL append/query library (append, list, show by ID) | New |
| `src/lib/quick-log.test.cjs` | Unit tests for quick-log module | New |
| `skills/quick/SKILL.md` | Update Step 6 to append to JSONL log after task completion | Existing (modify) |
| `skills/add-set/SKILL.md` | Refactor to call `node rapid-tools.cjs state add-set` instead of direct STATE.json writes | Existing (modify) |
| `src/lib/dag.cjs` | Existing DAG creation -- used by add-set for recalculation, no modification needed | Existing (read-only) |
| `src/lib/plan.cjs` | Existing `writeDAG`, `writeOwnership` -- called by add-set recalculation logic | Existing (read-only or minor modify) |
| `src/lib/state-machine.cjs` | Existing `withStateTransaction` -- used by add-set for atomic state mutation | Existing (read-only) |
| `src/lib/contract.cjs` | Existing `createOwnershipMap` -- used by add-set for ownership regeneration | Existing (read-only) |

## Integration Points

- **Exports:**
  - `quickTaskLog`: Append-only JSONL file at `.planning/memory/quick-tasks.jsonl` recording each quick task execution (id, description, outcome, slug, timestamp, branch)
  - `quickQueryCommand`: CLI commands `rapid-tools quick list [--limit N]` and `rapid-tools quick show <id>` for querying quick task history
  - `stateAddSetCommand`: CLI command `rapid-tools state add-set --milestone <id> --set-id <id> --set-name <name> [--deps <dep1,dep2>]` for atomic set addition
  - `dagRecalculation`: Function that recalculates and persists DAG.json after a set is added, ensuring DAG consistency with STATE.json

- **Imports:** None. This set has zero imports from other sets.

- **Side Effects:**
  - After `state add-set`, DAG.json and OWNERSHIP.json are rewritten to reflect the new set topology
  - The quick SKILL.md will append a log entry after each successful quick task execution
  - The add-set SKILL.md will no longer write STATE.json directly via the Write tool -- all mutations go through the CLI

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quick task ID collision from `ls \| wc -l` counting in SKILL.md | Low | Use monotonic counter (max ID from JSONL + 1) instead of directory count; the log itself becomes the source of truth for next ID |
| add-set SKILL.md currently writes STATE.json directly via Write tool -- agents may still use old pattern | Medium | Update SKILL.md instructions to explicitly call CLI command; add anti-pattern note forbidding direct Write tool usage for STATE.json |
| DAG recalculation may fail if existing sets have invalid dependency references | Medium | Validate all dependency references before calling `dag.createDAG`; surface clear error message listing unknown set IDs |
| Concurrent add-set calls could race on STATE.json | Low | `withStateTransaction` already handles locking via proper-lockfile; the refactor eliminates the current unprotected write pattern |
| quick-tasks.jsonl location decision (`.planning/quick/` vs `.planning/memory/`) | Low | CONTRACT.json already specifies `.planning/memory/quick-tasks.jsonl`; align with memory-system convention from the merged set |

## Wave Breakdown (Preliminary)

- **Wave 1:** Quick task logging foundation -- create `quick-log.cjs` module with append/query functions, write unit tests, add `quick list`, `quick show`, and `quick log` CLI commands to rapid-tools.cjs
- **Wave 2:** add-set CLI command -- implement `state add-set` subcommand in rapid-tools.cjs using `withStateTransaction`, `dag.createDAG`, `contract.createOwnershipMap`, and `plan.writeDAG`/`plan.writeOwnership`; write unit tests for the recalculation logic
- **Wave 3:** SKILL.md integration -- update `skills/quick/SKILL.md` Step 6 to call `quick log` after completion; refactor `skills/add-set/SKILL.md` Steps 5-6 to call `state add-set` CLI command instead of direct file writes; fix quick task ID generation to use log-based monotonic counter

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
