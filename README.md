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
