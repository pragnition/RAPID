# Feature Research

**Domain:** Metaprompting / Team-based Parallel Development Coordination Framework (Claude Code Plugin)
**Researched:** 2026-03-03
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete. Derived from analysis of GSD, PAUL, Agent Orchestrator, ccswarm, Claude Code Agent Farm, Parallel Code, and Claude Code's native Agent Teams.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Project initialization** | Every framework (GSD, PAUL, ruflo) has an init command. Users expect a single command to scaffold planning state, config, and project structure. | MEDIUM | Must generate `.planning/` structure, detect existing codebase, and scaffold CLAUDE.md. GSD uses `/gsd:new-project`, PAUL uses `/paul:init`. |
| **Planning phase with task decomposition** | Core of every framework. GSD has discuss/plan/execute/verify. PAUL has plan/apply/unify. Users expect structured task breakdown before execution. | HIGH | Must decompose work into parallelizable "sets" with clear boundaries. This is where RAPID diverges -- sets not phases. |
| **Slash command interface** | Standard interaction pattern for Claude Code plugins. GSD has 20+ commands, PAUL has 15+. Users expect discoverable `/rapid:command` interface. | LOW | Claude Code's skill/command system handles routing. Need name, description, frontmatter. |
| **Persistent state across sessions** | Every framework externalizes state to files. GSD uses STATE.md/ROADMAP.md/PROJECT.md. PAUL uses STATE.md with loop position tracking. Users expect to resume where they left off. | MEDIUM | Git-native state files in `.planning/`. Must track: current phase, set statuses, decisions, blockers. SESSION.md or STATE.md pattern. |
| **Progress tracking / status command** | GSD has `/gsd:progress`, PAUL has `/paul:progress`. Users need "where am I?" at a glance. | LOW | Read state files, summarize current position, suggest next action. Both GSD and PAUL do this well. |
| **Execution with fresh context windows** | Core insight of metaprompting: each task gets a clean 200K token context. GSD spawns fresh subagents per task. Context rot is the enemy. | MEDIUM | Subagent spawning per task/set. Each agent gets only the files and context it needs. |
| **Atomic git commits per task** | GSD commits after each task for bisect-ability. Users expect granular, traceable history. | LOW | Standard git commit with structured message. Phase/set number in commit for tracing. |
| **Session pause/resume** | Both GSD and PAUL support pausing work and generating handoff state. Users expect to close terminal and pick up later. | MEDIUM | Write comprehensive state to disk. Resume reads state and suggests exactly one next action (PAUL pattern). |
| **Verification / acceptance testing** | GSD has `/gsd:verify-work`, PAUL has `/paul:verify`. Users expect a way to validate work meets requirements before marking complete. | MEDIUM | Run tests, check acceptance criteria, generate verification report. Humans do final UAT. |
| **CLAUDE.md generation** | RAPID's PROJECT.md explicitly lists this. Every worktree/set needs consistent Claude context. GSD generates context files per phase. | MEDIUM | Auto-generate CLAUDE.md with code style, architecture patterns, API conventions, and project-specific knowledge. Must stay under 300 lines per best practices. |
| **Help command** | Every plugin has `/help`. Users need command reference and workflow guidance. | LOW | List commands, describe workflow, show current state. |
| **Codebase mapping / discovery** | GSD has `/gsd:map-codebase`. For brownfield projects, users need the framework to understand what exists before planning. | MEDIUM | Analyze existing code structure, conventions, dependencies, test patterns. Feed into planning context. |

### Differentiators (Competitive Advantage)

