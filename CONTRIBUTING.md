# Contributing to RAPID

## What is RAPID

RAPID (Rapid Agentic Parallelizable and Isolatable Development) is a Claude Code plugin for team-based parallel development. It decomposes projects into independent sets, executes them in isolated git worktrees with parallel agents, and merges the results. The core workflow is: init, plan, execute, review, merge. See [`.planning/context/ARCHITECTURE.md`](.planning/context/ARCHITECTURE.md) for the full system design.

## Development Setup

**Prerequisites:** Node.js 18+, Git

```bash
git clone https://github.com/pragnition/RAPID.git
cd RAPID
npm install
./setup.sh
```

Verify your setup:

```bash
node --test 'src/**/*.test.cjs'
```

## Making Changes

Fork the repo and create a feature branch. Branch naming convention:

- `feat/description` for new features
- `fix/description` for bug fixes
- Do **not** use the `rapid/` prefix -- that is reserved for RAPID's internal set branches.

Run tests before submitting:

```bash
node --test 'src/**/*.test.cjs'
```

Commit format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`

## Pull Requests

Submit PRs against `main`. Fill out the PR template completely -- every section exists for a reason. Keep PRs focused: one logical change per PR. Reference related issues with `Fixes #123` or `Related to #456`.

## Code Style

RAPID uses CommonJS (`.cjs` extension), 2-space indentation, single quotes, and requires semicolons. Tests use Node.js built-in `node:test` runner with `assert/strict` for assertions.

For full details:
- [`.planning/context/CONVENTIONS.md`](.planning/context/CONVENTIONS.md) -- naming, module structure, commit format
- [`.planning/context/STYLE_GUIDE.md`](.planning/context/STYLE_GUIDE.md) -- formatting, testing patterns, output conventions

## Reporting Issues

Use the [issue templates](https://github.com/pragnition/RAPID/issues/new/choose) when filing bugs or requesting features. There are two variants of each template: standard forms for human-authored issues, and Markdown templates for AI-assisted contributions. For questions that do not fit a bug report or feature request, use [GitHub Discussions](https://github.com/pragnition/RAPID/discussions).

## License

RAPID is released under the [MIT License](LICENSE).
