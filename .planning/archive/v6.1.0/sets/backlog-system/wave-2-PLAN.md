# Wave 2 PLAN: Audit-Version Integration

**Set:** backlog-system
**Wave:** 2 of 3
**Objective:** Update the `audit-version` skill to scan `.planning/backlog/` for accumulated backlog items and surface them during milestone audit. Users can promote items to pending sets or defer them to the next version's deferred list.

## File Ownership

| File | Action |
|------|--------|
| `skills/audit-version/SKILL.md` | Modify |

## Task 1: Add Backlog Surfacing Step to `skills/audit-version/SKILL.md`

Insert a new **Step 3.5: Backlog Review** between the existing Step 3 (Generate Audit Report) and Step 4 (Remediation and Deferral). This is an additive section -- do not restructure or renumber existing steps.

### Step 3.5 Content to Insert

Insert the following section after the line `Verify the artifact was created:` block in Step 3b (after the `test -f` verification command) and before the `## Step 4: Remediation and Deferral` heading.

The new section should be:

```markdown
## Step 3.5: Backlog Review

### Step 3.5a: Scan for Backlog Items

Check if `.planning/backlog/` exists and contains any `.md` files:

\```bash
BACKLOG_COUNT=$(find .planning/backlog -name '*.md' 2>/dev/null | wc -l)
echo "Backlog items found: ${BACKLOG_COUNT}"
\```

If `BACKLOG_COUNT` is 0, display: "No backlog items found. Skipping backlog review." and skip to Step 4.

### Step 3.5b: Parse Backlog Items

For each `.md` file in `.planning/backlog/`, read the file and extract:
- `title` from the YAML frontmatter
- `created` date from the YAML frontmatter
- `description` from the Markdown body (everything after the frontmatter closing `---`)

Use the Read tool to read each file. Parse the YAML frontmatter by extracting content between the opening and closing `---` lines.

### Step 3.5c: Present Backlog Summary Table

Display a batch summary table of all backlog items:

\```
--- Backlog Items ({BACKLOG_COUNT} found) ---

| # | Title | Created | Description (preview) |
|---|-------|---------|----------------------|
| 1 | {title} | {created} | {first 60 chars of description}... |
| 2 | ... | ... | ... |

-----------------------------------------
\```

### Step 3.5d: Backlog Triage

For each backlog item, prompt the user individually using AskUserQuestion:

**Prompt:**
> Backlog item: {title}
> Created: {created}
> Description: {full description}
>
> What should be done with this item?

**Options:** `["Promote to new set", "Defer to next version", "Discard"]`

Handle each response:

- **"Promote to new set":** Ask the user for a set name using AskUserQuestion (freeform):
  > "What should this set be named? (Use kebab-case, e.g., 'add-priority-field')"

  Then write `.planning/pending-sets/{set-name}.json` using the Write tool:
  \```json
  {
    "setName": "{set-name}",
    "scope": "{backlog item description}",
    "files": [],
    "deps": [],
    "severity": "N/A",
    "source": "backlog/{original-filename}",
    "createdAt": "{current ISO date}"
  }
  \```
  Create the `.planning/pending-sets/` directory first if it does not exist: `mkdir -p .planning/pending-sets`

  After writing the pending-set JSON, delete the backlog file:
  \```bash
  rm .planning/backlog/{original-filename}
  \```
  Display: "Promoted '{title}' to pending set '{set-name}'. Run `/rapid:add-set {set-name}` to formalize."

- **"Defer to next version":** Add the item to the `DEFERRAL_LIST` (the same list used by Step 4d). The item should be formatted as:
  - requirement: `[Backlog] {title}`
  - severity: `N/A`
  - reason: "Backlog item deferred during audit"
  - remediation/carry-forward context: `{full description}`

  After adding to DEFERRAL_LIST, delete the backlog file:
  \```bash
  rm .planning/backlog/{original-filename}
  \```
  Display: "Deferred '{title}' to next version."

  Note: The actual write to `v{VERSION}-DEFERRED.md` happens in existing Step 4d, which already handles the DEFERRAL_LIST. This step just appends to that list.

- **"Discard":** Delete the backlog file without persisting content anywhere:
  \```bash
  rm .planning/backlog/{original-filename}
  \```
  Display: "Discarded '{title}'."
```

### Insertion Point

The new section goes between the end of Step 3b (after the `test -f` verification bash block) and the beginning of Step 4. Find the line:

```
## Step 4: Remediation and Deferral
```

Insert the entire Step 3.5 section before that line.

### What NOT to Do
- Do NOT renumber existing steps (Steps 0-5 remain unchanged)
- Do NOT restructure the existing remediation flow in Step 4
- Do NOT add backlog item editing or management capabilities
- Do NOT change the existing DEFERRAL_LIST format -- backlog deferrals should use the same structure as audit gap deferrals
- Do NOT add duplicate detection logic when promoting or deferring
- Do NOT modify the audit report format in Step 3 -- backlog items are handled separately in Step 3.5, not added to the gap analysis

### Verification

```bash
# Verify Step 3.5 exists in the skill
grep -q "Step 3.5" skills/audit-version/SKILL.md && echo "PASS: Step 3.5 exists" || echo "FAIL: Step 3.5 missing"
# Verify it comes before Step 4
STEP35_LINE=$(grep -n "Step 3.5" skills/audit-version/SKILL.md | head -1 | cut -d: -f1)
STEP4_LINE=$(grep -n "Step 4:" skills/audit-version/SKILL.md | head -1 | cut -d: -f1)
if [ "$STEP35_LINE" -lt "$STEP4_LINE" ]; then echo "PASS: Step 3.5 before Step 4"; else echo "FAIL: Step ordering wrong"; fi
# Verify backlog-related keywords are present
grep -q "backlog" skills/audit-version/SKILL.md && echo "PASS: Contains backlog references" || echo "FAIL: Missing backlog references"
grep -q "pending-sets" skills/audit-version/SKILL.md && echo "PASS: Contains pending-sets reference" || echo "FAIL: Missing pending-sets reference"
```

## Success Criteria

1. `skills/audit-version/SKILL.md` contains a new Step 3.5 between Steps 3 and 4
2. Step 3.5 scans `.planning/backlog/` for `.md` files and parses YAML frontmatter
3. Step 3.5 presents a batch summary table of all backlog items
4. Each item can be promoted (writes to `.planning/pending-sets/{name}.json` then deletes backlog file), deferred (adds to DEFERRAL_LIST then deletes backlog file), or discarded (deletes backlog file)
5. Promoted items use the same JSON format as existing remediation sets (`setName`, `scope`, `files`, `deps`, `severity`, `source`, `createdAt`)
6. Deferred items flow into the existing Step 4d DEFERRAL_LIST mechanism with severity `N/A`
7. Existing steps 0-5 are untouched in structure and numbering
