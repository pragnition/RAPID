# Domain/UX Research: Developer-Facing CLI Agent Framework

**Domain:** AI-powered developer tool (Claude Code plugin for parallel development)
**Researched:** 2026-03-12
**Overall confidence:** HIGH (patterns well-established across Cursor, Copilot Workspace, Devin, Claude Code ecosystem)

---

## Table Stakes

Features/patterns developers expect from agentic developer tools. Missing = tool feels broken or amateur.

| Pattern | Why Expected | Complexity | RAPID v2 Status | v3 Implication |
|---------|--------------|------------|-----------------|----------------|
| Self-contained commands (work after /clear) | Claude Code's context resets between sessions; devs run /clear constantly to manage 200K window | Med | BROKEN -- many commands assume prior context | **Critical fix** -- each command must bootstrap from filesystem state |
| Single suggested next action | Decision fatigue kills velocity; devs want "do X next" not "pick from 5 options" | Low | Partial -- /status suggests actions but inconsistently | Standardize: every command ends with exactly ONE recommended next step |
| Plan-before-execute with approval gate | Universal pattern (Cursor, Copilot Workspace, Devin) -- show what will happen, let dev edit/approve | Low | Present in /wave-plan but spread across multiple commands | Consolidate: /plan-set shows plan, dev approves, done |
| Progress visibility during long operations | Devs need to see agents working, not stare at a blank terminal for 5 min | Med | Present via markdown banners | Keep and refine -- banners work well in Claude Code |
| Idempotent/re-entrant commands | Devs re-run commands after failures, context clears, or interruptions | Med | Partial -- /execute has smart re-entry, others don't | Every command must detect "already done" state and skip/resume |
| Human-readable error messages with recovery paths | "Error: state invalid" is useless; "Set X is in 'executing' state. Run /review to proceed." is actionable | Low | Good in v2.1+ with structured error recovery | Maintain and extend |
| Transparent agent activity | Devs want to see what agents are doing, not trust a black box | Med | Banners show agent names and progress | Add: show agent count, current step name, elapsed time |

## Differentiators

Features that set RAPID apart from the competition. Not expected, but high-value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Vision-first discussion (capture what, not how) | Cursor/Copilot jump straight to code; RAPID captures developer intent first, reducing rework | Low | /discuss is RAPID's strongest UX differentiator -- keep it prominent |
| Parallel isolation with merge confidence | No other Claude Code plugin does multi-set parallel execution with conflict detection | High | Core value prop -- already working, don't regress |
| "Agents that know their tools" (embedded docs) | Eliminates guessing; agents call the right CLI commands because docs are in the prompt | Med | v3 target: embed rapid-tools.cjs docs per agent via YAML |
| Adversarial review pipeline | Hunter/advocate/judge is unique in the ecosystem; 3-cycle narrowing with scope reduction | High | Already proven -- keep as-is |
| Autonomy dial per decision type | Smashing Mag pattern: not binary trust, but a spectrum per task type | Med | /discuss already has "Let Claude decide" option; formalize this pattern across all gates |

## Anti-Features

Features to explicitly NOT build. These are traps that look attractive but hurt the experience.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Wizard-style multi-step interactive flows | /clear breaks mid-wizard; context loss = start over. Claude Code is NOT a GUI. Each command = one transaction. | Self-contained commands that read state from disk, do one thing, write state back |
| Too many slash commands (17+ in v2) | Cognitive load: devs can hold 4-7 chunks in working memory. 17 commands = "which one do I need?" paralysis | v3 target of 7 core + 4 auxiliary = right size. Resist adding more. |
| Implicit command ordering | "You need to run /context before /plan" is invisible dependency. Devs skip steps and hit cryptic errors | Each command validates its own preconditions and tells the user what's missing |
| "Choose from these options" at every gate | AskUserQuestion for every micro-decision creates decision fatigue. Devs delegate to tools to REDUCE decisions, not increase them | Strong defaults with opt-out. "I'll do X unless you say otherwise." Reserve AskUserQuestion for genuine ambiguity |
| Silent progress (no feedback during agent work) | Devs assume the tool is frozen, kill it, lose work | Periodic status updates even during subagent execution |
| Context-dependent help | /help that changes based on project state is confusing; devs can't build a mental model | Static reference card for /help. Dynamic suggestions go in /status |
| Catch-all default commands | "Running /rapid with no subcommand does X" leads to accidents and prevents future additions | Always require explicit subcommand: /rapid:init, /rapid:status, etc. |

