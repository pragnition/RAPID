# PLAN: planning-refinement -- Wave 1

## Objective

Implement two refinements to the RAPID planning and review pipeline:

1. **F9 -- UI/UX emphasis in discuss-set**: Add conditional guidance to discuss-set Step 5 so that when a set involves user-facing components, the agent naturally weaves UI/UX considerations into the 4 gray areas rather than ignoring them or wasting a slot on irrelevant UI/UX for backend-only sets.

2. **F7 -- Review file discovery auto-detection**: Modify the unit-test, bug-hunt, and uat skills so they auto-detect post-merge REVIEW-SCOPE.md without requiring the explicit `--post-merge` flag. Standard path takes precedence; post-merge path is the fallback. The `--post-merge` flag is retained as an explicit override.

All changes are prompt-engineering edits to existing skill markdown files. No library code or CLI logic changes.

---

## Task 1: Add UI/UX gray area guidance to discuss-set Step 5

**File:** `skills/discuss-set/SKILL.md`

**Action:** Insert a conditional guidance paragraph between the gray area criteria bullet list (line 158, after "- UI/UX decisions need to be made") and the "Present gray areas using AskUserQuestion:" line (line 160). This paragraph tells the agent to prioritize UI/UX considerations when the set context indicates frontend or user-facing work.

**What to insert (between line 158 and line 160):**

A new paragraph with this guidance:

```
When the set's context (SET-OVERVIEW.md, CONTRACT.json, ROADMAP.md description) indicates user-facing components, frontend work, or UI changes, weave UI/UX considerations naturally into the relevant gray areas. For example, a "state management" gray area for a frontend set should include UI state questions; an "API design" gray area should consider how the API shapes the user experience. Do NOT reserve a dedicated gray area slot exclusively for UI/UX -- instead, let UI/UX concerns enrich the gray areas that naturally touch user-facing behavior. For sets with no user-facing components (pure backend, CLI internals, infrastructure), UI/UX gray areas are unnecessary and should not be forced.
```

**What NOT to do:**
- Do NOT add a 5th gray area or change the "exactly 4" constraint
- Do NOT add a separate pre-step or additional Step for UI/UX detection
- Do NOT add programmatic keyword matching or file pattern detection logic
- Do NOT modify the AskUserQuestion option count or format in Step 5

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test skills/discuss-set/SKILL.test.cjs
```

All 9 existing tests must pass. The new paragraph does not add numbered options, does not change the heading, and does not alter Key Principles or Anti-Patterns -- so no test should break.

Additionally, verify the insertion manually:
- The phrase "user-facing components" appears in discuss-set SKILL.md
- The phrase "Do NOT reserve a dedicated gray area" appears in discuss-set SKILL.md
- Step 5 still contains exactly 4 numbered options (lines starting with `1.` through `4.`)

---

## Task 2: Add path fallback to unit-test SKILL.md Step 1

**File:** `skills/unit-test/SKILL.md`

**Action:** Replace the current Step 1 path selection logic (lines 63-75) with auto-detection fallback logic. The new Step 1 should:

1. If `POST_MERGE=true` (explicit `--post-merge` flag): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly (existing behavior, unchanged).
2. If `POST_MERGE` is not set: Try standard path `.planning/sets/{setId}/REVIEW-SCOPE.md` first. If not found, try fallback path `.planning/post-merge/{setId}/REVIEW-SCOPE.md`. If found at the fallback path, set `POST_MERGE=true` for downstream artifact writes. If neither path has the file, display error and STOP.

**Replace the current Step 1 content** (from `## Step 1: Load REVIEW-SCOPE.md` up to but not including `## Step 2: Parse Scope Data`) with:

```markdown
## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-UNIT.md, issue logging) use the post-merge directory.

**Guard check:** If neither path contains the file, display error and STOP:

\`\`\`
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
Checked: .planning/sets/{setId}/REVIEW-SCOPE.md
         .planning/post-merge/{setId}/REVIEW-SCOPE.md
Run `/rapid:review {setId}` first to generate the review scope.
\`\`\`

Read the file content. Parse the `<!-- SCOPE-META {...} -->` JSON block to extract metadata:
- `setId`, `date`, `postMerge`, `worktreePath`, `totalFiles`, `useConcernScoping`
```

**What NOT to do:**
- Do NOT remove the `--post-merge` flag detection from Step 0b -- it is retained as an explicit override
- Do NOT change any other step in unit-test SKILL.md
- Do NOT modify the guard check error to omit the paths checked

**Verification:**

