# Plan: Remove "index 0" Language, Fix Init Next-Step, Add Developer Groups Format

## Objective

Three related fixes to the roadmapper role and init pipeline:
1. Eliminate confusing "index 0" / "set 0" language from the roadmapper (CLI is 1-based)
2. Make the init SKILL.md "Next step" message context-aware based on team-size
3. Add a concrete output format for the Developer Groups section so the roadmapper actually generates it

---

## Task 1: Remove "index 0" language from roadmapper role

**Files:** `src/modules/roles/role-roadmapper.md`

**Actions:**

The following lines contain "index 0" or "Set 0" language that must be updated. The foundation set is simply the **first entry** in the sets array -- there is no index 0 in CLI terms.

1. **Line 120** (STATE.json example comment):
   - Old: `// When team-size > 1, include foundation set at index 0 (no waves array):`
   - New: `// When team-size > 1, include foundation set as the first entry (no waves array):`

2. **Line 251** (Foundation Set section opening paragraph):
   - Old: `...as the first entry (index 0) in \`state.milestones[].sets[]\`.`
   - New: `...as the **first entry** in \`state.milestones[].sets[]\`.`

3. **Line 257** (Foundation Set in state subsection):
   - Old: `When \`team-size > 1\`, insert this entry at index 0 of the sets array:`
   - New: `When \`team-size > 1\`, insert this entry at the first position of the sets array:`

4. **Line 305** (ROADMAP.md example):
   - Old: `### Set 0: Foundation`
   - New: `### Set 1: Foundation`

5. **Line 315** (Conditional Behavior Summary table):
   - Old: `Include foundation set at index 0 with contract merging all exports`
   - New: `Include foundation set as first entry with contract merging all exports`

**Do NOT change:**
- Any JavaScript logic or array indexing in code files
- The actual structure of the JSON examples (foundation still goes first)
- The set ID `"foundation"` (it remains reserved)

**Verification:**
```bash
# Must return zero matches for "index 0" in the file
grep -c "index 0" src/modules/roles/role-roadmapper.md
# Expected: 0

# Must return zero matches for "Set 0"
grep -c "Set 0" src/modules/roles/role-roadmapper.md
# Expected: 0
```

**Done when:** No occurrences of "index 0" or "Set 0" remain in `role-roadmapper.md`, and the foundation set is consistently described as "first entry" / "first position".

---

## Task 2: Make init "Next step" message team-size-aware

**Files:** `skills/init/SKILL.md`

**Actions:**

At Step 12 (around line 1279-1295), the "Next step" display currently always says:

```
> **Next step:** `/rapid:start-set 1`
> *(Start set 1 for development)*
```

Replace the static message block with conditional logic. The team-size value is already available from Step 4A. Change the instruction to:

Parse the JSON output. If there are sets available, display based on team-size:

**When team-size > 1:**
```
> **Next step:** `/rapid:start-set 1`
> *(Start set 1 -- foundation -- to establish shared interfaces)*
```

**When team-size = 1:**
```
> **Next step:** `/rapid:start-set 1`
> *(Start set 1 for development)*
```

The surrounding "no sets" fallback (showing `/rapid:status`) remains unchanged.

**Verification:**
```bash
# Confirm the conditional text exists
grep -c "foundation -- to establish shared interfaces" skills/init/SKILL.md
# Expected: 1

grep -c "Start set 1 for development" skills/init/SKILL.md
# Expected: 1
```

**Done when:** Step 12 conditionally displays the appropriate description based on team-size, and both variants are present in the SKILL.md.

---

## Task 3: Add concrete Developer Groups output format to roadmapper

**Files:** `src/modules/roles/role-roadmapper.md`

**Actions:**

In the `### Multi-Developer (team-size > 1)` subsection (lines 243-247), the current text is:

```markdown
### Multi-Developer (team-size > 1)
When team-size > 1, include in the roadmap output:
- A "Developer Groups" section suggesting how sets should be assigned to developers.
- Note which sets share file ownership and should ideally be assigned to the same developer.
- Flag any sets with high cross-group dependency risk.
```

After the existing bullet list, append the following concrete example and note:

```markdown

Include the Developer Groups section in the ROADMAP.md output using this exact table format:

```markdown
## Developer Groups

| Group | Developer | Sets | Rationale |
|-------|-----------|------|-----------|
| 1 | Dev 1 | foundation, auth-system | Foundation first, then auth (shares user model files) |
| 2 | Dev 2 | data-pipeline, api-endpoints | Both touch the data layer, minimal cross-group deps |
```

**Rules:**
- The foundation set MUST be assigned to Group 1 (it must be completed first by one developer before parallel work begins).
- Each group corresponds to one developer. Number of groups must equal team-size.
- The "Rationale" column explains why those sets are grouped together (shared files, dependency chain, domain affinity).
```

**Do NOT:**
- Modify the Solo Developer subsection
- Change the Principles subsection
- Add any code or logic -- this is purely documentation/prompt content

**Verification:**
```bash
# Confirm the table header exists
grep -c "| Group | Developer | Sets | Rationale |" src/modules/roles/role-roadmapper.md
# Expected: 1

# Confirm the foundation-in-Group-1 rule exists
grep -c "foundation set MUST be assigned to Group 1" src/modules/roles/role-roadmapper.md
# Expected: 1
```

**Done when:** The Multi-Developer subsection contains a concrete example table and explicit rules for Developer Groups output.

---

## Post-Edit Step: Rebuild Agents

After all three tasks are complete, recompile the assembled agent files:

```bash
node src/bin/rapid-tools.cjs build-agents
```

**Verification:**
```bash
# Must exit 0
node src/bin/rapid-tools.cjs build-agents
echo $?
```

**Done when:** `build-agents` exits cleanly with no errors.

---

## Success Criteria

1. Zero occurrences of "index 0" or "Set 0" in `role-roadmapper.md`
2. Init SKILL.md Step 12 shows team-size-conditional "Next step" descriptions
3. Roadmapper Multi-Developer subsection has a concrete Developer Groups table format with rules
4. `build-agents` completes successfully after all edits
