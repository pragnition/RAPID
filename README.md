<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" />
</p>

<p align="center">
  <a href='https://github.com/pragnition/RAPID/tree/main'><img src="https://img.shields.io/badge/version-5.0.0-d3c6aa?style=flat-square&labelColor=2d353b" alt="Version" /></a>
  <a href='https://github.com/pragnition/RAPID/blob/main/LICENSE'><img src="https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b" alt="License" /></a>
  <a href='https://claude.com/plugins'><img src="https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b" alt="Claude Code" /></a>
  <a href='https://nodejs.org/en/blog/release/v18.18.0'><img src="https://img.shields.io/badge/Node.js-18%2B-a7c080?style=flat-square&labelColor=2d353b" alt="Node.js" /></a>
</p>

> Pre-existing agent harnesses like GSD and OpenSpec are great, but not built for collaboration amongst teams.
> At Pragnition Labs, we build in small, mobile teams. We needed something better.
> RAPID is a meta prompting framework/agent harness that treats parallelized development as a **first class citizen** feature.

---

<p align="center">
  <sub>Built with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a></sub>
</p>

> [!NOTE]
> RAPID is still in beta. Therefore, features may be broken/unpolished. Feedback is **always** welcome.

**RAPID is a Claude Code plugin that coordinates parallel AI-assisted development.**

- **Isolation** -- each set gets its own git worktree; agents never touch each other's files
- **Ownership** -- file boundaries enforced per set; no overlapping modifications
- **Contracts** -- `CONTRACT.json` specs define what each set exports and imports
- **Merge strategy** -- 5-level conflict detection with tiered auto-resolution

## Install

> [!TIP]
> ```
> /plugin install rapid@pragnition/pragnition-public-plugins 
> ```
> alternatively,
> ```
> /plugin marketplace add pragnition/pragnition-public-plugins
> /plugin install rapid@pragnition-public-plugins
> ```
> `/rapid:install` inside Claude Code to configure your environment.

## 60-Second Quickstart

```
/rapid:init              # Research project, generate roadmap, decompose into sets
/rapid:branding          # Optional, helps create UI and branding theme 
/rapid:start-set 1       # Create isolated worktree for set 1
/rapid:discuss-set 1     # Capture your implementation vision
/rapid:plan-set 1        # Research, plan all waves, validate contracts
/rapid:execute-set 1     # Execute all waves (parallel agents per wave)
/rapid:review 1          # Scope review targets (optional)
  /rapid:unit-test 1       # Generate and run unit tests
  /rapid:bug-hunt 1        # Adversarial bug hunting
  /rapid:uat 1             # Acceptance testing
/rapid:merge             # Integrate completed sets to main
/rapid:audit-version
/rapid:new-version
```

That is the full lifecycle. Each command spawns specialized agents, produces artifacts, and advances the set through its lifecycle automatically.

> [!TIP]
> RAPID does not confine you to parallel development. Should you wish to work without worktrees, you may pass in the --solo flag to all commands. 

## Architecture

<p align="center">
  <img src="branding/lifecycle-flow.svg" alt="RAPID Lifecycle Flow" />
</p>

<p align="center">
  <img src="branding/agent-dispatch.svg" alt="Agent Dispatch Architecture" />
</p>

## How It Works

RAPID structures parallel work around **sets** -- independent workstreams that each developer owns end-to-end.

**Research pipeline.** `/rapid:init` fleshes out the project with you, spawns 6 parallel researchers (stack, features, architecture, pitfalls, oversights, UX) to analyze your project. A synthesizer combines their findings, and a roadmapper decomposes work into sets with clear boundaries.

**Isolation.** `/rapid:start-set` creates a dedicated git worktree per set so each agent works in its own copy of the repo with no cross-contamination.

**Discussion.** `/rapid:discuss-set` captures the developer's implementation vision and design decisions into CONTEXT.md before any planning begins.

**Interface contracts.** Sets connect through `CONTRACT.json` -- machine-verifiable specs defining which functions, types, and endpoints each set exposes. Contracts are validated after planning, during execution, and before merge.

**Planning.** `/rapid:plan-set` runs a researcher to investigate implementation specifics, a planner to produce wave-level plans, and a verifier to check for coverage gaps and contract violations.

**Execution.** `/rapid:execute-set` runs one executor per wave in dependency order. Each executor implements planned work with atomic commits and reports results; re-running after interruption resumes from the first incomplete task.

**Review pipeline.** Four sequential stages: scoping identifies changed files by concern area, unit tests target each concern group, an adversarial bug-hunt cycle (hunter/devil's-advocate/judge, up to 3 rounds) finds and auto-fixes confirmed issues, and acceptance testing verifies end-to-end behavior.

**Merge.** `/rapid:merge` detects conflicts at 5 levels (textual, structural, dependency, API, semantic) and resolves them through a confidence cascade -- high-confidence auto-accepted, mid-confidence delegated to resolver agents, low-confidence escalated to the developer. Clean merges skip detection via fast-path `git merge-tree`.

## Command Reference

| Command | Description |
|---------|-------------|
| `/rapid:init` | Research project, generate roadmap, decompose into sets |
| `/rapid:start-set` | Create isolated worktree, generate scoped CLAUDE.md |
| `/rapid:discuss-set` | Capture developer implementation vision before planning |
| `/rapid:plan-set` | Plan all waves in a set -- research, plan, validate |
| `/rapid:execute-set` | Execute all waves with per-wave executor agents |
| `/rapid:review` | Scope review targets and produce REVIEW-SCOPE.md |
| `/rapid:merge` | Merge completed sets to main with conflict detection |

See [DOCS.md](DOCS.md) for the full reference covering all 28 commands.

## Documentation

-> [DOCS.md](DOCS.md) -- command reference, quick lookup, all 28 commands with usage examples

-> [Technical Documentation](technical_documentation.md) -- architectural narrative, system design rationale, how components fit together

-> [docs/](docs/) -- topic-specific deep-dives (agents, state machines, configuration, merge, review, and more)

## Credits 

Huge thanks to the work done by other opensource agent harnesses like [get-shit-done](https://github.com/gsd-build/get-shit-done) and [OpenSpec](https://github.com/gsd-build/get-shit-done). RAPID is heavily inspired by get-shit-done. In fact, earlier versions of RAPID were built using GSD till RAPID was good enough to build itself!

Another shoutout to [this article](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) by humanlayer that served as a great info dump/starting point.




## Links

-> [Contributing Guide](CONTRIBUTING.md) -- how to contribute to RAPID

-> [License](LICENSE) -- MIT
