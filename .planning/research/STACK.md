# Stack Research

**Domain:** Claude Code plugin -- Mark II workflow overhaul (review module, state machine, adversarial agents, merger adaptation)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Current Stack Baseline

The existing RAPID codebase uses:
- **Language:** CommonJS (`.cjs` files), Node.js v25.8.0
- **Dependencies:** `ajv@^8.17.1` (schema validation), `ajv-formats@^3.0.1`, `proper-lockfile@^4.1.2` (file locking)
- **Test framework:** `node:test` (built-in) + `node:assert/strict`
- **State:** Markdown files in `.planning/` with lock-based concurrent writes via `state.cjs`
- **Shell tooling:** `src/bin/rapid-tools.cjs` CLI helper
- **Plugin architecture:** Commands, agents, skills, hooks as `.md` files with YAML frontmatter
- **Agent coordination:** EXPERIMENTAL_AGENT_TEAMS with subagent fallback

This is a deliberately minimal dependency footprint. The Mark II additions should preserve this philosophy -- add dependencies only when hand-rolling would be error-prone or wasteful.

## Recommended Stack for Mark II

### Core Technologies (NEW for Mark II)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `playwright` (library package) | ^1.52 | UAT browser automation in library mode | Already installed globally (v1.58.2) and configured at `.playwright/cli.config.json`. Use as a **library** for programmatic browser control in the UAT agent -- NOT as a test runner. The UAT agent needs to navigate, click, screenshot, and report pass/fail per step. Library mode (`require('playwright')`) gives direct `chromium.launch()`, `page.goto()`, `page.click()`, `page.screenshot()` without `@playwright/test` runner overhead. |
| `node:test` `run()` API (built-in) | N/A (Node.js v22+) | Programmatic unit test execution and structured result capture | Already the project standard. The `run()` function from `node:test` returns a `TestsStream` with events (`test:pass`, `test:fail`, `test:complete`) that the Unit Test agent can consume programmatically to build structured reports. The target project's test runner may differ -- the Unit Test agent should detect and use whatever the TARGET project uses, but RAPID's own test infrastructure stays on `node:test`. Zero new dependencies. |
| Hand-rolled state machine (no library) | N/A | State tracking for Sets/Waves/Jobs across context resets | XState v5 (v5.28.0, 16.7kB) is overkill. RAPID's state transitions are flat and linear per entity. The existing `state.cjs` pattern (Markdown fields + lock-file writes) already works. Extend it with JSON-based state objects and a transition validation table. See detailed rationale below. |
| Playwright MCP Server | Latest | Interactive UAT via Claude Code MCP integration | Already configured. The UAT agent uses MCP for interactive browser sessions where the user observes. Falls back to `playwright` library for headless/automated runs. |

### Existing Technologies (RETAINED for Mark II)

| Technology | Version | Purpose | Mark II Extension |
|------------|---------|---------|-------------------|
| `ajv` | ^8.17.1 | Schema validation | Extend with schemas for BugReport, Verdict, Ruling, UAT Plan, Wave/Job state objects |
| `ajv-formats` | ^3.0.1 | Format validation | Retained for date-time, URI formats in reports |
| `proper-lockfile` | ^4.1.2 | Concurrent file access | Critical for hunter/devils-advocate/judge pipeline where agents read/write shared report files |
| `node:test` + `node:assert/strict` | Built-in | RAPID's own unit tests | Continue using for all new `.test.cjs` files |
| `child_process.execSync` | Built-in | Git operations, shell commands | Merger adaptation uses this for git merge, diff, merge-base operations |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Playwright MCP Server | UAT agent browser control via Claude Code MCP | Configured at `.playwright/cli.config.json`. Prefer MCP for interactive UAT; fall back to `playwright` library for headless. |
| `node --test src/lib/*.test.cjs` | Run RAPID's own tests | Existing pattern. Unit Test agent wraps this with `run()` for programmatic access to results. |

## Installation

```bash
# Only NEW dependency -- Playwright as a project-level dependency
npm install playwright

# No new dev dependencies needed
# node:test is built-in, ajv and proper-lockfile already installed
```

**Total new runtime dependencies: 1** (`playwright`)

Note: Playwright browsers may need installation via `npx playwright install chromium` if not already available system-wide. The UAT agent should detect and handle this.

## Key Architecture Decisions

### 1. Playwright: Library Mode, Not Test Runner

**Use `playwright` (library), NOT `@playwright/test` (test runner).**

The UAT agent is not running Playwright test suites with `expect()` assertions. It is:
- Launching a browser (headed so the user sees it)
- Navigating to the target application
- Performing user flows (click, type, navigate)
- Taking screenshots for evidence
- Reporting pass/fail per UAT step
- Asking the user for verification on "human" steps via AskUserQuestion

