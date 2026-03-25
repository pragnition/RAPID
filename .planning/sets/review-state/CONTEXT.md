# CONTEXT: review-state

**Set:** review-state
**Generated:** 2026-03-25
**Mode:** interactive

<domain>
## Set Boundary
Implement persistent review pipeline state so the review skill tracks which stages (scope, unit-test, bug-hunt, uat) have been completed for each set. Uses a standalone REVIEW-STATE.json file per set (following the MERGE-STATE.json precedent), enabling downstream commands to skip already-completed stages and resume interrupted review pipelines. Owned files: src/lib/review.cjs, src/lib/review.test.cjs, src/commands/review.cjs, src/commands/review.test.cjs, and the four SKILL.md files (review, unit-test, bug-hunt, uat).
</domain>

<decisions>
## Implementation Decisions

### State File Schema Design
- Use a nested stages object: `stages: { scope: { completed, verdict }, "unit-test": { ... }, "bug-hunt": { ... }, uat: { ... } }`
- **Rationale:** Nested objects give clean O(1) lookups by stage name, are naturally extensible if new stages are added, and mirror how skills already refer to stages by name.

### Prerequisite Enforcement Model
- Enforce prerequisites in the library layer only (review.cjs), with descriptive error messages
- **Rationale:** Library enforcement is deterministic and cannot be bypassed by agent interpretation of skill markdown. Descriptive error messages give skills enough context to relay meaningful feedback without needing redundant skill-level checks.

### Re-entry and Idempotency Strategy
- Skills check review state at entry and prompt via AskUserQuestion with skip/re-run options; library stays simple with no re-entry logic
- **Rationale:** AskUserQuestion provides rich UX for the skip/re-run decision. Keeping this in the skill layer means the library remains a clean data layer without user interaction concerns. Each skill independently checks before calling library functions.

### Atomic Write Pattern
- Use simple temp-file-then-rename atomic write without locking
- **Rationale:** Review is fundamentally single-writer per set (only one review skill runs at a time). The temp-file-then-rename pattern protects against crash corruption, which is the only realistic failure mode. Transactional locking would add complexity with no concurrent access to protect against.

### CLI Inspection UX
- `rapid-tools review state <set-id>` outputs a structured table with Stage | Status | Verdict columns
- **Rationale:** A table is instantly scannable for humans, showing all 4 stages at a glance. This is a user-facing command where readability matters more than machine-parseability.

### Skill Integration Depth
- Minimal entry/exit integration: check state at entry (skip/re-run prompt), write state at exit (mark complete)
- **Rationale:** Skills are markdown prompts interpreted by agents -- more conditionals mean more room for misinterpretation. Minimal changes are easier to maintain and less likely to break agent behavior. Entry/exit hooks cover the full skip/resume use case without mid-skill complexity.

### Verdict Capture Granularity
- Minimal: just `completed: boolean` and `verdict: 'pass' | 'fail' | 'partial'` per stage
- **Rationale:** User preference for simplicity. Timestamps and issue counts add fields to maintain and validate without clear immediate benefit. The verdict alone is sufficient for prerequisite checks and CLI inspection.

### State Lifecycle and Cleanup
- Eager creation when `/rapid:review` runs scope; no cleanup (persists forever as historical record)
- **Rationale:** Eager creation means the file exists as soon as review starts, simplifying state checks in downstream skills (no null-check ambiguity). No cleanup follows the MERGE-STATE.json precedent and preserves review history.

### Claude's Discretion
- No areas were left to Claude's discretion -- all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The schema should use Zod validation consistent with existing ReviewIssue, MergeStateSchema patterns in the codebase
- readReviewState should return null when no REVIEW-STATE.json exists (not throw), matching the CONTRACT.json signature
- The `state` CLI subcommand should be added to the existing switch statement in src/commands/review.cjs
- Prerequisite errors should include actionable next-step suggestions (e.g., "Run /rapid:unit-test first")
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/merge.cjs` provides the precedent for atomic JSON state files: writeMergeState uses temp-file-then-rename, readMergeState returns parsed+validated or null
- `src/lib/review.cjs` already has Zod schemas (ReviewIssue, ConcernGroup, ScoperOutput) and fs/path imports -- new schemas slot in naturally
- `src/commands/review.cjs` uses a switch statement over subcommands (scope, log-issue, list-issues, update-issue, lean, summary) -- `state` is a new case
- All four SKILL.md files follow the same structure: Step 0 (env + set resolution), Step 1 (load REVIEW-SCOPE.md), then pipeline-specific steps -- state checks would go between Step 0 and Step 1
- The `parseArgs` utility from `src/lib/args.cjs` is already used in the review command handler
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
