# State Access Protocol

All project state lives in `.planning/` and is accessed through the `rapid-tools.cjs` CLI. Never read or write `.planning/` files directly.

## CLI Commands

**State operations:**
- `node src/bin/rapid-tools.cjs state get [field]` -- Read a specific field from STATE.md
- `node src/bin/rapid-tools.cjs state get --all` -- Read the entire STATE.md content
- `node src/bin/rapid-tools.cjs state update <field> <value>` -- Update a field in STATE.md

**Lock operations:**
- `node src/bin/rapid-tools.cjs lock acquire <name>` -- Acquire a named lock
- `node src/bin/rapid-tools.cjs lock status <name>` -- Check if a named lock is held

## Rules

- **Reads are safe without locking.** The CLI reads state synchronously and does not require lock acquisition.
- **Writes MUST go through the CLI.** The state update command acquires locks automatically, performs the write, and releases the lock in a single atomic operation.
- **Never write directly to `.planning/` files.** Always use the CLI tool. Direct writes bypass locking and can corrupt state when multiple agents are active.
- **Lock contention is normal.** If a write blocks on a lock, the CLI retries automatically with exponential backoff. Do not retry manually.