Features that set RAPID apart. Not required in existing frameworks, but they are RAPID's core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Parallel set definition with interface contracts** | RAPID's core innovation. No existing framework defines parallelizable work units with explicit interface contracts between them. GSD runs tasks in "waves" but within a single-developer context. Agent Teams coordinate at the session level but lack formalized contracts. | HIGH | Sets defined during planning with explicit APIs, data shapes, and behavioral contracts between them. This is what enables true team parallelism vs. solo-agent parallelism. |
| **Git worktree orchestration per set** | Physical isolation via worktrees. Agent Orchestrator and Parallel Code do this, but neither combines it with planning-time contract definition. RAPID makes worktrees a first-class concept from planning through merge. | HIGH | Create, manage, and clean up git worktrees automatically. Each set gets its own worktree + branch. Must handle worktree lifecycle: create on set start, merge on set complete, prune on cleanup. |
| **Merge reviewer agent** | No existing metaprompting framework has an automated merge reviewer that validates contract compliance and test coverage. Agent Orchestrator handles CI failures reactively but does not do proactive deep review. | HIGH | Agent that reads interface contracts, reviews the diff, runs tests, blocks merge on contract violations. This is architectural enforcement, not just linting. |
| **Cleanup agent for merge issues** | When merge reviewer finds problems, spawn a targeted cleanup agent. Existing tools escalate to humans or retry blindly. | MEDIUM | Spawned on-demand when merge review fails. Gets specific context about what failed and why. Focused scope = effective fixes. |
| **Loose sync model** | GSD and PAUL are strictly linear. Agent Teams are fully ad-hoc. RAPID occupies the middle ground: shared planning gate, then independent execution per set. No framework currently does this. | MEDIUM | Shared planning phase where all sets are defined together. After planning gate, each set has its own discuss/plan/execute lifecycle. Sync only at merge time. |
| **Cross-worktree style consistency** | Auto-generated style guide ensures all worktrees produce consistent code. Existing frameworks rely on CLAUDE.md but do not generate style guides from codebase analysis. | MEDIUM | Analyze existing code patterns during init. Generate style guide covering naming, formatting, patterns. Inject into every worktree's CLAUDE.md context. |
| **Team-first design (solo = team of one)** | Existing frameworks are solo-first. RAPID treats solo as a degenerate case of team. This means the parallelism model works at scale 1 to scale N without code path divergence. | LOW | Single architecture that handles 1 developer or 10. Solo mode creates one set; team mode creates N sets. Same execution engine. |
| **EXPERIMENTAL_AGENT_TEAMS detection with subagent fallback** | No existing framework gracefully detects and leverages Agent Teams when available while falling back to subagents. Most assume one or the other. | MEDIUM | Runtime detection of CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS. Use Agent Teams for inter-set coordination when available. Fall back to subagent orchestration when not. |
| **Interface contract validation at merge time** | Contracts are not just documentation -- they are enforced. At merge time, the reviewer agent validates that implementations conform to defined interfaces. | HIGH | Parse contract definitions, compare against actual code, run integration tests across set boundaries. This is what makes parallel work safe. |
| **Set dependency graph** | While sets are meant to be independent, some may have soft dependencies (e.g., Set B's API client depends on Set A's API contract). Visualizing and managing this is unique. | MEDIUM | DAG of set relationships. Planning warns about tight coupling. Execution respects ordering constraints for dependent sets. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Learned from failures in existing frameworks and explicit out-of-scope items in PROJECT.md.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Standalone CLI** | Developers want to install and run independently. Ruflo, Agent Orchestrator are standalone. | Duplicates Claude Code infrastructure. Maintenance burden of CLI framework, updates, compatibility. Claude Code plugin architecture provides commands, hooks, skills, agents for free. | Claude Code plugin that installs via `npx` or git clone into `.claude/`. Leverage existing skill/command/hook infrastructure. |
| **Central server/service for state** | Team coordination naturally suggests a server. Ruflo has agent swarm servers. | Infrastructure dependency kills adoption. Must work offline, in CI, on planes. Git is already a distributed coordination system. | Git-native state with lock files in `.planning/`. Conflict resolution via git merge semantics. |
| **Ad-hoc set creation during execution** | "I just realized I need another set." Feels flexible. | Destroys isolation guarantees. Late-created sets have no contract coverage with existing sets. Integration surface area grows unpredictably. | Plan well, add sets by re-entering planning phase. `/rapid:replan` that pauses execution, adds sets with contracts, resumes. |
| **Fully synchronized phase gates** | Every set must be at the same phase before anyone advances. Enterprise PM instinct. | Blocking. The entire point of RAPID is non-blocking parallelism. If Set A finishes planning first, it should start executing without waiting for Set B. | Loose sync: shared planning gate only. After that, sets have independent lifecycles. Sync at merge time, not at phase gates. |
| **Real-time inter-set communication during execution** | Agent Teams support inter-agent messaging. Feels natural. | Defeats isolation. If Set A's agent can message Set B's agent mid-execution, you get implicit coupling, race conditions, and unpredictable outcomes. | Interface contracts defined upfront. If agents need to communicate, the contracts were insufficient -- replan. |
| **AI-powered automatic merge conflict resolution** | "Just let the AI fix merge conflicts." | Merge conflicts between sets indicate contract violations. Auto-resolving hides architectural problems. The merge should fail loudly so the contract can be fixed. | Merge reviewer agent that diagnoses why the conflict exists, then spawns cleanup agent with specific instructions. Humans approve contract changes. |
| **GUI / web dashboard** | Parallel Code has a GUI. Looks nice. | Massive scope increase. Electron/web app maintenance. RAPID is a Claude Code plugin -- the terminal IS the interface. | Rich terminal output with progress tracking. `/rapid:status` shows all sets, their states, and next actions. |
| **Plugin marketplace / ecosystem** | "Let users extend RAPID with plugins." | Premature abstraction. Build the core first. Plugin APIs are hard to get right and expensive to maintain backward compatibility. | Well-structured code with clear extension points. Consider plugin system in v2+ after core is validated. |
| **Automatic set decomposition** | "AI should figure out the sets for me." | Set boundaries are architectural decisions requiring human judgment. AI-generated boundaries tend toward naive file-based splitting rather than domain-based isolation. | AI suggests set decomposition during planning. Human reviews and adjusts. AI generates interface contracts for approved sets. |

