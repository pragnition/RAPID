# Wave 3 PLAN: SKILL.md Integration

**Set:** quick-and-addset
**Wave:** 3 of 3
**Objective:** Update the `/rapid:quick` and `/rapid:add-set` skill files to use the new CLI commands created in Waves 1-2. Fix the quick task ID generation to use the monotonic counter from the JSONL log, add JSONL log append after task completion, and refactor add-set to use `state add-set` CLI instead of direct STATE.json writes.

## File Ownership

| File | Action |
|------|--------|
| `skills/quick/SKILL.md` | **Modify** (Steps 2 and 6) |
| `skills/add-set/SKILL.md` | **Modify** (Steps 5-6, anti-patterns) |

---

## Task 1: Fix Quick Task ID Generation in `skills/quick/SKILL.md` Step 2

### Action

Modify `skills/quick/SKILL.md` Step 2 ("Create Quick Task Directory") to replace the collision-prone `ls | wc -l` approach with the monotonic counter from the JSONL log.

**Current code to replace** (lines 47-51 approximately):
```bash
EXISTING=$(ls .planning/quick/ 2>/dev/null | wc -l)
NEXT_ID=$((EXISTING + 1))
echo "Next quick task ID: $NEXT_ID"
```

**Replace with:**
```bash
# (env preamble here)
LAST_ENTRY=$(node "${RAPID_TOOLS}" quick list --limit 1 2>/dev/null)
# Parse the max ID from the most recent entry (list returns descending by ID)
NEXT_ID=$(echo "$LAST_ENTRY" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
  console.log(Array.isArray(data) && data.length > 0 ? data[0].id + 1 : 1);
")
echo "Next quick task ID: $NEXT_ID"
```

**Explanation of change:** Instead of counting directories (which breaks when directories are deleted or tasks fail mid-execution), this reads the max ID from the JSONL log and increments it. If no entries exist, it starts at 1. This matches the CONTEXT.md decision on "Monotonic counter" ID strategy.

**Keep the rest of Step 2 unchanged** -- the slug generation and `mkdir -p` logic remains the same.

### What NOT to Do
- Do NOT change the slug generation logic
- Do NOT change the directory creation (`mkdir -p`) logic
- Do NOT remove the `TASK_DIR` variable assignment

### Verification

Read `skills/quick/SKILL.md` and verify:
- Step 2 no longer contains `ls .planning/quick/ | wc -l`
- Step 2 uses `node "${RAPID_TOOLS}" quick list --limit 1` for ID generation
- The rest of Step 2 is unchanged

### Done Criteria
- `ls .planning/quick/ | wc -l` pattern is completely removed from Step 2
- New ID generation uses the `quick list` CLI command
- Fallback to ID 1 when no entries exist

---

## Task 2: Add JSONL Log Append to `skills/quick/SKILL.md` Step 6

### Action

Modify `skills/quick/SKILL.md` Step 6 ("Write Summary and Complete") to append a JSONL log entry after the summary file is written, before the git commit.

**Insert the following block AFTER the summary file write and BEFORE the git commit** (between the summary markdown template and the `git add` command):

Add this new subsection:

```markdown
### Append to Quick Task Log

Record this task execution in the persistent JSONL log:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" quick log \
  --description "{task description from Step 1}" \
  --outcome "{COMPLETE/CHECKPOINT/BLOCKED from executor return}" \
  --slug "${SLUG}" \
  --branch "$(git branch --show-current)"
\`\`\`

This creates an append-only log entry at `.planning/memory/quick-tasks.jsonl` for future querying via `rapid-tools quick list` and `rapid-tools quick show`.
```

**Also update the git commit command** to include the JSONL log file if it was just created:

Change:
```bash
git add "{TASK_DIR}"
git commit -m "quick({SLUG}): complete quick task {NEXT_ID}"
```

To:
```bash
git add "{TASK_DIR}"
git add ".planning/memory/quick-tasks.jsonl"
git commit -m "quick({SLUG}): complete quick task {NEXT_ID}"
```

### What NOT to Do
- Do NOT modify the summary file template
- Do NOT add the log append to Step 5 (it must happen in Step 6, after execution completes)
- Do NOT modify the completion display message

### Verification

Read `skills/quick/SKILL.md` and verify:
- Step 6 contains `node "${RAPID_TOOLS}" quick log` command
- The `git add` includes `.planning/memory/quick-tasks.jsonl`
- The log command passes all four required flags

### Done Criteria
- Step 6 appends to JSONL log via `quick log` CLI command
- The JSONL file is included in the git commit
- All four flags (description, outcome, slug, branch) are populated from pipeline state

---

## Task 3: Refactor `skills/add-set/SKILL.md` Step 5 to Use CLI

### Action

Rewrite `skills/add-set/SKILL.md` Step 5 ("Update STATE.json") to use the new `state add-set` CLI command instead of direct STATE.json file writes.

