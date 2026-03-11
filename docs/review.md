# Review

One skill orchestrates the full adversarial review pipeline at the set level.

## `/rapid:review <set-id>`

Runs a multi-stage review pipeline on a completed set. The review operates at the set level -- all changed files across all waves are scoped together. You choose which stages to run: unit test, bug hunt, UAT, or any combination.

**Scoping** starts by diffing the set branch against main to identify changed files and their one-hop dependents. A scoper agent categorizes files by concern area (e.g., "authentication", "database", "UI") so each review agent receives only relevant files. If cross-cutting files exceed 50% of the total, concern scoping falls back to directory chunking (groups of 15 files max). Concern-based scoping applies to unit test and bug hunt stages; UAT always uses full scope.

**Unit testing** generates a test plan (one agent per concern group or directory chunk, running in parallel), presents it for approval, then executes approved tests. Results are written to REVIEW-UNIT.md with pass/fail counts and test output.

**Bug hunting** runs an adversarial three-stage pipeline with up to 3 fix-and-rehunt cycles. First, `rapid-bug-hunter` agents analyze scoped files for bugs, logic errors, and quality issues (one per concern group, parallel). Findings are deduplicated across groups, then a `rapid-devils-advocate` challenges each finding with counter-evidence. A `rapid-judge` rules on each finding: ACCEPTED (real bug), DISMISSED (false positive), or DEFERRED (insufficient evidence, needs your input). Accepted bugs are dispatched to a `rapid-bugfix` agent for targeted fixes. Cycles 2-3 narrow scope to only the files the bugfix agent modified, preventing scope creep. Results are written to REVIEW-BUGS.md.

**UAT** generates a test plan with steps tagged as automated (browser automation via Chrome DevTools MCP or Playwright MCP) or human-verified. After approval, automated steps execute via the configured browser tool and human steps pause for your verification. Results are written to REVIEW-UAT.md.

All findings are logged as issues with wave attribution for traceability. A consolidated REVIEW-SUMMARY.md is generated after all stages complete.

See [skills/review/SKILL.md](../skills/review/SKILL.md) for full step-by-step details.

---

Next: [Merge and Cleanup](merge-and-cleanup.md)
