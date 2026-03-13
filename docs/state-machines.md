# State Machines

RAPID v3.0 tracks one entity type -- sets -- with a single lifecycle. Every state transition is validated against a strict transition map before it can take effect. The canonical source of truth is `src/lib/state-transitions.cjs`.

## SetStatus Lifecycle

A set progresses through six stages, advancing as skills complete their work.

```
pending --> discussing --> planning --> executing --> complete --> merged
```

| Transition | Triggered By | Description |
|------------|-------------|-------------|
| pending --> discussing | `/rapid:discuss-set` | Discussion begins to capture implementation vision |
| discussing --> planning | `/rapid:plan-set` | Planning pipeline starts producing PLAN.md files |
| planning --> executing | `/rapid:execute-set` | Execution begins with per-wave executor agents |
| executing --> complete | `/rapid:execute-set` | All waves complete and verification passes |
| complete --> merged | `/rapid:merge` | Set branch merged into main |

`merged` is the terminal state -- no transitions out.

### Key Properties

- **Independence:** Sets are fully independent. No state transition rejects based on another set's status. Sets can be started, executed, reviewed, and merged in any order.
- **No derived status:** In v3.0, set status is explicit -- it is set directly by the skill that advances the lifecycle. There is no status derivation from children.
- **Validation:** Every transition is checked against the transition map. Invalid transitions (e.g., `pending` --> `executing`) are rejected with an error.

## SetStatus Enum

The valid status values for sets:

**SetStatus:** `pending`, `discussing`, `planning`, `executing`, `complete`, `merged`

## State Persistence

### Atomic Writes

State is persisted as `.planning/STATE.json`. Every state mutation follows the transaction pattern:

1. Read STATE.json
2. Validate preconditions (current status allows the transition)
3. Perform work
4. Write STATE.json atomically via temp-file-then-rename

The temp-file-then-rename pattern prevents partial writes -- either the full new state is written or the old state remains intact.

### File-Level Locking

State writes are protected by file-level locking via `src/lib/lock.cjs`. Only one agent can hold the state lock at a time. Lock files are stored in `.planning/.locks/` (gitignored) and auto-expire after 5 minutes (configurable via `lock_timeout_ms` in config.json).

Lock name: `state`

### Crash Recovery

RAPID preserves a crash recovery triad:

1. **detectCorruption** -- Validates STATE.json against the schema. Returns diagnostic information if the state is malformed or missing.

2. **recoverFromGit** -- Restores the last committed version of STATE.json from git history:
   ```bash
   git checkout HEAD -- .planning/STATE.json
   ```

3. **Atomic writes** -- The temp-file-then-rename pattern ensures crashes during writes leave a valid state file (either old or new, never partial).

### Bootstrapping

Every command bootstraps exclusively from STATE.json and disk artifacts. No conversation context is required -- the system is fully self-contained after a `/clear`. Commands read STATE.json to determine what has been done and what needs to happen next.

---

Next: [Troubleshooting](troubleshooting.md)
