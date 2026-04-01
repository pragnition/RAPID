# PLAN: init-enhancements / Wave 2 -- Spec Flag, Principles Interview, Research Roles, and Scoped CLAUDE.md

## Objective

Integrate the principles module and spec-file support into the RAPID init pipeline. This wave has four independent tracks that all build on the Wave 1 foundation:

1. **Research role modules** -- Add `## Spec Content` section to all 6 research role .md files with [FROM SPEC] tagging and balanced skepticism framing.
2. **Init SKILL.md: --spec flag** -- Add Step 0.5 argument parsing and spec-aware discovery bypass to the init flow, mirroring the new-version pattern.
3. **Init SKILL.md: principles interview** -- Add Step 4E (principles interview after discovery confirmation) and Step 9.5 (write PRINCIPLES.md before auto-commit).
4. **Worktree CLAUDE.md** -- Extend `generateScopedClaudeMd()` in `src/lib/worktree.cjs` to include principles summary when PRINCIPLES.md exists.

## Context

- The 6 research role modules all follow an identical Input/Output/Scope structure. The `## Spec Content` section goes after `## Input` and before `## Output`.
- The new-version SKILL.md Step 0.5 at `skills/new-version/SKILL.md` provides the exact pattern for `--spec` argument parsing.
- `generateScopedClaudeMd()` at `src/lib/worktree.cjs:795-890` is a sync function with 2 params `(cwd, setName)`. It assembles 6 sections. The principles section inserts after "Your Scope" (section 2) and before "Interface Contract" (section 3).
- The init SKILL.md has 13 steps. Spec parsing inserts at Step 0.5, principles interview at Step 4E (after 4D confirmation), principles writing at Step 9.5 (before auto-commit in Step 10).
- 8 predefined categories for the interview: architecture, code style, testing, security, UX, performance, data handling, documentation.

---

## Task 1: Update 6 research role modules with `## Spec Content` section

**Files:**
- `src/modules/roles/role-research-stack.md`
- `src/modules/roles/role-research-architecture.md`
- `src/modules/roles/role-research-features.md`
- `src/modules/roles/role-research-pitfalls.md`
- `src/modules/roles/role-research-ux.md`
- `src/modules/roles/role-research-oversights.md`

### Implementation

For each of the 6 research role modules, add a new `## Spec Content` section **between** the existing `## Input` section and the `## Output` section. The section is identical across all 6 modules except for the agent-specific domain reference. Use this template:

```markdown
## Spec Content

When a spec file is provided via `--spec`, you may receive pre-extracted content relevant to your research domain. This content is tagged with `[FROM SPEC]` markers.

### How to Handle Spec Content

1. **If spec content is provided:** A `## Spec Content` block will appear in your task input containing extracted assertions. Each assertion is prefixed with `[FROM SPEC]`.
2. **If no spec content is provided:** This section will be absent from your task input. Proceed with your normal research flow.

### Critical Evaluation Framing

Spec-provided content should be treated with **balanced skepticism**:

- **Technical claims** (e.g., "we use PostgreSQL 15", "the API handles 10K RPS"): Verify where possible using documentation, codebase analysis, or Context7 MCP lookups. If verification is not possible, note the claim as `[FROM SPEC - unverified]`.
- **Domain/business assertions** (e.g., "our users are enterprise teams", "we need HIPAA compliance"): Accept at face value unless contradicted by evidence in the codebase or other research inputs.
- **Architecture/design decisions** (e.g., "we chose event sourcing", "microservices preferred"): Evaluate critically against the project's actual codebase and scale. Note agreement or disagreement with rationale.

### Output Tagging

