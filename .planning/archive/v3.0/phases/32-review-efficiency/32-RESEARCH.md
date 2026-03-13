# Phase 32: Review Efficiency - Research

**Researched:** 2026-03-10
**Domain:** LLM-based file scoping, concern-based chunking, finding deduplication
**Confidence:** HIGH

## Summary

Phase 32 introduces a "scoper" agent that categorizes changed files by concern (e.g., state-logic, UI, tests) before review agents run, so each bug hunter receives only files relevant to its concern area. This is an internal architectural change to the existing review pipeline -- no external libraries or APIs are involved. All implementation uses existing RAPID patterns: a new role module (`role-scoper.md`), registration in the build-agents maps, a new `rapid-scoper` agent file, modifications to `review.cjs` for concern-based scoping and deduplication, and restructuring of the review SKILL.md to insert the scoper as Step 2.5.

The four requirements (REV-01 through REV-04) form a clean pipeline: scoper categorizes files -> concern-scoped hunters run in parallel -> findings merged and deduplicated -> single advocate + judge on unified set. The critical design decision is that the scoper is an LLM subagent (not a rule-based classifier), which means its output format must be structured via RAPID:RETURN and its categorization is per-review (not a fixed taxonomy).

**Primary recommendation:** Implement as three work units: (1) scoper role module + agent registration + review.cjs concern-scoping functions, (2) SKILL.md restructuring for Step 2.5 and concern-scoped bug hunt pipeline, (3) deduplication logic and concern-tagged output in REVIEW-BUGS.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- LLM-determined categories per project -- scoper agent analyzes changed files and generates concern categories that fit the specific review, not a fixed predefined taxonomy
- Flat categories (no priority ranking) -- all concerns reviewed equally
- Each file gets a category + one-line rationale (e.g., "state-machine.cjs -> state-logic: manages SET_TRANSITIONS")
- No minimum category count -- if all files belong to one concern, single-scope review is fine (no forced splitting)
- Two-level splitting: scoper categorizes by concern FIRST, then within each concern group, apply directory chunking if that group exceeds 15 files (existing CHUNK_THRESHOLD)
- Scoper applies to bug hunt + unit test stages only -- UAT continues to run full scope unchunked (tests user workflows, not files)
- Scoper runs eagerly as Step 2.5, right after file scoping in Step 2 -- result cached for all subsequent stages
- Scoper is a new LLM subagent (rapid-scoper) spawned via Agent tool -- reads file contents and uses LLM judgment to categorize
- Binary flag per file: either assigned to a concern or marked cross-cutting (no confidence scores)
- Cross-cutting files included in ALL concern scopes -- may generate duplicate findings (handled at merge step)
- Fallback: if cross-cutting files exceed 50% of total, discard scoper results and fall back to existing directory chunking
- Cross-cutting classification visible in scope banner -- user sees the concern split and cross-cutting count
- Deduplication happens BEFORE the adversarial pipeline -- merge and dedup all hunter findings across concerns, then run one advocate + one judge on the deduplicated set (saves tokens)
- Duplicate detection: same file + similar description (fuzzy/semantic matching, not strict line number match)
- When deduplicating, higher severity finding wins -- if equal severity, keep the one with more detailed evidence
- Merged results tagged with source concern -- each finding in the summary includes which concern scope it originated from
- The scoper agent categorizes once, its output reused by both unit test and bug hunt stages -- no re-categorization per stage
- For bug hunt: concern-scoped hunters run in parallel (up to 5), findings merged and deduplicated, THEN single advocate + single judge pass on the unified set
- The >50% cross-cutting fallback should log a warning so users can understand when concern-based scoping wasn't beneficial
- Concern tags in findings help trace which concern area surfaced a bug, useful for understanding code health by area

### Claude's Discretion
- Exact scoper agent prompt design and categorization heuristics
- How the scoper reads file contents (full read vs summary/header scan)
- Fuzzy matching algorithm for finding deduplication
- How to present concern-tagged findings in REVIEW-BUGS.md
- Scoper output format (JSON structure via RAPID:RETURN)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REV-01 | Scoper agent categorizes changed files by concern before review | New `role-scoper.md` role module, `rapid-scoper` agent registration, SKILL.md Step 2.5 insertion, scoper output schema definition |
| REV-02 | Review agents receive only files relevant to their assigned concern | `scopeByConcern()` function in review.cjs, concern-group iteration in SKILL.md Steps 4a/4b, two-level chunking (concern then directory) |
| REV-03 | Cross-cutting files (scoper uncertain) included in all review scopes | Cross-cutting merge logic in `scopeByConcern()`, 50% fallback threshold check, scope banner display |
| REV-04 | Review results merged before presentation to user | `deduplicateFindings()` function in review.cjs, concern-tag preservation, restructured bug hunt pipeline (merge -> single advocate -> single judge) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^3.25.76 | Schema validation for scoper output and ReviewIssue concern field | Already in project dependencies, used for all structured data validation |
| node:test | built-in | Unit testing for new functions | Project standard test framework, all existing tests use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new dependencies | - | - | All functionality implemented with existing deps + built-in Node APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom fuzzy matching | fuzzball, string-similarity npm | Not worth adding a dependency for one function -- Levenshtein on descriptions is ~15 lines of code and sufficient for finding deduplication |

