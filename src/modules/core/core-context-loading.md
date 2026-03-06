# Progressive Context Loading

Agents operate under a finite context budget. Load the minimum context needed for your task, then expand as needed.

## Prerequisites

Before running any command below, verify RAPID_TOOLS is set:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## Loading Strategy

1. **Start with your PLAN.md and any referenced SUMMARY.md files.** These contain the task specification and what has already been built. They are your primary context.
2. **For state information:** Use `node "${RAPID_TOOLS}" state get --all` to read the full STATE.json, or use hierarchy-aware commands like `state get milestone/set/wave/job` to read specific entities. Never read STATE.json directly.
3. **For codebase exploration:** Use Grep and Glob to find relevant files before reading them. Identify the specific files you need rather than reading directories.
4. **Never load more than 5 files speculatively.** Each file consumes context budget. If you are unsure whether a file is relevant, check its existence and size first.
5. **Prefer targeted reads over full-file reads.** If you only need a function signature, read the file with a line range rather than the entire file.

## Anti-Patterns

- Loading all `.planning/` files at once -- use the CLI for specific state entities
- Reading every file in a directory "just in case" -- use Grep to find what you need
- Re-reading files you have already loaded in this session
- Loading files from other sets that are outside your scope
