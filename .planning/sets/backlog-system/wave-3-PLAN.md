# Wave 3 PLAN: Agent Prompt Updates

**Set:** backlog-system
**Wave:** 3 of 3
**Objective:** Update agent role prompts and the discuss-set skill to hint at backlog usage when out-of-scope ideas are encountered. These are pure additive text changes -- no behavioral logic changes.

## File Ownership

| File | Action |
|------|--------|
| `src/modules/roles/role-executor.md` | Modify |
| `src/modules/roles/role-planner.md` | Modify |
| `skills/discuss-set/SKILL.md` | Modify |

## Task 1: Update `src/modules/roles/role-executor.md`

Add a new section **after** the existing `## Constraints` section (after the last constraint bullet point, before any closing content). The section should be titled `## Backlog Capture` and contain 5-8 lines of guidance.

### Content to Add

Insert after the last line of the `## Constraints` section (after the bullet "Do not modify or delete files in .rapid-stubs/ -- they are managed by the orchestrator"):

```markdown

## Backlog Capture

When you encounter a feature idea, improvement, or requirement that falls outside your current set's scope during execution:

- **Do not implement it.** Stay within your set's file ownership boundaries.
- **Do not silently drop it.** Capture it so the idea is not lost.
- **Invoke `/rapid:backlog`** with a title and description to persist the idea.

Example: If while implementing an auth module you notice the error handling could benefit from a centralized error registry, but that is outside your set's scope:

> Invoke `/rapid:backlog "Centralized error registry" "Create a shared error code registry that all modules reference for consistent error responses across the API."`

Backlog items are reviewed during milestone audits (`/rapid:audit-version`) and promoted to new sets or deferred to future milestones.
```

### What NOT to Do
- Do NOT modify the existing Constraints section content
- Do NOT move or reorder existing sections
- Do NOT add more than 12 lines (keep it concise -- agents should spend time executing, not reading long prompts)

### Verification

```bash
# Verify the backlog section exists
grep -q "## Backlog Capture" src/modules/roles/role-executor.md && echo "PASS: Backlog section exists" || echo "FAIL: Backlog section missing"
# Verify it mentions /rapid:backlog
grep -q "/rapid:backlog" src/modules/roles/role-executor.md && echo "PASS: References /rapid:backlog" || echo "FAIL: Missing /rapid:backlog reference"
# Verify existing Constraints section is intact
grep -q "## Constraints" src/modules/roles/role-executor.md && echo "PASS: Constraints section intact" || echo "FAIL: Constraints section missing"
```

## Task 2: Update `src/modules/roles/role-planner.md`

Add a new section **after** the existing `## Constraints` section (after the last constraint bullet point). The section should be titled `## Backlog Capture` and contain 5-8 lines of guidance.

### Content to Add

Insert after the last line of the `## Constraints` section (after the bullet "Never embed implementation code in plans -- describe behavior, not code"):

```markdown

## Backlog Capture

When you discover a feature idea or improvement opportunity that falls outside the current set's scope during planning:

- **Do not expand the plan to include it.** Keep the plan within the set's defined boundaries.
- **Do not silently drop it.** Capture it so the idea is not lost.
- **Invoke `/rapid:backlog`** with a title and description to persist the idea for future review.

Example: If while planning a database migration set you realize the project could benefit from a query caching layer, but that is outside the set's scope:

> Invoke `/rapid:backlog "Query caching layer" "Add a caching layer for frequently-accessed database queries to reduce load on the primary database."`

Backlog items are reviewed during milestone audits (`/rapid:audit-version`) and promoted to new sets or deferred to future milestones.
```

### What NOT to Do
- Do NOT modify the existing Constraints section content
- Do NOT move or reorder existing sections
- Do NOT duplicate content from the Escape Hatches or Planning Principles sections

### Verification

```bash
# Verify the backlog section exists
grep -q "## Backlog Capture" src/modules/roles/role-planner.md && echo "PASS: Backlog section exists" || echo "FAIL: Backlog section missing"
# Verify it mentions /rapid:backlog
grep -q "/rapid:backlog" src/modules/roles/role-planner.md && echo "PASS: References /rapid:backlog" || echo "FAIL: Missing /rapid:backlog reference"
# Verify existing Constraints section is intact
grep -q "## Constraints" src/modules/roles/role-planner.md && echo "PASS: Constraints section intact" || echo "FAIL: Constraints section missing"
```