## Feature Dependencies

```
[Project Initialization]
    |
    +--requires--> [Codebase Mapping] (for brownfield projects)
    |
    +--produces--> [CLAUDE.md Generation]
    |              |
    |              +--requires--> [Style Guide Generation]
    |
    +--produces--> [Planning State Files]
                   |
                   +--enables--> [Planning Phase]
                                 |
                                 +--produces--> [Set Definitions]
                                 |              |
                                 |              +--includes--> [Interface Contracts]
                                 |              |
                                 |              +--includes--> [Set Dependency Graph]
                                 |
                                 +--enables--> [Git Worktree Orchestration]
                                               |
                                               +--creates--> [Per-Set Worktrees + Branches]
                                               |
                                               +--enables--> [Per-Set Execution]
                                                             |
                                                             +--uses--> [Fresh Context Subagents]
                                                             |
                                                             +--produces--> [Atomic Git Commits]
                                                             |
                                                             +--feeds--> [Verification]
                                                                         |
                                                                         +--triggers--> [Merge Reviewer Agent]
                                                                                        |
                                                                                        +--validates--> [Interface Contract Compliance]
                                                                                        |
                                                                                        +--may-spawn--> [Cleanup Agent]
                                                                                        |
                                                                                        +--on-pass--> [Merge to Main]

[Session Pause/Resume] ~~independent~~ [All Phases]

[Progress Tracking] ~~reads~~ [Planning State Files]

[Help Command] ~~independent~~ [All Features]

[Agent Teams Detection] ~~enhances~~ [Per-Set Execution]
    |
    +--fallback--> [Subagent Orchestration]
```

### Dependency Notes

- **Planning Phase requires Project Initialization:** Can't plan without project context, requirements, and state files.
- **Git Worktree Orchestration requires Set Definitions:** Must know what sets exist before creating worktrees.
- **Interface Contracts require Set Definitions:** Contracts define boundaries between specific sets.
- **Merge Reviewer Agent requires Interface Contracts:** Without contracts, the reviewer has nothing to validate against.
- **Cleanup Agent requires Merge Reviewer Agent:** Only spawned when merge review finds issues.
- **CLAUDE.md Generation requires Style Guide Generation:** Style guide is injected into CLAUDE.md for consistency.
- **Agent Teams Detection enhances but does not require Per-Set Execution:** Subagent fallback means execution works regardless.
- **Session Pause/Resume is independent:** Can be implemented at any time, works across all phases.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the core thesis that parallel set-based development works.