**Installation:**
```bash
# No new packages needed -- all existing dependencies suffice
```

## Architecture Patterns

### Modified Project Structure
```
src/
  modules/
    roles/
      role-scoper.md          # NEW: scoper role module
  lib/
    review.cjs                # MODIFIED: concern-scoping + dedup functions
    review.test.cjs           # MODIFIED: tests for new functions
  bin/
    rapid-tools.cjs           # MODIFIED: scoper registration in build-agents maps
agents/
  rapid-scoper.md             # NEW: generated by build-agents
skills/
  review/
    SKILL.md                  # MODIFIED: Step 2.5, restructured bug hunt pipeline
```

### Pattern 1: Scoper Agent as LLM Subagent
**What:** The scoper is an LLM agent (not a rules-based classifier) that reads file contents and uses judgment to categorize files by concern.
**When to use:** Step 2.5 of the review pipeline, after file scoping but before any stage execution.
**Why:** File-to-concern mapping is inherently semantic -- a rules engine would need constant maintenance as projects evolve. LLM judgment adapts automatically.

**Scoper output schema (RAPID:RETURN):**
```json
{
  "status": "COMPLETE",
  "data": {
    "concerns": [
      {
        "name": "state-logic",
        "files": ["src/lib/state.cjs", "src/lib/transitions.cjs"],
        "rationale": {
          "src/lib/state.cjs": "Core state management with transition table",
          "src/lib/transitions.cjs": "SET_TRANSITIONS enum definitions"
        }
      },
      {
        "name": "cli-interface",
        "files": ["src/bin/rapid-tools.cjs"],
        "rationale": {
          "src/bin/rapid-tools.cjs": "CLI argument parsing and command dispatch"
        }
      }
    ],
    "crossCutting": [
      {
        "file": "src/lib/utils.cjs",
        "rationale": "Utility functions used across all concerns"
      }
    ],
    "totalFiles": 5,
    "concernCount": 2,
    "crossCuttingCount": 1
  }
}
```

### Pattern 2: Two-Level Splitting (Concern, then Directory)
**What:** Files are first grouped by concern (scoper output), then within each concern group, directory chunking applies if the group exceeds CHUNK_THRESHOLD (15 files).
**When to use:** When a concern group is large enough to warrant further splitting.
**Example flow:**
```
All files (45)
  -> Scoper categorizes:
       state-logic (20 files)  -> chunkByDirectory -> 3 chunks
       ui-components (18 files) -> chunkByDirectory -> 2 chunks
       tests (5 files)          -> single chunk
       cross-cutting (2 files)  -> included in all concern scopes
```

### Pattern 3: Restructured Bug Hunt Pipeline
**What:** Instead of per-chunk hunters -> per-chunk advocate -> per-chunk judge, the new pipeline is: per-concern hunters (parallel) -> merge + dedup -> single advocate -> single judge.
**Why:** Deduplicating before the adversarial pipeline saves significant tokens. Running one advocate and one judge on the merged set avoids duplicate work and produces more consistent rulings.
**Flow:**
```
Step 4b.2: Spawn bug-hunter per concern scope (up to 5 parallel)
Step 4b.2.5: Merge findings from all hunters, deduplicate
Step 4b.3: Check for zero findings (on deduplicated set)
Step 4b.4: Spawn ONE devils-advocate on merged+deduped findings
Step 4b.5: Spawn ONE judge on findings + assessments
```

### Pattern 4: Concern-Scoped ReviewIssue
**What:** The existing `ReviewIssue` Zod schema gains an optional `concern` field.
**Why:** Tracing which concern area surfaced a finding is useful for understanding code health by area.
**Schema change:**
```javascript
const ReviewIssue = z.object({
  // ... existing fields ...
  concern: z.string().optional(),  // NEW: concern name from scoper
});
```

