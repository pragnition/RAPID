# State Access Protocol

All project state lives in `.planning/STATE.json` and is accessed through the `rapid-tools.cjs` CLI (via `RAPID_TOOLS` env var). Never read or write `.planning/` files directly.

## Prerequisites

Before running any command below, verify RAPID_TOOLS is set:

```bash
# Load RAPID_TOOLS env var with multi-fallback:
# 1. Already set in environment (e.g., from parent skill)
# 2. CLAUDE_SKILL_DIR-based .env (skill context)
# 3. Project root .env (agent context -- find .planning/ directory ancestor)
if [ -z "${RAPID_TOOLS:-}" ]; then
  # Try skill context first
  if [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then
    export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs)
  fi
  # Try project root (agent context -- look for .planning/ in ancestors)
  if [ -z "${RAPID_TOOLS:-}" ]; then
    _rapid_root=$(pwd)
    while [ "$_rapid_root" != "/" ]; do
      if [ -f "$_rapid_root/.env" ] && [ -d "$_rapid_root/.planning" ]; then
        export $(grep -v '^#' "$_rapid_root/.env" | xargs)
        break
      fi
      _rapid_root=$(dirname "$_rapid_root")
    done
    unset _rapid_root
  fi
fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## CLI Commands

**State read operations:**
- `node "${RAPID_TOOLS}" state get --all` -- Read the full STATE.json as formatted JSON
- `node "${RAPID_TOOLS}" state get milestone <id>` -- Read a specific milestone
- `node "${RAPID_TOOLS}" state get set <milestoneId> <setId>` -- Read a specific set
- `node "${RAPID_TOOLS}" state get wave <milestoneId> <setId> <waveId>` -- Read a specific wave
- `node "${RAPID_TOOLS}" state get job <milestoneId> <setId> <waveId> <jobId>` -- Read a specific job

**State transition operations:**
- `node "${RAPID_TOOLS}" state transition set <milestoneId> <setId> <status>` -- Transition set status
- `node "${RAPID_TOOLS}" state transition wave <milestoneId> <setId> <waveId> <status>` -- Transition wave status
- `node "${RAPID_TOOLS}" state transition job <milestoneId> <setId> <waveId> <jobId> <status>` -- Transition job status

**State integrity operations:**
- `node "${RAPID_TOOLS}" state detect-corruption` -- Check STATE.json integrity
- `node "${RAPID_TOOLS}" state recover` -- Recover STATE.json from last git commit

**Lock operations:**
- `node "${RAPID_TOOLS}" lock acquire <name>` -- Acquire a named lock
- `node "${RAPID_TOOLS}" lock status <name>` -- Check if a named lock is held

## Rules

- **Reads use `readState()` internally.** The CLI reads STATE.json, validates it against the Zod schema, and returns the validated JSON. If STATE.json is missing or invalid, the CLI exits with an error.
- **Writes use `transition*()` functions.** The transition commands acquire a lock, validate the state transition is allowed, update the status, derive parent statuses automatically, and write atomically. Invalid transitions are rejected.
- **Never write directly to `.planning/` files.** Always use the CLI tool. Direct writes bypass locking and can corrupt state when multiple agents are active.
- **Lock contention is normal.** If a write blocks on a lock, the CLI retries automatically with exponential backoff. Do not retry manually.
- **Hierarchy-aware reads.** Use `state get milestone/set/wave/job` to read specific entities rather than parsing the full state. This keeps context budgets low.
