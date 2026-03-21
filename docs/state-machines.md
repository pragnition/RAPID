# State Machines

RAPID tracks three entity types -- sets, waves, and jobs -- each with their own lifecycle. Every state transition is validated against a strict transition map before it can take effect. The canonical source of truth is `src/lib/state-transitions.cjs`.

## SetStatus Lifecycle

A set progresses through six stages, advancing as skills complete their work.

```
pending --> discussed --> planned --> executed --> complete --> merged
              ^                        ^
              |                        |
              +-- (self-loop)          +-- (self-loop)
```

The `pending` → `planned` shortcut allows skipping the discuss step when delegation is preferred.

| Transition | Triggered By | Description |
|------------|-------------|-------------|
| pending --> discussed | `/rapid:discuss-set` | Discussion captures implementation vision |
| pending --> planned | `/rapid:plan-set` | Skip discuss, go straight to planning |
| discussed --> planned | `/rapid:plan-set` | Planning pipeline produces PLAN.md files |
| discussed --> discussed | `/rapid:discuss-set` | Re-discussion with updated context |
| planned --> executed | `/rapid:execute-set` | Execution begins with per-wave executor agents |
| executed --> complete | `/rapid:execute-set` | All waves complete and verification passes |
| executed --> executed | `/rapid:execute-set` | Re-execution after crash recovery |
| complete --> merged | `/rapid:merge` | Set branch merged into main |

`merged` is the terminal state -- no transitions out.

### Key Properties

- **Independence:** Sets are fully independent. No state transition rejects based on another set's status. Sets can be started, executed, reviewed, and merged in any order.
- **Self-loops:** `discussed` and `executed` allow self-transitions for re-discussion and crash recovery.
- **Skip discuss:** The `pending` → `planned` transition lets you skip discussion entirely.
- **Solo mode:** Solo sets auto-transition from `complete` → `merged` since there is no branch to merge.
- **Validation:** Every transition is checked against the transition map. Invalid transitions (e.g., `pending` → `executed`) are rejected with an error.

## SetStatus Enum

**SetStatus:** `pending`, `discussed`, `planned`, `executed`, `complete`, `merged`

## Wave and Job Lifecycles

Waves and jobs follow a simpler three-state lifecycle:

```
pending --> executing --> complete
```

| Entity | Statuses | Triggered By |
|--------|----------|-------------|
| Wave | `pending`, `executing`, `complete` | `/rapid:execute-set` advances waves sequentially |
| Job | `pending`, `executing`, `complete` | Executor agent advances jobs within a wave |

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