### Anti-Patterns to Avoid
- **Fixed taxonomy:** Do NOT define a hardcoded list of concern categories. The scoper generates categories per-review based on actual file contents.
- **Confidence scores on file categorization:** The decision is binary -- a file is either in a concern or cross-cutting. No probability scores.
- **Re-running scoper per stage:** The scoper runs ONCE at Step 2.5. Its output is reused by both unit test and bug hunt stages.
- **Deduplication after advocate/judge:** Dedup BEFORE the adversarial pipeline to save tokens. Not after.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent spawning | Custom agent dispatch | Existing `Spawn the **rapid-{role}** agent` pattern | Established in all 28 existing agents |
| Agent registration | Manual agent file creation | `build-agents` command (add to ROLE_MAPS) | Automated assembly from core + role modules |
| File chunking | Custom chunking for concern groups | `chunkByDirectory()` from review.cjs | Already handles threshold, small-group merging |
| Structured output | Custom parsing | RAPID:RETURN protocol | All agents use this protocol |
| Schema validation | Manual checks | Zod schemas | Project standard for all structured data |

**Key insight:** This phase modifies an existing pipeline. Almost all infrastructure (agent spawning, chunking, issue logging, structured returns) already exists. The new code is the scoper role module, concern-scoping functions, and deduplication logic.

## Common Pitfalls

### Pitfall 1: Cross-Cutting File Explosion
**What goes wrong:** The scoper marks too many files as cross-cutting, defeating the purpose of concern-based scoping.
**Why it happens:** Utility files, configuration, and shared modules are genuinely cross-cutting. If the project has many shared utilities, the scoper may be overly cautious.
**How to avoid:** The 50% fallback threshold is the safety net. If >50% of files are cross-cutting, discard scoper results and fall back to existing directory chunking. Log a warning so the user understands.
**Warning signs:** Scope banner shows cross-cutting count approaching total file count.

### Pitfall 2: Finding Deduplication False Positives
**What goes wrong:** The dedup algorithm incorrectly merges two distinct findings that happen to reference the same file with similar descriptions.
**Why it happens:** Fuzzy matching on descriptions can match unrelated issues that share common terms.
**How to avoid:** Require BOTH same file AND high description similarity (>0.7 normalized Levenshtein distance). When in doubt, keep both findings -- false negatives (missed dedup) are cheaper than false positives (lost findings).
**Warning signs:** Merged finding count is suspiciously low compared to total hunter output.

### Pitfall 3: Agent Tool 5-Concurrent Limit
**What goes wrong:** More than 5 concern-scoped hunters are dispatched simultaneously, exceeding Claude Code's subagent limit.
**Why it happens:** The scoper generates many concern categories (e.g., 8 categories for a large review).
**How to avoid:** Cap parallel hunter dispatch at 5. If more than 5 concern groups exist, batch them (first 5, then remaining). This is the existing pattern from directory chunking.
**Warning signs:** Agent tool errors about exceeding concurrent limit.

### Pitfall 4: Scoper Running on Too Many Files
**What goes wrong:** The scoper reads all file contents, consuming excessive tokens for large reviews.
**Why it happens:** Reading full file contents for 50+ files is expensive.
**How to avoid:** The scoper should read file headers/summaries (first ~50 lines + exports) rather than full file contents. File paths and directory structure already carry strong signal about concern grouping.
**Warning signs:** Scoper agent taking very long or timing out.

### Pitfall 5: Missing concern Field in Existing ReviewIssue Data
**What goes wrong:** Adding `concern` to ReviewIssue breaks backward compatibility with existing REVIEW-ISSUES.json files.
**Why it happens:** Existing issues don't have the `concern` field.
**How to avoid:** The field is `z.string().optional()` -- Zod strips unknown fields but accepts missing optional fields. Existing data remains valid. loadSetIssues continues to work unchanged.

### Pitfall 6: SKILL.md Step Numbering Drift
**What goes wrong:** Inserting Step 2.5 and restructuring Steps 4b.2-4b.5 causes confusion with existing documentation references.
**Why it happens:** The skill has complex step numbering already.
**How to avoid:** Use sub-step numbering (2.5 for scoper insertion). Within bug hunt, add 4b.2.5 for the merge/dedup step. Preserve existing step numbers where possible (precedent: Phase 30 used 5.5/6.5).

## Code Examples