## Competitive Analysis: How Similar Tools Handle Multi-Step Workflows

### Cursor 2.0

**Interaction model:** Agent-centric IDE with Mission Control sidebar.

Key patterns RAPID should learn from:
- **Agents as managed resources:** Named agents with visible status, not anonymous background processes. Cursor shows a grid of agent cards you can click into. RAPID equivalent: /status should show active agents per set with names and progress.
- **Shadow Virtual File System (SVFS):** Multiple agents write to isolated virtual trees, merged and presented for single-click approval. RAPID equivalent: git worktrees already provide this -- our architecture is sound.
- **4x generation speed focus:** Throughput matters for iterative turns. RAPID equivalent: minimize roundtrips. /plan-set should do the full pipeline (research + plan + jobs) in one command, not require 3 separate invocations.

**What Cursor gets wrong for RAPID's context:**
- Cursor is visual/GUI-first. RAPID is terminal/text-first. Don't cargo-cult visual patterns.
- Cursor agents share a codebase concurrently. RAPID isolates per-worktree. Different model.

### GitHub Copilot Workspace

**Interaction model:** Issue -> Specification -> Plan -> Implementation -> PR.

Key patterns RAPID should learn from:
- **Plan as editable artifact:** The plan is a document the developer can edit before execution. "Everything is fully editable." RAPID equivalent: ROADMAP.md and job plans should be editable artifacts, not opaque agent output. Present plan, let dev modify markdown, then execute.
- **Transparent tool calls:** Copilot shows what it's about to do and what it completed. Planning Mode writes execution notes in real-time. RAPID equivalent: log agent actions to a visible file, not just console banners.
- **Two steering moments:** Specification (what) and Plan (how). Developer controls both. RAPID equivalent: /discuss captures the "what" (specification), /plan-set captures the "how" (plan). Two commands, two control points. This is the right structure.

**What Copilot Workspace gets wrong for RAPID's context:**
- Copilot Workspace is single-developer, single-change. RAPID handles multi-set parallel changes.
- Copilot Workspace was sunset (May 2025). Patterns live on in VS Code Plan Mode.

### Devin 2.0

**Interaction model:** Chat interface with cloud VM isolation, parallel sessions.

Key patterns RAPID should learn from:
- **Interactive Planning:** Devin scans the codebase and suggests plans the dev refines, rather than requiring detailed specs upfront. RAPID equivalent: /init's discovery conversation is already close to this. /discuss should also proactively identify areas needing input rather than asking open-ended questions.
- **Parallel session management:** Multiple Devins, each in its own VM. Developer "steps in to steer when needed." RAPID equivalent: multiple sets in parallel worktrees. /status is the "stepping in" surface.
- **Cut losses early:** Devin's own docs say "if it's going in circles, stop and start fresh." RAPID equivalent: agent timeout + "BLOCKED" return status + clear escalation to dev. Don't let agents spin.

**What Devin gets wrong for RAPID's context:**
- Devin is cloud-hosted. RAPID is local-first (git-native, no servers).
- Devin manages its own IDE/browser/shell. RAPID delegates to Claude Code's existing tool surface.

### Claude Code Native (Tasks, Background Agents)

**Interaction model:** Terminal-first, slash commands, /tasks for background work.

Key patterns RAPID should learn from:
- **Tasks as durable state:** Tasks write to ~/.claude/tasks on disk, surviving crashes and /clear. RAPID equivalent: STATE.json is already this pattern. Keep it.
- **DAG-based task dependencies:** Tasks can block on other tasks. RAPID equivalent: wave dependencies and set dependency DAG already implement this.
- **Ctrl+B to background:** Developer can background a running agent and check later. RAPID equivalent: /execute should communicate "this will take a while" and suggest backgrounding for long runs.
- **Aggressive context management:** Best practice is writing state to disk, /clear-ing, then referencing the file. RAPID equivalent: every command should work this way by design. Read state from files, not from conversation history.

---

## UX Principles for v3.0

### Principle 1: Every Command is a Transaction

