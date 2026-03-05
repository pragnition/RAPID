# State Access Protocol

All project state lives in `.planning/` and is accessed through the `rapid-tools.cjs` CLI (via `RAPID_TOOLS` env var). Never read or write `.planning/` files directly.

## Prerequisites

Before running any command below, verify RAPID_TOOLS is set:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## CLI Commands

**State operations:**
- `node "${RAPID_TOOLS}" state get [field]` -- Read a specific field from STATE.md
- `node "${RAPID_TOOLS}" state get --all` -- Read the entire STATE.md content
- `node "${RAPID_TOOLS}" state update <field> <value>` -- Update a field in STATE.md

**Lock operations:**
- `node "${RAPID_TOOLS}" lock acquire <name>` -- Acquire a named lock
- `node "${RAPID_TOOLS}" lock status <name>` -- Check if a named lock is held

## Rules

- **Reads are safe without locking.** The CLI reads state synchronously and does not require lock acquisition.
- **Writes MUST go through the CLI.** The state update command acquires locks automatically, performs the write, and releases the lock in a single atomic operation.
- **Never write directly to `.planning/` files.** Always use the CLI tool. Direct writes bypass locking and can corrupt state when multiple agents are active.
- **Lock contention is normal.** If a write blocks on a lock, the CLI retries automatically with exponential backoff. Do not retry manually.