When your research output references or builds upon spec-provided assertions, tag them:
- Direct reference: `[FROM SPEC] The project uses React 18 with Server Components.`
- Verified: `[FROM SPEC - verified] PostgreSQL 15 confirmed via package.json.`
- Unverified: `[FROM SPEC - unverified] Claims 10K RPS capacity; no benchmark data found.`
- Contradicted: `[FROM SPEC - contradicted] Spec states "microservices" but codebase is a monolith.`
```

Adapt the third bullet under "Critical Evaluation Framing" for each agent's domain:

- **role-research-stack.md**: "Architecture/design decisions" -> "Stack preferences" (e.g., "we chose PostgreSQL over MongoDB", "Node.js 20 required")
- **role-research-architecture.md**: Keep as-is (architecture is this agent's domain).
- **role-research-features.md**: "Architecture/design decisions" -> "Feature scope decisions" (e.g., "MVP includes X but not Y", "we need offline support")
- **role-research-pitfalls.md**: "Architecture/design decisions" -> "Risk assessments" (e.g., "we have mitigated SQL injection", "performance is not a concern at current scale")
- **role-research-ux.md**: "Architecture/design decisions" -> "UX/domain decisions" (e.g., "our users prefer CLI over GUI", "we follow Material Design")
- **role-research-oversights.md**: "Architecture/design decisions" -> "Infrastructure decisions" (e.g., "we use GitHub Actions for CI", "logging is handled by Datadog")

### Placement

Insert the `## Spec Content` section immediately after the last line of the `## Input` section (the line before `## Output`). Preserve all existing content exactly.

### Verification

```bash
cd /home/kek/Projects/RAPID
for f in src/modules/roles/role-research-*.md; do
  echo "=== $f ==="
  grep -n "## Spec Content" "$f" && echo "PASS" || echo "FAIL: missing ## Spec Content"
  grep -n "\[FROM SPEC\]" "$f" && echo "PASS" || echo "FAIL: missing [FROM SPEC] tag"
  grep -n "balanced skepticism" "$f" && echo "PASS" || echo "FAIL: missing balanced skepticism framing"
done
```

All 6 files must show PASS for all three checks.

### Commit

```
feat(init-enhancements): add spec content sections to 6 research role modules
```

---

## Task 2: Add `--spec` flag parsing to init SKILL.md (Step 0.5)

**Files:** `skills/init/SKILL.md`

### Implementation

Add a new section between `## Display Stage Banner` and `## Step 1: Prerequisites`. The section is titled `## Step 0.5: Parse Optional Arguments` and mirrors the pattern from `skills/new-version/SKILL.md`.

Insert the following content:

```markdown
## Step 0.5: Parse Optional Arguments

If the user invoked `/rapid:init` with arguments, parse them here. The supported argument is `--spec <path>` which provides a pre-written spec file to seed research agents with prior findings.

**Argument parsing instructions:**

1. Check if the skill was invoked with arguments (the user's input after `/rapid:init`).
2. If the input contains a file path argument (with or without the `--spec` prefix), treat it as a spec file path.
   - With prefix: `/rapid:init --spec path/to/spec.md`
   - Without prefix: `/rapid:init path/to/spec.md`
3. Read the spec file using the Read tool.
   - If the file does not exist or cannot be read, display a warning: **"Spec file not found at {path}. Falling back to fully interactive discovery."** and set `specContent = null`.
   - If the file is read successfully, store its full content as `specContent` for use in Steps 4B and 7.
4. If no arguments were provided, set `specContent = null`. This is the backward-compatible default.

When `specContent` is null, all subsequent steps behave identically to the original flow.

### Spec Section Extraction

When `specContent` is not null, extract recognizable sections from the spec file using markdown header matching. Map extracted sections to discovery areas and research agent domains:

| Spec Header Pattern | Discovery Area | Research Agent |
|---|---|---|
| `# Vision`, `# Overview`, `# Introduction` | Vision/problem statement | all |
| `# Features`, `# Requirements`, `# User Stories` | Must-have features | features |
| `# Architecture`, `# Design`, `# System Design` | Technical approach | architecture |
| `# Stack`, `# Technology`, `# Tech Stack` | Tech stack preferences | stack |
| `# Security`, `# Compliance`, `# Privacy` | Compliance requirements | pitfalls, oversights |
| `# UX`, `# Design`, `# User Experience` | UX considerations | ux |
| `# Constraints`, `# Limitations`, `# Non-functional` | Technical constraints | pitfalls, oversights |
| `# Scale`, `# Performance`, `# Load` | Scale expectations | stack, architecture |

