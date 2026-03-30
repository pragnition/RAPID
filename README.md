<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" width="800" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-5.0.0-d3c6aa?style=flat-square&labelColor=2d353b" alt="Version" /> <img src="https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b" alt="License" /> <img src="https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b" alt="Claude Code" /> <img src="https://img.shields.io/badge/Node.js-18%2B-a7c080?style=flat-square&labelColor=2d353b" alt="Node.js" />
</p>

<p align="center">
  <em>Rapid Agentic Parallelizable and Isolatable Development</em>
</p>

---

Claude Code is powerful for a solo developer, but the moment multiple developers use it on the same project, everything breaks. Agents overwrite each other's work because there is no isolation or file ownership -- merge conflicts pile up and semantic incompatibilities slip through undetected. The core issue is that parallel AI-assisted development needs the same things parallel human development needs: isolation (worktrees), ownership (file boundaries), contracts (interface specs), and a structured merge strategy. RAPID provides all four, coordinated by 27 specialized agents that handle automation so developers focus on decisions, not coordination.

## Install

> [!TIP]
> ```
> claude plugin add pragnition/RAPID
> ```

Then run `/rapid:install` inside Claude Code to configure your environment.

## 60-Second Quickstart

```
/rapid:init              # Research project, generate roadmap, decompose into sets
/rapid:start-set 1       # Create isolated worktree for set 1
/rapid:discuss-set 1     # Capture your implementation vision
/rapid:plan-set 1        # Research, plan all waves, validate contracts
/rapid:execute-set 1     # Execute all waves (parallel agents per wave)
/rapid:review 1          # Scope review targets
/rapid:unit-test 1       # Generate and run unit tests
/rapid:bug-hunt 1        # Adversarial bug hunting
/rapid:uat 1             # Acceptance testing
/rapid:merge             # Integrate completed sets to main
```

That is the full lifecycle. Each command spawns specialized agents, produces artifacts, and advances the set through its lifecycle automatically.

## How It Works

RAPID structures parallel work around **sets** -- independent workstreams that each developer owns end-to-end.

**Research pipeline.** Before any code is written, `/rapid:init` spawns 6 parallel researchers (stack, features, architecture, pitfalls, oversights, UX) to analyze your project. A synthesizer combines their findings, and a roadmapper decomposes work into sets with clear boundaries.

**Interface contracts.** Sets connect through `CONTRACT.json` -- machine-verifiable specifications that define exactly which functions, types, and endpoints each set exposes. If Set A needs a function from Set B, the contract enforces that Set B actually exports it with the right signature. Contracts are validated after planning, during execution, and before merge.

**Planning with validation.** `/rapid:plan-set` runs a 3-step pipeline: a researcher investigates implementation specifics, a planner produces wave-level plans, and a verifier checks for coverage gaps, contract violations, and inconsistencies. Total: 2-4 agent spawns per set.

**Execution with per-wave agents.** `/rapid:execute-set` runs one executor agent per wave, sequentially through the wave dependency order. Each executor implements the planned work, commits atomically, and reports results. A verification agent checks objectives after all waves complete. If interrupted, re-running detects completed work from planning artifacts and resumes where it left off.

**4-stage review pipeline.** Review is split into four independent skills that run sequentially after execution:

- `/rapid:review` scopes the review -- identifies changed files, categorizes them by concern area, and produces a REVIEW-SCOPE.md that downstream skills consume.
- `/rapid:unit-test` generates and runs unit tests against each concern group identified by the scoper.
- `/rapid:bug-hunt` runs the adversarial bug-hunt cycle: a hunter finds issues, a devil's advocate challenges the findings, and a judge rules on each dispute. Confirmed bugs are fixed automatically. This cycle iterates up to 3 times.
- `/rapid:uat` runs acceptance testing with browser automation to verify end-to-end behavior.

**Multi-level merge.** `/rapid:merge` detects conflicts at 5 levels (textual, structural, dependency, API, semantic) and resolves them through a 4-tier confidence cascade. High-confidence resolutions are auto-accepted, mid-confidence conflicts go to dedicated resolver agents, and low-confidence conflicts escalate to the developer. Clean merges skip detection entirely via a fast-path `git merge-tree` check.

<details>
<summary>Architecture</summary>

<p align="center">
  <img src="branding/lifecycle-flow.svg" alt="RAPID Lifecycle Flow" width="800" />
</p>

The 7-phase lifecycle: init, start-set, discuss, plan, execute, review, and merge. Each phase produces artifacts that feed the next.

<p align="center">
  <img src="branding/agent-dispatch.svg" alt="Agent Dispatch Architecture" width="800" />
</p>

27 agents organized by command. Each skill dispatches exactly the agents it needs -- no central coordinator.

</details>

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

## Links

-> [Full Documentation](DOCS.md) -- all 28 commands, architecture, state machines, configuration

-> [Contributing Guide](CONTRIBUTING.md) -- how to contribute to RAPID

-> [License](LICENSE) -- MIT

## License

MIT -- see [LICENSE](LICENSE).
