# PLAN: generous-planning / Wave 1

## Objective

Add a user-facing `targetSetCount` granularity prompt to the `/rapid:new-version` skill and wire the selected value through to the roadmapper agent spawn. This gives users explicit control over how many sets the roadmapper decomposes a milestone into.

## Owned Files

| File | Action |
|------|--------|
| `skills/new-version/SKILL.md` | Modify -- add Step 2D prompt + update Step 7 task template |
| `src/modules/roles/role-roadmapper.md` | Modify -- clarify Auto mode semantics in Design Principles |

## Tasks

### Task 1: Add Step 2D -- Granularity Prompt to new-version SKILL.md

**File:** `skills/new-version/SKILL.md`

**What to do:**

Insert a new `### Step 2D: Set Count Granularity` section between Step 2C-vi (Completeness Confirmation, ends at line 278 with the category-tagged goals string) and Step 3 (Handle Unfinished Sets, starts at line 280).

The new step should contain:

1. An AskUserQuestion prompt with:
   - question: "Set count granularity -- How many sets should the roadmapper target for this milestone?"
   - Options (4 total):
     - "Compact (3-5 sets)" -- "Fewer, larger sets. Good for small milestones or solo developers."
     - "Standard (6-10 sets)" -- "Balanced decomposition. Good for most projects."
     - "Granular (11-15 sets)" -- "Many small sets. Good for large teams or highly parallel work."
     - "Auto" -- "Let the roadmapper decide based on project complexity and scope."

2. Value mapping logic:
   - "Compact (3-5 sets)" maps to `targetSetCount = "3-5"`
   - "Standard (6-10 sets)" maps to `targetSetCount = "6-10"`
   - "Granular (11-15 sets)" maps to `targetSetCount = "11-15"`
   - "Auto" maps to `targetSetCount = "auto"`

3. Store the result as `targetSetCount` for use in Step 7.

**What NOT to do:**
- Do NOT renumber existing steps. Step 2D is a sub-step under the Step 2 umbrella, just like 2C-i through 2C-vi.
- Do NOT add any default bias. If the user picks Auto, pass "auto" literally.
- Do NOT make this prompt conditional on specContent or any other flag -- it always appears.

**Verification:**
```bash
# Confirm Step 2D exists in the file
grep -n "Step 2D" skills/new-version/SKILL.md
# Confirm all four options are present
grep -c "Compact\|Standard\|Granular\|Auto" skills/new-version/SKILL.md
# Confirm targetSetCount is referenced
grep -c "targetSetCount" skills/new-version/SKILL.md
```

### Task 2: Wire targetSetCount into Step 7 Roadmapper Spawn

**File:** `skills/new-version/SKILL.md`

**What to do:**

In Step 7 (Roadmapper Pipeline), modify the roadmapper agent task string template. The current template (lines 596-619) has sections for Research Synthesis, Milestone Goals, Milestone Name, Working Directory, CRITICAL instructions, and Instructions.

Add a new `## Target Set Count` section to the task string, inserted between `## Milestone Name` and `## Working Directory`. The section content should be:

```
## Target Set Count
{targetSetCount from Step 2D}
```

This passes the value verbatim. The roadmapper's existing input item 6 and Design Principles item 5 already handle interpretation of this parameter.

**What NOT to do:**
- Do NOT add conditional logic ("if targetSetCount is not auto, then..."). Always pass the value.
- Do NOT duplicate the roadmapper's interpretation logic in SKILL.md -- that belongs in role-roadmapper.md.

**Verification:**
```bash
# Confirm Target Set Count section exists in Step 7
grep -A2 "Target Set Count" skills/new-version/SKILL.md
# Confirm it appears within the roadmapper task template (between Milestone Name and Working Directory)
sed -n '/## Step 7/,/## Step 8/p' skills/new-version/SKILL.md | grep -n "Target Set Count"
```

### Task 3: Clarify Auto Mode in role-roadmapper.md

**File:** `src/modules/roles/role-roadmapper.md`

**What to do:**

Update Design Principles item 5 (line 181) to clarify Auto mode semantics. The current text reads:

> 5. **Respect granularity preference** -- if targetSetCount is provided, use it as soft guidance for the number of sets. "3-5" means fewer, larger sets; "11-15" means many, smaller sets. "auto" means use your best judgment based on project complexity. If you deviate from the target range, include a brief justification in the roadmap output (e.g., "Target was 3-5 sets, but 7 sets are needed because the frontend and backend have independent deployment pipelines and shared nothing.")

Add a clarifying sentence at the end of this item:

> When targetSetCount is "auto", apply no artificial bias toward any specific range -- decompose based purely on project structure, complexity, and team size.

Also update the behavioral constraint on line 229. The current text reads:

> - If targetSetCount is provided and is not "auto", include a note in the roadmap output confirming the target range and whether the actual set count falls within it. If it does not, explain why.

Add after this line:

> - If targetSetCount is "auto", do not reference any target range in the output. Simply decompose based on your analysis of the project.

**What NOT to do:**
- Do NOT add a default bias toward 6-10 for Auto mode. The CONTEXT.md decision is "No artificial bias" and takes precedence over the CONTRACT.json behavioral contract which suggested 6-10 as default.
- Do NOT change the existing behavior for non-auto values (3-5, 6-10, 11-15).
- Do NOT modify the Input section item 6 -- it already correctly documents all valid values.

**Verification:**
```bash
# Confirm the Auto clarification exists
grep "no artificial bias" src/modules/roles/role-roadmapper.md
# Confirm the behavioral constraint addition exists
grep "do not reference any target range" src/modules/roles/role-roadmapper.md
# Confirm existing non-auto behavior is unchanged
grep "soft guidance" src/modules/roles/role-roadmapper.md
```

## Success Criteria

1. Running `/rapid:new-version` presents a granularity prompt (Step 2D) after goal confirmation and before research pipeline.
2. All four options (Compact 3-5, Standard 6-10, Granular 11-15, Auto) are available in the prompt.
3. The selected `targetSetCount` value appears in the roadmapper agent spawn task string in Step 7.
4. The roadmapper role definition clarifies that Auto means no artificial bias.
5. No existing step numbering is broken -- Step 2D slots in as a sub-step under Step 2.
6. All verification commands above pass.