This is browser automation, not test execution.

```javascript
// UAT agent pattern -- library mode
const { chromium } = require('playwright');

async function runUATStep(step) {
  const browser = await chromium.launch({ headless: false }); // User SEES the browser
  const page = await browser.newPage();
  await page.goto(step.url);

  for (const action of step.actions) {
    await page[action.type](action.selector, action.value);
  }

  const screenshot = await page.screenshot({ path: step.screenshotPath });
  await browser.close();
  return { passed: true, screenshot: step.screenshotPath };
}
```

**Fallback strategy:**
1. Playwright MCP available -> use MCP for interactive UAT (user observes browser)
2. MCP unavailable -> use `playwright` library for headless automation
3. No browser environment -> degrade to AskUserQuestion-based manual UAT

### 2. Unit Test Execution: Programmatic `node:test` via `run()`

Use `run()` from `node:test` to execute test files and capture structured results for report generation:

```javascript
const { run } = require('node:test');
const path = require('path');

function executeTests(testFiles) {
  return new Promise((resolve) => {
    const results = { passed: [], failed: [], skipped: [] };

    run({ files: testFiles.map(f => path.resolve(f)) })
      .on('test:pass', (event) => results.passed.push(event.data))
      .on('test:fail', (event) => results.failed.push(event.data))
      .on('test:skip', (event) => results.skipped.push(event.data))
      .on('end', () => resolve(results));
  });
}
```

**For target projects using different test runners:** The Unit Test agent should detect the project's test runner (Jest, Vitest, Mocha, etc.) from `package.json` scripts or config files and shell out to it. The structured result parsing happens on the agent side, not via a library.

### 3. State Machine: Extend Existing `state.cjs`, No Library

**Do NOT add XState, Robot, or any FSM library.**

RAPID's state transitions are:
- **Linear per entity** (job: `pending -> planning -> executing -> reviewing -> complete`)
- **Persisted to disk** (must survive Claude Code context resets)
- **Read/written by different agents** across different sessions
- **Simple enough to validate with a transition table**