**Pattern:** Read state from disk -> Validate preconditions -> Do work -> Write state to disk -> Suggest next action.

**Why:** Claude Code's /clear wipes conversation. Subagents spawn fresh. Context compaction is unpredictable. The only reliable persistence is the filesystem.

**Implementation:** Each command:
1. Reads STATE.json + relevant artifacts (ROADMAP.md, DEFINITION.md, etc.)
2. Validates: "Am I in the right state to run?"
3. If not: prints what's wrong and what command to run first
4. Does its work (spawns agents, writes files, etc.)
5. Updates STATE.json atomically
6. Prints summary and exactly one suggested next action

### Principle 2: Progressive Disclosure via Command Set Size

**Pattern:** 7 core commands + 4 auxiliary = 11 total. Devs learn the 7-command workflow, discover auxiliaries as needed.

**Why:** Miller's Law: 7 +/- 2 items is the limit of working memory. 17 commands in v2 exceeded this. The v3 target of 7 core commands is exactly right.

**v3 command mapping:**

| Core Command | What It Does | v2 Equivalent |
|---|---|---|
| /init | Project setup, research, roadmap | /init + /context + /plan (consolidated) |
| /start-set | Create worktree, scoped context | /set-init |
| /discuss-set | Capture implementation vision | /discuss |
| /plan-set | Research + plan all waves/jobs | /wave-plan + /plan-set (consolidated) |
| /execute-set | Run all jobs across waves | /execute |
| /review | Quality pipeline | /review |
| /merge | Conflict detection + resolution | /merge |

| Auxiliary Command | What It Does | When Discovered |
|---|---|---|
| /new-version | Archive milestone, bump version | After first merge cycle |
| /add-set | Add a set to existing roadmap | When scope grows mid-milestone |
| /quick | One-off task outside set structure | When devs need a quick fix |
| /status | Dashboard with next-action suggestion | Anytime (most discoverable auxiliary) |
| /install | One-time setup | First use only |

### Principle 3: Strong Defaults, Rare Questions

**Pattern:** The "Autonomy Dial" from Smashing Magazine's agentic UX patterns. Not every decision needs developer input.

**Taxonomy of decisions:**

| Decision Type | Default Behavior | Ask Developer When |
|---|---|---|
| Agent model selection | Use configured default from config.json | Never (set during /init) |
| Wave ordering | Automatic dependency detection | Dependencies are ambiguous |
| Job plan granularity | Follow the plan from /plan-set | Never (edit the plan file if unhappy) |
| Bug severity classification | Judge agent decides | Confidence < 0.5 (DEFERRED) |
| Merge conflict resolution | Auto-resolve high-confidence (>0.8) | Confidence < 0.8 |
| Review stage selection | Run all stages | Never (add --skip-uat etc. as flags) |

**Anti-pattern to kill:** v2's habit of asking "What would you like to do?" with 3-5 options after every operation. Replace with: do the obvious thing, print what happened, suggest next step.

### Principle 4: Suggest, Don't Ask

**Pattern:** Every command ends with ONE clear next step, not a menu.

**Bad (v2 pattern):**
```
Set 'auth' initialized. What would you like to do?
1. Run /rapid:discuss for wave 1
2. Run /rapid:status to see all sets
3. Initialize another set
4. Review the set overview
```

**Good (v3 pattern):**
```
Set 'auth' initialized.
  Worktree: .rapid-worktrees/auth
  Branch: rapid/auth
  Waves: 3 (7 jobs total)

Next: /rapid:discuss-set auth
(Or /rapid:status to see all sets)
```

### Principle 5: Errors Are Navigation

**Pattern:** Every error message tells the developer exactly where they are and how to get where they want to be.

**Bad:**
```
Error: Cannot execute. Set is in 'pending' state.
```

**Good:**
```
Cannot execute set 'auth' -- it's in 'pending' state.

Current progress:
  [x] /init (complete)
  [x] /start-set auth (complete)
  [ ] /discuss-set auth (not started) <-- you are here
  [ ] /plan-set auth
  [ ] /execute-set auth

Next: /rapid:discuss-set auth
```

### Principle 6: Commands Explain Themselves

**Pattern:** "Agents that know their tools." Each agent prompt embeds exactly the CLI tool documentation it needs. No guessing, no hallucinating tool APIs.

