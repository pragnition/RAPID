# CONTEXT: review-pipeline

**Set:** review-pipeline
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Decompose the monolithic `/rapid:review` skill (~1035 lines) into 4 independent, individually invocable skills that share a common scoping artifact (REVIEW-SCOPE.md):
- `/rapid:review` — scoping-only, produces REVIEW-SCOPE.md (rewrite of existing skill)
- `/rapid:unit-test` — reads REVIEW-SCOPE.md, runs unit test pipeline, writes REVIEW-UNIT.md
- `/rapid:bug-hunt` — reads REVIEW-SCOPE.md, runs hunter+advocate+judge pipeline, writes REVIEW-BUGS.md
- `/rapid:uat` — reads REVIEW-SCOPE.md, runs acceptance testing, writes REVIEW-UAT.md

The existing `src/lib/review.cjs` library and agent role modules remain largely intact — the work is at the skill orchestration layer. The review pipeline still operates at set level (all changed files across all waves scoped together).
</domain>

<decisions>
## Implementation Decisions

### REVIEW-SCOPE.md Schema
- **Structured markdown** with defined sections (headings, tables, code blocks)
- Each downstream skill parses REVIEW-SCOPE.md by heading to extract its needed data
- Sections must include: changed files, dependent files, directory chunks, wave attribution, concern groups (from scoper agent), cross-cutting files, acceptance criteria, set metadata
- Concern-scoping results from the scoper agent are embedded in REVIEW-SCOPE.md (scoper runs once during /review, not per-downstream-skill)
- File paths with metadata only — no full file contents (each downstream skill reads files itself)

### Skill Registration & Naming
- **Flat names**: `skills/unit-test/SKILL.md`, `skills/bug-hunt/SKILL.md`, `skills/uat/SKILL.md`
- Commands: `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat`
- `/rapid:review` stays at its current path (`skills/review/SKILL.md`) but becomes scoping-only
- Old monolithic review behavior is fully removed, not preserved as alias

### Independence vs Chaining
- **Scoping-only**: `/rapid:review` produces REVIEW-SCOPE.md and stops — no chaining
- User explicitly invokes `/rapid:unit-test`, `/rapid:bug-hunt`, `/rapid:uat` as separate commands
- No `--all` flag or stage-selection menu in `/rapid:review`
- Each downstream skill detects missing REVIEW-SCOPE.md and prompts user to run `/rapid:review` first

### Claude's Discretion
- **Post-merge mode handling**: Claude will determine how `--post-merge` flows through the decomposed skills. Likely approach: each skill independently supports `--post-merge` flag, since they are standalone. REVIEW-SCOPE.md includes a `postMerge` indicator set during scoping.
</decisions>

<specifics>
## Specific Ideas
- REVIEW-SCOPE.md should include a `postMerge: true/false` field so downstream skills know the mode without needing their own flag parsing (though they should still accept --post-merge for explicit invocation)
- The scoper agent runs during /review (Step 2.5 equivalent) and its output is serialized into REVIEW-SCOPE.md, saving downstream skills from spawning their own scoper
- Each downstream skill should validate REVIEW-SCOPE.md exists before any agent spawning, with a clear error message pointing to `/rapid:review`
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/review.cjs` provides: `scopeSetForReview()`, `scopeSetPostMerge()`, `chunkByDirectory()`, `buildWaveAttribution()`, `scopeByConcern()`, `deduplicateFindings()`, `logIssue()`, `loadSetIssues()`, `updateIssueStatus()`, `generateReviewSummary()`
- Agent roles exist at: `src/modules/roles/role-scoper.md`, `role-unit-tester.md`, `role-bug-hunter.md`, `role-devils-advocate.md`, `role-judge.md`, `role-uat.md`
- Generated agents: `agents/rapid-scoper.md`, `agents/rapid-unit-tester.md`, `agents/rapid-bug-hunter.md`, `agents/rapid-devils-advocate.md`, `agents/rapid-judge.md`, `agents/rapid-uat.md`, `agents/rapid-bugfix.md`
- Current skill at `skills/review/SKILL.md` handles everything: set resolution, scoping, concern categorization, stage selection, unit test (plan+execute), bug hunt (3-cycle adversarial), UAT (plan+execute), summary generation
- Review artifacts write to `.planning/sets/{setId}/REVIEW-*.md` (standard) or `.planning/post-merge/{setId}/REVIEW-*.md` (post-merge)
- CHUNK_THRESHOLD = 15 files per directory group
- Cross-cutting fallback threshold = 50% of total files
</code_context>

<deferred>
## Deferred Ideas
- Staleness detection for REVIEW-SCOPE.md (warn if older than latest commit) — could be added later as a quality-of-life improvement
- A `/rapid:review --all` convenience flag to chain all stages — explicitly deferred; may revisit if users find the manual invocation tedious
</deferred>