Use case-insensitive matching. If a header does not match any pattern, include its content in a general "Additional Spec Context" bucket passed to all agents.

Tag each extracted section with `[FROM SPEC]` prefix when passing to downstream consumers.

---
```

### Spec-Aware Discovery (modify Step 4B)

After the existing Step 4B preamble ("This is a thorough requirements interview..."), add the following conditional block before Batch 1:

```markdown
### Spec-Aware Discovery Mode

If `specContent` is not null, enter spec-aware discovery mode:

1. **Per-area coverage detection:** For each of the 13 discovery areas (vision, target users, scale, features, tech stack, starting point, performance, compliance, integrations, auth, experience, non-functional, success criteria), classify coverage from the spec as:
   - `covered` -- The spec provides clear, specific information for this area.
   - `partial` -- The spec mentions this area but lacks detail or specificity.
   - `uncovered` -- The spec does not address this area at all.

2. **Adaptive questioning depth:**
   - For `covered` areas: Lead with context extracted from the spec. Display: "From your spec, I see: {extracted summary}". Then ask a brief confirmation: "Is this still accurate? Anything to add or change?" If confirmed, move on. If the user wants changes, collect the updated information.
   - For `partial` areas: Lead with context: "Your spec mentions {topic} but I need more detail on: {specific gaps}". Then ask the targeted follow-up question from the original batch.
   - For `uncovered` areas: Ask the full original question from the batch, noting it was not covered in the spec.

3. **Batch compression:** Covered areas within a batch can be presented as a single confirmation prompt instead of individual questions. For example, if Batch 1's vision and target users are both covered, present them together: "From your spec: Vision is {X}, targeting {Y} users at {Z} scale. Confirm or adjust?"

4. **Spec content supplements, never replaces.** Even when the spec fully covers an area, the user always has the opportunity to override or augment. Never skip an area entirely without at least offering the user a chance to confirm or modify.

After spec-aware discovery completes, compile the project brief identically to the non-spec flow. Include a `Spec File: {path}` line in the brief metadata.
```

### Spec Content in Research Agents (modify Step 7)

In Step 7 (Parallel Research Agents), modify each agent's task template to include spec content when available. After the existing `## Brownfield Context` block in each agent's spawn template, add:

```markdown
{if specContent is not null:}
## Spec Content
The following content was extracted from a user-provided spec file. Assertions are tagged with [FROM SPEC].
Evaluate critically: verify technical claims where possible, accept domain/business assertions at face value unless contradicted by evidence.

{extracted spec sections relevant to this agent's domain, each prefixed with [FROM SPEC]}
{end if}
```

### What NOT to do

- Do NOT remove or modify any existing steps. Step 0.5 is purely additive.
- Do NOT make `--spec` required. When omitted, the flow is identical to the current implementation.
- Do NOT attempt to validate the spec file format -- accept any text file.
- Do NOT pass raw spec content to agents -- always extract and tag sections first.

### Verification

```bash
cd /home/kek/Projects/RAPID
grep -c "Step 0.5" skills/init/SKILL.md  # Should be >= 1
grep -c "\-\-spec" skills/init/SKILL.md   # Should be >= 3
grep -c "specContent" skills/init/SKILL.md # Should be >= 5
grep -c "FROM SPEC" skills/init/SKILL.md   # Should be >= 2
grep -c "Spec-Aware Discovery" skills/init/SKILL.md  # Should be >= 1
grep -c "Spec Content" skills/init/SKILL.md  # Should be >= 1 (in Step 7)
```

### Commit

```
feat(init-enhancements): add --spec flag with section extraction and spec-aware discovery to init
```

