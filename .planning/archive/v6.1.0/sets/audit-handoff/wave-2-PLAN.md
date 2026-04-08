# PLAN: audit-handoff -- Wave 2 (Skill Wiring)

## Objective

Wire the remediation module into the three skill files: audit-version writes artifacts, add-set auto-discovers and consumes them, and status displays pending remediations. Also add the `.planning/pending-sets/` entry to `.gitignore` so artifacts are not tracked.

## Owned Files

| File | Action |
|------|--------|
| `skills/audit-version/SKILL.md` | **Modify** |
| `skills/add-set/SKILL.md` | **Modify** |
| `skills/status/SKILL.md` | **Modify** |
| `.gitignore` | **Modify** |

## Dependencies

- Wave 1 must be complete. The remediation module (`src/lib/remediation.cjs`) must exist with all 4 exported functions.

---

## Task 1: Add `.planning/pending-sets/` to `.gitignore`

### What to Change

Edit `.gitignore` to add the pending-sets directory entry. This ensures remediation artifacts are local-only ephemeral handoff files.

### Implementation Details

Add the following lines after the existing `.planning/worktrees/*.lock` entry:

```
# RAPID remediation artifacts (ephemeral audit-to-set handoff)
.planning/pending-sets/
```

### What NOT to Do

- Do NOT remove or reorder any existing `.gitignore` entries.
- Do NOT add the directory itself to git (it is created lazily by the module).

### Verification

```bash
grep -q 'pending-sets' .gitignore && echo "PASS: gitignore entry exists" || echo "FAIL: gitignore entry missing"
```

---

## Task 2: Wire artifact writer into `skills/audit-version/SKILL.md`

### What to Change

Modify Step 4e of the audit-version skill to write remediation artifacts to disk after the user names each remediation set.

### Current Behavior (Step 4e)

Currently, Step 4e collects set names from the user and prints `/rapid:add-set` commands as guidance text. The artifacts exist only in the skill's output.

### New Behavior

After the user provides each set name in Step 4e, the skill should write a remediation artifact to `.planning/pending-sets/{set-name}.json` using the Write tool. The artifact contains the structured context from the gap analysis.

### Implementation Details

In Step 4e, after collecting each set name via AskUserQuestion, add instructions for the agent to write the artifact file. Insert the following block after the "Collect the set names" instruction and BEFORE the "then display" command list:

**New instruction block to insert:**

```markdown
For each item in `REMEDIATION_LIST` with its collected set name, write a remediation artifact using the Write tool:

Write `.planning/pending-sets/{set-name}.json` with this structure:

\`\`\`json
{
  "setName": "{set-name}",
  "scope": "{remediation description from gap analysis}",
  "files": [],
  "deps": [],
  "severity": "{severity from gap item}",
  "source": "v{TARGET_VERSION}-AUDIT.md",
  "createdAt": "{current ISO date}"
}
\`\`\`

Create the `.planning/pending-sets/` directory first if it does not exist:

\`\`\`bash
mkdir -p .planning/pending-sets
\`\`\`

The `files` and `deps` arrays are left empty -- they will be populated by the user during add-set discovery. The `source` field references the audit report for traceability.
```

Also update the final display block in Step 4e. After the existing "Run these commands" guidance, add a note:

```
Remediation artifacts written to .planning/pending-sets/
These will be auto-discovered when you run /rapid:add-set.
```

### Exact Edit Location

The edit goes inside Step 4e, between the AskUserQuestion loop that collects set names and the display block that prints `/rapid:add-set` commands. The existing text to find is:

```
Collect the set names, then display:
```

Insert the new artifact-writing instructions BEFORE that line, and modify the display block to include the artifact note.

### What NOT to Do

- Do NOT change any other step in the audit-version skill.
- Do NOT import or require the remediation.cjs module in the SKILL.md -- skill files instruct agents to use the Write tool directly (consistent with how audit-version already creates other artifacts).
- Do NOT change the AskUserQuestion prompts or options.
- Do NOT remove the existing `/rapid:add-set` command guidance -- keep it as a fallback reference.

### Verification

