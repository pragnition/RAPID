---
description: Scope a completed set for review -- produces REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:review -- Review Scoping

You are the RAPID review scoping skill. This skill scopes a completed set for review and produces a single output artifact: `REVIEW-SCOPE.md`. Downstream skills (`/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat`) consume this artifact as their input. Follow these steps IN ORDER. Do not skip steps.

## REVIEW-SCOPE.md Schema

The output artifact has this structure:

```markdown
# REVIEW-SCOPE: {setId}

<!-- SCOPE-META {"setId":"...","date":"...","postMerge":false,"worktreePath":"...","totalFiles":N,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | ... |
| Date | ... |
| Post-Merge | true/false |
| Worktree Path | ... |
| Total Files | N |
| Concern Scoping | true/false |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `path/to/file.cjs` | wave-1 |

## Dependent Files
| File |
|------|
| `path/to/dep.cjs` |

## Directory Chunks
### Chunk 1: src/lib
- `src/lib/a.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `path/to/file.cjs` | wave-1 |

## Concern Scoping
(concern groups or "Concern scoping was not performed.")

## Acceptance Criteria
1. [wave-1] Criterion text
```

## Step 0: Environment + Set Resolution

### 0a: Load environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner review
```

### 0b: Parse arguments

The user invokes this skill with: `/rapid:review <set-id>` or numeric shorthand like `/rapid:review 1`.

**Wave-specific review is no longer supported.** If the user passes a wave argument (e.g., `/rapid:review 1 1.1`), ignore it with a note: "Wave-specific review is no longer supported. Reviewing entire set."

#### Resolve Set Reference

If `<set-id>` was provided, resolve it through the numeric ID resolver:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<set-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations.

If `<set-id>` was not provided, use AskUserQuestion to ask:
- **question:** "Which set to review?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

Parse the set-id from the user's invocation.

#### Detect `--post-merge` flag

Check if the user invoked with `--post-merge` flag: `/rapid:review <set-id> --post-merge`

If `--post-merge` is present, set `POST_MERGE=true`. The post-merge review path bypasses status validation and state transitions entirely. All review operations run against the project root (`cwd`) on the main branch, not a worktree.

### 0c: Validate set status

**If `POST_MERGE=true`:** Skip this step entirely. Post-merge review does not require any specific set status -- it operates on already-merged sets. Proceed directly to Step 1.

Read STATE.json to verify the target set exists and is in a reviewable state:

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output and find the target set. The set status MUST be `complete`. If the set is in any other status (e.g., `pending`, `planned`, `executed`):

> Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' state. Run `/rapid:execute-set {set-id}` first.

Exit.

### 0d: Validate review eligibility

**If `POST_MERGE=true`:** Skip this step entirely. Post-merge review does not require any specific set status -- it operates on already-merged sets. Proceed directly to Step 1.

The set must be in `complete` state to proceed. No state transition is performed -- review is a non-mutating operation on set status.

## Step 1: Scope Set Files

**If `POST_MERGE=true`:**

Scope changed files from the set's merge commit:

```bash
SCOPE_RESULT=$(node "${RAPID_TOOLS}" review scope <set-id> --post-merge)
```

Parse the JSON output: `{ changedFiles, dependentFiles, totalFiles, chunks, postMerge }`.

- `changedFiles` -- files changed in the set's merge commit (from merge commit diff)
- `dependentFiles` -- files that import changed files (one-hop dependents)
- `totalFiles` -- total count
- `chunks` -- directory groups (same chunking logic)
- `postMerge` -- boolean `true` confirming post-merge mode

Note: No `waveAttribution` is available in post-merge mode. Wave attribution tags will be set to `"unattributed"`.

Set the working directory to `cwd` (the project root on main branch). Do NOT attempt to resolve a worktree path.

**Solo set scoping:** For solo sets, the scope command should use the `startCommit` from the registry entry instead of the base branch. The review scope CLI handles this internally when it detects a solo entry. If manual scoping is needed:

```bash
# Get the solo set's start commit from registry
REGISTRY=$(cat .planning/worktrees/REGISTRY.json)
START_COMMIT=$(echo "$REGISTRY" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); e=d.worktrees['${SET_NAME}']; console.log(e && e.startCommit || '')")
# Use startCommit for diff
git diff --name-only ${START_COMMIT}...HEAD
```

For solo sets, the working directory is the project root (cwd), not a worktree path.

**If `POST_MERGE` is not set (standard path):**

Scope all changed files across the entire set in a single call:

```bash
SCOPE_RESULT=$(node "${RAPID_TOOLS}" review scope <set-id>)
```

Parse the JSON output: `{ changedFiles, dependentFiles, totalFiles, chunks, waveAttribution }`.

- `changedFiles` -- array of files changed in the set branch vs main
- `dependentFiles` -- array of files that import changed files (one-hop dependents)
- `totalFiles` -- total count of changed + dependent files
- `chunks` -- array of `{ dir, files }` directory groups (pre-computed by the scope command using the 15-file threshold)
- `waveAttribution` -- map of `{ filePath: waveId }` derived from wave-*-PLAN.md file lists across all waves

Print a banner:

```
--- RAPID Review Scoping ---
Set: {setId}
Scope: {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
Chunks: {chunks.length} directory group(s)
----------------------------
```

Store `chunks` and `waveAttribution` for use in subsequent steps.

## Step 2: Concern-Based Scoping

**If `POST_MERGE=true`:** The working directory for the scoper agent is `cwd` (project root), not a worktree path. All other scoper behavior is identical.

Spawn the **rapid-scoper** agent with the full scoped file list from Step 1:

