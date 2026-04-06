# Stack Research: backlog-system

## Core Stack Assessment

### Runtime Environment
- **Node.js:** >=22 (enforced in package.json `engines`)
- **Latest stable:** Node.js 24.x (as of April 2026)
- **Relevant features:** `node:test` built-in test runner, `node:fs` for file I/O, `node:path` for cross-platform path handling
- **No breaking changes impact:** The backlog-system set writes Markdown files and modifies existing SKILL.md files -- no runtime code changes that would encounter Node.js version concerns

### Module System
- **CommonJS throughout** -- all `.cjs` files use `'use strict'` preamble and `require()`
- **SKILL.md files are pure Markdown** -- no module system considerations for the core deliverable
- **Role prompt files (`role-executor.md`, `role-planner.md`) are Markdown** -- text edits only

### Package Manager
- **npm** (no lockfile detected -- project uses `package.json` directly)
- **No new dependencies needed** -- the backlog-system set creates a new skill and modifies existing Markdown files; all file I/O within skills uses the `Bash`, `Read`, `Write`, and `Glob` tools provided by the Claude Code harness

### Testing Framework
- **Built-in `node:test`** with `node:assert/strict`
- **Test runner:** `node --test 'src/**/*.test.cjs'`
- **Relevance to this set:** This set's deliverables are primarily SKILL.md files (interpreted by the Claude Code agent at runtime, not by Node.js). Unit testing applies only if any Node.js library code (e.g., a `backlog.cjs` module) is created for programmatic backlog I/O. Per the CONTEXT.md decisions, the skill file itself handles all logic -- no Node.js library module is scoped for v1.

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| zod | ^3.25.76 | 3.25.x | Active | Used for STATE.json schema validation; not involved in backlog-system |
| proper-lockfile | ^4.1.2 | 4.1.2 | Maintenance-only | File locking for state transactions; not needed for backlog writes |
| ajv | ^8.17.1 | 8.17.x | Active | JSON Schema validation; not used by this set |
| ajv-formats | ^3.0.1 | 3.0.x | Active | Format extensions for ajv; not used by this set |

**Assessment:** No dependency changes needed. The backlog-system set operates entirely at the SKILL.md and role-prompt level, using tools already provided by the Claude Code agent runtime (Bash, Read, Write, Glob, Grep, AskUserQuestion). No new npm packages are required.

## Compatibility Matrix

### Skill File Format Compatibility

The SKILL.md format follows a strict convention confirmed across all 28 existing skills:

1. **YAML frontmatter** with `description` and `allowed-tools` fields
2. **Markdown body** with numbered Steps (Step 0, Step 1, etc.)
3. **Environment preamble** in every Bash code block that calls `rapid-tools.cjs`
4. **AskUserQuestion** for interactive prompts with prefilled options

The new `skills/backlog/SKILL.md` must follow this exact pattern. Key observations:

- **`allowed-tools` determines capability.** The backlog skill needs `Bash(rapid-tools:*)`, `AskUserQuestion`, `Read`, `Write`, and `Glob` (for directory scanning). It does NOT need `Agent` (no subagent spawns) or `Grep`.
- **Directory auto-discovery.** Skills are auto-discovered from `skills/*/SKILL.md` paths -- placing a SKILL.md in `skills/backlog/` is sufficient for registration. No plugin.json or settings.json changes needed.
- **The `description` frontmatter** appears in the skill list shown by `/rapid:help` and in the system reminder's available skills list.

### Backlog File Format Compatibility

The CONTEXT.md decision specifies **Markdown with YAML frontmatter** for backlog items:

```markdown
---
title: Example idea title
created: 2026-04-06T12:00:00.000Z
---

Description of the idea goes here.
```

This format aligns with existing RAPID artifact conventions:
- **CONTEXT.md** uses XML-tagged sections within Markdown
- **DEFERRED.md** uses Markdown tables
- **DEFINITION.md** uses Markdown with structured sections
- **v{VERSION}-DEFERRED.md** uses Markdown tables with frontmatter-like headers

