# Wave 2 Plan: Update Roadmapper Role

## Objective

Update the roadmapper role prompt (`src/modules/roles/role-roadmapper.md`) to accept and use the `targetSetCount` runtime parameter and the formal acceptance criteria from `REQUIREMENTS.md`. These are the downstream changes that make the new discovery flow's outputs actionable in roadmap generation.

This wave depends on Wave 1 being complete -- it needs to understand the exact parameter format and REQUIREMENTS.md structure that Wave 1 established.

## Owned Files

- `src/modules/roles/role-roadmapper.md`

## Tasks

### Task 1: Add targetSetCount and REQUIREMENTS.md to Input Section

**File:** `src/modules/roles/role-roadmapper.md` (lines 7-13)

**Action:** Add two new numbered items to the `## Input` list after item 5 (Scaffold report):

```markdown
6. **Target set count** (optional) -- runtime parameter indicating user's desired decomposition granularity. Values: "3-5" (compact), "6-10" (standard), "11-15" (granular), or "auto" (let roadmapper decide based on project complexity and team size). When provided, aim for this range but deviate if the project structure demands it.
7. **Acceptance criteria** (optional) -- `.planning/REQUIREMENTS.md` containing formal functional and non-functional acceptance criteria derived from user discovery answers. When provided, use these to inform set boundaries -- each criterion should be traceable to at least one set.
```

**What NOT to do:**
- Do NOT renumber existing items 1-5.
- Do NOT mark these as required -- they are optional (backward compatible with older init flows).
- Do NOT change the instruction "Read the research summary using the Read tool before beginning roadmap generation."

**Verification:** Read lines 7-16 of the modified file. Confirm items 6 and 7 are present with correct descriptions. Confirm items 1-5 are unchanged.

---

### Task 2: Add Granularity Guidance to Set Boundary Design

**File:** `src/modules/roles/role-roadmapper.md` (lines 167-171)

**Action:** Add a new principle to the `### Set Boundary Design` section, after principle 4 ("Contracts are foundational"):

```markdown
5. **Respect granularity preference** -- if targetSetCount is provided, use it as soft guidance for the number of sets. "3-5" means fewer, larger sets; "11-15" means many, smaller sets. "auto" means use your best judgment based on project complexity. If you deviate from the target range, include a brief justification in the roadmap output (e.g., "Target was 3-5 sets, but 7 sets are needed because the frontend and backend have independent deployment pipelines and shared nothing.")
```

**What NOT to do:**
- Do NOT remove or modify existing principles 1-4.
- Do NOT make targetSetCount a hard constraint -- it is soft guidance.

**Verification:** Read the Set Boundary Design section. Confirm principle 5 is present and principles 1-4 are unchanged.

---

### Task 3: Add Criteria-to-Sets Traceability to Behavioral Constraints

**File:** `src/modules/roles/role-roadmapper.md` (lines 212-218)

**Action:** Add two new behavioral constraints to the `### Behavioral Constraints` section, after the last existing constraint ("Complete the proposal in a single pass"):

```markdown
- If targetSetCount is provided and is not "auto", include a note in the roadmap output confirming the target range and whether the actual set count falls within it. If it does not, explain why.
- If REQUIREMENTS.md acceptance criteria are provided, ensure every criterion is covered by at least one set's scope. Include a traceability note in the roadmap: "Criterion X is addressed by Set Y." If a criterion cannot be traced to any set, flag it as an uncovered requirement.
```

**What NOT to do:**
- Do NOT remove any existing behavioral constraints.
- Do NOT add traceability as a hard blocker -- uncovered criteria should be flagged, not cause failure.

**Verification:** Read the Behavioral Constraints section. Confirm the two new constraints are present. Confirm existing constraints are unchanged.

---

### Task 4: Add Requirements Traceability to Output Format

**File:** `src/modules/roles/role-roadmapper.md` (lines 61-98)

**Action:** In the `### ROADMAP.md Content Format` section, add a new section to the roadmap template after `## Contract Summary`:

```markdown
## Requirements Traceability
| Criterion | Covered By |
|-----------|-----------|
| {acceptance criterion from REQUIREMENTS.md} | {set name(s)} |
```

Add a note below the template: "The Requirements Traceability section is only included when `.planning/REQUIREMENTS.md` exists. If no acceptance criteria were provided, omit this section entirely."

**What NOT to do:**
- Do NOT modify the existing ROADMAP.md template sections (Milestone, Set, Dependency Graph, Contract Summary).
- Do NOT make this section mandatory -- it is conditional on REQUIREMENTS.md existing.

**Verification:** Read the ROADMAP.md Content Format section. Confirm the Requirements Traceability table is present after Contract Summary. Confirm the conditionality note is present.

---

## Success Criteria

1. The roadmapper Input section lists 7 items (original 5 + targetSetCount + acceptance criteria).
2. Set Boundary Design has 5 principles (original 4 + granularity preference).
3. Behavioral Constraints include targetSetCount deviation reporting and requirements traceability.
4. ROADMAP.md output format includes a conditional Requirements Traceability section.
5. All changes are additive -- no existing content is removed or modified.
6. The roadmapper remains backward compatible -- it works correctly when targetSetCount and REQUIREMENTS.md are not provided.
