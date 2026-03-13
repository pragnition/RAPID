# Phase 22: Review Module - Research

**Researched:** 2026-03-08
**Domain:** Review pipeline orchestration, adversarial bug hunting, unit testing, UAT automation
**Confidence:** HIGH

## Summary

Phase 22 implements the review quality gate between execution and merge. The review module introduces a two-tier architecture: lean wave-level review (auto-runs during reconciliation) and full set-level review (manual via `/rapid:review`). The full review orchestrates a three-stage pipeline -- unit testing, adversarial bug hunting (hunter/devils-advocate/judge), and UAT -- with bugfix iteration loops and human-in-the-loop decision points.

The GSD review plugin (`gsd-review/1.0.1`) provides a mature reference implementation with scoping, unit-test, bug-hunt, and UAT skills that closely match RAPID's requirements. RAPID must adapt these patterns to its hierarchical state model (milestone > set > wave > job), its worktree-based execution model, and its wave-scoped artifact storage at `.planning/waves/{setId}/{waveId}/`. Key differences: RAPID uses CommonJS (not ESM), STATE.json (not STATE.md), and has a locked iteration limit of 3 cycles (not 5 like GSD).

The phase requires 6 new agent roles, a new `review.cjs` library module, a new `/rapid:review` skill, modifications to the execute pipeline for lean review integration, and new CLI subcommands. The architecture follows established RAPID patterns: assembler-based agent composition, RAPID:RETURN structured protocol, AskUserQuestion at every decision gate, and lock-protected atomic state writes.

**Primary recommendation:** Build from established RAPID patterns (assembler, returns, state machine) with GSD review as structural reference. Do NOT port GSD code directly -- adapt the orchestration patterns to RAPID's CommonJS/Zod/STATE.json architecture.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Two-tier review architecture:** Lean wave-level review (auto during reconciliation: artifact verification, quick static analysis, contract compliance, auto-fix) and full set-level review (manual via `/rapid:review`, complete unit test > bug hunt > UAT pipeline)
- **Pipeline invocation & scope:** `/rapid:review` is manual-only, dual scope (set or wave), review state is set-level only (set transitions executing -> reviewing), artifacts at `.planning/waves/{setId}/{waveId}/REVIEW-*.md` plus consolidated `REVIEW-SUMMARY.md` at set level
- **Stage control & ordering:** User chooses stages via AskUserQuestion, order is unit test -> bug hunt -> UAT. Unit test and UAT require test plan approval. Bug hunt runs autonomously. Judge's DEFERRED rulings require human input
- **Bug hunt iteration depth:** Fixed limit of 3 bugfix cycles (hunt -> fix -> re-hunt -> fix -> re-hunt -> fix). After 3 cycles, remaining bugs presented with per-bug options. Hunter scope: changed files + dependencies. Re-hunts narrow to only files bugfix modified
- **UAT human interaction:** Steps classified as automated or human, user approves classification. Browser automation tool is project/global config. Human-tagged steps pause for pass/fail via AskUserQuestion. Failed steps logged with evidence, continue running. UAT plans from JOB-PLAN.md acceptance criteria and WAVE-CONTEXT.md decisions

### Claude's Discretion
- Internal prompt design for all new agent roles (unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat)
- Lean wave-level review implementation details (auto-fix mechanics, fixable issue criteria)
- Review artifact format (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md naming)
- How logged issues are structured and persisted for --fix-issues
- Bug hunter risk/confidence scoring format
- UAT screenshot capture and presentation mechanism
- Execute --fix-issues implementation details