- [ ] **Project initialization** (`/rapid:init`) -- Scaffold `.planning/` structure, detect existing codebase, generate initial CLAUDE.md and style guide
- [ ] **Set-based planning** (`/rapid:plan`) -- Define parallelizable sets with explicit interface contracts and boundaries
- [ ] **Git worktree orchestration** -- Create/manage/cleanup worktrees per set. This is the physical isolation mechanism
- [ ] **Per-set execution** (`/rapid:execute`) -- Run set execution in fresh subagent contexts with set-specific CLAUDE.md
- [ ] **Interface contract definition** -- Structured format for defining APIs, data shapes, and behavioral contracts between sets
- [ ] **Merge reviewer agent** -- Deep code review at merge time validating contract compliance and test coverage
- [ ] **Basic state management** -- STATE.md tracking set statuses, decisions, blockers. Resume capability
- [ ] **Progress tracking** (`/rapid:status`) -- Show all sets, their lifecycle phase, and next actions
- [ ] **Help command** (`/rapid:help`) -- Command reference and workflow guidance

### Add After Validation (v1.x)

Features to add once core parallel workflow is proven.

- [ ] **Cleanup agent** -- Trigger: merge reviewer frequently finds fixable issues that could be auto-remediated
- [ ] **Discuss phase per set** -- Trigger: users want to capture design preferences before planning (GSD pattern)
- [ ] **Verification/UAT phase** -- Trigger: users need structured acceptance testing beyond merge review
- [ ] **Codebase mapping** (`/rapid:map`) -- Trigger: brownfield adoption increases and users need automated codebase analysis
- [ ] **EXPERIMENTAL_AGENT_TEAMS detection** -- Trigger: Agent Teams becomes stable/common enough to warrant dual-mode support
- [ ] **Set dependency graph visualization** -- Trigger: users create complex set relationships that need visual debugging
- [ ] **Milestone management** -- Trigger: projects span multiple planning cycles, need versioned milestones

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Cross-agent-tool support** (Codex, Gemini CLI) -- Why defer: Claude Code plugin architecture assumption simplifies v1 enormously
- [ ] **Replan workflow** (`/rapid:replan`) -- Why defer: requires pausing in-flight sets, adjusting contracts, resuming -- complex state management
- [ ] **Custom merge strategies** -- Why defer: default merge + reviewer is sufficient for v1; custom strategies are an optimization
- [ ] **Integration with issue trackers** (GitHub Issues, Linear) -- Why defer: scope creep; manual linking is fine for v1
- [ ] **Plugin/extension system** -- Why defer: premature abstraction; extension points should emerge from real usage patterns
- [ ] **Hooks for CI/CD integration** -- Why defer: users can wire their own CI; framework hooks are v2 polish

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Project initialization | HIGH | MEDIUM | P1 |
| Set-based planning with contracts | HIGH | HIGH | P1 |
| Git worktree orchestration | HIGH | HIGH | P1 |
| Per-set execution (subagents) | HIGH | MEDIUM | P1 |
| Merge reviewer agent | HIGH | HIGH | P1 |
| State management + resume | HIGH | MEDIUM | P1 |
| Progress tracking | MEDIUM | LOW | P1 |
| Help command | MEDIUM | LOW | P1 |
| CLAUDE.md generation | HIGH | MEDIUM | P1 |
| Style guide generation | MEDIUM | MEDIUM | P2 |
| Cleanup agent | MEDIUM | MEDIUM | P2 |
| Discuss phase per set | MEDIUM | MEDIUM | P2 |
| Verification/UAT | MEDIUM | MEDIUM | P2 |
| Codebase mapping | MEDIUM | MEDIUM | P2 |
| Agent Teams detection + fallback | MEDIUM | MEDIUM | P2 |
| Set dependency graph | LOW | MEDIUM | P2 |
| Milestone management | LOW | MEDIUM | P3 |
| Replan workflow | MEDIUM | HIGH | P3 |
| Cross-agent-tool support | LOW | HIGH | P3 |
| Custom merge strategies | LOW | MEDIUM | P3 |
| Issue tracker integration | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- validates the core thesis
- P2: Should have, add when core is working -- improves DX and handles edge cases
- P3: Nice to have, future consideration -- expansion features

## Competitor Feature Analysis

