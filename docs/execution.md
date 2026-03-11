# Execution

One skill handles all job execution across waves in a set, with three distinct modes of operation.

## `/rapid:execute <set-id> [--fix-issues] [--retry-wave <wave-id>]`

Dispatches parallel subagents (one `rapid-job-executor` per job) across all waves in a set. Waves process sequentially because later waves depend on earlier ones; jobs within a wave run in parallel because they touch different files.

**Normal execution** processes each wave in order: transitions the wave to executing, loads all JOB-PLAN.md files, dispatches one subagent per job that needs work, collects RAPID:RETURN results, reconciles deliverables (file delivery, commit format), runs a lean wave review for quick issue detection, and auto-advances to the next wave. PASS and PASS_WITH_WARNINGS reconciliation results advance automatically -- only FAIL retains a user prompt with retry or cancel options.

**Smart re-entry** makes execution crash-safe and idempotent. On every invocation, the skill reads STATE.json to classify each job: `complete` jobs are skipped, `failed` jobs are retried, stale `executing` jobs (from a crashed previous run) are re-dispatched, and `pending` jobs execute normally. Re-running `/rapid:execute` after an interruption picks up exactly where things left off.

**Dual-mode dispatch** supports both subagent spawning (proven stable, one Agent tool call per job) and agent teams (faster parallel execution via Claude Code agent teams, one team per wave). Mode is detected once at startup and locked for the entire run. If agent teams fail mid-wave, the entire wave automatically falls back to subagent mode with a visible warning.

**`--fix-issues` mode** loads all open review issues for the set (from the review pipeline), presents them for confirmation, then spawns `rapid-bugfix` agents to apply targeted fixes. Each fixed issue is committed atomically and its status updated.

**`--retry-wave <wave-id>` mode** targets a specific wave for retry. Verifies all predecessor waves are complete, then re-executes only the target wave (retrying failed/pending jobs, skipping complete ones). After the target wave completes, continues with subsequent waves using normal auto-advance behavior.

See [skills/execute/SKILL.md](../skills/execute/SKILL.md) for full step-by-step details.

---

Next: [Review](review.md)
