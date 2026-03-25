[DOCS.md](../DOCS.md) > Auxiliary Commands

# Auxiliary Commands

These commands handle specialized tasks that fall outside the core set lifecycle. They can be run independently at any point during a project.

---

## `/rapid:branding`

Conducts a structured branding interview to capture visual identity, component style, terminology, and interaction preferences. Detects the project type (webapp, CLI, library) to tailor the interview. Generates a `BRANDING.md` artifact that shapes how all RAPID agents communicate and style their output.

**When to use:** Before starting frontend-heavy sets, or when you want consistent UI/UX guidance across agent-generated code.

See [skills/branding/SKILL.md](../skills/branding/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:scaffold`

Generates project-type-aware foundation files for the target codebase. Detects the project type (Node.js, Python, Go, etc.) and scaffolds appropriate directory structure, config files, and boilerplate. Additive-only -- existing files are never overwritten.

**When to use:** At the start of a greenfield project, after `/rapid:init`, to generate the basic project structure before execution begins.

See [skills/scaffold/SKILL.md](../skills/scaffold/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:audit-version [version]`

Audits a completed milestone by cross-referencing planned requirements (ROADMAP.md, REQUIREMENTS.md, CONTRACT.json) against actual delivery (STATE.json set statuses, VERIFICATION-REPORT.md). Produces a structured gap report at `.planning/v{version}-AUDIT.md`. Strictly read-only -- never mutates state. Offers remediation through `/rapid:add-set` or deferral for the next version. Uses a two-pass strategy for milestones with 5+ sets.

**When to use:** After all sets in a milestone are merged, to verify complete delivery before moving to the next version.

See [skills/audit-version/SKILL.md](../skills/audit-version/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:migrate [--dry-run]`

Migrates `.planning/` state from older RAPID versions to the current version. Detects the current version, compares against the running RAPID version, and guides an interactive migration. Handles schema changes, status renames (e.g., `discussing` to `discussed`), and structural updates. The `--dry-run` flag previews changes without applying them.

**When to use:** After upgrading RAPID to a new major version, when existing projects need state file updates.

See [skills/migrate/SKILL.md](../skills/migrate/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:register-web`

Registers the current project with the RAPID Mission Control web dashboard. Requires `RAPID_WEB=true` in the environment. Only needed for projects initialized before v4.1.0 -- newer projects auto-register during `/rapid:init`.

**When to use:** When you want to add an older project to the web dashboard.

See [skills/register-web/SKILL.md](../skills/register-web/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:bug-fix <description>`

Investigates and fixes bugs described by the user. Dispatches agents to analyze the codebase, identify the root cause, and apply a targeted fix with atomic commits. Works from any branch or directory -- no set association required.

**When to use:** When you encounter a bug outside of the normal set lifecycle and want quick investigation and resolution.

See [skills/bug-fix/SKILL.md](../skills/bug-fix/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:quick <description>`

Runs ad-hoc changes without the full set structure. Uses a 3-agent pipeline (planner, plan-verifier, executor) in-place on the current branch. Fully autonomous after the initial task description. Quick tasks are stored in `.planning/quick/` and excluded from STATE.json.

**When to use:** For small, self-contained changes that do not warrant a full set lifecycle -- config tweaks, minor refactors, documentation fixes.

See [skills/quick/SKILL.md](../skills/quick/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:add-set <set-name>`

Adds a new set to the current milestone mid-stream through a lightweight interactive discovery flow. Creates DEFINITION.md and CONTRACT.json, updates STATE.json and ROADMAP.md. No subagent spawns. Suggests `/rapid:start-set` as the next action.

**When to use:** When scope expands after initial planning and a new workstream is needed.

See [skills/add-set/SKILL.md](../skills/add-set/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).

---

## `/rapid:documentation [--scope <full|changelog|api|architecture>] [--diff-only]`

Generates and updates project documentation from git history and RAPID artifacts. Supports scoped generation (full, changelog, API, architecture) and a `--diff-only` mode that shows what changed without generating files. Extracts changelogs from ROADMAP.md set descriptions.

**When to use:** After completing a milestone or significant set of changes, to keep project documentation up to date.

See [skills/documentation/SKILL.md](../skills/documentation/SKILL.md) for full details. Back to [DOCS.md](../DOCS.md).
