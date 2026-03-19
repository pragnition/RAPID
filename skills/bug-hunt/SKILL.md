---
description: Run adversarial bug hunt on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:bug-hunt -- Adversarial Bug Hunt Pipeline

You are the RAPID bug hunt skill. This skill runs the adversarial bug hunt pipeline on a scoped set. It reads `REVIEW-SCOPE.md` (produced by `/rapid:review`) as its input. The pipeline uses a hunter-advocate-judge pattern with up to 3 iterative cycles. Follow these steps IN ORDER. Do not skip steps. Do NOT include stage selection prompting, unit test logic, or UAT logic.

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
node "${RAPID_TOOLS}" display banner bug-hunt
```

### 0b: Parse arguments

The user invokes this skill with: `/rapid:bug-hunt <set-id>` or numeric shorthand like `/rapid:bug-hunt 1`.

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
- **question:** "Which set to run bug hunt for?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

#### Detect `--post-merge` flag

Check if the user invoked with `--post-merge` flag: `/rapid:bug-hunt <set-id> --post-merge`

If `--post-merge` is present, set `POST_MERGE=true`. Post-merge mode reads REVIEW-SCOPE.md from the post-merge artifact directory.

## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-BUGS.md, issue logging) use the post-merge directory.

**Guard check:** If neither path contains the file, display error and STOP:

```
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
Checked: .planning/sets/{setId}/REVIEW-SCOPE.md
         .planning/post-merge/{setId}/REVIEW-SCOPE.md
Run `/rapid:review {setId}` first to generate the review scope.
```

Read the file content. Parse the `<!-- SCOPE-META {...} -->` JSON block to extract metadata:
- `setId`, `date`, `postMerge`, `worktreePath`, `totalFiles`, `useConcernScoping`

## Step 2: Parse Scope Data

Parse the following sections from REVIEW-SCOPE.md:

### Changed Files
Extract file paths and wave attribution from the `## Changed Files` table. Each row has `| file | wave |` format.

### Dependent Files
Extract file paths from the `## Dependent Files` table.

### Directory Chunks
Extract chunks from `## Directory Chunks` section. Each chunk is a `### Chunk N: dirName` subsection with bulleted file lists.

### Concern Scoping
If `useConcernScoping` is true in SCOPE-META, parse the `## Concern Scoping` section:
- Extract concern groups (each `### ConcernName` subsection with file lists)
- Extract cross-cutting files from `### Cross-Cutting Files`
- Build concern groups: for each concern, the file list is the concern's own files PLUS all cross-cutting files

Store the full scope data for use in the bug hunt cycle loop.

Initialize:
- `cycleNumber = 0`
- `modifiedFiles = []` (tracks files modified by bugfix agents across cycles)
- `allAcceptedBugs = []` (accumulates accepted bugs across cycles)

## Step 3: Bug Hunt Cycle Loop (max 3 iterations)

Repeat the following sub-steps up to 3 times (`MAX_BUGFIX_CYCLES = 3`). Each cycle narrows scope to files modified by the previous cycle's bugfix.

### 3.1: Determine Scope for This Cycle

- **Cycle 1:** Use the full scope from Step 2 (all changed files + dependent files, organized by concern or chunk)
- **Cycle 2+:** Narrow scope to `modifiedFiles` from the previous cycle's bugfix step. If `modifiedFiles` is empty, skip to Step 4.

### 3.2: Spawn Bug Hunter Agents

Dispatch strategy based on scope:

**If concern scoping is active (`useConcernScoping = true`) and cycle 1:**
- Spawn one `rapid-bug-hunter` agent per concern group (up to 5)
- Agent ID format: `bug-hunter-{cycleNumber}-{concernName}` (kebab-case)

**If fallback / no concern scoping, or cycle 2+:**
- If 1 or fewer directory chunks: spawn a single `rapid-bug-hunter` agent
- If multiple chunks: one agent per chunk
- Agent ID format: `bug-hunter-{cycleNumber}-chunk-{N}`

**Agent prompt template:**

