# Phase 32: Review Efficiency - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A scoper agent categorizes changed files by concern before any review agent runs, so each review agent receives only the files relevant to its concern area. Cross-cutting files (scoper uncertain) are included in all review scopes. Results from concern-scoped agents are merged and deduplicated before presentation. Target: 60-80% context waste reduction for review agents.

</domain>

<decisions>
## Implementation Decisions

### Concern taxonomy
- LLM-determined categories per project — scoper agent analyzes changed files and generates concern categories that fit the specific review, not a fixed predefined taxonomy
- Flat categories (no priority ranking) — all concerns reviewed equally
- Each file gets a category + one-line rationale (e.g., "state-machine.cjs → state-logic: manages SET_TRANSITIONS")
- No minimum category count — if all files belong to one concern, single-scope review is fine (no forced splitting)

### Scoper vs chunking
- Two-level splitting: scoper categorizes by concern FIRST, then within each concern group, apply directory chunking if that group exceeds 15 files (existing CHUNK_THRESHOLD)
- Scoper applies to bug hunt + unit test stages only — UAT continues to run full scope unchunked (tests user workflows, not files)
- Scoper runs eagerly as Step 2.5, right after file scoping in Step 2 — result cached for all subsequent stages
- Scoper is a new LLM subagent (rapid-scoper) spawned via Agent tool — reads file contents and uses LLM judgment to categorize

### Cross-cutting handling
- Binary flag per file: either assigned to a concern or marked cross-cutting (no confidence scores)
- Cross-cutting files included in ALL concern scopes — may generate duplicate findings (handled at merge step)
- Fallback: if cross-cutting files exceed 50% of total, discard scoper results and fall back to existing directory chunking
- Cross-cutting classification visible in scope banner — user sees the concern split and cross-cutting count

### Result deduplication
- Deduplication happens BEFORE the adversarial pipeline — merge and dedup all hunter findings across concerns, then run one advocate + one judge on the deduplicated set (saves tokens)
- Duplicate detection: same file + similar description (fuzzy/semantic matching, not strict line number match)
- When deduplicating, higher severity finding wins — if equal severity, keep the one with more detailed evidence
- Merged results tagged with source concern — each finding in the summary includes which concern scope it originated from

### Claude's Discretion
- Exact scoper agent prompt design and categorization heuristics
- How the scoper reads file contents (full read vs summary/header scan)
- Fuzzy matching algorithm for finding deduplication
- How to present concern-tagged findings in REVIEW-BUGS.md
- Scoper output format (JSON structure via RAPID:RETURN)

</decisions>

<specifics>
## Specific Ideas

- The scoper agent categorizes once, its output reused by both unit test and bug hunt stages — no re-categorization per stage
- For bug hunt: concern-scoped hunters run in parallel (up to 5), findings merged and deduplicated, THEN single advocate + single judge pass on the unified set
- The >50% cross-cutting fallback should log a warning so users can understand when concern-based scoping wasn't beneficial
- Concern tags in findings help trace which concern area surfaced a bug, useful for understanding code health by area

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `review.cjs`: `scopeSetForReview()` — returns changed + dependent files, scoper runs on this output
- `review.cjs`: `chunkByDirectory()` — reused within each concern group when files exceed CHUNK_THRESHOLD
- `review.cjs`: `buildWaveAttribution()` — wave attribution continues to work orthogonally to concern scoping
- `review.cjs`: `ReviewIssue` Zod schema — needs new optional `concern` field for concern tagging
- SKILL.md Step 2: file scoping — scoper inserts as Step 2.5 between scoping and stage execution
- SKILL.md Step 4b.2-4b.5: bug hunt pipeline — restructured: per-concern hunters → merge/dedup → single advocate → single judge

### Established Patterns
- Agent spawning: `Spawn the **rapid-{role}** agent with this task:` pattern
- RAPID:RETURN protocol for structured agent results
- Directory chunking at CHUNK_THRESHOLD=15
- Parallel subagent dispatch (up to 5 concurrent)

### Integration Points
- New agent: `rapid-scoper` role module + agent file
- Modified: `skills/review/SKILL.md` — add Step 2.5 (scoper), restructure bug hunt pipeline, add concern-tagged output
- Modified: `src/lib/review.cjs` — add concern-based scoping functions, deduplication logic, fallback detection
- Modified: `src/bin/rapid-tools.cjs` — update `review scope` CLI to include concern categorization in output
- Modified: `ReviewIssue` schema — add optional `concern` field
- Rebuild: `agents/rapid-scoper.md` via build-agents after role module creation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-review-efficiency*
*Context gathered: 2026-03-10*