### Deferred Ideas (OUT OF SCOPE)
- `/rapid:config` command for project/global-level settings (browser automation tool choice, etc.) -- new capability, its own phase or quick task
- `/execute --fix-issues` batch-fix command -- implementation details deferred to planning, may need its own plan within this phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REVW-01 | /review orchestrates unit test > bug hunt > UAT pipeline (per-wave or per-set) | GSD review skill provides reference orchestration pattern; RAPID needs set/wave scoping via state-machine.cjs; two-tier architecture (lean wave + full set) |
| REVW-02 | Unit test agent generates test plan for user approval before writing tests | GSD unit-test skill shows plan-generation-then-approval pattern; RAPID adapts with AskUserQuestion and REVIEW-UNIT.md artifacts |
| REVW-03 | Unit test agent writes, runs, and reports with full observability (commands, stdout, pass/fail) | GSD unit-test skill shows implementation -> execution -> report flow; RAPID uses node:test framework detection |
| REVW-04 | Bug hunter agent performs broad static analysis with risk/confidence scoring | GSD hunter agent pattern; RAPID adapts with wave-scoped file discovery (changed files + dependents) |
| REVW-05 | Devils advocate agent attempts to disprove hunter findings with code evidence | GSD advocate agent pattern; read-only codebase access for verification |
| REVW-06 | Judge agent produces final ruling (ACCEPTED/DISMISSED/DEFERRED) with HITL for contested findings | GSD judge agent pattern adapted; DEFERRED replaces GSD's NEEDS HUMAN REVIEW with AskUserQuestion |
| REVW-07 | Bugfix subagent fixes accepted bugs, pipeline iterates until clean | GSD bugfix-agent pattern; RAPID limits to 3 cycles (not 5); scope narrows per cycle |
| REVW-08 | UAT agent generates multi-step test plan with automated/human step tagging | GSD uat-agent pattern; RAPID derives from JOB-PLAN.md acceptance criteria |
| REVW-09 | UAT agent executes automated steps via Playwright, prompts user for human steps | GSD Playwright CLI detection pattern; RAPID adds Chrome DevTools MCP as alternative (config-driven) |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `node:test` | Built-in | Test runner for review module tests | Already used across all 25 existing test files |
| Zod | 3.24.4 (locked) | Schema validation for review state, issue structures | Already used for STATE.json validation; CommonJS-compatible version |
| proper-lockfile | ^4.1.2 | Lock-protected atomic state writes | Already used by lock.cjs for all state mutations |
| Ajv | ^8.17.1 | Contract meta-schema validation for lean review | Already used by contract.cjs for contract compliance checks |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright (MCP) | External | Browser automation for UAT | When user configures Playwright as automation tool |
| Chrome DevTools (MCP) | External | Browser automation for UAT | When user configures Chrome DevTools as automation tool (default) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:test | jest/vitest | node:test is zero-dependency, already used everywhere; no new dependency needed |
| Manual issue tracking | Issue tracker integration | Deferred to v2.1 (PLSH-03); use structured markdown files for now |

**Installation:**
```bash
# No new dependencies needed -- all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure

```
skills/
  review/
    SKILL.md              # /rapid:review skill (orchestrator)

src/
  modules/
    roles/
      role-unit-tester.md     # Unit test agent role
      role-bug-hunter.md      # Bug hunter agent role
      role-devils-advocate.md # Devils advocate agent role
      role-judge.md           # Judge agent role
      role-bugfix.md          # Bugfix agent role
      role-uat.md             # UAT agent role
  lib/
    review.cjs              # Review library (pipeline orchestration, scoping, issue logging)
    review.test.cjs         # Review library tests
  bin/
    rapid-tools.cjs         # Extended with review subcommands
```

### Review Artifact Storage Pattern

```
.planning/waves/{setId}/
  REVIEW-SUMMARY.md                  # Consolidated set-level review summary
  {waveId}/
    REVIEW-UNIT.md                   # Unit test results for this wave
    REVIEW-BUGS.md                   # Bug hunt results (judge rulings) for this wave
    REVIEW-UAT.md                    # UAT results for this wave
    REVIEW-ISSUES.json               # Structured issues for --fix-issues (logged, not yet fixed)
```

### Pattern 1: Two-Tier Review Architecture

**What:** Lean wave-level review runs automatically during/after reconciliation; full set-level review is manual via `/rapid:review`.

**When to use:** Lean review on every wave completion. Full review when developer is ready to verify a set before merge.

**Lean Wave Review Flow:**
```
reconcileWaveJobs() completes
  -> leanReview(cwd, setId, waveId)
    -> verifyArtifacts(planned files)
    -> quickStaticAnalysis(changed files) -- hunter-only, no adversarial
    -> checkContractCompliance(contracts)
    -> attemptAutoFix(issues)
      -> if auto-fix succeeds: log fix, continue silently
      -> if auto-fix fails: AskUserQuestion with "Log issue and continue" recommended
    -> writeIssues(REVIEW-ISSUES.json)