---

## Task 3: Add principles interview step to init SKILL.md (Step 4E and Step 9.5)

**Files:** `skills/init/SKILL.md`

### Implementation: Step 4E (after Step 4D)

Insert a new `## Step 4E: Principles Capture` section immediately after Step 4D (Summary Confirmation) and before Step 5 (Scaffold). This step runs only after the user confirms the project brief in Step 4D.

```markdown
## Step 4E: Principles Capture

Capture meta-principles that guide development decisions across the project. These are stored in `.planning/PRINCIPLES.md` and summarized in worktree-scoped CLAUDE.md files.

### Principles Interview

Present the 8 predefined categories one at a time. For each category, offer 2-3 recommended principles as multiSelect options, plus the ability to add custom principles.

**Category walkthrough:**

For each category in order (architecture, code style, testing, security, UX, performance, data handling, documentation):

Use AskUserQuestion with:
- question: "Principles for **{Category}** -- Select any that apply, or add your own:"
- Options (vary per category -- see recommended principles below):
  - {Recommended principle 1} -- "{brief rationale}"
  - {Recommended principle 2} -- "{brief rationale}"
  - {Recommended principle 3} -- "{brief rationale}"
  - "Add custom" -- "Write your own principle for this category"
  - "Skip this category" -- "No principles needed for {category}"

If the user selects "Add custom", ask freeform: "Enter your principle statement for {Category}:" and then "Brief rationale (why this matters):" -- collect both and add to the principles list.

Users can select multiple recommended principles AND add custom ones in the same category.

**Recommended principles per category:**

1. **Architecture:**
   - "Prefer composition over inheritance" -- "Flexibility and easier refactoring"
   - "Use dependency injection for testability" -- "Enables unit testing with mocks"
   - "Keep modules loosely coupled" -- "Independent deployment and development"

2. **Code Style:**
   - "Use strict mode everywhere" -- "Prevents silent errors"
   - "Prefer named exports over default exports" -- "Better IDE support and refactoring"
   - "Keep functions under 30 lines" -- "Readability and single responsibility"

3. **Testing:**
   - "Test behavior, not implementation" -- "Tests survive refactoring"
   - "Require tests for all bug fixes" -- "Prevent regressions"
   - "Use integration tests for critical paths" -- "Catch issues unit tests miss"

4. **Security:**
   - "Never store secrets in code" -- "Use environment variables or secret managers"
   - "Validate all external input" -- "Prevent injection attacks"
   - "Use parameterized queries" -- "Prevent SQL injection"

5. **UX:**
   - "Show loading states for async operations" -- "Users need feedback"
   - "Provide meaningful error messages" -- "Help users recover from errors"
   - "Support keyboard navigation" -- "Accessibility and power users"

6. **Performance:**
   - "Lazy load non-critical resources" -- "Faster initial page loads"
   - "Use pagination for large datasets" -- "Prevent memory issues"
   - "Cache expensive computations" -- "Reduce redundant work"

7. **Data Handling:**
   - "Validate at boundaries" -- "Trust nothing from external sources"
   - "Use transactions for multi-step writes" -- "Maintain data consistency"
   - "Log all data mutations" -- "Auditability and debugging"

8. **Documentation:**
   - "Document why, not what" -- "Code shows what; comments explain why"
   - "Keep README up to date" -- "First impression for new contributors"
   - "Document breaking changes in changelogs" -- "Users need migration guidance"

**Escape hatch:**

Before starting the category walkthrough, offer an escape hatch:

Use AskUserQuestion with:
- question: "Would you like to define project principles now?"
- Options:
  - "Yes, walk me through categories" -- "Define principles category by category (recommended)"
  - "Use sensible defaults" -- "Infer principles from existing code patterns (brownfield) or use generic best practices (greenfield)"
  - "Skip principles" -- "Do not generate PRINCIPLES.md. You can add it later."

**If "Yes, walk me through categories":** Proceed with the category walkthrough above.

**If "Use sensible defaults":**
- For brownfield projects: Analyze existing code patterns detected in Step 6 (CODEBASE-ANALYSIS.md) to infer principles. Look for patterns like: test framework usage (testing principles), module structure (architecture principles), linting config (code style principles), existing security middleware (security principles).
- For greenfield projects: Use the first recommended principle from each of the 8 categories as defaults.
- Present the inferred/default principles for confirmation before writing.

**If "Skip principles":** Set `principlesData = null` and skip Step 9.5. No PRINCIPLES.md will be generated.

After the interview (or defaults), compile `principlesData` as an array of `{category, statement, rationale}` objects.
```

