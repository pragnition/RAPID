# Deep Codebase Analysis: GSD & PAUL

**Analyzed:** 2026-03-03
**Purpose:** Extract concrete patterns for RAPID architecture

## Key Patterns to Adopt

### From Both (Convergent Patterns)
1. **Command-Workflow-Agent separation** — thin commands (~30 lines), fat workflows/agents. Commands are stable, agents evolve.
2. **STATE.md as living digest** — under 100 lines, YAML frontmatter for machine reading, markdown body for humans. Single source of truth for "where are we?"
3. **Progressive context loading** — one CLI call returns everything a workflow needs (GSD's `init` pattern). Keeps orchestrator at ~10-15% context.
4. **Plans as prompts** — execution plans are specifications agents can implement without interpretation. Include exact file paths, verification commands, done conditions.
5. **Atomic commits per task** — bisectable, blame-friendly git history.
6. **Decimal phases for interruptions** — 2.1 between 2 and 3, no renumbering needed.
7. **Session pause/resume via handoff files** — designed for zero-context fresh sessions.

### From GSD (Unique Strengths)
1. **Wave-based parallel execution** — plans grouped into dependency waves, parallel within wave.
2. **Goal-backward verification** — "are goals met?" not "were tasks done?" 3-level: exists → substantive → wired.
3. **Deviation rules** — 4-tier autonomy: auto-fix bugs, auto-add critical, auto-fix blocking, STOP for architectural.
4. **Analysis paralysis guard** — 5+ consecutive reads without action → STOP.
5. **Context monitor hook chain** — statusline → bridge file → context monitor → agent warnings at 35%/25%.
6. **Frontmatter sync** — build YAML from markdown content automatically for dual human/machine readability.
7. **CLI tool layer** — ~60+ atomic subcommands agents call via Bash. Clean, testable, composable.
8. **Plan-check verification loop** — research → plan → check → iterate (max 3). Catches gaps before execution.

### From PAUL (Unique Strengths)
1. **Mandatory loop closure (UNIFY)** — every plan gets reconciled. Audit trail prevents drift.
2. **Rich SUMMARY frontmatter** — subsystem, tags, requires/provides, affects, tech-stack, key-files, patterns-established. Enables automatic context assembly.
3. **Pre-planning pipeline** — discuss, assumptions, discover, research (4 commands vs GSD's 1).
4. **The assumptions command** — reveals Claude's mental model so misalignment caught before planning.
5. **Acceptance criteria as first-class** — Given/When/Then in every plan, pass/fail in every summary.
6. **Single next action routing** — `/progress` always suggests exactly ONE next action. Deterministic.
7. **Explicit boundaries in plans** — DO NOT CHANGE and SCOPE LIMITS sections. Prevents scope creep.
8. **Checkpoint system** — human-verify (90%), decision (9%), human-action (1%). "If Claude CAN automate it, Claude MUST."
9. **PROJECT.md evolution** — requirements move Active → Validated/Shipped at phase transitions. Living spec.
10. **Performance metrics** — velocity tracking, average duration, trend analysis in STATE.md.

## Key Anti-Patterns to Avoid

### From GSD
1. **Monolithic agent prompts** — planner is 50KB. Break into composable modules.
2. **Filesystem-as-database** — file existence = completion, regex parsing = state reads. Zero concurrency safety.
3. **No inter-agent communication** — filesystem is the only message bus. No real-time coordination.
4. **Silent error swallowing** — `try { } catch (e) {}` everywhere. Impossible to debug the system itself.
5. **Hardcoded path assumptions** — `~/.claude/get-shit-done/` baked into commands.
6. **No rollback mechanism** — partial execution leaves inconsistent state.
7. **Trusting agent self-reports** — classifyHandoffIfNeeded workaround reveals fundamental trust problem.

### From PAUL
1. **Anti-subagent philosophy** — "~70% quality" claim is wrong for RAPID's parallel use case.
2. **Sequential-only execution** — has wave schema in frontmatter but doesn't implement parallel execution.
3. **Single-developer assumption** — zero team features, no concept of ownership or coordination.
4. **Verbose templates** — PLAN.md template is 328 lines, mostly docs. Inflates context.
5. **CARL coupling** — external dependency for rule enforcement. Keep self-contained.
6. **Markdown-only state** — not easily machine-parseable for coordination logic.

## Architecture Recommendations for RAPID

### Plugin Structure
- Adopt three-tier: Command → Workflow → Agent
- Add proper `plugin.json` manifest (not directory convention)
- Use `${CLAUDE_PLUGIN_ROOT}` for path references (not hardcoded paths)
- Separate template docs from template content

### State Management
- JSON as source of truth, Markdown as rendered views
- mkdir-based atomic locking for concurrent access
- Team-aware state: who owns what, which dev is on which set
- File-system verification (don't trust agent self-reports)

### Agent Design
- Break large agents into composable modules (NOT 50KB monoliths)
- Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED tables)
- Fresh context per agent (spawn new, never resume)
- Agent identity tracking (which dev spawned which agent)

### Execution Model
- Wave-based parallel execution (from GSD)
- Mandatory reconciliation after each wave (from PAUL's UNIFY)
- Per-set worktree isolation (RAPID's core innovation)
- Interface contracts as coordination layer (RAPID's core innovation)

### Team Coordination
- Lock/claim system for plans and files
- Broadcast mechanism for team status
- Merge reviewer as quality gate (not just review)
- Shared planning gate, independent execution, coordinated merge