```bash
grep -q 'pending-sets' skills/audit-version/SKILL.md && echo "PASS: audit-version references pending-sets" || echo "FAIL: no pending-sets reference"
grep -q 'auto-discovered' skills/audit-version/SKILL.md && echo "PASS: auto-discovery note present" || echo "FAIL: auto-discovery note missing"
```

---

## Task 3: Wire artifact reader into `skills/add-set/SKILL.md`

### What to Change

Insert a new Step 1.5 (between existing Steps 1 and 2) that checks for pending remediation artifacts and pre-populates scope. Also add artifact cleanup after the commit in Step 7.

### Implementation Details

**Part A: Insert artifact discovery step**

After Step 1 ("Load State and Validate") and before Step 2 ("Interactive Discovery"), insert a new section:

```markdown
---

## Step 1.5: Check for Pending Remediation Artifacts

Check if any remediation artifacts exist from a previous `/rapid:audit-version` run:

\`\`\`bash
# (env preamble here)
PENDING_DIR=".planning/pending-sets"
if [ -d "$PENDING_DIR" ]; then
  ARTIFACTS=$(ls "$PENDING_DIR"/*.json 2>/dev/null | wc -l)
  if [ "$ARTIFACTS" -gt 0 ]; then
    echo "PENDING_ARTIFACTS=$ARTIFACTS"
    ls "$PENDING_DIR"/*.json
  else
    echo "PENDING_ARTIFACTS=0"
  fi
else
  echo "PENDING_ARTIFACTS=0"
fi
\`\`\`

**If PENDING_ARTIFACTS is 0:** Skip to Step 2 (standard interactive discovery). This is the graceful fallback path.

**If PENDING_ARTIFACTS is 1:** Read the single artifact file using the Read tool. Parse the JSON to extract `setName`, `scope`, `severity`, and `source`. Display the artifact context:

\`\`\`
--- Pending Remediation Found ---
Set Name: {setName}
Scope: {scope}
Severity: {severity}
Source: {source}
---------------------------------
\`\`\`

Use AskUserQuestion to confirm:

> "A remediation artifact was found from {source}. Use this to pre-populate the new set?"
> Options: ["Yes -- use artifact", "No -- start fresh"]

- If "Yes": Set `SET_SCOPE = artifact.scope`, `SET_FILES_AND_DEPS = "Files: " + artifact.files.join(", ") + " | Deps: " + artifact.deps.join(", ")`, and `ARTIFACT_SET_NAME = artifact.setName`. Skip Step 2 (interactive discovery) and proceed to Step 3 with the artifact's set name pre-filled.
- If "No": Proceed to Step 2 as normal.

**If PENDING_ARTIFACTS is more than 1:** Read all artifact files. Present a selection list using AskUserQuestion:

> "Multiple remediation artifacts found. Which one should be used for this set?"
> Options: One option per artifact formatted as "{setName} -- {scope} ({severity})" plus a final "None -- start fresh" option.

- If user selects an artifact: Pre-populate as described above for the single-artifact case.
- If user selects "None -- start fresh": Proceed to Step 2 as normal.

Record `CONSUMED_ARTIFACT_NAME` (the setName of the consumed artifact, or null if none was used). This is needed for cleanup in Step 7.

---
```

**Part B: Pre-fill set ID in Step 3**

In Step 3 ("Generate Set ID"), add a note at the beginning:

```markdown
If `ARTIFACT_SET_NAME` was set in Step 1.5 (from a consumed remediation artifact), propose that name as the set ID instead of deriving one from the scope description. The user still confirms or customizes the ID as normal.
```

**Part C: Add artifact cleanup to Step 7**

At the end of Step 7, after the existing commit block and before the "Display Confirmation" section, add:

```markdown
### Clean Up Consumed Artifact

If `CONSUMED_ARTIFACT_NAME` is set (a remediation artifact was used):

\`\`\`bash
ARTIFACT_FILE=".planning/pending-sets/${CONSUMED_ARTIFACT_NAME}.json"
if [ -f "$ARTIFACT_FILE" ]; then
  rm "$ARTIFACT_FILE"
  echo "Cleaned up remediation artifact: $ARTIFACT_FILE"
fi
\`\`\`

This ensures consumed artifacts are deleted after the set is successfully committed. If add-set fails before this point, the artifact survives for retry.
```