**Why:** From Devin's Agents 101: "Specify the approach, not just the outcome." Agents with explicit tool docs in their prompt succeed at a dramatically higher rate than agents that must infer tool usage.

**Implementation:** Inline YAML per agent with relevant rapid-tools.cjs subcommands, their arguments, and expected outputs. Agents only see the tools they need, not the full 60+ command surface.

---

## Feature Dependencies

```
/install --> /init
               |
               v
         /start-set (per set, parallel across devs)
               |
               v
         /discuss-set (per set)
               |
               v
         /plan-set (per set)
               |
               v
         /execute-set (per set)
               |
               v
         /review (per set)
               |
               v
         /merge (all completed sets)
               |
               v
         /new-version (start next cycle)

Side-channels (no ordering):
  /status -- anytime
  /add-set -- after /init, before /merge
  /quick -- anytime (bypasses set structure)
```

## MVP UX Recommendation

### Must-Have for v3.0 Launch

1. **Self-contained commands** -- each reads state from disk, works after /clear (Table Stakes)
2. **7+4 command reduction** -- from 17 to 11 commands total (Progressive Disclosure)
3. **Single next-action suggestion** -- end of every command output (Suggest, Don't Ask)
4. **Embedded tool docs per agent** -- agents know their tools (Agents That Know Their Tools)
5. **Idempotent re-entry** -- every command handles "already partially done" gracefully (Table Stakes)
6. **Error-as-navigation** -- breadcrumb trail showing where you are in the workflow (Errors Are Navigation)

### Defer to v3.1

- **Autonomy dial configuration** (per-project tuning of when to ask vs auto-decide)
- **Agent activity logging to file** (beyond banners -- full timeline in .planning/logs/)
- **Interactive plan editing** (let devs edit ROADMAP.md and have changes reflected in STATE.json)

### Never Build

- Wizard-style multi-command flows that require continuous context
- More than ~12 total commands (if you need more, it's a workflow problem not a command problem)
- GUI/TUI dashboard (RAPID is terminal-text; devs use /status)

---

## Interaction Model Comparison Matrix

| Dimension | Cursor 2.0 | Copilot Workspace | Devin 2.0 | Claude Code Native | RAPID v3 Target |
|-----------|-----------|-------------------|-----------|-------------------|-----------------|
| **Interface** | GUI (VS Code) | Web | Web | Terminal | Terminal (slash commands) |
| **Isolation** | SVFS (virtual) | Branch per change | Cloud VM per session | Worktree per task | Git worktree per set |
| **Planning** | Agent plans inline | Spec -> Plan -> Edit | Interactive scan + suggest | User writes prompt | /discuss (what) -> /plan-set (how) |
| **Execution** | Parallel agents | Single execution | Cloud parallel sessions | Sequential or /tasks | Parallel jobs within waves |
| **Review** | Inline diff approval | PR-based review | Self-testing + PR | Manual or tool-based | Adversarial pipeline (hunter/advocate/judge) |
| **State** | In-memory + SVFS | GitHub (commits/PRs) | Cloud memory layer | ~/.claude/tasks on disk | STATE.json in git |
| **Parallel work** | Mission Control grid | One change at a time | Multiple sessions | Background tasks | Multiple sets across devs |
| **/clear resilience** | N/A (persistent IDE) | N/A (web app) | N/A (cloud state) | Fragile (context lost) | **Designed for it** -- filesystem-first |

---

## Key UX Anti-Patterns in v2 to Fix

### 1. The "Which Command?" Problem
**Symptom:** Developer reads DOCS.md, sees 17 commands, gets confused about /wave-plan vs /plan-set vs /plan.
**Root cause:** Overlapping command surface with unclear boundaries.
**Fix:** Collapse to 7 core commands. Each does exactly one thing. No overlaps.

### 2. The "Context Required" Problem
**Symptom:** Developer runs /execute after /clear and gets unexpected behavior because the orchestrator lost context from the prior /discuss session.
**Root cause:** Commands implicitly depend on conversation context, not just filesystem state.
**Fix:** Every command bootstraps exclusively from filesystem state (STATE.json + artifacts). Conversation context is a bonus, never a requirement.

### 3. The "Decision Menu" Problem
**Symptom:** After every command, developer gets 3-5 options via AskUserQuestion. Multiply by 10 commands in a workflow and that's 30-50 decisions per set.
**Root cause:** Over-application of "human-in-the-loop" principle.
**Fix:** Strong defaults. Print what happened. Suggest ONE next step. Developer only intervenes when something goes wrong.

### 4. The "Missing Prerequisite" Problem
**Symptom:** Developer runs /execute but hasn't run /discuss or /wave-plan. Gets a cryptic error.
**Root cause:** Commands don't explain what came before them.
**Fix:** Error messages show full progress breadcrumb: what's done, what's missing, what to run next.

### 5. The "Wave vs Set" Confusion
**Symptom:** Developer doesn't know if they should run /wave-plan per wave or /plan-set for the whole set.
**Root cause:** Two commands that do the same thing at different granularity levels.
**Fix:** One command: /plan-set. It handles all waves automatically. If a developer wants per-wave control, they edit the plan files directly.

---

## Sources

### Competitive Analysis
- [Cursor 2.0 and Composer: Multi-Agent Rethink](https://www.cometapi.com/cursor-2-0-what-changed-and-why-it-matters/)
- [Cursor AI Review 2026](https://prismic.io/blog/cursor-ai)
- [Cursor 2.0 Review: Multi-Agent Editor](https://aitoolsreview.co.uk/insights/cursor-2-0-review-2026)
- [Cursor's Third Era: Cloud Agents](https://www.latent.space/p/cursor-third-era)
- [GitHub Copilot Workspace](https://githubnext.com/projects/copilot-workspace)
- [Planning Mode in Visual Studio 2022](https://windowsforum.com/threads/planning-mode-in-visual-studio-2022-copilot-orchestrates-multi-step-plans-public-preview.386041/)
- [Copilot Workspace: Copilot-Native Dev Environment](https://github.blog/news-insights/product-news/github-copilot-workspace/)
- [Devin 2.0 Technical Design Deep Dive](https://medium.com/@takafumi.endo/agent-native-development-a-deep-dive-into-devin-2-0s-technical-design-3451587d23c0)
- [Devin AI: Agents 101](https://devin.ai/agents101)
- [Devin 2025 Performance Review](https://cognition.ai/blog/devin-annual-performance-review-2025)

### UX Patterns
- [Designing For Agentic AI: Practical UX Patterns (Smashing Magazine)](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- [Command Line Interface Guidelines](https://clig.dev/)
- [UX Patterns for CLI Tools (Lucas F. Costa)](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)
- [10 Design Principles for Delightful CLIs (Atlassian)](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis)
- [Progressive Disclosure Matters: Applying 90s UX Wisdom to 2026 AI Agents](https://aipositive.substack.com/p/progressive-disclosure-matters)
- [CLI UX Best Practices: Progress Displays (Evil Martians)](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)

### Claude Code Ecosystem
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Tasks Update (VentureBeat)](https://venturebeat.com/orchestration/claude-codes-tasks-update-lets-agents-work-longer-and-coordinate-across)
- [Extend Claude with Skills](https://code.claude.com/docs/en/skills)
- [Context Window Management Deep Dive](https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/3.3-context-window-management)

### Agentic Workflow Architecture
- [Agentic Workflows: Emerging Architectures (Vellum)](https://www.vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns)
- [Top AI Agentic Workflow Patterns (ByteByteGo)](https://blog.bytebytego.com/p/top-ai-agentic-workflow-patterns)
- [Agentic Workflows for Software Development (McKinsey)](https://medium.com/quantumblack/agentic-workflows-for-software-development-dc8e64f4a79d)
- [2026 Agentic Coding Trends (HuggingFace)](https://huggingface.co/blog/Svngoku/agentic-coding-trends-2026)

### Cognitive Load & Decision Fatigue
- [Cognitive Load in UX (Laws of UX)](https://lawsofux.com/cognitive-load/)
- [Cognitive Load Theory for Developer Tools (ZigPoll)](https://www.zigpoll.com/content/how-can-cognitive-load-theory-be-applied-to-improve-the-usability-of-developer-tools)
- [Why Developers Never Finish Onboarding](https://business.daily.dev/resources/why-developers-never-finish-your-onboarding-and-how-to-fix-it/)