| Feature | GSD | PAUL | Agent Orchestrator | Parallel Code | Agent Teams (native) | RAPID (planned) |
|---------|-----|------|--------------------|---------------|---------------------|-----------------|
| Project init | `/gsd:new-project` with research | `/paul:init` | `ao spawn` per issue | Manual | N/A (native feature) | `/rapid:init` with set planning |
| Planning model | Linear phases: discuss/plan/execute/verify | PAU loop: plan/apply/unify | Issue-based, no formal planning | None (manual) | Natural language task assignment | Parallel sets with interface contracts |
| Parallelism model | Wave-based within single dev | None (sequential, in-session) | Per-issue worktree parallelism | Per-task worktree GUI | Agent-to-agent task claiming | Per-set worktree with contracts |
| Team support | Solo only | Solo only | Multi-agent (no human team) | Multi-agent GUI | Multi-agent orchestration | Multi-developer team + multi-agent |
| State management | Files in `.planning/` | Files in `.paul/` | Issue tracking (GitHub) | None persistent | Team config + task list in `~/.claude/` | Files in `.planning/` (git-native) |
| Interface contracts | No | No | No | No | No | Core feature |
| Merge workflow | Atomic commits per task | Atomic commits per plan | Auto-PR creation | Sidebar merge button | N/A (shared repo) | Merge reviewer agent with contract validation |
| Code review | No built-in review | No built-in review | Reactive (CI failure + review comments) | Built-in diff viewer | Peer agent challenge | Dedicated merge reviewer agent |
| Style enforcement | No (relies on CLAUDE.md) | No (relies on CLAUDE.md) | No | No | Via CLAUDE.md | Auto-generated style guide + CLAUDE.md injection |
| Context management | Fresh subagent per task | In-session (no subagent sprawl) | Fresh agent per issue | Fresh agent per task | Each teammate has own context | Fresh subagent per set task |
| Git worktrees | No | No | Yes (core feature) | Yes (core feature) | Supported but manual | Yes (orchestrated per set) |
| Session resume | STATE.md + `/gsd:progress` | STATE.md + `/paul:resume` | Crash recovery via dashboard | No | Limited (no teammate resume) | STATE.md + `/rapid:resume` |
| Offline support | Yes (git-native) | Yes (file-based) | Requires GitHub API | Yes (local) | Yes (local) | Yes (git-native) |

## Sources

- [GSD (Get Shit Done) GitHub](https://github.com/gsd-build/get-shit-done) -- PRIMARY: Full feature set analyzed from README and local installation [HIGH confidence]
- [PAUL Framework GitHub](https://github.com/ChristopherKahler/paul) -- PRIMARY: Plan-Apply-Unify loop, commands, state management [HIGH confidence]
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams) -- OFFICIAL: Agent Teams architecture, features, limitations [HIGH confidence]
- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills) -- OFFICIAL: Plugin architecture, SKILL.md format, frontmatter [HIGH confidence]
- [Composio Agent Orchestrator](https://github.com/ComposioHQ/agent-orchestrator) -- GitHub README: Parallel worktree execution, CI handling, review routing [MEDIUM confidence]
- [Parallel Code](https://github.com/johannesjo/parallel-code) -- GitHub README: GUI, worktree management, multi-agent support [MEDIUM confidence]
- [ccswarm](https://github.com/nwiizo/ccswarm) -- GitHub README: Rust-based, role-based agents, worktree isolation [MEDIUM confidence]
- [Claude Code Agent Farm](https://github.com/Dicklesworthstone/claude_code_agent_farm) -- GitHub README: Lock-based coordination, tmux monitoring, 20+ agents [MEDIUM confidence]
- [GSD Medium Article](https://agentnativedev.medium.com/get-sh-t-done-meta-prompting-and-spec-driven-development-for-claude-code-and-codex-d1cde082e103) -- Context rot prevention, wave execution model [MEDIUM confidence]
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) -- OFFICIAL: CLAUDE.md guidance, hook patterns, permission model [HIGH confidence]
- [Spec-Driven Development Guide](https://www.augmentcode.com/guides/what-is-spec-driven-development) -- SDD patterns, interface-first design [MEDIUM confidence]
- [Anthropic C Compiler Case Study](https://www.anthropic.com/engineering/building-c-compiler) -- Real-world 16-agent parallel development [HIGH confidence]

---
*Feature research for: Metaprompting / Team-based Parallel Development Coordination*
*Researched: 2026-03-03*