The YAML frontmatter + Markdown body pattern is human-readable and parseable via simple text processing (split on `---` markers, parse YAML block for metadata, remainder is body).

### Audit-Version Integration Compatibility

The audit-version SKILL.md currently has 5 steps (0-5). The backlog surfacing step should be inserted as a new step. Key constraints:

- **Step 3 (Generate Audit Report)** writes the audit report
- **Step 4 (Remediation and Deferral)** handles gap remediation with AskUserQuestion prompts
- **Step 5 (Completion Banner)** is the final output

The backlog surfacing step fits naturally as **Step 3.5** (between report generation and remediation) or as a new **Step 4 subsection** (Step 4f) at the end of remediation. Given that backlog items are conceptually separate from gap remediation, a dedicated step (inserted as Step 3.5 or renumbering Step 4 onward) is cleaner.

**Promotion flow compatibility:** When promoting a backlog item to a remediation set, the same `.planning/pending-sets/{name}.json` format is used. The `writeRemediationArtifact()` function from `src/lib/remediation.cjs` provides `{ setName, scope, files: [], deps: [], severity, source, createdAt }` -- reusable for backlog promotions. However, since the audit-version skill writes these artifacts directly in its SKILL.md (not via the library), the backlog promotion should follow the same inline Write tool pattern.

**Deferral flow compatibility:** When deferring a backlog item, content is appended to `v{VERSION}-DEFERRED.md` using the existing table format: `| # | Requirement | Original Severity | Reason for Deferral | Carry-Forward Context |`. Since backlog items have no severity field, the severity column should use a placeholder like "backlog" or "N/A".

### File Naming Convention

Backlog items need unique filenames to avoid merge conflicts across worktrees. The CONTEXT.md mentions "timestamp + slug" naming. Recommended format:

```
.planning/backlog/{YYYYMMDD-HHmmss}-{slug}.md
```

Where:
- Timestamp uses ISO-style compact format for sortability
- Slug is derived from the title (kebab-case, truncated to ~40 chars)
- Example: `.planning/backlog/20260406-143022-add-priority-field.md`

This pattern:
- Ensures uniqueness across concurrent worktree writes (timestamp granularity to seconds)
- Sorts chronologically when listed
- Is human-readable in directory listings
- Avoids conflicts during merge (different filenames from different worktrees)

### Cross-Worktree Behavior

Per CONTEXT.md: "Committed with set work -- backlog items are committed in the worktree and merge alongside set changes."

This means:
- Backlog items created in a worktree are `git add`-ed and committed alongside other set artifacts
- They merge to main when the set merges
- `.planning/backlog/` is NOT gitignored (confirmed: not present in `.gitignore` or `.planning/.gitignore`)
- The directory needs a `.gitkeep` or equivalent if the skill creates it lazily (mkdir -p in the skill)

**Risk:** If two worktrees create backlog items with identical filenames (same second, same slug), a merge conflict would occur. The timestamp-to-second granularity makes this extremely unlikely in practice.

## Upgrade Paths

No upgrades needed for this set. All work is at the Markdown/SKILL.md level with no runtime code dependencies beyond what the Claude Code agent already provides.

## Tooling Assessment

### Build Tools
- **No build step needed** -- SKILL.md files are directly consumed by the Claude Code agent
- **`build-agents` command:** Generates agent `.md` files from `src/modules/`. The `role-executor.md` and `role-planner.md` files modified by this set are in `src/modules/roles/`. After modifying these source files, `build-agents` must be run to regenerate the corresponding files in `agents/`. This is an important post-modification step.

### Test Framework
- **`node:test`** built-in -- available but likely unused for this set's primary deliverables (SKILL.md files cannot be unit-tested; they are Claude-interpreted Markdown)
- **Potential test surface:** If a `src/lib/backlog.cjs` module is created for reusable backlog I/O (read, list, write, delete operations used by audit-version), it should have a collocated `backlog.test.cjs`
- **CONTEXT.md decision says "No validation on write or read"** which suggests no library module is strictly needed for v1 -- the skill can use inline Bash commands for file creation