## Task 3: Update `skills/discuss-set/SKILL.md`

Add a backlog hint to the **Key Principles** section of the discuss-set skill. This is a single bullet point addition -- not a new section.

### Content to Add

In the `## Key Principles` section, add a new bullet point after the existing bullet "**Deferred decisions:** Out-of-scope ideas raised during discussion are captured in DEFERRED.md, never silently dropped." (this is the most contextually relevant insertion point):

```markdown
- **Backlog capture:** When out-of-scope feature ideas emerge during discussion that are too concrete for DEFERRED.md (which tracks deferred decisions), suggest using `/rapid:backlog` to capture them as backlog items for future milestone review.
```

### What NOT to Do
- Do NOT add a new section -- this is a single bullet point in an existing section
- Do NOT modify the Anti-Patterns section
- Do NOT add backlog-related logic to the skill's execution flow (Steps 1-9)
- Do NOT add backlog invocation to the Step 6.5 (Capture Deferred Decisions) flow -- DEFERRED.md and backlog serve different purposes (deferred architectural decisions vs. concrete feature ideas)

### Verification

```bash
# Verify the backlog hint exists in Key Principles
grep -q "Backlog capture" skills/discuss-set/SKILL.md && echo "PASS: Backlog hint exists" || echo "FAIL: Backlog hint missing"
# Verify it mentions /rapid:backlog
grep -q "/rapid:backlog" skills/discuss-set/SKILL.md && echo "PASS: References /rapid:backlog" || echo "FAIL: Missing /rapid:backlog reference"
# Verify Key Principles section is intact
grep -q "## Key Principles" skills/discuss-set/SKILL.md && echo "PASS: Key Principles section intact" || echo "FAIL: Key Principles section missing"
```

## Task 4: Rebuild Agent Definitions

After modifying the role prompt files (`role-executor.md` and `role-planner.md`), the generated agent files in `agents/` must be rebuilt to incorporate the changes.

### Action

Run the build-agents command:

```bash
node ~/Projects/RAPID/src/bin/rapid-tools.cjs build-agents
```

### Verification

```bash
# Verify rapid-executor.md was regenerated with backlog content
grep -q "Backlog Capture" agents/rapid-executor.md && echo "PASS: Executor agent rebuilt" || echo "FAIL: Executor agent not rebuilt"
# Verify rapid-planner.md was regenerated with backlog content
grep -q "Backlog Capture" agents/rapid-planner.md && echo "PASS: Planner agent rebuilt" || echo "FAIL: Planner agent not rebuilt"
```

Note: If `build-agents` fails because `rapid-executor.md` or `rapid-planner.md` have the `<!-- CORE: Hand-written agent -->` marker, the agents directory copies are hand-managed. In that case, manually verify that the source role files (`src/modules/roles/role-executor.md` and `src/modules/roles/role-planner.md`) contain the Backlog Capture section, and note that the `agents/` files will need separate manual updating. Do NOT modify files in `agents/` directly -- only modify `src/modules/roles/` source files and let build-agents handle propagation.

### What NOT to Do
- Do NOT edit files in `agents/` directly
- Do NOT skip this step -- stale agent definitions mean executors and planners will not see the backlog hints

## Success Criteria

1. `src/modules/roles/role-executor.md` contains a `## Backlog Capture` section with a concrete `/rapid:backlog` invocation example
2. `src/modules/roles/role-planner.md` contains a `## Backlog Capture` section with a concrete `/rapid:backlog` invocation example
3. `skills/discuss-set/SKILL.md` Key Principles section includes a backlog capture bullet point
4. Agent definitions in `agents/` are rebuilt (or source files are updated if agents are hand-managed)
5. No existing content in any of the three files is removed or reordered
6. The backlog hints are concise (5-8 lines for role prompts, 1 bullet for discuss-set)