```
Adversarial bug hunt for set '{setId}' -- Cycle {cycleNumber}, {concern/chunk description}.

## Files to Analyze
{file list for this concern/chunk}

## Working Directory
{worktreePath from SCOPE-META, or cwd if post-merge}

## Instructions
Perform a thorough adversarial code review. For each file:
1. Read the file completely
2. Look for: logic errors, off-by-one errors, race conditions, unhandled edge cases, security issues, resource leaks, error handling gaps, API contract violations
3. For each finding, provide:
   - file: the file path
   - line: approximate line number
   - severity: critical/high/medium/low
   - description: clear description of the bug
   - evidence: code snippet showing the issue
   - suggestedFix: brief description of how to fix

Return findings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"findings":[{"file":"...","line":N,"severity":"...","description":"...","evidence":"...","suggestedFix":"...","concern":"{concernName}"}]}} -->
```

### 3.3: Merge and Deduplicate

Collect findings from all hunter agents. Merge into a single array.

Deduplicate using the `deduplicateFindings` algorithm from `src/lib/review.cjs`:
- Same file + description similarity > 0.7 (normalized Levenshtein) = duplicate
- Higher severity wins; equal severity keeps longer evidence

### 3.4: Zero Findings Check

If no findings after deduplication, print:

```
--- Bug Hunt Cycle {cycleNumber}: No findings ---
```

Skip to Step 4 (completion).

### 3.5: Spawn Devil's Advocate

Spawn ONE `rapid-devils-advocate` agent on the merged findings:

```
Devil's advocate review for set '{setId}' -- Cycle {cycleNumber}.

## Findings to Challenge
{JSON array of all merged/deduplicated findings}

## Working Directory
{worktreePath or cwd}

## Instructions
For each finding:
1. Read the actual code at the specified file and line
2. Determine if the finding is legitimate or a false positive
3. Provide a counter-argument if you believe the finding is invalid
4. Rate your confidence: high/medium/low

Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"challenges":[{"findingIndex":N,"isValid":bool,"counterArgument":"...","confidence":"high|medium|low"}]}} -->
```

### 3.6: Spawn Judge

Spawn ONE `rapid-judge` agent that receives both the findings and the devil's advocate challenges:

```
Judge review for set '{setId}' -- Cycle {cycleNumber}.

## Findings
{JSON array of findings}

## Challenges
{JSON array of devil's advocate challenges}

## Working Directory
{worktreePath or cwd}

## Instructions
For each finding, considering the devil's advocate challenge:
1. Read the actual code
2. Weigh the hunter's evidence against the advocate's counter-argument
3. Issue a ruling: ACCEPTED, DISMISSED, or DEFERRED
4. **IMPORTANT: Include your leaning indicator with confidence for EVERY ruling.**
   Format: "leaning: accept|reject|uncertain, confidence: high|medium|low"
   This is visible in the final REVIEW-BUGS.md output.

Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"rulings":[{"findingIndex":N,"ruling":"ACCEPTED|DISMISSED|DEFERRED","rationale":"...","leaning":"accept|reject|uncertain","confidence":"high|medium|low"}]}} -->
```

### 3.7: Handle DEFERRED Rulings

For any findings where the judge ruled DEFERRED:
- Present each DEFERRED finding to the user with AskUserQuestion:
  - **question:** "Bug finding in `{file}` (line {line}): {description}\n\nJudge leaning: {leaning} (confidence: {confidence})\nRationale: {rationale}\n\nWhat should we do?"
  - **options:** ["Accept (fix it)", "Dismiss (false positive)", "Defer (skip for now)"]

Update each DEFERRED ruling based on user response:
- "Accept" -> ACCEPTED
- "Dismiss" -> DISMISSED
- "Defer" -> remains DEFERRED (logged but not fixed)

### 3.8: Write REVIEW-BUGS.md

Write the bug hunt results to:

- **Standard mode:** `.planning/sets/{setId}/REVIEW-BUGS.md`
- **Post-merge mode:** `.planning/post-merge/{setId}/REVIEW-BUGS.md`

This write is idempotent -- overwrite if exists.

**CONTRACT REQUIREMENT (`judgeLeaningVisible`):** REVIEW-BUGS.md MUST include the judge leaning with confidence for each finding. This is a behavioral contract requirement.

Format:

```markdown
# REVIEW-BUGS: {setId}

## Summary
| Metric | Value |
|--------|-------|
| Cycle | {cycleNumber} |
| Total Findings | {count} |
| Accepted | {accepted} |
| Dismissed | {dismissed} |
| Deferred | {deferred} |

## Accepted Findings

### BUG-{N}: {description}
- **File:** `{file}`
- **Line:** {line}
- **Severity:** {severity}
- **Evidence:** {code snippet}
- **Suggested Fix:** {fix description}
- **Judge Ruling:** ACCEPTED
- **Judge Leaning:** {leaning} (confidence: {confidence})
- **Concern:** {concern or 'N/A'}

## Dismissed Findings

### BUG-{N}: {description}
- **File:** `{file}`
- **Line:** {line}
- **Severity:** {severity}
- **Judge Ruling:** DISMISSED
- **Judge Leaning:** {leaning} (confidence: {confidence})
- **Rationale:** {judge rationale}

## Deferred Findings

### BUG-{N}: {description}
- **File:** `{file}`
- **Line:** {line}
- **Severity:** {severity}
- **Judge Ruling:** DEFERRED
- **Judge Leaning:** {leaning} (confidence: {confidence})
- **Rationale:** {judge rationale}
```

### 3.9: Spawn Bugfix Agent

For all ACCEPTED findings from this cycle, spawn a `rapid-bugfix` agent:

```
Fix accepted bugs for set '{setId}' -- Cycle {cycleNumber}.

## Bugs to Fix
{JSON array of ACCEPTED findings with file, line, description, suggestedFix}

## Working Directory
{worktreePath or cwd}

## Instructions
1. For each accepted bug, apply the fix
2. Make atomic changes -- fix one bug at a time
3. Run any existing tests after each fix to prevent regressions
4. Track which files you modified
5. Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"fixes":[{"findingId":"BUG-N","file":"...","fixed":true|false,"reason":"..."}],"modifiedFiles":["..."]}} -->
```

Update `modifiedFiles` with the files reported by the bugfix agent. Add accepted findings to `allAcceptedBugs`.

### 3.9a: Cycle Continuation Confirmation

**This step fires only before cycles 2 and 3** (i.e., when `cycleNumber >= 1` after incrementing). Skip this step entirely on cycle 1.

Before starting the next cycle, present the user with a summary and confirmation prompt.

**Display cycle summary:**

```
--- Bug Hunt Cycle {cycleNumber + 1} Complete ---
Findings: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
Modified files this cycle: {modifiedFiles list, or 'none'}
```

Use AskUserQuestion:
- **question:** "Bug hunt cycle {cycleNumber + 1} of 3 complete.\n\nAccepted: {accepted} | Dismissed: {dismissed} | Deferred: {deferred}\nFiles modified by bugfix: {modifiedFiles.length > 0 ? modifiedFiles.join(', ') : 'none'}\n\nContinue to the next cycle?"
- **options:** ["Continue to cycle {cycleNumber + 2} of 3", "Stop and save {allAcceptedBugs.length} findings"]

**If user chooses "Continue...":** Proceed normally -- increment `cycleNumber` and continue to Step 3.1.

**If user chooses "Stop and save...":** Execute the early-exit path (Step 3.9b).

### 3.9b: Early Exit Path

When the user chooses to stop early at the confirmation gate (Step 3.9a):

**1. Write partial REVIEW-BUGS.md**

Write REVIEW-BUGS.md using the same format as Step 3.8, but add two additional rows to the Summary table:

| Metric | Value |
|--------|-------|
| Partial | Yes (stopped after cycle {cycleNumber + 1} of 3) |
| Cycles Completed | {cycleNumber + 1} |

These rows go after the existing Deferred row. All other content (Accepted/Dismissed/Deferred findings sections) uses the same format as Step 3.8, populated from `allAcceptedBugs` and findings from all completed cycles.

**2. Log all accepted findings**

For every finding in `allAcceptedBugs`, log an issue using the same command as Step 4:

```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "bug" \
  --severity "{severity}" \
  --file "{file}" \
  --line {line} \
  --description "{description}" \
  --source "bug-hunt"
```

These are real bugs found in completed cycles -- they must be logged regardless of whether all cycles ran.

**3. Jump to Step 4 (Completion Banner)**

After writing REVIEW-BUGS.md and logging issues, skip directly to Step 4. The completion banner should reflect the partial run (use the actual `cycleNumber + 1` for the Cycles count).

### 3.10: Cycle 3 Remaining Bugs

