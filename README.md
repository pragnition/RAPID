# RAPID

**Rapid Agentic Parallelizable and Isolatable Development for Claude Code**

A plugin that enables team-based parallel development by decomposing project work into a hierarchy of Sets, Waves, and Jobs -- each executing in isolated git worktrees, connected by machine-verifiable interface contracts, and validated through an adversarial review pipeline.

## What It Does

- **Decomposes** project work into a Sets/Waves/Jobs hierarchy with dependency ordering and file ownership
- **Isolates** each set in its own git worktree so multiple developers (or Claude instances) work without conflicts
- **Validates** cross-set boundaries with machine-verifiable interface contracts (JSON Schema)
- **Reviews** code through an adversarial pipeline: unit test, bug hunt (hunter/advocate/judge), and UAT
- **Merges** with 5-level conflict detection and 4-tier resolution cascade, plus bisection recovery

## Hierarchy

```
Project
  Milestone (v1.0, v2.0, ...)
    Set (independent workstream -- own worktree and branch)
      Wave (dependency-ordered group -- sequential within set)
        Job (atomic work unit -- parallel within wave)
```

Sets run in parallel across developers. Waves execute sequentially within a set. Jobs execute in parallel within a wave. Each job has its own subagent and modifies only its assigned files.

## Quick Start

### Installation

**Plugin Marketplace (recommended):**

```
claude plugin add fishjojo1/RAPID
```

Then run `/rapid:install` inside Claude Code to complete setup.

**Alternative -- git clone:**

```bash
git clone https://github.com/fishjojo1/RAPID.git
cd RAPID
./setup.sh
```

### Workflow

```
/rapid:install           One-time setup
/rapid:init              Research, roadmap, scaffold .planning/
/rapid:context           Analyze existing codebase (brownfield)
/rapid:plan              Decompose into sets with contracts and DAG
```

Then for each set (in parallel across developers):

```
/rapid:set-init          Create worktree and branch
/rapid:discuss           Capture implementation vision
/rapid:wave-plan         Research, plan waves, plan jobs
/rapid:execute           Run jobs in parallel, reconcile per wave
/rapid:review            Unit test + bug hunt + UAT
```

After sets complete:

```
/rapid:merge             5-level detection, 4-tier resolution, DAG merge
/rapid:cleanup           Remove worktrees and branches
/rapid:new-milestone     Archive, bump version, re-plan
```

Additional commands: `/rapid:status`, `/rapid:assumptions`, `/rapid:pause`, `/rapid:resume`, `/rapid:help`

### Prerequisites

- Node.js 18+
- git 2.30+
- Claude Code (latest)

## Documentation

See [DOCS.md](DOCS.md) for the full command reference, architecture details, agent system (26 role modules, 21 runtime libraries), state machine, CLI reference, and configuration.

## License

MIT -- see [LICENSE](LICENSE).
