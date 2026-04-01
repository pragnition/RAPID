<!-- gap-closure: true -->
# Wave 3 Plan: How It Works Gap Closure

**Set:** readme-polish
**Wave:** 3
**Gap:** Gap 1 -- How It Works line count below target (17 lines, target 20-25)
**Objective:** Add two missing lifecycle subsections (Isolation and Discussion) to the How It Works section, bringing the line count into the 20-25 range and covering the two phases visible in the Quickstart and lifecycle diagram but absent from the prose.

## Context

The How It Works section currently has 6 bold-titled subsections: Research pipeline, Interface contracts, Planning, Execution, Review pipeline, and Merge. The Quickstart and lifecycle diagram both show two additional phases -- `start-set` (isolation/worktree creation) and `discuss-set` (capturing implementation vision) -- that have no corresponding subsections.

Adding **Isolation.** and **Discussion.** subsections (one sentence each, plus blank-line separators) adds 4 content lines and 2 blank lines, bringing the section from ~15 lines to ~21 lines, squarely within the 20-25 target.

The new subsections must be ordered to match the lifecycle flow shown in the diagram and Quickstart:
1. Intro line (existing)
2. **Research pipeline.** (existing -- covers init)
3. **Isolation.** (NEW -- covers start-set)
4. **Discussion.** (NEW -- covers discuss-set)
5. **Interface contracts.** (existing)
6. **Planning.** (existing)
7. **Execution.** (existing)
8. **Review pipeline.** (existing)
9. **Merge.** (existing)

## Tasks

### Task 1: Add Isolation and Discussion subsections to How It Works

**File:** `README.md`

**Actions:**

Insert two new bold-titled paragraphs between the existing **Research pipeline.** paragraph and the **Interface contracts.** paragraph. The insertion point is after line 61 (the Research pipeline paragraph) and before line 63 (the Interface contracts paragraph).

Insert the following text (including leading and trailing blank lines for consistent formatting):

```

**Isolation.** `/rapid:start-set` creates a dedicated git worktree per set so each agent works in its own copy of the repo with no cross-contamination.

**Discussion.** `/rapid:discuss-set` captures the developer's implementation vision and design decisions into CONTEXT.md before any planning begins.

```

That is: blank line, Isolation paragraph, blank line, Discussion paragraph, blank line. The trailing blank line connects to the existing blank line before Interface contracts (deduplicate so there is only one blank line between Discussion and Interface contracts).

After the edit, the How It Works section (lines 57 through end of Merge paragraph) should read:

```
## How It Works

RAPID structures parallel work around **sets** -- independent workstreams that each developer owns end-to-end.

**Research pipeline.** `/rapid:init` spawns 6 parallel researchers (stack, features, architecture, pitfalls, oversights, UX) to analyze your project. A synthesizer combines their findings, and a roadmapper decomposes work into sets with clear boundaries.

**Isolation.** `/rapid:start-set` creates a dedicated git worktree per set so each agent works in its own copy of the repo with no cross-contamination.

**Discussion.** `/rapid:discuss-set` captures the developer's implementation vision and design decisions into CONTEXT.md before any planning begins.

**Interface contracts.** Sets connect through `CONTRACT.json` -- machine-verifiable specs defining which functions, types, and endpoints each set exposes. Contracts are validated after planning, during execution, and before merge.

**Planning.** `/rapid:plan-set` runs a researcher to investigate implementation specifics, a planner to produce wave-level plans, and a verifier to check for coverage gaps and contract violations.

**Execution.** `/rapid:execute-set` runs one executor per wave in dependency order. Each executor implements planned work with atomic commits and reports results; re-running after interruption resumes from the first incomplete task.

**Review pipeline.** Four sequential stages: scoping identifies changed files by concern area, unit tests target each concern group, an adversarial bug-hunt cycle (hunter/devil's-advocate/judge, up to 3 rounds) finds and auto-fixes confirmed issues, and acceptance testing verifies end-to-end behavior.

**Merge.** `/rapid:merge` detects conflicts at 5 levels (textual, structural, dependency, API, semantic) and resolves them through a confidence cascade -- high-confidence auto-accepted, mid-confidence delegated to resolver agents, low-confidence escalated to the developer. Clean merges skip detection via fast-path `git merge-tree`.
```

**What NOT to do:**
- Do not modify any existing subsection text -- only insert new paragraphs
- Do not reorder existing subsections relative to each other
- Do not change the section heading or intro line
- Do not touch any other section of README.md
- Do not add emojis

**Verification:**
```bash
# Count lines in How It Works section (from "## How It Works" to next "##" heading)
sed -n '/^## How It Works$/,/^## /{/^## How It Works$/p;/^## [^H]/!p}' README.md | wc -l
# Target: 21-25 lines (was ~15)

# Confirm Isolation subsection exists
grep -c '^\*\*Isolation\.\*\*' README.md
# Should output "1"

# Confirm Discussion subsection exists
grep -c '^\*\*Discussion\.\*\*' README.md
# Should output "1"

# Confirm lifecycle order: Isolation appears before Discussion, Discussion before Interface contracts
grep -n '^\*\*Isolation\.\*\*\|^\*\*Discussion\.\*\*\|^\*\*Interface contracts\.\*\*' README.md
# Isolation line number < Discussion line number < Interface contracts line number

# Confirm no other sections were modified (Install, Quickstart, Architecture, Command Reference, Links unchanged)
# Check total line count is reasonable (was 90, should be ~94-96 with 4-6 new lines)
wc -l README.md
```

## Success Criteria

1. How It Works section contains 8 bold-titled subsections (was 6), adding Isolation and Discussion
2. Subsection order matches lifecycle flow: Research pipeline, Isolation, Discussion, Interface contracts, Planning, Execution, Review pipeline, Merge
3. Each new subsection is exactly one sentence
4. Total How It Works section line count is 21-25 (within the 20-25 target)
5. No existing subsection text is modified
6. No other README sections are affected
7. README total line count increases by 4-6 lines

## File Ownership

| File | Action |
|------|--------|
| `README.md` | Modify (insert 2 subsections into How It Works) |