After the 3rd cycle, if there are still ACCEPTED bugs that were not successfully fixed:
- Present each remaining bug to the user with AskUserQuestion:
  - **question:** "Remaining unfixed bug in `{file}`: {description}\n\nThis persisted through {cycleNumber} fix cycles."
  - **options:** ["Fix manually", "Defer", "Dismiss"]

Log the user's decision for each.

**End of cycle loop.** Increment `cycleNumber` and repeat from 3.1 unless:
- `cycleNumber >= 3`
- `modifiedFiles` is empty (no changes in last cycle)
- All findings were DISMISSED or DEFERRED
- User chose to stop at the confirmation gate (Step 3.9a)

## Step 4: Completion Banner

Print the completion banner:

```
--- RAPID Bug Hunt Complete ---
Set: {setId}{postMerge ? ' (post-merge)' : ''}
Cycles: {cycleNumber}
Total Findings: {totalFindings}
Accepted: {accepted} | Dismissed: {dismissed} | Deferred: {deferred}
Bugs Fixed: {fixedCount}
Issues Logged: {issueCount}

Output: {path to REVIEW-BUGS.md}

Next steps:
  /rapid:unit-test {setIndex}  -- Run unit tests
  /rapid:uat {setIndex}        -- Run user acceptance testing
  /rapid:review summary {setIndex} -- Generate review summary
---------------------------------
```

Log each accepted finding as an issue:

```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "bug" \
  --severity "{severity}" \
  --file "{file}" \
  --line {line} \
  --description "{description}" \
  --source "bug-hunt"
```

If in post-merge mode, issues are logged to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.

Then exit. Do NOT prompt for stage selection.

## Important Notes

- **Hunter-Advocate-Judge pattern.** Each cycle follows: hunters find bugs -> devil's advocate challenges -> judge rules. This adversarial process reduces false positives.
- **Deduplication across concern-scoped hunters.** When multiple hunters analyze overlapping files (cross-cutting files appear in multiple concern groups), findings are deduplicated using normalized Levenshtein similarity >= 0.7 on the same file.
- **Judge leaning is always visible.** The judge MUST provide a leaning indicator (accept/reject/uncertain) with confidence (high/medium/low) for every ruling. This leaning is included in REVIEW-BUGS.md per the `judgeLeaningVisible` behavioral contract.
- **Bugfix scope narrowing.** Each cycle narrows: cycle 1 scans everything, cycle 2+ only scans files modified by the previous cycle's bugfix agent. This prevents infinite loops while catching regressions introduced by fixes.
- **Max 3 cycles.** The `MAX_BUGFIX_CYCLES` constant (from `src/lib/review.cjs`) caps iterations. After 3 cycles, remaining unfixed bugs are escalated to the user.
- **Idempotent overwrite.** Re-running `/rapid:bug-hunt` overwrites REVIEW-BUGS.md. Previous bug hunt results are not accumulated.
- **REVIEW-SCOPE.md is the sole input.** This skill does not scope files itself -- it reads the scope produced by `/rapid:review`. If the scope is stale, re-run `/rapid:review` first.
- **No stage selection.** This skill runs bug hunt only. It does not prompt the user to select unit test or UAT stages.
- **Cycle continuation requires user confirmation.** Before starting cycle 2 or 3, the user is prompted with a summary of findings and modified files from the completed cycle. The user can choose to continue or stop early. Early exit preserves all accumulated findings in REVIEW-BUGS.md with partial-cycle metadata (Partial: Yes, Cycles Completed: N). All accepted findings are logged via `review log-issue` regardless of early exit. This satisfies the `no-runaway-cycles` and `preserve-partial-findings` behavioral contracts.
- **CONTRACT behavioral requirements enforced:**
  - `judgeLeaningVisible`: REVIEW-BUGS.md includes judge leaning with confidence for each finding
  - `noStagePrompting`: No stage selection menu
  - `idempotentRerun`: Re-running overwrites REVIEW-BUGS.md
  - `scopeRequired`: Guard at Step 1 checks for REVIEW-SCOPE.md
  - `no-runaway-cycles`: User confirmation required before cycles 2 and 3 (Step 3.9a)
  - `preserve-partial-findings`: Early exit preserves all findings in REVIEW-BUGS.md (Step 3.9b)