### Implementation: Step 9.5 (before Step 10)

Insert a new `## Step 9.5: Write PRINCIPLES.md` section between Step 9 (Roadmap Generation, after roadmap acceptance) and Step 10 (Auto-Commit).

```markdown
## Step 9.5: Write PRINCIPLES.md

If `principlesData` is not null (principles were captured in Step 4E):

1. Generate the PRINCIPLES.md content:

   ```javascript
   const { generatePrinciplesMd } = require('./src/lib/principles.cjs');
   const content = generatePrinciplesMd(principlesData);
   ```

2. Write `.planning/PRINCIPLES.md` using the Write tool.

3. Display: "Wrote {N} principles across {M} categories to .planning/PRINCIPLES.md"

If `principlesData` is null (user skipped principles): Skip this step silently. Do not write an empty PRINCIPLES.md.
```

### What NOT to do

- Do NOT insert the principles interview before Step 4D confirmation -- the user must approve the project brief first.
- Do NOT make principles mandatory -- the "Skip principles" escape hatch must always be available.
- Do NOT write PRINCIPLES.md if the user skipped principles.
- Do NOT put the sensible-defaults escape hatch in the middle of the category walkthrough -- it goes at the beginning.

### Verification

```bash
cd /home/kek/Projects/RAPID
grep -c "Step 4E" skills/init/SKILL.md        # Should be >= 1
grep -c "Step 9.5" skills/init/SKILL.md        # Should be >= 1
grep -c "PRINCIPLES.md" skills/init/SKILL.md   # Should be >= 3
grep -c "sensible defaults" skills/init/SKILL.md # Should be >= 1
grep -c "principlesData" skills/init/SKILL.md   # Should be >= 3
grep -c "predefined categories" skills/init/SKILL.md  # Should be >= 1
```

### Commit

```
feat(init-enhancements): add principles interview and PRINCIPLES.md generation to init flow
```

---

## Task 4: Extend `generateScopedClaudeMd()` with principles awareness

**Files:** `src/lib/worktree.cjs`, `src/lib/worktree.test.cjs`

### Implementation: Modify `generateScopedClaudeMd()`

In `src/lib/worktree.cjs`, modify the `generateScopedClaudeMd(cwd, setName)` function (lines 795-890):

1. **Add principles loading** after the style guide loading block (after line 818) and before the "Build owned files" block (line 820):

```javascript
// Load principles summary (graceful if missing)
let principlesSummary = null;
try {
  const principles = require('./principles.cjs');
  const principlesData = principles.loadPrinciples(cwd);
  if (principlesData && principlesData.length > 0) {
    principlesSummary = principles.generateClaudeMdSection(principlesData);
  }
} catch (err) {
  // Graceful -- skip principles section
}
```

2. **Insert principles section** in the section assembly block, between section 2 (Your Scope) and section 3 (Interface Contract). After the `## Your Scope` section push (after the line `sections.push('');` following "ONLY modify files listed under File Ownership"), add:

```javascript
// 2.5. Project Principles (if available)
if (principlesSummary) {
  sections.push(principlesSummary);
  sections.push('');
}
```

3. **Do NOT change the function signature.** The function remains `generateScopedClaudeMd(cwd, setName)` with 2 params. Principles loading is internal.

### Implementation: Add tests to `worktree.test.cjs`

