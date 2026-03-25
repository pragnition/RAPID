[DOCS.md](../DOCS.md) > Review

# Review

The review pipeline is split into 4 separate skills. First, `/rapid:review` scopes the review and produces `REVIEW-SCOPE.md`. Then three independent skills -- `/rapid:unit-test`, `/rapid:bug-hunt`, and `/rapid:uat` -- each consume that scope artifact to run their respective pipelines.

## `/rapid:review <set-id>`

Scopes a completed set for review by diffing the set branch against main. Identifies changed files and their one-hop dependents, categorizes them by concern area, and produces `REVIEW-SCOPE.md`. This artifact is the sole input for all downstream review skills. If cross-cutting files exceed 50% of the total, concern scoping falls back to directory chunking (groups of 15 files max).

**Output:** `REVIEW-SCOPE.md` with file lists, concern groups, and directory chunks.

**Agents spawned:** `rapid-scoper`

See [skills/review/SKILL.md](../skills/review/SKILL.md) for full details.

## `/rapid:unit-test <set-id>`

Runs the unit test pipeline on a scoped set. Reads `REVIEW-SCOPE.md` as input. Spawns `rapid-unit-tester` agents (one per concern group, running in parallel) that generate test plans and execute tests using the configured test framework. Supports multiple test runners (Node.js, Python, Go, Rust) based on the project's `config.json` test framework configuration.

**Output:** `REVIEW-UNIT.md` with pass/fail counts and test output.

**Agents spawned:** `rapid-unit-tester` (one per concern group)

**Prerequisite:** `REVIEW-SCOPE.md` must exist (run `/rapid:review` first).

See [skills/unit-test/SKILL.md](../skills/unit-test/SKILL.md) for full details.

## `/rapid:bug-hunt <set-id>`

Runs the adversarial bug hunt pipeline on a scoped set. Reads `REVIEW-SCOPE.md` as input. Uses a hunter-advocate-judge pattern with up to 3 iterative fix-and-rehunt cycles:

1. **Hunt** -- `rapid-bug-hunter` agents analyze scoped files for bugs, logic errors, and quality issues (one per concern group, parallel)
2. **Challenge** -- `rapid-devils-advocate` challenges each finding with counter-evidence to reduce false positives
3. **Judge** -- `rapid-judge` rules on each finding: ACCEPTED (real bug), DISMISSED (false positive), or DEFERRED (needs user input)
4. **Fix** -- Accepted bugs are dispatched to `rapid-bugfix` for targeted fixes with atomic commits

Cycles 2-3 narrow scope to only the files the bugfix agent modified, preventing scope creep.

**Output:** `REVIEW-BUGS.md` with findings, verdicts, and fix status.

**Agents spawned:** `rapid-bug-hunter` (per concern group), `rapid-devils-advocate`, `rapid-judge`, `rapid-bugfix`

**Prerequisite:** `REVIEW-SCOPE.md` must exist (run `/rapid:review` first).

See [skills/bug-hunt/SKILL.md](../skills/bug-hunt/SKILL.md) for full details.

## `/rapid:uat <set-id>`

Runs user acceptance testing on a scoped set. Reads `REVIEW-SCOPE.md` as input. Generates acceptance test plans with steps tagged as automated (browser automation) or human-verified. Automated steps execute via the configured browser tool; human steps pause for verification. UAT runs once on the full scope -- it is never chunked or concern-scoped.

**Output:** `REVIEW-UAT.md` with acceptance test results.

**Agents spawned:** `rapid-uat`

**Prerequisite:** `REVIEW-SCOPE.md` must exist (run `/rapid:review` first).

See [skills/uat/SKILL.md](../skills/uat/SKILL.md) for full details.

## Typical Workflow

```bash
/rapid:review auth-system       # Scope the set -> REVIEW-SCOPE.md
/rapid:unit-test auth-system    # Generate and run unit tests
/rapid:bug-hunt auth-system     # Adversarial bug hunting
/rapid:uat auth-system          # Acceptance testing
```

You can run any combination of the three downstream skills based on your needs. They are independent and can run in any order.

## Prerequisites

The set must be in `complete` status before review can begin. Solo sets that have auto-transitioned to `merged` use `--post-merge` mode automatically.

---

Next: [Merge and Cleanup](merge-and-cleanup.md)