### New Function: scopeByConcern()
```javascript
// Source: Derived from existing chunkByDirectory pattern in review.cjs

/**
 * Group files by concern using scoper output, with cross-cutting files
 * included in ALL groups. Falls back to directory chunking if cross-cutting
 * files exceed 50% of total.
 *
 * @param {Object} scoperOutput - Parsed scoper RAPID:RETURN data
 * @param {string[]} allFiles - Full file list from review scope
 * @returns {{ concernGroups: Array<{concern: string, files: string[]}>, fallback: boolean, warning?: string }}
 */
function scopeByConcern(scoperOutput, allFiles) {
  const { concerns, crossCutting } = scoperOutput;
  const crossCuttingFiles = crossCutting.map(c => c.file);

  // Fallback check: >50% cross-cutting
  if (crossCuttingFiles.length > allFiles.length * 0.5) {
    return {
      concernGroups: [],
      fallback: true,
      warning: `Cross-cutting files (${crossCuttingFiles.length}/${allFiles.length}) exceed 50% threshold. Falling back to directory chunking.`,
    };
  }

  // Build concern groups with cross-cutting files included in each
  const concernGroups = concerns.map(c => ({
    concern: c.name,
    files: [...c.files, ...crossCuttingFiles],
  }));

  return { concernGroups, fallback: false };
}
```

### New Function: deduplicateFindings()
```javascript
// Source: New function for review.cjs

/**
 * Deduplicate findings from multiple concern-scoped hunters.
 * Same file + similar description = duplicate.
 * Higher severity wins; equal severity keeps more detailed evidence.
 *
 * @param {Array<Object>} findings - Merged findings from all hunters
 * @returns {Array<Object>} Deduplicated findings with concern tags preserved
 */
function deduplicateFindings(findings) {
  const dominated = new Set();

  for (let i = 0; i < findings.length; i++) {
    if (dominated.has(i)) continue;
    for (let j = i + 1; j < findings.length; j++) {
      if (dominated.has(j)) continue;
      if (findings[i].file !== findings[j].file) continue;

      const sim = normalizedLevenshtein(findings[i].description, findings[j].description);
      if (sim < 0.7) continue;

      // Duplicate detected -- keep higher severity (or longer evidence)
      const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
      const ri = severityRank[findings[i].risk] || 0;
      const rj = severityRank[findings[j].risk] || 0;

      if (ri > rj) {
        dominated.add(j);
      } else if (rj > ri) {
        dominated.add(i);
      } else {
        // Equal severity -- keep longer evidence
        const ei = (findings[i].evidence || findings[i].codeSnippet || '').length;
        const ej = (findings[j].evidence || findings[j].codeSnippet || '').length;
        dominated.add(ei >= ej ? j : i);
      }
    }
  }

  return findings.filter((_, idx) => !dominated.has(idx));
}
```

### Helper: normalizedLevenshtein()
```javascript
// Source: Standard algorithm, no external dependency needed

/**
 * Compute normalized Levenshtein similarity between two strings.
 * Returns value between 0 (completely different) and 1 (identical).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Similarity score 0-1
 */
function normalizedLevenshtein(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - matrix[a.length][b.length] / maxLen;
}
```

### Scoper RAPID:RETURN Validation Schema
```javascript
// Source: New Zod schema for review.cjs

const ConcernFile = z.object({
  file: z.string(),
  rationale: z.string(),
});

const ConcernGroup = z.object({
  name: z.string(),
  files: z.array(z.string()),
  rationale: z.record(z.string(), z.string()),  // file -> rationale
});

const ScoperOutput = z.object({
  concerns: z.array(ConcernGroup),
  crossCutting: z.array(ConcernFile),
  totalFiles: z.number(),
  concernCount: z.number(),
  crossCuttingCount: z.number(),
});
```

