# Wave 1 PLAN: SKILL.md Step 4D -- Overwrite Fix and Encoded Criteria Format

## Objective

Fix the REQUIREMENTS.md overwrite bug and update Step 4D to generate criteria using `{CATEGORY}-{NNN}` encoding. Both changes are prompt-level in `skills/init/SKILL.md`. No code changes to `scaffold.cjs`.

## Owned Files

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Modify (Step 4D section, lines ~404-465) |

## Task 1: Add existsSync guard to Step 4D write instruction

**File:** `skills/init/SKILL.md`

**Current behavior (line 454):**
The instruction says: `Write the acceptance criteria to .planning/REQUIREMENTS.md using the Write tool.`
This always overwrites because the Write tool replaces file contents.

**Required change:**
Replace the single write instruction (around line 454) with a guarded instruction block. The new text should instruct the agent to:

1. Check if `.planning/REQUIREMENTS.md` already exists AND has non-empty content (more than just whitespace/empty markdown headers).
2. If it exists with content: **append** new criteria below the existing content, separated by a dated header like `## Updated Criteria ({ISO date})`. Do NOT overwrite.
3. If it does not exist or is empty: write the full criteria as a new file.

**Exact replacement -- find this text:**
```
**If "Looks good, proceed":**
Write the acceptance criteria to `.planning/REQUIREMENTS.md` using the Write tool. Then continue to Step 5.
```

**Replace with this text:**
```
**If "Looks good, proceed":**

Before writing, check if `.planning/REQUIREMENTS.md` already exists using the Read tool:
- **If the file exists and contains non-trivial content** (more than empty headers or whitespace): Use the Edit tool to APPEND the new criteria below the existing content, separated by a `## Updated Criteria ({current ISO date})` header. This preserves user-written criteria from previous runs.
- **If the file does not exist or is empty/trivial**: Write the full criteria to `.planning/REQUIREMENTS.md` using the Write tool.

Then continue to Step 5.
```

**Verification:**
- Read `skills/init/SKILL.md` and confirm the guarded instruction is present around line 454.
- Confirm the text no longer contains the bare "Write the acceptance criteria" instruction without the guard.

## Task 2: Replace freeform criteria format with encoded CATEGORY-NNN format

**File:** `skills/init/SKILL.md`

**Current format (lines ~422-440):**
The criteria template uses plain checkbox format:
```markdown
## Functional Requirements
- [ ] {criterion derived from must-have features}
```

**Required change:**
Replace the entire criteria format template block (from the line `Based on the discovery answers, generate formal acceptance criteria.` through the closing ` ``` ` of the markdown code block, approximately lines 422-440) with the following:

````
Based on the discovery answers, generate formal acceptance criteria using encoded category prefixes. Each criterion MUST follow the format `CATEGORY-NNN: description` where:

- **CATEGORY** is one of: FUNC, UIUX, PERF, SEC, DATA, INTEG, COMPAT, A11Y, MAINT
- **NNN** is a zero-padded three-digit number, sequential per category (001, 002, ...)
- Only use categories relevant to the project -- not every category needs criteria

The criteria regex pattern is: `/^[A-Z]+-\d{3}:/`

Format them as:

```markdown
# Acceptance Criteria

- [ ] FUNC-001: User can create an account with email and password
- [ ] FUNC-002: User can log in and receive a session token
- [ ] FUNC-003: User can reset their password via email link
- [ ] UIUX-001: All pages render correctly on mobile viewports (320px-768px)
- [ ] PERF-001: API responses complete within 200ms at p95 under expected load
- [ ] SEC-001: All user passwords are hashed with bcrypt before storage
```

**Post-generation validation:** Before writing REQUIREMENTS.md, verify that EVERY generated criterion line matches the regex `/^- \[ \] [A-Z]+-\d{3}: .+/`. If any line does not match, fix it before writing. This is a hard requirement -- do not skip validation.
````

**Verification:**
- Read `skills/init/SKILL.md` and confirm the new encoded format template is present.
- Confirm the regex pattern `/^[A-Z]+-\d{3}:/` appears in the instructions.
- Confirm the post-generation validation step is present.
- Confirm the old format (`## Functional Requirements` / `## Non-Functional Requirements` / `## Success Criteria` subsections) is removed.

## Task 3: Update the roadmap agent criteria reference

**File:** `skills/init/SKILL.md`

**Current text (around line 755-758):**
```
## Acceptance Criteria
{content of .planning/REQUIREMENTS.md written in Step 4D}

Use these formal acceptance criteria to inform set boundaries. Each criterion should be traceable to at least one set.
```

**Required change:**
Append one sentence to the instruction after "traceable to at least one set":
```
Each criterion should be traceable to at least one set. Reference criteria by their encoded ID (e.g., FUNC-001) when mapping criteria to sets.
```

**Verification:**
- Read `skills/init/SKILL.md` around line 758 and confirm the updated instruction references encoded IDs.

## Success Criteria

1. Step 4D contains a Read-before-Write guard that prevents overwriting existing REQUIREMENTS.md content.
2. Step 4D criteria format uses `CATEGORY-NNN:` encoding with explicit regex and validation step.
3. The roadmap agent section references encoded IDs for criteria-to-set traceability.
4. No changes to `scaffold.cjs` (the fix is prompt-level per CONTEXT.md decision).