XState (16.7kB, complex TypeScript types, actor model, hierarchical/parallel states) solves problems RAPID does not have. Even David Khourshid (XState's creator) has written that hand-rolled FSMs are appropriate for simple cases.

**Recommended pattern -- new `state-machine.cjs` module:**

```javascript
'use strict';
const fs = require('fs');
const path = require('path');
const { acquireLock } = require('./lock.cjs');

const TRANSITIONS = {
  job: {
    pending:    ['planning'],
    planning:   ['executing', 'blocked'],
    executing:  ['reviewing', 'blocked'],
    reviewing:  ['complete', 'executing'],  // Loop back for fixes
    blocked:    ['planning', 'executing'],
    complete:   []
  },
  wave: {
    pending:    ['planning'],
    planning:   ['executing'],
    executing:  ['reviewing'],
    reviewing:  ['complete', 'executing'],
    complete:   []
  },
  set: {
    pending:    ['active'],
    active:     ['merging', 'blocked'],
    merging:    ['complete', 'active'],
    blocked:    ['active'],
    complete:   []
  }
};

function canTransition(entityType, currentState, targetState) {
  const valid = TRANSITIONS[entityType]?.[currentState];
  if (!valid) return { allowed: false, reason: `Unknown state: ${currentState}` };
  if (!valid.includes(targetState)) {
    return {
      allowed: false,
      reason: `Cannot transition ${entityType} from "${currentState}" to "${targetState}". Valid targets: ${valid.join(', ')}`
    };
  }
  return { allowed: true };
}

async function transition(cwd, entityType, entityId, targetState) {
  const release = await acquireLock(cwd, `state-${entityType}-${entityId}`);
  try {
    const statePath = path.join(cwd, '.planning', 'state', `${entityType}s`, `${entityId}.json`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const check = canTransition(entityType, state.status, targetState);
    if (!check.allowed) return { transitioned: false, reason: check.reason };

    state.previousStatus = state.status;
    state.status = targetState;
    state.lastTransition = new Date().toISOString();
    state.history.push({ from: state.previousStatus, to: targetState, at: state.lastTransition });

    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return { transitioned: true, from: state.previousStatus, to: targetState };
  } finally {
    await release();
  }
}

module.exports = { TRANSITIONS, canTransition, transition };
```

State persisted as JSON alongside Markdown:
- `.planning/state/jobs/{job-id}.json` -- machine-readable state with transition history
- `.planning/state/waves/{wave-id}.json` -- wave state
- `.planning/state/sets/{set-id}.json` -- set state
- `.planning/STATE.md` -- human-readable summary (existing pattern, auto-generated from JSON)
- Lock files protect concurrent writes (existing `proper-lockfile` pattern)

### 4. Adversarial Multi-Agent Pipeline: Pure Prompt Engineering + File I/O

The hunter/devils-advocate/judge pipeline requires **zero new dependencies**. These are prompt-driven agents orchestrated through file-based report handoff.

What is needed:
- **Structured report schemas** (extend existing `ajv` validation for BugReport, Verdict, Ruling)
- **Sequential agent orchestration** (hunter -> devils-advocate -> judge, supported by existing subagent/teams framework)
- **Report persistence** (JSON/Markdown in `.planning/reviews/{wave-id}/`)
- **Scoring aggregation** (pure JavaScript)

```javascript
// review-pipeline.cjs -- orchestration pattern
async function runBugHuntPipeline(cwd, waveId, context) {
  const reviewDir = path.join(cwd, '.planning', 'reviews', waveId);

  // 1. Hunter agent produces findings (spawned as subagent)
  const hunterReport = await spawnReviewAgent('hunter', { context });
  writeReport(reviewDir, 'hunter-report.json', hunterReport);

  // 2. Devils advocate reviews findings (reads hunter output)
  const daReport = await spawnReviewAgent('devils-advocate', {
    context,
    hunterFindings: hunterReport
  });
  writeReport(reviewDir, 'devils-advocate-report.json', daReport);

  // 3. Judge makes final rulings (reads both)
  const judgeReport = await spawnReviewAgent('judge', {
    context,
    hunterFindings: hunterReport,
    daVerdicts: daReport
  });
  writeReport(reviewDir, 'judge-ruling.json', judgeReport);

  return judgeReport;
}
```

The agent prompts are already drafted in `mark2-plans/review-module/`. The infrastructure layer is just schema validation + file I/O + sequential subagent spawning.

### 5. Merger Adaptation: Extend Existing `merge.cjs`

The gsd_merge_agent patterns (5-level conflict detection, tiered resolution) port directly to RAPID using the existing stack:
- `child_process.execSync` for git commands (`git merge`, `git diff`, `git merge-base`)
- `fs` for file operations
- `ajv` for merge plan schema validation
- `proper-lockfile` for concurrent access during multi-set merges
- `contract.cjs` and `dag.cjs` already exist for contract validation and dependency ordering

No new dependencies needed.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `playwright` (library) | `@playwright/test` | Only if RAPID needs persistent Playwright test suites run via `npx playwright test`. It does not -- UAT is agent-driven, not suite-driven. |
| `playwright` (library) | Puppeteer | Never. Playwright supersedes Puppeteer with better cross-browser support, auto-waiting, and the same team. |
| `node:test` run() API | Vitest / Jest | Only for the TARGET project's tests. The Unit Test agent should detect and use whatever runner the target project uses. RAPID's own tests stay on `node:test`. |
| Hand-rolled FSM in `state-machine.cjs` | XState v5 (5.28.0) | Only if state requirements grow to include: parallel states, delayed transitions, state visualization, or actor hierarchies. Current requirements are flat linear progressions. |
| Hand-rolled FSM | Robot (1.2kB FSM lib) | Tempting due to size, but unnecessary. A ~50-line transition table in plain JS is simpler, has zero learning curve, and is trivially testable with `node:test`. |
| `ajv` (existing) for schemas | Zod | Only if migrating to TypeScript/ESM. Zod's TypeScript-first inference is wasted in a CommonJS codebase. `ajv` is already proven. |
| Sequential subagent spawning | LangChain/LangGraph | Never. RAPID agents are Claude Code subagents (prompt-driven via `.md` files), not LLM-chain agents. LangChain would be a massive, irrelevant dependency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@playwright/test` | Test runner overhead -- UAT agent drives browser directly, not via test suites with fixtures/assertions | `playwright` library package |
| XState / Robot / any FSM lib | RAPID's state transitions are flat and linear. A library adds bundle size, API surface, and learning curve for a 50-line problem | Hand-rolled transition table with `ajv` schema validation |
| Jest / Vitest for RAPID's own tests | Adds dev dependency for something `node:test` already does. Breaks consistency with 16 existing `.test.cjs` files | `node:test` (built-in) |
| Puppeteer | Superseded by Playwright by the same team. Chromium-only | `playwright` |
| LangChain / LangGraph | RAPID agents are Claude Code subagents, not LLM-chain agents. Massive irrelevant dependency | Existing subagent/teams framework |
| Socket.io / WebSocket | Agents communicate via files on disk. Git-native constraint | JSON files in `.planning/` with `proper-lockfile` |
| Any database (SQLite, etc.) | Violates git-native constraint. State must be git-trackable | JSON + Markdown files |
| Complex state machine visualizers | Nice-to-have but not needed. State is inspectable via JSON files and STATE.md | `cat .planning/state/jobs/job-01.json` |

## Stack Patterns by Context

**If the target project has a web frontend (UAT applicable):**
- Use Playwright MCP first (interactive, user sees browser)
- Fall back to `playwright` library for headless automated runs
- Generate UAT plans with automated/human step tagging per review module spec

**If the target project is backend-only (no UAT):**
- Skip Playwright entirely for that project
- Focus on unit test agent and bug hunt pipeline
- UAT degrades to manual verification with AskUserQuestion prompts

**If EXPERIMENTAL_AGENT_TEAMS is available:**
- Hunter, Devils Advocate, and Judge can run as team agents with shared context
- Pipeline orchestration is simpler (team manages lifecycle)
- State transitions can be observed by team lead

**If EXPERIMENTAL_AGENT_TEAMS is NOT available:**
- Fall back to sequential subagent spawning
- Pipeline orchestrator manages report handoff between stages via file I/O
- Each agent reads previous agent's output from `.planning/reviews/`

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `playwright@^1.52` | Node.js v18+ | RAPID runs on v25.8.0, well within range. v1.52+ required for latest Chromium protocol. System already has v1.58.2 globally. |
| `node:test` `run()` API | Node.js v22+ | `run()` and `TestsStream` events stable in v22+. v25.8.0 fully supported. |
| `ajv@^8.17.1` | Node.js v14+ | No compatibility concerns. |
| `proper-lockfile@^4.1.2` | Node.js v12+ | No compatibility concerns. |
| Playwright MCP | Claude Code v2.1+ | Standard MCP integration. Configured via `.playwright/cli.config.json`. |

## Integration Points with Existing Codebase

| New Feature | Integrates With | How |
|-------------|-----------------|-----|
| UAT agent | `teams.cjs` (subagent spawning) | Spawned as subagent, receives project context, uses Playwright MCP or library, returns structured UAT report |
| Unit Test agent | `state.cjs`, `execute.cjs` | Reads current wave/job state to know what to test. Uses `node:test` `run()` API. Writes test reports to `.planning/reviews/` |
| Bug hunt pipeline | `teams.cjs`, `returns.cjs` | Three sequential subagents (hunter -> DA -> judge), each reading previous agent's output from `.planning/reviews/` |
| State machine | `state.cjs` (extend), `lock.cjs` | New `state-machine.cjs` module wrapping existing state primitives with transition validation and history tracking |
| Merger adaptation | `merge.cjs`, `contract.cjs`, `dag.cjs` | Extend existing merge module with 5-level conflict detection from gsd_merge_agent patterns. Uses existing git helpers and contract validation |
| Review schemas | `ajv` (existing) | New JSON schemas for BugReport, Verdict, Ruling, UATStep, TestReport validated with existing `ajv` setup |

## Sources

- [Node.js v25.8.0 `node:test` documentation](https://nodejs.org/api/test.html) -- verified `run()` API, `TestsStream` events, programmatic test execution (HIGH confidence)
- [Playwright Library documentation](https://playwright.dev/docs/library) -- verified library mode vs test runner distinction, API surface (HIGH confidence)
- [Playwright CLI documentation](https://playwright.dev/docs/test-cli) -- verified CLI capabilities (HIGH confidence)
- [XState npm page](https://www.npmjs.com/package/xstate) -- current version 5.28.0 confirmed, assessed and rejected (HIGH confidence)
- [Simon Willison: Playwright MCP with Claude Code](https://til.simonwillison.net/claude-code/playwright-mcp-claude-code) -- MCP integration approach (MEDIUM confidence)
- [Dev.to: You don't need a library for state machines](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) -- XState creator argues hand-rolled FSMs are fine for simple cases (HIGH confidence)
- Existing codebase analysis: `state.cjs`, `lock.cjs`, `teams.cjs`, `merge.cjs`, `core.cjs`, `package.json`, all 16 `.test.cjs` files (HIGH confidence)
- Review module specs: `mark2-plans/review-module/*.md` -- first-party design docs for hunter/DA/judge/unit-test agents (HIGH confidence)
- gsd_merge_agent plans: `mark2-plans/gsd_merge_agent/` -- first-party merge pipeline reference (HIGH confidence)

---
*Stack research for: RAPID Mark II -- review module, state machine, adversarial agents, merger adaptation*
*Researched: 2026-03-06*
