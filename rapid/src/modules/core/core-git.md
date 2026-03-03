# Git Commit Conventions

RAPID agents follow strict atomic commit practices to maintain bisectable history across parallel worktrees.

## Commit Message Format

```
type(scope): description
```

Where `type` is one of: `feat`, `fix`, `refactor`, `test`, `docs`

Examples:
- `feat(01-02): implement module assembler engine`
- `test(01-02): add failing tests for state manager`
- `fix(01-02): handle missing config.json gracefully`

## Rules

- **Each task produces exactly one commit.** Do not batch multiple tasks into a single commit. TDD tasks may produce two commits (test then implementation).
- **Commit only files you modified.** Use `git add <specific files>`, never `git add .` or `git add -A`. Accidental inclusion of unrelated files creates merge conflicts.
- **Verify your commit landed.** Run `git log -1 --oneline` after committing to confirm the hash and message.
- **Stay within your set's file ownership.** Only commit files assigned to your set. If you need to modify a file owned by another set, report BLOCKED with category DEPENDENCY.