```
Review set '{setId}' -- categorize {totalFiles} files by concern area.

## Scoped Files
{list of ALL files from review scope (changedFiles + dependentFiles)}

## Working Directory
{worktreePath}

## Instructions
Read the scoped files and categorize each by concern area.
Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{...ScoperOutput...}} -->
```

Parse the scoper's RAPID:RETURN output.

### Cross-Cutting Fallback Check

If `crossCuttingCount > totalFiles * 0.5`:
- Log warning: "Cross-cutting files ({crossCuttingCount}/{totalFiles}) exceed 50% threshold. Falling back to directory chunking."
- Set `useConcernScoping = false`
- Record the fallback warning string for inclusion in REVIEW-SCOPE.md

If `crossCuttingCount <= totalFiles * 0.5`:
- Set `useConcernScoping = true`
- Build concern groups: for each concern, the file list is the concern's own files PLUS all cross-cutting files
- Within each concern group, if the group exceeds 15 files (CHUNK_THRESHOLD), apply `chunkByDirectory` to split it further
- Store the concern groups

Print concern scope banner:

```
--- Concern Scoping ---
Set: {setId}
Concerns: {concernCount} ({concern names, comma-separated})
Cross-cutting: {crossCuttingCount} file(s)
Scoping: {'concern-based' if useConcernScoping else 'directory chunking (fallback)'}
-----------------------
```

**If the scoper agent fails or times out:** Set `useConcernScoping = false` and `concernScoping = null`. Log a note but continue -- the review scope is still valid without concern data.

## Step 3: Load Acceptance Criteria

Load acceptance criteria using the `extractAcceptanceCriteria` library function from `src/lib/review.cjs`:

```javascript
const { extractAcceptanceCriteria } = require('../../src/lib/review.cjs');
const criteria = extractAcceptanceCriteria(cwd, setId);
```

Or equivalently, read wave-*-PLAN.md files from `.planning/sets/{setId}/`, extract content under `## Success Criteria` or `## Acceptance Criteria` headings, and parse bullet points. Each criterion is prefixed with its originating wave (e.g., `[wave-1] Criterion text`).

## Step 4: Generate REVIEW-SCOPE.md

Build the scope data object and serialize it to REVIEW-SCOPE.md using the `serializeReviewScope` function from `src/lib/review.cjs`:

```javascript
const { serializeReviewScope } = require('../../src/lib/review.cjs');
const markdown = serializeReviewScope({
  setId,
  date: new Date().toISOString(),
  postMerge: POST_MERGE || false,
  worktreePath,
  changedFiles,
  dependentFiles,
  totalFiles,
  chunks,
  waveAttribution: waveAttribution || {},
  concernScoping: concernScoping || null,
  useConcernScoping,
  fallbackWarning: fallbackWarning || null,
  acceptanceCriteria: criteria,
});
```

Write the markdown to:

- **If `POST_MERGE=true`:** `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
- **Standard path:** `.planning/sets/{setId}/REVIEW-SCOPE.md`

This write is idempotent -- if REVIEW-SCOPE.md already exists, overwrite it.

## Step 5: Completion Banner

Print the completion banner:

**If `POST_MERGE=true`:**

```
--- RAPID Review Scope Complete ---
Set: {setId} (post-merge)
Scope: {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
Chunks: {chunks.length} directory group(s)
Concern Scoping: {useConcernScoping ? 'enabled' : 'disabled'}
Acceptance Criteria: {criteria.length} items

Output: .planning/post-merge/{setId}/REVIEW-SCOPE.md

Next steps:
  /rapid:unit-test {setIndex} --post-merge   -- Run unit tests
  /rapid:bug-hunt {setIndex} --post-merge    -- Run adversarial bug hunt
  /rapid:uat {setIndex} --post-merge         -- Run user acceptance testing
------------------------------------
```

**Standard path:**

```
--- RAPID Review Scope Complete ---
Set: {setId}
Scope: {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
Chunks: {chunks.length} directory group(s)
Concern Scoping: {useConcernScoping ? 'enabled' : 'disabled'}
Acceptance Criteria: {criteria.length} items

Output: .planning/sets/{setId}/REVIEW-SCOPE.md

Next steps:
  /rapid:unit-test {setIndex}   -- Run unit tests
  /rapid:bug-hunt {setIndex}    -- Run adversarial bug hunt
  /rapid:uat {setIndex}         -- Run user acceptance testing
------------------------------------
```

Where `{setIndex}` is the numeric index of the set resolved at Step 0.

Then exit. Do NOT prompt for selection.

## Important Notes

- **This skill produces REVIEW-SCOPE.md as its sole output.** It does not run unit tests, bug hunts, or UAT. Those are separate skills that consume REVIEW-SCOPE.md.
- **Idempotent overwrite.** If REVIEW-SCOPE.md already exists, it is overwritten. Re-running `/rapid:review` regenerates the scope artifact.
- **Post-merge flag propagation.** The `postMerge` field in SCOPE-META tells downstream skills whether to operate in post-merge mode.
- **Review does not modify set status.** Review operates on sets in `complete` state without transitioning them. The review skill is a non-mutating observation step.
- **Concern scoping is best-effort.** If the scoper agent fails, concern scoping is disabled and the scope falls back to directory chunking only. The REVIEW-SCOPE.md is still valid.
- **Wave attribution is derived from wave-*-PLAN.md files.** Files not in any plan are tagged as `"unattributed"`. Post-merge mode has no wave attribution.
- **Directory chunking groups files by parent directory when scope exceeds 15 files.** Each chunk is a `{ dir, files }` entry. Small directories (< 3 files) merge into neighboring chunks.