Add new test cases to the existing `describe('generateScopedClaudeMd', ...)` block in `src/lib/worktree.test.cjs`, after the existing "skips style guide section" test (after line 947):

```javascript
it('includes principles section when PRINCIPLES.md exists', () => {
  // Write a PRINCIPLES.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PRINCIPLES.md'),
    [
      '# Project Principles',
      '',
      '> Generated: 2026-03-31',
      '> Categories: architecture',
      '',
      '## Architecture',
      '',
      '- **Prefer composition over inheritance** -- Flexibility and easier refactoring',
      '',
    ].join('\n'),
    'utf-8'
  );

  const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
  assert.ok(md.includes('## Project Principles'), 'should contain Project Principles section');
  assert.ok(md.includes('Prefer composition over inheritance'), 'should contain principle statement');
});

it('omits principles section when PRINCIPLES.md does not exist', () => {
  const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
  assert.ok(!md.includes('## Project Principles'), 'should not contain Project Principles section when file missing');
});

it('places principles section between scope and contract', () => {
  // Write a PRINCIPLES.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PRINCIPLES.md'),
    [
      '# Project Principles',
      '',
      '> Generated: 2026-03-31',
      '> Categories: testing',
      '',
      '## Testing',
      '',
      '- **Test behavior not implementation** -- Tests survive refactoring',
      '',
    ].join('\n'),
    'utf-8'
  );

  const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
  const scopeIdx = md.indexOf('## Your Scope');
  const principlesIdx = md.indexOf('## Project Principles');
  const contractIdx = md.indexOf('## Interface Contract');
  assert.ok(scopeIdx < principlesIdx, 'principles should come after scope');
  assert.ok(principlesIdx < contractIdx, 'principles should come before contract');
});
```

### What NOT to do

- Do NOT change the function signature from 2 params to 3 params. Principles loading is handled internally.
- Do NOT make the function async. It stays synchronous (matching existing pattern).
- Do NOT import principles.cjs at the top of worktree.cjs -- require it inline inside the function so the module is optional (graceful if principles.cjs is somehow missing).

### Verification

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/worktree.test.cjs
```

All existing tests plus the 3 new tests must pass.

### Commit

```
feat(init-enhancements): extend generateScopedClaudeMd with principles awareness
```

---

## Overall Verification

After all 4 tasks are complete, run the full test suite for both modules:

```bash
cd /home/kek/Projects/RAPID
node --test src/lib/principles.test.cjs
node --test src/lib/worktree.test.cjs
```

Both must pass with zero failures.

Verify all 6 research role modules have the spec content section:

```bash
cd /home/kek/Projects/RAPID
for f in src/modules/roles/role-research-*.md; do
  grep -q "## Spec Content" "$f" && echo "OK: $f" || echo "FAIL: $f"
done
```

Verify init SKILL.md has all new sections:

```bash
cd /home/kek/Projects/RAPID
grep -c "Step 0.5\|Step 4E\|Step 9.5\|specContent\|principlesData\|FROM SPEC\|PRINCIPLES.md" skills/init/SKILL.md
```

Should return a count >= 15.

## Success Criteria

- All 6 research role modules contain `## Spec Content` section with [FROM SPEC] tagging and balanced skepticism framing
- Init SKILL.md contains Step 0.5 with `--spec` argument parsing and section extraction table
- Init SKILL.md contains spec-aware discovery mode in Step 4B with per-area coverage detection
- Init SKILL.md contains Step 4E with principles interview including 8-category walkthrough and escape hatches
- Init SKILL.md contains Step 9.5 with PRINCIPLES.md writing
- Init SKILL.md Step 7 research agent templates include conditional spec content blocks
- `generateScopedClaudeMd()` includes principles summary between scope and contract sections
- `generateScopedClaudeMd()` gracefully omits principles when PRINCIPLES.md does not exist
- All unit tests pass for both `principles.test.cjs` and `worktree.test.cjs`