**Current Step 5 content to replace entirely** (lines 167-192):

The current approach reads STATE.json via CLI, parses JSON in the skill, manually adds a set object, and writes back with the Write tool. This is the exact anti-pattern the CONTEXT.md describes.

**Replace Step 5 with:**

```markdown
## Step 5: Update STATE.json and Recalculate DAG

Add the new set to the current milestone atomically using the CLI command. This uses `withStateTransaction` internally for safe mutation and automatically recalculates DAG.json and OWNERSHIP.json.

Determine dependencies from the user's `SET_FILES_AND_DEPS` answer in Step 2. If the user mentioned dependencies on existing sets, extract the set IDs and format them as a comma-separated list for the `--deps` flag. If no dependencies were mentioned, omit the `--deps` flag.

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" state add-set \
  --milestone "${MILESTONE_ID}" \
  --set-id "${SET_ID}" \
  --set-name "${SET_ID}" \
  [--deps "dep1,dep2"]
\`\`\`

Parse the JSON output to confirm success. The output will be:
\`\`\`json
{
  "setId": "...",
  "milestoneId": "...",
  "depsValidated": [...]
}
\`\`\`

Commit the state change:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" execute commit-state "add-set(${SET_ID}): add new set to milestone"
\`\`\`

**If the CLI command fails:** Display the error message from stderr. Common failures:
- "Set X already exists" -- the set ID is a duplicate, ask user for a new ID
- "Dependency X not found" -- a referenced dependency does not exist in the milestone
- "STATE.json not found" -- project not initialized, suggest `/rapid:init`

Display: "Failed to add set to STATE.json. Your set artifacts were created at .planning/sets/${SET_ID}/ but state was not updated. Try re-running /rapid:add-set or manually add the set." STOP.
```

### What NOT to Do
- Do NOT keep any reference to reading STATE.json directly in Step 5
- Do NOT keep any reference to the Write tool for STATE.json in Step 5
- Do NOT modify Steps 1-4 or Steps 6-7

### Verification

Read `skills/add-set/SKILL.md` and verify:
- Step 5 uses `node "${RAPID_TOOLS}" state add-set` command
- Step 5 does NOT contain `state get --all` for the purpose of manual mutation
- Step 5 does NOT contain "Write tool" or "Write the updated STATE.json"
- The `--deps` flag is conditionally included based on user's dependency answer

### Done Criteria
- Step 5 exclusively uses `state add-set` CLI command for state mutation
- Error handling covers the three common failure modes
- The commit-state call is preserved for git commit

---

## Task 4: Add Anti-Pattern Notes to `skills/add-set/SKILL.md`

### Action

Add explicit anti-pattern notes to `skills/add-set/SKILL.md` that forbid direct STATE.json manipulation.

**Add to the "Anti-Patterns" section** (around line 266, inside the existing anti-pattern list):

Insert these new bullet points:

```markdown
- Do NOT use the Write tool to modify STATE.json directly -- always use `state add-set` CLI command which provides atomic transactions via `withStateTransaction`
- Do NOT read STATE.json with `state get --all` and then write it back manually -- this creates race conditions and bypasses validation
- Do NOT skip the DAG recalculation -- `state add-set` handles this automatically; manual STATE.json edits would leave DAG.json inconsistent
```

**Also add to the "Key Principles" section** (around line 277):

```markdown
- **Atomic state mutation:** STATE.json is mutated via `state add-set` CLI command, which uses `withStateTransaction` for lock-protected atomic writes with Zod validation
- **DAG consistency:** DAG.json and OWNERSHIP.json are automatically recalculated after every `state add-set` call
```

### What NOT to Do
- Do NOT remove existing anti-pattern notes
- Do NOT remove existing key principles
- Do NOT modify the anti-pattern notes in quick/SKILL.md (that file has its own anti-patterns)

### Verification

Read `skills/add-set/SKILL.md` and verify:
- Anti-Patterns section contains "Do NOT use the Write tool to modify STATE.json"
- Key Principles section contains "Atomic state mutation"
- Existing anti-patterns and key principles are preserved

### Done Criteria
- Three new anti-pattern bullets are added forbidding direct STATE.json writes
- Two new key principles are added about atomic mutation and DAG consistency
- Existing content is preserved

---

## Success Criteria (Wave 3 Complete)

1. `skills/quick/SKILL.md` Step 2 uses monotonic counter from JSONL log (no more `ls | wc -l`)
2. `skills/quick/SKILL.md` Step 6 appends to JSONL log via `quick log` CLI command
3. `skills/add-set/SKILL.md` Step 5 uses `state add-set` CLI command exclusively
4. `skills/add-set/SKILL.md` contains anti-pattern notes forbidding direct STATE.json writes
5. No references to direct STATE.json Write tool usage remain in add-set/SKILL.md Step 5
6. Both SKILL.md files remain valid Markdown with correct front matter