```

**Full Set Review Flow:**
```
/rapid:review <set> [wave]
  -> transitionSet(executing -> reviewing)
  -> AskUserQuestion: choose stages (unit test / bug hunt / UAT)
  -> for each selected stage, for each wave:
    -> run stage pipeline
    -> write per-wave REVIEW-{TYPE}.md
  -> consolidate REVIEW-SUMMARY.md at set level
```

### Pattern 2: Agent Role Registration

**What:** Register 6 new agent roles in assembler.cjs following the existing pattern.

**Example:**
```javascript
// In assembler.cjs ROLE_TOOLS
const ROLE_TOOLS = {
  // ... existing roles ...
  'unit-tester': 'Read, Write, Bash, Grep, Glob',
  'bug-hunter': 'Read, Grep, Glob, Bash',
  'devils-advocate': 'Read, Grep, Glob',
  'judge': 'Read, Write, Grep, Glob',
  'bugfix': 'Read, Write, Edit, Bash, Grep, Glob',
  'uat': 'Read, Write, Bash, Grep, Glob, WebFetch',
};

const ROLE_DESCRIPTIONS = {
  // ... existing roles ...
  'unit-tester': 'RAPID unit test agent -- generates test plans and writes/runs tests',
  'bug-hunter': 'RAPID bug hunter agent -- performs static analysis and identifies bugs',
  'devils-advocate': 'RAPID devils advocate agent -- challenges bug hunter findings with evidence',
  'judge': 'RAPID judge agent -- rules on contested findings with ACCEPTED/DISMISSED/DEFERRED',
  'bugfix': 'RAPID bugfix agent -- fixes accepted bugs with atomic commits',
  'uat': 'RAPID UAT agent -- generates and executes acceptance test plans',
};
```

### Pattern 3: Review Scoping (Adapted from GSD)

**What:** Compute the set of files relevant to a wave/set for review, including changed files and their one-hop dependents.

**Adaptation from GSD:** GSD uses git diff against main branch. RAPID already has `getChangedFiles()` in execute.cjs which diffs worktree branch against base. Review scoping builds on this -- for a wave, scope is the union of all job-changed files plus files that import those changed files.

```javascript
// In review.cjs
function scopeWaveForReview(cwd, setId, waveId, worktreePath, baseBranch) {
  const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);
  const dependentFiles = findDependents(cwd, changedFiles); // one-hop import search
  return {
    changedFiles,
    dependentFiles,
    totalFiles: changedFiles.length + dependentFiles.length,
  };
}
```

### Pattern 4: Bugfix Iteration with Narrowing Scope

**What:** 3-cycle limit: hunt -> fix -> re-hunt(narrowed) -> fix -> re-hunt(narrowed) -> fix. Each re-hunt narrows scope to only files modified by the previous bugfix cycle.

```javascript
// Pseudocode for bugfix iteration in review SKILL.md
for (let cycle = 1; cycle <= 3; cycle++) {
  const scope = cycle === 1
    ? fullScope                          // All changed files + dependents
    : narrowScope(previousFixedFiles);    // Only files bugfix agent modified

  const hunterFindings = await runHunter(scope);
  const advocateReport = await runAdvocate(hunterFindings);
  const judgeRulings = await runJudge(hunterFindings, advocateReport);

  const acceptedBugs = judgeRulings.filter(r => r.ruling === 'ACCEPTED');
  if (acceptedBugs.length === 0) break; // Clean -- stop iterating

  const fixResults = await runBugfixer(acceptedBugs);
  previousFixedFiles = fixResults.modifiedFiles;

  if (cycle === 3 && fixResults.remainingBugs.length > 0) {
    // Present remaining bugs with per-bug options
    await presentRemainingBugs(fixResults.remainingBugs);
  }
}
```

### Pattern 5: Issue Logging for --fix-issues

**What:** Structured JSON issues persisted at `.planning/waves/{setId}/{waveId}/REVIEW-ISSUES.json` that survive context resets.

```javascript
// REVIEW-ISSUES.json schema
const ReviewIssue = z.object({
  id: z.string(),              // e.g., "ISSUE-001"
  type: z.enum(['artifact', 'static', 'contract', 'test', 'bug', 'uat']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string(),
  line: z.number().optional(),
  description: z.string(),
  autoFixAttempted: z.boolean(),
  autoFixSucceeded: z.boolean(),
  source: z.enum(['lean-review', 'unit-test', 'bug-hunt', 'uat']),
  status: z.enum(['open', 'fixed', 'deferred', 'dismissed']),
  createdAt: z.string(),
  fixedAt: z.string().optional(),
});

const ReviewIssues = z.object({
  waveId: z.string(),
  setId: z.string(),
  issues: z.array(ReviewIssue),
  lastUpdatedAt: z.string(),
});
```

### Pattern 6: State Transitions for Review

**What:** Set transitions from `executing` to `reviewing` when `/rapid:review` is invoked. Wave state machine is unchanged.

```javascript
// Already defined in state-transitions.cjs:
// SET_TRANSITIONS.executing = ['reviewing']
// SET_TRANSITIONS.reviewing = ['merging']

// In review SKILL.md Step 0:
// node "${RAPID_TOOLS}" state transition set <milestoneId> <setId> reviewing
```

### Anti-Patterns to Avoid

- **Porting GSD code directly:** GSD uses `.planning/STATE.md` and `.review/{timestamp}/` paths. RAPID uses `STATE.json` and `.planning/waves/{setId}/{waveId}/`. Adapt patterns, not paths.
- **Scoping too broadly:** Including all files in a set for review wastes tokens. Scope to wave-level changed files + one-hop dependents.
- **Making lean review blocking by default:** Lean review should auto-fix silently when possible and recommend "Log issue and continue" when it cannot. Only truly critical issues (contract violations) should block.
- **Running the full adversarial pipeline in lean review:** Lean review is hunter-only (quick static analysis). The 3-agent adversarial pipeline (hunter/advocate/judge) is reserved for full set-level review.
- **Spawning sub-sub-agents:** Review subagents are leaf agents. The review SKILL.md orchestrator spawns them; they cannot spawn their own subagents.
- **Modifying wave state for reviews:** Wave state machine stays unchanged (reconciling -> complete). Review state is tracked at the set level only plus per-wave artifact files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State transitions | Custom set status tracker | `transitionSet()` from state-machine.cjs | Already validates executing->reviewing->merging transitions |
| Agent prompt assembly | Inline prompt strings | `assembleAgent()` from assembler.cjs | Consistent frontmatter, tool permissions, size warnings |
| Lock-protected writes | Manual file locking | `acquireLock()` from lock.cjs | Handles stale lock detection, timeout, cleanup |
| Return parsing | Regex for agent output | `parseReturn()` / `validateHandoff()` from returns.cjs | Handles JSON extraction, Zod schema validation |
| Changed file detection | Custom git diff | `getChangedFiles()` from execute.cjs | Already handles worktree paths and branch comparison |
| Contract validation | Custom schema checks | `CONTRACT_META_SCHEMA` from contract.cjs | Already validates CONTRACT.json structure |
| Wave resolution | Custom state lookup | `resolveWave` CLI command | Already handles ambiguous matches with array returns |
| Schema validation | Manual field checks | Zod schemas in state-schemas.cjs | Type-safe, composable, already the standard pattern |

**Key insight:** RAPID already has robust infrastructure for agent orchestration, state management, and structured returns. The review module's complexity is in the pipeline logic and agent prompts, not in infrastructure. Lean heavily on existing modules.

## Common Pitfalls

### Pitfall 1: Token Budget Explosion in Adversarial Pipeline
**What goes wrong:** Running hunter -> advocate -> judge on a large set with many files can consume enormous token budgets (estimated $15-45 per cycle from STATE.md blockers section).
**Why it happens:** Each agent reads all scoped files, and the advocate must re-read everything to verify claims.
**How to avoid:** Wave-scoped review (not set-scoped). Each wave reviews only its changed files + one-hop dependents. Soft cap at ~50 files per review scope.
**Warning signs:** Review taking >10 minutes or >$20 per wave.

### Pitfall 2: Race Conditions in State Transitions
**What goes wrong:** If lean review auto-fix modifies STATE.json at the same time as manual operations.
**Why it happens:** Lean review runs during reconciliation flow; user might invoke commands simultaneously.
**How to avoid:** All state writes go through `acquireLock()`. Lean review reads state once, performs all checks, then writes once.
**Warning signs:** "Lock already held" errors during review.

### Pitfall 3: Lean Review Auto-Fix Masking Real Issues
**What goes wrong:** Auto-fix silently repairs symptoms while leaving root causes, giving false confidence.
**Why it happens:** Auto-fix targets easy-to-detect patterns (missing semicolons, import order) but can't reason about correctness.
**How to avoid:** Auto-fix limited to verifiable transformations: file existence checks, contract export verification, lint auto-fix. Logic bugs never auto-fixed. Log all auto-fix actions to REVIEW-ISSUES.json for audit trail.
**Warning signs:** Repeated auto-fixes on the same files across waves.

### Pitfall 4: Judge DEFERRED Rulings Accumulating
**What goes wrong:** Users defer too many findings, creating a growing backlog that never gets resolved.
**Why it happens:** "Defer" is easier than deciding, and nothing forces resolution.
**How to avoid:** DEFERRED rulings are persisted in REVIEW-ISSUES.json with status='open'. The `--fix-issues` command surfaces deferred items. REVIEW-SUMMARY.md shows deferred count prominently. Consider a warning when deferred count exceeds threshold.
**Warning signs:** REVIEW-SUMMARY.md showing >5 deferred items across waves.

### Pitfall 5: UAT Browser Automation Fragility
**What goes wrong:** Playwright/Chrome DevTools automation fails on dynamic content, timing issues, or environment differences.
**Why it happens:** Web applications have loading states, animations, and server-dependent content that automated tools struggle with.
**How to avoid:** UAT steps tagged as `[human]` for subjective visual verification. Automated steps focus on navigable, deterministic interactions. Screenshot evidence on failure. Retry-once pattern from GSD. Dev server readiness check before execution.
**Warning signs:** Consistent UAT step failures on the same interaction.

### Pitfall 6: Scope Creep in Bug Hunter
**What goes wrong:** Bug hunter reports issues in files outside the wave's changed-file scope, wasting tokens on irrelevant findings.
**Why it happens:** Hunter agent reads broadly and finds pre-existing issues unrelated to the current wave's work.
**How to avoid:** Explicit scope constraint in hunter prompt: "Only report bugs in these files: [scoped file list]." Pre-existing issues outside scope are not the wave's responsibility.
**Warning signs:** Hunter report includes files not modified in the current wave.

## Code Examples

### review.cjs Core Functions

```javascript
// Source: Derived from execute.cjs patterns and GSD review scoping

'use strict';

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const execute = require('./execute.cjs');
const stateMachine = require('./state-machine.cjs');

// Issue schema for REVIEW-ISSUES.json
const ReviewIssue = z.object({
  id: z.string(),
  type: z.enum(['artifact', 'static', 'contract', 'test', 'bug', 'uat']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string(),
  line: z.number().optional(),
  description: z.string(),
  autoFixAttempted: z.boolean().default(false),
  autoFixSucceeded: z.boolean().default(false),
  source: z.enum(['lean-review', 'unit-test', 'bug-hunt', 'uat']),
  status: z.enum(['open', 'fixed', 'deferred', 'dismissed']).default('open'),
  createdAt: z.string(),
  fixedAt: z.string().optional(),
});

/**
 * Compute review scope for a wave: changed files + one-hop dependents.
 */
function scopeWaveForReview(cwd, worktreePath, baseBranch) {
  const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);
  const dependentFiles = findDependents(cwd, changedFiles);
  return { changedFiles, dependentFiles, totalFiles: changedFiles.length + dependentFiles.length };
}

/**
 * Find files that import/require any of the given files.
 */
function findDependents(cwd, changedFiles) {
  // Search for import/require references to changed files
  // Returns unique list of dependent files not already in changedFiles
}

/**
 * Log a review issue to REVIEW-ISSUES.json for a wave.
 */
function logIssue(cwd, setId, waveId, issue) {
  const issuesPath = path.join(cwd, '.planning', 'waves', setId, waveId, 'REVIEW-ISSUES.json');
  let existing = { waveId, setId, issues: [], lastUpdatedAt: '' };
  if (fs.existsSync(issuesPath)) {
    existing = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
  }
  existing.issues.push(ReviewIssue.parse(issue));
  existing.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(issuesPath, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * Load all issues across waves for a set (for --fix-issues and REVIEW-SUMMARY.md).
 */
function loadSetIssues(cwd, setId) {
  const wavesDir = path.join(cwd, '.planning', 'waves', setId);
  const issues = [];
  if (!fs.existsSync(wavesDir)) return issues;
  for (const waveDir of fs.readdirSync(wavesDir)) {
    const issuesPath = path.join(wavesDir, waveDir, 'REVIEW-ISSUES.json');
    if (fs.existsSync(issuesPath)) {
      const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
      issues.push(...data.issues.map(i => ({ ...i, waveId: waveDir })));
    }
  }
  return issues;
}
```

### CLI Subcommands (rapid-tools.cjs additions)

```javascript
// Source: Derived from existing execute/wave-plan subcommand patterns

// New subcommands for review management:
// review scope <set-id> <wave-id>     Compute review scope for a wave
// review log-issue <set-id> <wave-id>  Log a review issue (reads JSON from stdin)
// review list-issues <set-id>          List all issues for a set
// review update-issue <set-id> <wave-id> <issue-id> <status>  Update issue status
// review summary <set-id>              Generate REVIEW-SUMMARY.md content
```

### SKILL.md Stage Selection Pattern

```markdown
## Step N: Stage Selection

Use AskUserQuestion:
- **question:** "Which review stages to run?"
- **options:**
  - "All" -- description: "Run unit test, bug hunt, and UAT in order"
  - "Unit test only" -- description: "Generate test plan, write tests, run and report"
  - "Bug hunt only" -- description: "Static analysis with adversarial verification"
  - "UAT only" -- description: "Acceptance testing with browser automation"
  - "Unit test + Bug hunt" -- description: "Testing and bug hunting, skip UAT"
  - "Bug hunt + UAT" -- description: "Bug hunting and acceptance testing, skip unit tests"
```

### Lean Review Integration Point

```javascript
// In execute SKILL.md Step 3g, AFTER reconcileWaveJobs:

// Lean review runs automatically after successful reconciliation
// node "${RAPID_TOOLS}" review lean <set-id> <wave-id>
// Parse JSON output for { issues, autoFixed, needsAttention }
// If needsAttention.length > 0:
//   AskUserQuestion with recommended "Log issue and continue"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.0 single reviewer role | Multi-agent adversarial review pipeline | v2.0 Phase 22 | Deeper code analysis through challenge-response |
| v1.0 manual code review only | Automated unit test + UAT + bug hunt | v2.0 Phase 22 | Automated quality gates reduce human review burden |
| v1.0 set-level review only | Two-tier: lean wave + full set review | v2.0 Phase 22 | Earlier issue detection, less review-time surprise |
| GSD's `.review/{timestamp}/` artifacts | RAPID's `.planning/waves/{setId}/{waveId}/REVIEW-*.md` | Phase 22 adaptation | Artifacts co-located with wave planning data |
| GSD's 5-iteration max | RAPID's 3-iteration max | User decision | Reduces token cost while still catching regressions |

**Deprecated/outdated:**
- `role-reviewer.md`: Remains for merge-time review (Phase 23). The review module's agents are complementary, not replacements.
- `role-verifier.md`: Remains for artifact verification. Lean review incorporates some verifier checks but does not replace it.

## Open Questions

1. **Browser automation tool configuration storage**
   - What we know: User decided it's a "project/global-level config setting." The `/rapid:config` command is deferred.
   - What's unclear: Where does this setting live before /rapid:config exists? config.json? .env? Hardcoded default?
   - Recommendation: Add `browserAutomation: 'chrome-devtools' | 'playwright'` to `.planning/config.json` with `chrome-devtools` as default. AskUserQuestion on first UAT run if not configured.

2. **Lean review auto-fix scope**
   - What we know: Auto-fix for artifact verification failures and simple issues. Contract violations are hard blocks.
   - What's unclear: What constitutes a "fixable" issue in static analysis? Just lint fixes, or also missing imports/exports?
   - Recommendation: Auto-fix limited to: (1) missing test files -> create stubs, (2) lint issues -> run linter auto-fix, (3) missing exports referenced in contracts -> flag but don't auto-fix (too risky). All other issues logged for manual resolution.

3. **`--fix-issues` command scope and flow**
   - What we know: Deferred to planning but may need its own plan within this phase.
   - What's unclear: Does it re-run the review pipeline on fixed files? Or just mark issues as resolved?
   - Recommendation: `--fix-issues` reads REVIEW-ISSUES.json, presents open issues, spawns bugfix agent per issue, marks fixed on success. Does NOT re-run full review -- user can invoke `/rapid:review` again for that.

4. **Review artifacts and git commits**
   - What we know: Existing pattern is STATE.json committed at wave boundaries. Review artifacts are markdown files.
   - What's unclear: Should review artifacts be committed to git? They contain analysis that may be useful for audit.
   - Recommendation: REVIEW-*.md files committed alongside STATE.json at review completion. REVIEW-ISSUES.json committed too (structured data for --fix-issues).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | None (uses default node:test behavior) |
| Quick run command | `node --test src/lib/review.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVW-01 | Pipeline orchestration (stage selection, ordering, per-wave/set scoping) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-02 | Unit test plan generation (test plan schema validation) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-03 | Unit test execution and reporting (report parsing, observability fields) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-04 | Bug hunter scoping and risk/confidence schema | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-05 | Devils advocate report parsing | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-06 | Judge ruling schema (ACCEPTED/DISMISSED/DEFERRED), HITL flow | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-07 | Bugfix iteration tracking (3-cycle limit, scope narrowing) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-08 | UAT plan schema (automated/human tagging, acceptance criteria derivation) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |
| REVW-09 | UAT execution tracking (Playwright detection, step results schema) | unit | `node --test src/lib/review.test.cjs -x` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test src/lib/review.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/review.test.cjs` -- covers REVW-01 through REVW-09 (scoping, issue schemas, iteration tracking, scope narrowing, pipeline ordering)
- [ ] Framework install: none needed -- node:test is built-in

## Sources

### Primary (HIGH confidence)
- **Existing codebase inspection** -- assembler.cjs, execute.cjs, state-machine.cjs, state-transitions.cjs, state-schemas.cjs, returns.cjs, contract.cjs
- **All 19 existing role modules** -- pattern reference for new role design
- **execute SKILL.md** -- orchestration pattern reference (Agent tool dispatch, RAPID:RETURN parsing, AskUserQuestion gates)
- **discuss/wave-plan SKILL.md files** -- environment setup, wave resolution, CLI integration patterns

### Secondary (MEDIUM confidence)
- **GSD gsd-review/1.0.1 plugin** -- Reference implementation for review, bug-hunt, unit-test, UAT, scoping skills. Structural patterns adapted for RAPID's architecture. Located at `~/.claude/plugins/cache/pragnition-plugins/gsd-review/1.0.1/`
- **CONTEXT.md decisions** -- User-locked architectural decisions for two-tier review, iteration limits, stage ordering

### Tertiary (LOW confidence)
- **Browser automation tool integration details** -- Playwright MCP vs Chrome DevTools MCP configuration and capability differences not fully verified. Recommend testing both during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already in use
- Architecture: HIGH -- follows established RAPID patterns with clear GSD reference
- Pitfalls: HIGH -- identified from GSD experience and codebase analysis
- Agent role design: MEDIUM -- prompts are Claude's discretion per CONTEXT.md, GSD provides reference but RAPID's context is different
- UAT browser automation: MEDIUM -- MCP tool availability depends on user environment

**Research date:** 2026-03-08
**Valid until:** 2026-04-07 (30 days -- stable architecture, no fast-moving dependencies)
