# Gaps: kanban-autopilot

## Gap 1: skills/autopilot/SKILL.md missing

**ROADMAP criterion:** "New `skills/autopilot/SKILL.md` that polls autopilot-flagged columns"

**Status:** Not implemented. The autopilot functionality is implemented as a backend lifespan-managed poller (`autopilot_worker.py`) rather than as a Claude Code CLI skill with a `SKILL.md` file. This is architecturally correct — the poller runs inside the web backend process, not as a Claude Code CLI skill invocation. The ROADMAP phrasing implied a CLI skill, but the backend-poller approach better matches the runtime requirements (always-on polling, FastAPI lifespan integration, in-process DB access).

**Severity:** Low — architectural decision rather than missing functionality. The polling behavior exists; only the skill file is absent.

**Resolution path:** Create a minimal `skills/autopilot/SKILL.md` as documentation/entry-point, or update ROADMAP to reflect the backend-poller architecture.

## Gap 2: Commit-trailer traceability (Autopilot-Card-Id:) missing

**ROADMAP criterion:** "Commit-trailer traceability (`Autopilot-Card-Id:`)"

**Status:** Not implemented. No commit-trailer injection logic exists. This was already flagged as MISSING in the VERIFICATION-REPORT.md during the planning phase — the wave plans never included tasks for this feature.

**Severity:** Medium — traceability feature that would link git commits to kanban cards for audit trail.

**Resolution path:** Implement via PreToolUse hook or system prompt injection that adds `Autopilot-Card-Id: {card_id}` and `Autopilot-Run-Id: {run_id}` trailers to git commit messages produced during autopilot runs.