Verify the replacement manually:
- The phrase "Auto-detect by checking paths in order" appears in unit-test SKILL.md Step 1
- The phrase "set `POST_MERGE=true`" appears in the auto-detect bullet
- The guard check mentions both paths
- Step 0b still contains `--post-merge` flag detection

---

## Task 3: Add path fallback to bug-hunt SKILL.md Step 1

**File:** `skills/bug-hunt/SKILL.md`

**Action:** Apply the same Step 1 replacement as Task 2, but to `skills/bug-hunt/SKILL.md`. The current Step 1 (lines 63-78) has identical structure.

**Replace the current Step 1 content** (from `## Step 1: Load REVIEW-SCOPE.md` up to but not including `## Step 2: Parse Scope Data`) with the same auto-detection logic as Task 2, with one difference in the guard check error message -- reference `REVIEW-BUGS.md` context:

```markdown
## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-BUGS.md, issue logging) use the post-merge directory.

**Guard check:** If neither path contains the file, display error and STOP:

\`\`\`
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
Checked: .planning/sets/{setId}/REVIEW-SCOPE.md
         .planning/post-merge/{setId}/REVIEW-SCOPE.md
Run `/rapid:review {setId}` first to generate the review scope.
\`\`\`

Read the file content. Parse the `<!-- SCOPE-META {...} -->` JSON block to extract metadata:
- `setId`, `date`, `postMerge`, `worktreePath`, `totalFiles`, `useConcernScoping`
```

**What NOT to do:**
- Do NOT remove the `--post-merge` flag detection from Step 0b
- Do NOT change any other step in bug-hunt SKILL.md

**Verification:**

Verify the replacement manually:
- The phrase "Auto-detect by checking paths in order" appears in bug-hunt SKILL.md Step 1
- The downstream artifact reference says "REVIEW-BUGS.md" (not REVIEW-UNIT.md)
- Step 0b still contains `--post-merge` flag detection

---

## Task 4: Add path fallback to uat SKILL.md Step 1

**File:** `skills/uat/SKILL.md`

**Action:** Apply the same Step 1 replacement as Tasks 2-3, but to `skills/uat/SKILL.md`. The current Step 1 (lines 63-78) has identical structure.

**Replace the current Step 1 content** (from `## Step 1: Load REVIEW-SCOPE.md` up to but not including `## Step 2: Parse Scope Data`) with the same auto-detection logic, referencing `REVIEW-UAT.md` for downstream artifacts:

```markdown
## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-UAT.md, issue logging) use the post-merge directory.

**Guard check:** If neither path contains the file, display error and STOP:

\`\`\`
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
Checked: .planning/sets/{setId}/REVIEW-SCOPE.md
         .planning/post-merge/{setId}/REVIEW-SCOPE.md
Run `/rapid:review {setId}` first to generate the review scope.
\`\`\`

Read the file content. Parse the `<!-- SCOPE-META {...} -->` JSON block to extract metadata:
- `setId`, `date`, `postMerge`, `worktreePath`, `totalFiles`, `useConcernScoping`
```

**What NOT to do:**
- Do NOT remove the `--post-merge` flag detection from Step 0b
- Do NOT change any other step in uat SKILL.md

**Verification:**

Verify the replacement manually:
- The phrase "Auto-detect by checking paths in order" appears in uat SKILL.md Step 1
- The downstream artifact reference says "REVIEW-UAT.md"
- Step 0b still contains `--post-merge` flag detection

---

## Success Criteria

1. `node --test skills/discuss-set/SKILL.test.cjs` -- all 9 tests pass
2. discuss-set SKILL.md Step 5 contains UI/UX conditional guidance paragraph between the criteria list and the AskUserQuestion block
3. discuss-set SKILL.md Step 5 still has exactly 4 numbered gray area options (no 5th option added)
4. unit-test, bug-hunt, and uat SKILL.md files all have auto-detection fallback in Step 1
5. All three review skills retain `--post-merge` flag detection in Step 0b
6. All three review skills' guard check error messages reference both checked paths
7. Each review skill's auto-detect bullet references the correct downstream artifact (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md respectively)

---

## File Ownership

| File | Task |
|------|------|
| `skills/discuss-set/SKILL.md` | Task 1 |
| `skills/unit-test/SKILL.md` | Task 2 |
| `skills/bug-hunt/SKILL.md` | Task 3 |
| `skills/uat/SKILL.md` | Task 4 |

No file is modified by more than one task. No file overlaps with other sets (agent-prompts touches different sections of discuss-set SKILL.md -- non-overlapping).
