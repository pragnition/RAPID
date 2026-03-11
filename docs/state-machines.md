# State Machines

RAPID tracks three entity types -- sets, waves, and jobs -- each with its own lifecycle. Every state transition is validated against a strict transition map before it can take effect. The canonical source of truth is `src/lib/state-transitions.cjs`.

## Set Lifecycle

A set progresses through six stages, advancing as skills complete their work.

```
pending ──> planning ──> executing ──> reviewing ──> merging ──> complete
```

| Transition | Triggered by |
|------------|-------------|
| pending -> planning | `/rapid:set-init` starts decomposing the set into waves |
| planning -> executing | `/rapid:execute` begins dispatching job agents |
| executing -> reviewing | `/rapid:review` starts the review pipeline |
| reviewing -> merging | `/rapid:merge` begins integration into main |
| merging -> complete | Merge pipeline finishes successfully |

`complete` is a terminal state -- no transitions out.

## Wave Lifecycle

Waves have a richer lifecycle that includes discussion, reconciliation, and a retry path from failure.

```
pending ──> discussing ──> planning ──> executing ──> reconciling ──> complete
                                            │                          ^
                                            v                          │
                                         failed ──────────────────────>┘
                                                      (retry)
```

| Transition | Triggered by |
|------------|-------------|
| pending -> discussing | `/rapid:discuss` opens collaborative discussion on the wave |
| discussing -> planning | `/rapid:wave-plan` begins creating job plans |
| planning -> executing | Job dispatch starts for this wave |
| executing -> reconciling | All jobs complete or reach terminal state |
| reconciling -> complete | Post-wave reconciliation succeeds |
| executing -> failed | Derived from job statuses (any failed, none executing) |
| failed -> executing | Re-running `/rapid:execute` retries the wave |

The `failed -> executing` retry path allows re-dispatching failed jobs without restarting the entire set.

## Job Lifecycle

Jobs have the simplest lifecycle -- they either complete or fail, with a retry option.

```
pending ──> executing ──> complete
                │
                v
             failed ──> executing (retry)
```

| Transition | Triggered by |
|------------|-------------|
| pending -> executing | Job agent dispatched by the execute skill |
| executing -> complete | Job agent returns RAPID:RETURN with COMPLETE status |
| executing -> failed | Job agent returns RAPID:RETURN with BLOCKED status or missing return marker |
| failed -> executing | Re-running `/rapid:execute` retries the failed job |

## Derived Status Rules

Wave and set statuses can be derived automatically from their children's statuses. This keeps parent entities in sync without requiring explicit transitions.

### Wave status (derived from jobs)

The wave status is computed from its jobs using these rules, evaluated in order:

1. **No jobs** -> `pending`
2. **All jobs pending** -> `pending`
3. **All jobs complete** -> `complete`
4. **Any job failed AND no job executing** -> `failed`
5. **Otherwise** -> `executing`

A derived status only applies if it represents forward progression -- it never regresses a wave to an earlier state (for example, a wave in `reconciling` will not revert to `executing` from derived status).

### Set status (derived from waves)

The set status is computed from its waves using simpler rules:

1. **No waves** -> `pending`
2. **All waves pending** -> `pending`
3. **All waves complete** -> `complete`
4. **Otherwise** -> `executing`

Any active wave (discussing, planning, executing, reconciling, or failed) counts as "in progress" from the set's perspective.

## Status Enums

These are the valid status values for each entity type, defined in `src/lib/state-schemas.cjs`:

**SetStatus:** `pending`, `planning`, `executing`, `reviewing`, `merging`, `complete`

**WaveStatus:** `pending`, `discussing`, `planning`, `executing`, `reconciling`, `complete`, `failed`

**JobStatus:** `pending`, `executing`, `complete`, `failed`

## State Schema

The full project state is a nested hierarchy validated by Zod schemas:

```
ProjectState
  ├── version (always 1)
  ├── projectName
  ├── currentMilestone
  ├── milestones[]
  │     ├── id, name
  │     └── sets[]
  │           ├── id, status (SetStatus)
  │           └── waves[]
  │                 ├── id, status (WaveStatus)
  │                 └── jobs[]
  │                       ├── id, status (JobStatus)
  │                       ├── startedAt?, completedAt?
  │                       ├── commitSha?
  │                       └── artifacts[]
  ├── lastUpdatedAt
  └── createdAt
```

State is persisted as `.planning/STATE.json` and protected by file-level locking during writes. See `src/lib/state-schemas.cjs` for the full Zod definitions.
