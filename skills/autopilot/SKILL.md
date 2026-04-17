---
description: Backend-managed autopilot poller that claims kanban cards from autopilot-enabled columns and dispatches agent runs
allowed-tools: ""
args: []
categories: [autonomous]
---

# Autopilot

The autopilot is a backend-managed background worker, not a CLI-invoked skill. It runs as a lifespan-managed poller inside the RAPID web backend (`app/agents/autopilot_worker.py`).

## How It Works

- Polls autopilot-enabled columns for unclaimed kanban cards on a 60-second interval.
- Routes each card to the appropriate skill via label-based matching (`app/agents/card_routing.py`): `bug` maps to `bug-fix`, `feature` maps to `add-set`, `chore` maps to `quick`.
- Dispatches agent runs through `AgentSessionManager.start_run()` with atomic `lock_card` CAS to prevent double-claiming.
- Per-card retry limit: 3 attempts before the card is moved to the Blocked column.

## Commit Trailers

Every `git commit` produced during an autopilot-dispatched run automatically receives two trailers injected by the runtime:

- `Autopilot-Card-Id: <card_id>` -- links the commit to the originating kanban card
- `Autopilot-Run-Id: <run_id>` -- links the commit to the specific agent run

These trailers are injected by a PreToolUse hook (`inject_commit_trailers` in `app/agents/permission_hooks.py`) that detects simple `git commit` Bash commands and appends `--trailer` flags when the `card_id` and `run_id` ContextVars are bound.

## Important

This skill is **NOT** invoked via `/rapid:autopilot` in the CLI. It runs automatically when the web backend is running and columns have autopilot enabled via the kanban board UI.
