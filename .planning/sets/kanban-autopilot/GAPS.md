# Gaps: kanban-autopilot

## Gap 1: skills/autopilot/SKILL.md missing

**ROADMAP criterion:** "New `skills/autopilot/SKILL.md` that polls autopilot-flagged columns"

**Status:** Resolved. `skills/autopilot/SKILL.md` created (commit `6154360`) as a documentation entry-point with YAML frontmatter (`categories: [autonomous]`) that accurately describes the backend-poller architecture.

**Severity:** Low — architectural decision rather than missing functionality. The polling behavior exists; only the skill file was absent.

**Resolution path:** Create a minimal `skills/autopilot/SKILL.md` as documentation/entry-point, or update ROADMAP to reflect the backend-poller architecture.

## Gap 2: Commit-trailer traceability (Autopilot-Card-Id:) missing

**ROADMAP criterion:** "Commit-trailer traceability (`Autopilot-Card-Id:`)"

**Status:** Resolved. Full implementation chain: `card_id_var` ContextVar in `correlation.py` (commit `894b2f5`), session binding in `session_manager.py` (commit `b40cd85`), `inject_commit_trailers` PreToolUse hook in `permission_hooks.py` (commit `dd45f32`), registered in `sdk_options.py` (commit `10b81c4`). Tests in `test_correlation.py` (commit `c514320`) and `test_commit_trailers.py` (commit `8d3cb80`).

**Severity:** Medium — traceability feature that links git commits to kanban cards for audit trail.

**Resolution path:** Implement via PreToolUse hook or system prompt injection that adds `Autopilot-Card-Id: {card_id}` and `Autopilot-Run-Id: {run_id}` trailers to git commit messages produced during autopilot runs.