### What NOT to Do

- Do NOT modify the existing Step 2 logic -- it must continue to work identically when no artifact exists (graceful fallback).
- Do NOT require or import the remediation.cjs module -- the skill reads files directly via bash/Read tool.
- Do NOT auto-create the set without user confirmation -- always present and confirm.
- Do NOT change the existing AskUserQuestion prompts in Steps 2 or 3.
- Do NOT remove the "Anti-Patterns" section or any existing rules.

### Verification

```bash
grep -q 'Step 1.5' skills/add-set/SKILL.md && echo "PASS: Step 1.5 exists" || echo "FAIL: Step 1.5 missing"
grep -q 'CONSUMED_ARTIFACT_NAME' skills/add-set/SKILL.md && echo "PASS: cleanup variable referenced" || echo "FAIL: cleanup variable missing"
grep -q 'pending-sets' skills/add-set/SKILL.md && echo "PASS: pending-sets referenced" || echo "FAIL: pending-sets not referenced"
```

---

## Task 4: Add pending remediation display to `skills/status/SKILL.md`

### What to Change

Add a "Pending Remediations" section to the status dashboard output in Step 3, displayed after the set table.

### Implementation Details

In Step 3 ("Display Dashboard"), after the set table display (item 3) and before the tip line (item 4), insert a new section:

```markdown
3.5. **Pending Remediations:** Check for remediation artifacts from `/rapid:audit-version`:

   \`\`\`bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   PENDING_DIR=".planning/pending-sets"
   if [ -d "$PENDING_DIR" ]; then
     ARTIFACTS=$(ls "$PENDING_DIR"/*.json 2>/dev/null)
     if [ -n "$ARTIFACTS" ]; then
       echo "HAS_PENDING=true"
       for f in $ARTIFACTS; do
         NAME=$(basename "$f" .json)
         SCOPE=$(node -e "try { const a = JSON.parse(require('fs').readFileSync('$f','utf-8')); console.log(a.scope || 'no scope'); } catch(e) { console.log('unreadable'); }")
         echo "$NAME|$SCOPE"
       done
     else
       echo "HAS_PENDING=false"
     fi
   else
     echo "HAS_PENDING=false"
   fi
   \`\`\`

   If `HAS_PENDING` is true, display a "Pending Remediations" section after the set table:

   \`\`\`
   ### Pending Remediations

   The following remediation sets were suggested by `/rapid:audit-version` and are waiting to be created:

   | Set Name | Scope |
   |----------|-------|
   | {name} | {scope (truncated to ~80 chars)} |
   | ... | ... |

   Run `/rapid:add-set` to create a set from these suggestions.
   \`\`\`

   If `HAS_PENDING` is false, do not display this section at all (no empty table, no "0 pending" message).
```

### What NOT to Do

- Do NOT modify the existing set table format or ordering logic.
- Do NOT add pending remediations as rows in the main set table -- they are a separate concept.
- Do NOT modify Step 2 (data loading) or Step 4 (next actions).
- Do NOT make the status skill writable -- it remains read-only.

### Verification

```bash
grep -q 'Pending Remediations' skills/status/SKILL.md && echo "PASS: pending section exists" || echo "FAIL: pending section missing"
grep -q 'pending-sets' skills/status/SKILL.md && echo "PASS: pending-sets directory referenced" || echo "FAIL: pending-sets not referenced"
```

---

## Success Criteria

1. `.gitignore` contains `.planning/pending-sets/` entry
2. `skills/audit-version/SKILL.md` instructs agent to write remediation artifacts during Step 4e
3. `skills/add-set/SKILL.md` has Step 1.5 that discovers and pre-populates from artifacts, with graceful fallback
4. `skills/add-set/SKILL.md` has artifact cleanup in Step 7
5. `skills/status/SKILL.md` displays "Pending Remediations" section when artifacts exist
6. No skill file imports or requires the remediation.cjs module (skills use bash/Write/Read tools directly)
7. Existing skill behavior is preserved when no artifacts exist (graceful fallback path)