### Linting/Formatting
- **No linter configured** -- Markdown formatting follows existing conventions (2-space indentation in YAML, consistent heading levels)
- **SKILL.md convention:** All existing skills use consistent Step numbering, environment preamble patterns, and AskUserQuestion formatting

### CI/CD
- **No CI pipeline** -- testing is manual via `npm test`
- **No Markdown linting** in CI -- SKILL.md quality relies on pattern consistency

## Stack Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | `build-agents` regeneration required after role prompt changes | Medium -- forgetting to run it means agents use stale prompts | Add a verification step to the wave plan: after modifying `src/modules/roles/role-*.md`, run `node src/bin/rapid-tools.cjs build-agents` and commit regenerated files |
| 2 | YAML frontmatter parsing in audit-version integration | Low -- simple text-based parsing (split on `---` markers) could break on edge cases (description containing `---`) | Use greedy first-match for the second `---` delimiter; document the constraint that descriptions should not contain `---` on a line by itself |
| 3 | Audit-version step renumbering cascading complexity | Low -- inserting a new step requires renumbering subsequent steps | Keep existing steps intact by inserting as Step 3.5 or appending as Step 4f subsection rather than renumbering |
| 4 | `.planning/backlog/` directory not existing on first invocation | Low -- skill must create it lazily | Use `mkdir -p .planning/backlog` in the skill's write step; the directory is committed when the first item is added |
| 5 | Agent prompt bloat from adding backlog sections to role files | Low -- ~5-8 lines per file | Keep sections concise with a single example; validate line count after editing |
| 6 | Skill auto-discovery naming collision | Very low -- `skills/backlog/SKILL.md` maps to `/rapid:backlog` | Verify no existing skill uses the `backlog` name (confirmed: no collision among 28 existing skills) |

## Recommendations

| # | Action | Rationale | Priority |
|---|--------|-----------|----------|
| 1 | Create `skills/backlog/SKILL.md` following the exact YAML frontmatter + Step-based structure of existing skills | Core deliverable; must match established conventions for auto-discovery and agent compatibility | **critical** |
| 2 | Use `allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read, Write, Glob` in frontmatter | Matches the tool set needed: Bash for mkdir/git, AskUserQuestion for fallback prompts, Read for validation, Write for file creation, Glob for directory scanning | **critical** |
| 3 | Use `{YYYYMMDD-HHmmss}-{slug}.md` naming for backlog files | Ensures uniqueness across worktrees, chronological sorting, and human readability | **critical** |
| 4 | Insert audit-version backlog surfacing as a new Step 3.5 (or append as Step 4f) to minimize disruption to existing step numbering | Preserves existing step references in documentation and user muscle memory | **high** |
| 5 | Reuse the pending-sets JSON format (`{ setName, scope, files, deps, severity, source, createdAt }`) for backlog promotions via inline Write tool calls | Consistency with existing audit-version remediation flow; no new artifact format needed | **high** |
| 6 | Run `build-agents` after modifying `src/modules/roles/role-executor.md` and `role-planner.md` | Required to propagate changes to the generated agent files in `agents/` directory | **high** |
| 7 | Add backlog hint to discuss-set's Key Principles section (not Anti-Patterns) | Key Principles is the positive guidance section; Anti-Patterns is for "do not do" rules. Backlog usage is positive guidance. | **medium** |
| 8 | Use "N/A" for severity when deferring backlog items to `v{VERSION}-DEFERRED.md` | Backlog items have no severity field per CONTEXT.md; must fit the existing DEFERRED.md table schema | **medium** |
| 9 | No Node.js library module (`backlog.cjs`) needed for v1 | SKILL.md can handle file creation via Bash inline; audit-version can parse backlog files via Read + Glob tools. Library extraction is a future optimization if backlog management features are added. | **low** |
