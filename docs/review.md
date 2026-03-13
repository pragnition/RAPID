# Review

One command runs the full adversarial review pipeline at the set level.

## `/rapid:review <set-id>`

Runs a multi-stage review pipeline on a completed set. The review operates at the set level -- all changed files across all waves are scoped together. You choose which stages to run: unit test, bug hunt, UAT, or any combination.

### Scoping

A `rapid-scoper` agent diffs the set branch against main to identify changed files and their one-hop dependents, then categorizes them by concern area (e.g., "authentication", "database", "UI"). Each review agent receives only relevant files. If cross-cutting files exceed 50% of the total, concern scoping falls back to directory chunking (groups of 15 files max).

### Unit testing

`rapid-unit-tester` agents (one per concern group, running in parallel) generate test plans and execute tests. Results are written to REVIEW-UNIT.md with pass/fail counts and test output.

### Bug hunting

A three-stage adversarial pipeline with up to 3 fix-and-rehunt cycles:

1. **Hunt** -- `rapid-bug-hunter` agents analyze scoped files for bugs, logic errors, and quality issues (one per concern group, parallel)
2. **Challenge** -- `rapid-devils-advocate` challenges each finding with counter-evidence to reduce false positives
3. **Judge** -- `rapid-judge` rules on each finding: ACCEPTED (real bug), DISMISSED (false positive), or DEFERRED (needs user input)
4. **Fix** -- Accepted bugs are dispatched to `rapid-bugfix` for targeted fixes with atomic commits

Cycles 2-3 narrow scope to only the files the bugfix agent modified, preventing scope creep. Results are written to REVIEW-BUGS.md.

### UAT

`rapid-uat` generates acceptance test plans with steps tagged as automated (browser automation) or human-verified. Automated steps execute via the configured browser tool; human steps pause for verification. Results are written to REVIEW-UAT.md.

### Output

A consolidated REVIEW-SUMMARY.md is generated after all stages complete with findings, verdicts, and fix status.

### Prerequisites

The set must be in `complete` status before review can begin.

See [skills/review/SKILL.md](../skills/review/SKILL.md) for full details.

---

Next: [Merge and Cleanup](merge-and-cleanup.md)
