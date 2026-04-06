<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-6.0.0-d3c6aa?style=flat-square&labelColor=2d353b" alt="Version" /> 
  <img src="https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b" alt="License" /> 
  <img src="https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b" alt="Claude Code" /> 
  <img src="https://img.shields.io/badge/Node.js-22%2B-a7c080?style=flat-square&labelColor=2d353b" alt="Node.js" />
</p>

> [!NOTE]
> RAPID is still in beta. Therefore, features may be broken/unpolished. Feedback is **always** welcome.

You are deep into a Claude session -- twenty minutes in, the model has seen your architecture,
your test suite, your style conventions. Then it starts repeating itself. It forgets a decision
you made five prompts ago. It hallucinates a function signature it generated correctly earlier.
That is context rot: as the context window fills, the model loses grip on earlier decisions and
artifacts, and quality degrades in ways you cannot predict. RAPID solves this by structuring
work into isolated sets with `/clear` between every command, so each step gets a fresh context
window loaded with exactly the artifacts it needs -- nothing more, nothing stale.

## Install

```
claude plugin add pragnition/RAPID
```

Then, inside Claude Code:

```
/rapid:install
```

Requires Node.js 22+. For alternative installation methods, see [DOCS.md](DOCS.md#installation).

## The /clear Mental Model

After every RAPID command that produces artifacts, a box appears telling you to run `/clear` and what command comes next. This is intentional -- clearing context between steps keeps each command focused and prevents the degradation that ruins long sessions.

17 of 28 commands show this footer. Informational commands like `/rapid:status` and `/rapid:help` do not -- they consume minimal context and produce no artifacts.

Throughout this README, you will see `/clear` between every command. This is the pattern.

## Quickstart

1. **`/rapid:init`** -- Research your project, generate a roadmap, decompose work into sets
   > /clear

2. **`/rapid:start-set 1`** -- Create an isolated worktree for the first set
   > /clear

3. **`/rapid:discuss-set 1`** -- Capture your implementation vision and design decisions
   > /clear

4. **`/rapid:plan-set 1`** -- Research, produce wave-level plans, validate contracts
   > /clear

5. **`/rapid:execute-set 1`** -- Execute all planned waves with parallel agents
   > /clear

6. **`/rapid:review 1`** -- Scope the set for review (then optionally: unit-test, bug-hunt, uat)
   > /clear

7. **`/rapid:merge`** -- Integrate the completed set into main
   > /clear

Each command spawns specialized agents, produces artifacts, and advances the set through its lifecycle. The `/clear` between each step is not optional -- it is what keeps the whole system working.

> [!TIP]
> RAPID does not confine you to parallel development. Pass `--solo` to any command to work without worktrees.
