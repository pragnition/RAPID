# RAPID

**Rapid Agentic Parallelizable and Isolatable Development**

A Claude Code plugin for team-based parallel development using isolated git worktrees and interface contracts.

## What It Does

- **Decomposes** project work into independent, parallelizable sets with dependency ordering
- **Isolates** each set in its own git worktree so multiple developers work without conflicts
- **Validates** cross-set boundaries with machine-verifiable interface contracts (JSON Schema)
- **Merges** through an automated review pipeline with contract gates and dependency-ordered integration

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

### Prerequisites

- Node.js 18+
- git 2.30+

## Workflow Overview

1. **`/rapid:init`** -- Set up project with `.planning/` directory and state files
2. **`/rapid:context`** -- Analyze existing codebase for style guides and conventions
3. **`/rapid:plan`** -- Decompose work into parallel sets with contracts and dependency graphs
4. **`/rapid:execute`** -- Run sets through discuss/plan/execute lifecycle in wave order
5. **`/rapid:status`** -- Monitor worktree progress and wave completion
6. **`/rapid:merge`** -- Review and integrate completed sets with contract validation
7. **`/rapid:cleanup`** -- Remove worktree directories after successful merges

Additional commands: `/rapid:help`, `/rapid:install`, `/rapid:assumptions`, `/rapid:pause`

## Documentation

See [DOCS.md](DOCS.md) for the full command reference, architecture details, agent system, and configuration options.

## License

MIT -- see [LICENSE](LICENSE).