### SKILL.md Step 2.5 Pattern (Scoper Insertion)
```markdown
## Step 2.5: Concern-Based Scoping (Bug Hunt + Unit Test only)

Skip this step if neither bug hunt nor unit test was selected in Step 1.

Spawn the **rapid-scoper** agent with the full scoped file list:

Review set '{setId}' -- categorize {totalFiles} files by concern.

## Scoped Files
{list of ALL files from review scope}

## Working Directory
{worktreePath}

## Instructions
Read the scoped files and categorize each by concern area.
Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{...ScoperOutput...}} -->

Parse RAPID:RETURN. Check cross-cutting fallback:
- If crossCuttingCount > totalFiles * 0.5: log warning, set fallback=true
- If fallback: use existing directory chunking (Step 2 chunks)
- If no fallback: use concern groups for Steps 4a and 4b

Print concern scope banner:
--- Concern Scoping ---
Set: {setId}
Concerns: {concernCount} ({concern names, comma-separated})
Cross-cutting: {crossCuttingCount} file(s)
-----------------------
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Directory chunking only | Concern-based scoping + directory chunking | Phase 32 | 60-80% context reduction per review agent |
| Per-chunk advocate + judge | Single advocate + judge on merged set | Phase 32 | Token savings from dedup before adversarial pipeline |
| No concern tracking on findings | Concern-tagged findings | Phase 32 | Better traceability of code health by area |

**Unchanged:**
- UAT continues to run on full scope (never concern-scoped or chunked)
- Lean wave-level review is unaffected
- Agent spawning patterns, RAPID:RETURN protocol, issue logging all preserved

## Open Questions

1. **Scoper prompt optimization for large file sets**
   - What we know: The scoper needs file contents to categorize by concern. Reading full contents of 50+ files is expensive.
   - What's unclear: Whether reading first ~50 lines per file provides sufficient signal, or if export/import statements alone are enough.
   - Recommendation: Start with header scan (first 50 lines + `module.exports` section). If categorization quality is poor, expand to full content. This is Claude's discretion per the CONTEXT.md.

2. **Levenshtein similarity threshold for deduplication**
   - What we know: 0.7 is a reasonable starting point for "similar descriptions."
   - What's unclear: Real-world finding descriptions may vary widely in wording even for the same bug.
   - Recommendation: Use 0.7 as default. Can be tuned later. Conservative approach: when in doubt, keep both findings.

3. **Concern-scoped unit testing**
   - What we know: CONTEXT.md says scoper applies to both unit test and bug hunt stages.
   - What's unclear: How concern-scoped unit test plan generation differs from the current approach. Unit tests are typically file-focused already.
   - Recommendation: For unit tests, concern groups reduce the file set each tester sees, which reduces irrelevant context. The tester still generates tests per-file. No structural change to the unit test pipeline beyond using concern groups instead of directory chunks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none (standard Node test runner) |
| Quick run command | `node --test src/lib/review.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | Scoper output validated by ScoperOutput schema | unit | `node --test src/lib/review.test.cjs` | Partially (file exists, new tests needed) |
| REV-02 | scopeByConcern returns correct concern groups | unit | `node --test src/lib/review.test.cjs` | No (new function) |
| REV-02 | Two-level chunking: concern group > 15 files triggers chunkByDirectory | unit | `node --test src/lib/review.test.cjs` | No (new test) |
| REV-03 | Cross-cutting files included in all concern scopes | unit | `node --test src/lib/review.test.cjs` | No (new test) |
| REV-03 | 50% cross-cutting threshold triggers fallback | unit | `node --test src/lib/review.test.cjs` | No (new test) |
| REV-04 | deduplicateFindings merges same-file similar-description findings | unit | `node --test src/lib/review.test.cjs` | No (new function) |
| REV-04 | Higher severity wins in deduplication | unit | `node --test src/lib/review.test.cjs` | No (new test) |
| REV-04 | ReviewIssue accepts optional concern field | unit | `node --test src/lib/review.test.cjs` | Partially (schema test exists, needs concern field test) |
| REV-01 | Scoper agent registered in build-agents maps | unit | `node --test src/lib/build-agents.test.cjs` | Partially (test exists, needs scoper entry check) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/review.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/review.test.cjs` -- needs new test cases for scopeByConcern, deduplicateFindings, normalizedLevenshtein, ScoperOutput schema, concern field on ReviewIssue
- [ ] `src/lib/build-agents.test.cjs` -- needs scoper entry in ROLE_CORE_MAP/ROLE_TOOLS/ROLE_COLORS/ROLE_DESCRIPTIONS assertions

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/lib/review.cjs`, `src/lib/review.test.cjs`, `src/bin/rapid-tools.cjs` (lines 459-589 for agent maps)
- Direct codebase analysis: `skills/review/SKILL.md` (full review pipeline)
- Direct codebase analysis: `src/modules/roles/role-bug-hunter.md`, `src/modules/roles/role-wave-analyzer.md` (role module patterns)
- Direct codebase analysis: `src/modules/core/core-returns.md` (RAPID:RETURN protocol)

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (user-locked) -- all implementation decisions verified against codebase feasibility

### Tertiary (LOW confidence)
- Levenshtein similarity threshold (0.7) -- reasonable default, may need tuning based on real-world finding descriptions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing infrastructure
- Architecture: HIGH -- follows established patterns (role modules, agent maps, SKILL.md step insertion)
- Pitfalls: HIGH -- identified through direct analysis of existing chunking/agent patterns
- Deduplication algorithm: MEDIUM -- Levenshtein threshold is an educated guess, may need iteration

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- internal architectural change, no external dependency drift)
