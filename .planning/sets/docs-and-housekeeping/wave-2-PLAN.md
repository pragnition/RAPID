# Wave 2 Plan: Context File Regeneration

**Set:** docs-and-housekeeping
**Wave:** 2 of 2
**Depends on:** Wave 1 (version sweep and runtime dep pins must be landed first so the context files reference the correct numbers)

---

## Objective

Surgically patch the four `.planning/context/` files so they accurately describe the v6.2.0 codebase after the three feature sets (`branding-overhaul`, `init-branding-integration`, `update-reminder`) have merged. **No rewrites from scratch** — match the existing tone, section layout, and detail level of each file, and edit only the drifted portions.

The four files:
1. `.planning/context/CODEBASE.md` — file layout, tech stack, module inventory
2. `.planning/context/ARCHITECTURE.md` — layers, state, patterns, pipelines
3. `.planning/context/CONVENTIONS.md` — naming, structure, commit format, tests
4. `.planning/context/STYLE_GUIDE.md` — code style, formatting, git rules

Total patches are substantial in absolute terms because `CODEBASE.md` has severe drift. `ARCHITECTURE.md` needs moderate updates. `CONVENTIONS.md` and `STYLE_GUIDE.md` need only small fixes (Node engine, test file placement note).

---

## Why This Wave Exists (and Why It Runs After Wave 1)

Wave 1 changed version numbers and pinned deps. Wave 2 needs to reference `3.25.76` exactly (not `^3.25.76`) when documenting the Zod pin, so it MUST see Wave 1's edits first. Beyond that, context regeneration is the last work the set does before merge.

---

## Prerequisites — Context To Load Before Editing

Before touching any `.planning/context/` file, the executor MUST read or verify the following (use targeted reads, not full-file dumps):

| Evidence | Where | What to confirm |
|---|---|---|
| Lib module count | `ls src/lib/*.cjs \| grep -v '\.test\.cjs$' \| wc -l` | **41** (not 21) |
| Commands module count | `ls src/commands/*.cjs \| grep -v '\.test\.cjs$' \| wc -l` | **23** |
| Agents count | `ls agents/*.md \| wc -l` | **27** |
| Skills count | `ls skills/ \| wc -l` | **30** |
| Roles count | `ls src/modules/roles/*.md \| wc -l` | **28** |
| Core modules count | `ls src/modules/core/*.md \| wc -l` | **3** |
| CLI router size | `wc -l src/bin/rapid-tools.cjs` | **~402 lines** (not 3500) |
| Node engine | `node -e 'console.log(require("./package.json").engines)'` | `{ node: '>=22' }` |
| Branding server | `src/lib/branding-server.cjs` — read lines 1-60 | Exports HTTP + SSE server with `fs.watch` debouncing |
| Branding artifacts | `src/lib/branding-artifacts.cjs` — read lines 1-60 | Exports Zod-validated manifest CRUD at `.planning/branding/artifacts.json` |
| Version staleness | `src/lib/version.cjs` — read full (106 lines) | Exports `writeInstallTimestamp`, `readInstallTimestamp`, `isUpdateStale` + constants |
| Init branding step | `skills/init/SKILL.md` — confirm Step 4B.5 exists | "Optional Branding Step (Skip by Default)" around lines 442+ |
| Status banner hook | `skills/status/SKILL.md` — end of file | Invokes `display update-reminder` at end of flow |
| Install banner hook | `skills/install/SKILL.md` — end of file | Same pattern |

Do NOT assume any of these — they drive the concrete patches below.

---

## Task List

Tasks may be interleaved per-file if that yields smaller commits, but the suggested grouping is one commit per context file for clarity.

### Task 1 — Patch `.planning/context/CODEBASE.md`

**File:** `.planning/context/CODEBASE.md`

**Drift inventory (the exact lines to fix):**

#### 1a. Project Identity section
**Line 6** currently reads:
```
- 26 specialized agents, strict file ownership via git worktrees, 5-level conflict detection
```
Change to:
```
- 27 specialized agents, strict file ownership via git worktrees, 5-level conflict detection
```

#### 1b. Tech Stack section
**Line 12** currently reads:
```
- **Runtime:** Node.js 18+ (CommonJS throughout, `.cjs` extension)
```
Change to:
```
- **Runtime:** Node.js 22+ (CommonJS throughout, `.cjs` extension — `engines.node` is `">=22"`)
```

**Line 13** currently reads:
```
- **Validation:** Zod 3.25.76 (state schemas), Ajv 8.17.1 (contract JSON Schema)
```
Change to:
```
- **Validation:** Zod 3.25.76 (state schemas), Ajv 8.18.0 (contract JSON Schema) — both exact-pinned
```

**Line 14** currently reads:
```
- **Concurrency:** proper-lockfile 4.1.2 (file-based distributed locking)
```
Change to:
```
- **Concurrency:** proper-lockfile 4.1.2 (file-based distributed locking — exact-pinned)
```

(Rationale: adding "exact-pinned" makes the pin policy discoverable from the context file; no other edit to this section.)

#### 1c. Directory Layout tree
The current tree in CODEBASE.md lines 20-68 is wrong in several places. Apply these **surgical edits**:

**Replace the `src/bin/` line** (currently `src/bin/rapid-tools.cjs        # CLI backbone (~3500 lines, command router)`) with:
```
│   ├── bin/rapid-tools.cjs        # CLI router (~400 lines, dispatches to src/commands/)
│   ├── commands/                   # 23 command handler modules + co-located tests
│   │   ├── state.cjs               # state get/set/install-meta handlers
│   │   ├── plan.cjs                # plan create-set/decompose/list-sets/load-set
│   │   ├── execute.cjs             # execute prepare-context + branding integration
│   │   ├── merge.cjs               # merge dispatch handlers
│   │   ├── review.cjs              # review scoping and scope file generation
│   │   ├── display.cjs             # display render / update-reminder banner
│   │   ├── build-agents.cjs        # agent build from modules
│   │   └── ...                     # 16 more handler modules
```

**Replace the `src/lib/` block** (currently shows "21 core library modules" and lists 20 files). New block:
```
│   ├── lib/                        # 41 core library modules + co-located tests
│   │   ├── state-machine.cjs       # State CRUD, transactions, locking
│   │   ├── state-schemas.cjs       # Zod schemas (ProjectState hierarchy)
│   │   ├── state-transitions.cjs   # Valid status transition map
│   │   ├── worktree.cjs            # Git worktree lifecycle + registry
│   │   ├── plan.cjs                # Set/wave planning, definitions
│   │   ├── dag.cjs                 # Dependency graph (Kahn's toposort)
│   │   ├── contract.cjs            # Interface contracts (compile, validate)
│   │   ├── execute.cjs             # Execution context prep, prompt assembly
│   │   ├── merge.cjs               # 5-level detection, 4-tier resolution
│   │   ├── review.cjs              # Review scoping, issue management
│   │   ├── verify.cjs              # Artifact verification (light/heavy)
│   │   ├── returns.cjs             # RAPID:RETURN marker parser
│   │   ├── resolve.cjs             # Set/wave reference resolution
│   │   ├── lock.cjs                # File locking primitives
│   │   ├── core.cjs                # Utilities (output, error, findProjectRoot)
│   │   ├── init.cjs                # Project scaffolding
│   │   ├── context.cjs             # Language detection, project analysis
│   │   ├── display.cjs             # Branded formatting + update-reminder banner
│   │   ├── stub.cjs                # Contract stub generation
│   │   ├── tool-docs.cjs           # YAML tool documentation registry
│   │   ├── version.cjs             # Version read + install-staleness primitives
│   │   ├── branding-artifacts.cjs  # Branding manifest CRUD (Zod-validated)
│   │   ├── branding-server.cjs     # HTTP/SSE server for branding artifact reload
│   │   ├── memory.cjs              # Agent memory persistence
│   │   ├── migrate.cjs             # .planning/ schema migrations
│   │   ├── prereqs.cjs             # Prereq + version comparison
│   │   ├── principles.cjs          # Agent principles registry
│   │   ├── quality.cjs             # Code quality heuristics
│   │   ├── compaction.cjs          # Context compaction for large sets
│   │   ├── quick-log.cjs           # Ad-hoc quick-pipeline logging
│   │   ├── remediation.cjs         # Review finding remediation
│   │   ├── scaffold.cjs            # Project-type scaffolding
│   │   ├── ui-contract.cjs         # UI contract validation
│   │   ├── web-client.cjs          # Mission Control web dashboard client
│   │   ├── add-set.cjs             # Mid-milestone set insertion
│   │   ├── args.cjs                # CLI arg parsing
│   │   ├── docs.cjs                # Docs generation helpers
│   │   ├── errors.cjs              # Structured error types
│   │   ├── group.cjs               # Set grouping utilities
│   │   ├── hooks.cjs               # Hook lifecycle helpers
│   │   └── stdin.cjs               # Stdin handling for CLI handlers
```

**Replace the `src/modules/` block** (currently says "30 role-specific agent modules"):
```
│   ├── modules/
│   │   ├── core/                   # 3 shared prompt modules (identity, conventions, returns)
│   │   └── roles/                  # 28 role-specific agent modules (.md)
```

**Replace the `agents/` line** (currently says "26 generated agent definitions"):
```
├── agents/                         # 27 generated agent definitions (.md)
```

**Replace the `skills/` line** (currently says "24 skill command directories"):
```
├── skills/                         # 30 skill command directories (SKILL.md each)
```

**Add a new `.planning/branding/` entry to the `.planning/` subtree** (insert after the `worktrees/REGISTRY.json` line):
```
│   ├── branding/                   # Branding artifacts + server PID (gitignored)
│   │   ├── artifacts.json          # Manifest (Zod-validated CRUD)
│   │   └── .server.pid             # Branding server PID (local only)
```

**Add** a `.rapid-install-meta.json` entry to the top-level listing (near `config.json`):
```
├── .rapid-install-meta.json        # Install timestamp sidecar (gitignored)
```

#### 1d. Source Code Summary table
Replace the entire table (currently lines 72-82) with:

```markdown
| Category | Count | Location | Description |
|----------|-------|----------|-------------|
| Core Libraries | 41 | src/lib/*.cjs | State, contracts, worktrees, merge, branding, version, etc. |
| Library Tests | 41+ | src/lib/*.test.cjs | Co-located unit tests (some modules ship multiple test files) |
| CLI Router | 1 | src/bin/rapid-tools.cjs | Thin ~400-line command router |
| Command Handlers | 23 | src/commands/*.cjs | Dispatch targets for the CLI router |
| Command Tests | 10+ | src/commands/*.test.cjs | Co-located handler tests |
| Agent Roles | 28 | src/modules/roles/*.md | Specialized agent personas |
| Core Modules | 3 | src/modules/core/*.md | Identity, conventions, returns protocol |
| Generated Agents | 27 | agents/*.md | Built from role modules |
| Skills | 30 | skills/*/SKILL.md | User-facing command definitions |
| Documentation | 9+ | docs/*.md | User guides |
```

#### 1e. Key Entry Points section
Currently lines 83-88 list three entry points. Add a fourth bullet describing the new commands/ split:

Before:
```
- **CLI:** `node src/bin/rapid-tools.cjs <command> [subcommand] [args...]`
```
Change to:
```
- **CLI:** `node src/bin/rapid-tools.cjs <command> [subcommand] [args...]` — thin router (~400 lines) that dispatches to `src/commands/<command>.cjs` handler modules
```

(Leave the other bullets unchanged.)

#### 1f. Dependencies table
Replace the dependencies table (currently lines 90-99) with:

```markdown
## Dependencies (Production — all exact-pinned)

| Package | Version | Purpose |
|---------|---------|---------|
| ajv | 8.18.0 | JSON Schema validation for CONTRACT.json |
| ajv-formats | 3.0.1 | Additional format validators |
| zod | 3.25.76 | TypeScript-first schema validation for state |
| proper-lockfile | 4.1.2 | File-based locking for concurrent access |

No dev dependencies. Tests use Node.js built-in `node:test` module. The v6.2.0 pin policy is enforced by `src/lib/version.test.cjs` (`runtime dependency pins` describe block) -- any future `npm install` regression surfaces immediately.
```

**Verify CODEBASE.md after edits:**
```bash
grep -c '21 core library' .planning/context/CODEBASE.md  # 0
grep -c '41' .planning/context/CODEBASE.md              # >=3
grep -c 'src/commands' .planning/context/CODEBASE.md    # >=2
grep -c '30 skill' .planning/context/CODEBASE.md        # 1
grep -c '27 ' .planning/context/CODEBASE.md             # >=1 (agents count)
grep -c 'branding-artifacts' .planning/context/CODEBASE.md  # >=1
grep -c 'branding-server' .planning/context/CODEBASE.md     # >=1
grep -c 'version.cjs' .planning/context/CODEBASE.md         # >=1
grep -c 'Node.js 18' .planning/context/CODEBASE.md      # 0 (should be bumped to 22)
grep -c '\^' .planning/context/CODEBASE.md              # 0 in dependency table rows
```

**Commit:** `docs(docs-and-housekeeping): refresh CODEBASE.md for v6.2.0 (modules, deps, commands split)`

---

### Task 2 — Patch `.planning/context/ARCHITECTURE.md`

**File:** `.planning/context/ARCHITECTURE.md`

**Drift inventory:**

#### 2a. Five-layer ASCII diagram
The current diagram (lines 8-30) says:
- `24 skills (SKILL.md)` → change to `30 skills (SKILL.md)`
- `26 agents (.md)` → change to `27 agents (.md)`
- `21 modules (src/lib/)` → change to `41 modules (src/lib/)`
- Add a CLI LAYER description update: current says `rapid-tools.cjs — command router + handlers`. Change to:
  ```
  │  rapid-tools.cjs — thin router (~400 lines)             │
  │  src/commands/ — 23 handler modules                     │
  ```

Preserve the box-drawing characters exactly (`┌`, `─`, `│`, `└`, `├`, `┤`). Do NOT re-flow the diagram — just swap the number tokens and add the handler-modules line inside the CLI LAYER box. Use the `Edit` tool with targeted `old_string`/`new_string` matching each individual number.

**CAUTION:** If the character count of a replacement line changes, the right-edge `│` character will desync. After editing, use `cat` to visually confirm alignment. If alignment breaks, pad with spaces inside the box before the `│` border.

#### 2b. Agent Build Pipeline section
**Line ~115** reads:
```
src/modules/roles/*.md   ← 30 role-specific instructions
        ↓ build-agents
agents/*.md              ← 26 assembled agent definitions
```
Change to:
```
src/modules/roles/*.md   ← 28 role-specific instructions
        ↓ build-agents
agents/*.md              ← 27 assembled agent definitions
```

#### 2c. Agent Categories table
Verify the category row counts still sum to 27 (currently described as 26 total). The table at roughly lines 119-127 should remain structurally the same. **Concretely**:
- If the table says something like "| Core | planner, executor, merger, reviewer |" (4 agents) and the totals imply 26, update totals to imply 27. The extra agent is the `rapid-branding` or equivalent agent produced by the branding-overhaul set — verify by listing `agents/rapid-*.md` and cross-referencing against the table categories. Place the new agent in the most natural category (likely "Utility" or "Core").

If the table doesn't have explicit totals but only lists agents by name, add the missing agent to the correct category row. Do NOT invent categories — reuse existing ones.

#### 2d. Command Flow: `/rapid:execute-set set-01` section (lines ~181-191)
The current flow lists CLI as `rapid-tools.cjs execute prepare-context` and then `execute.cjs`. This is correct at a high level but misses the new router/handler split. Replace the numbered steps with:

```
1. Skill (skills/execute-set/SKILL.md) → orchestrates
2. CLI router (src/bin/rapid-tools.cjs) → dispatches to handler
3. Handler (src/commands/execute.cjs) → parses args, calls library
4. Library (src/lib/execute.cjs) → prepares context, loads contracts
5. worktree.cjs → generates scoped CLAUDE.md
6. Agent (rapid-executor) → implements in worktree
7. returns.cjs → parses RAPID:RETURN
8. state-machine.cjs → transitions set to 'complete'
```

(Note: steps increment by one because we split the old step 2 into router + handler.)

#### 2e. Add a new subsection after "Core Patterns" or before "Merge Pipeline" called "v6.2.0 Subsystems"

Insert this block between the end of "Core Patterns" and the start of "Agent Architecture":

```markdown
## v6.2.0 Subsystems

Three subsystems landed in v6.2.0. Each is isolated from the core state machine and loads lazily at invocation time.

### Branding Server (src/lib/branding-server.cjs)
- HTTP + SSE server bound to port 3141 by default
- Watches `.planning/branding/artifacts.json` via `fs.watch` with 300ms debounce (`DEBOUNCE_MS`)
- Pushes change events to connected SSE clients (capped at `MAX_SSE_CLIENTS=10`)
- PID file at `.planning/branding/.server.pid` (ignored by git); 1-second health-probe timeout
- Manifest CRUD lives in `src/lib/branding-artifacts.cjs` with a Zod `ManifestSchema`

### Install Staleness Reminder (src/lib/version.cjs + src/lib/display.cjs)
- `writeInstallTimestamp(pluginRoot)` writes `{ installedAt: <ISO 8601> }` to `.rapid-install-meta.json` at plugin root (gitignored sidecar)
- `isUpdateStale(pluginRoot, thresholdDays?)` returns true if the recorded install is older than the threshold (default 7 days, configurable via `RAPID_UPDATE_THRESHOLD_DAYS` env var)
- `renderUpdateReminder(pluginRoot)` in `display.cjs` is the gated banner entry point — gate order: TTY → `NO_UPDATE_NOTIFIER` env var (any non-empty value suppresses) → `readInstallTimestamp` → `isUpdateStale` → `NO_COLOR`
- Wired into skill output end-of-flow for `/rapid:install` and `/rapid:status` via the CLI `display update-reminder` subcommand

### Init Branding Integration (skills/init/SKILL.md)
- Step 4B.5 "Optional Branding Step (Skip by Default)" — runs only when the user opts in during `/rapid:init`
- Project-type aware: offers different defaults for web / CLI / library projects
- Always skippable — no branding is created unless the user confirms
```

**Verify ARCHITECTURE.md after edits:**
```bash
grep -c '30 skills' .planning/context/ARCHITECTURE.md             # >=1
grep -c '27 agents' .planning/context/ARCHITECTURE.md             # >=1
grep -c '41 modules' .planning/context/ARCHITECTURE.md            # >=1
grep -c 'src/commands' .planning/context/ARCHITECTURE.md          # >=2
grep -c 'v6.2.0 Subsystems' .planning/context/ARCHITECTURE.md     # 1
grep -c 'Branding Server' .planning/context/ARCHITECTURE.md       # >=1
grep -c 'NO_UPDATE_NOTIFIER' .planning/context/ARCHITECTURE.md    # >=1
grep -c 'Step 4B.5' .planning/context/ARCHITECTURE.md             # >=1
```

**Commit:** `docs(docs-and-housekeeping): refresh ARCHITECTURE.md for v6.2.0 subsystems`

---

### Task 3 — Patch `.planning/context/CONVENTIONS.md`

**File:** `.planning/context/CONVENTIONS.md`

**Drift inventory:**

#### 3a. No structural changes — this file is mostly still accurate. Apply only these targeted patches:

**File Naming section** (around lines 4-14): **no change** — current layout still accurate.

**Module Structure section** (around lines 26-60): currently says:
```
Every library module in `src/lib/` follows this pattern:
```
Update to:
```
Every library module in `src/lib/` and every command handler in `src/commands/` follows this pattern:
```

Everything else in the code block below is unchanged.

**Testing Conventions section** (around lines 94-118): add a new bullet at the end of the bullet list (currently ends with "Clean up temp files/dirs in `afterEach`"):

```
- Tests live next to the module they cover (`src/lib/{module}.test.cjs`, `src/commands/{module}.test.cjs`)
- The `package.json` test script only runs `src/**/*.test.cjs` — **do NOT add tests under `tests/`** for new work (the `tests/` directory contains legacy suites like `tests/ux-audit.test.cjs` but is not on the default test path)
```

#### 3b. Commit Messages section (around lines 61-77)
No change required — the conventional-commit format is still current. Skip this section.

**Verify CONVENTIONS.md after edits:**
```bash
grep -c 'src/commands' .planning/context/CONVENTIONS.md       # >=1
grep -c 'do NOT add tests under' .planning/context/CONVENTIONS.md  # 1
```

**Commit:** `docs(docs-and-housekeeping): note commands/ and test-placement in CONVENTIONS.md`

---

### Task 4 — Patch `.planning/context/STYLE_GUIDE.md`

**File:** `.planning/context/STYLE_GUIDE.md`

**Drift inventory:**

#### 4a. Language & Runtime section
**Line 6** currently reads:
```
- **Node.js 18+** — leverages built-in `node:test`, `node:assert`, `node:fs`, `node:path`
```
Change to:
```
- **Node.js 22+** — leverages built-in `node:test`, `node:assert`, `node:fs`, `node:path` (engines.node = `">=22"`)
```

#### 4b. File Organization / Source Layout block
The current layout block (lines 67-73) reads:
```
src/lib/{module}.cjs         — library module (public API)
src/lib/{module}.test.cjs    — co-located tests
src/bin/rapid-tools.cjs      — CLI entry point
src/modules/core/*.md        — shared agent prompt modules
src/modules/roles/*.md       — role-specific agent prompts
```

Update to:
```
src/lib/{module}.cjs             — library module (public API)
src/lib/{module}.test.cjs        — co-located tests
src/bin/rapid-tools.cjs          — CLI router (~400 lines)
src/commands/{command}.cjs       — CLI handler modules (23)
src/commands/{command}.test.cjs  — co-located handler tests
src/modules/core/*.md            — shared agent prompt modules
src/modules/roles/*.md           — role-specific agent prompts
```

(Preserve the two-column alignment — use whatever padding keeps it readable.)

#### 4c. Testing Style section (around lines 142-149)
Add a new final bullet:
```
- New tests MUST live under `src/**` so `npm test`'s `'src/**/*.test.cjs'` glob picks them up
```

**Verify STYLE_GUIDE.md after edits:**
```bash
grep -c 'Node.js 18' .planning/context/STYLE_GUIDE.md     # 0
grep -c 'Node.js 22' .planning/context/STYLE_GUIDE.md     # >=1
grep -c 'src/commands' .planning/context/STYLE_GUIDE.md   # >=1
```

**Commit:** `docs(docs-and-housekeeping): update STYLE_GUIDE.md Node engine and src/commands layout`

---

### Task 5 — Final context verification gate

**No file edits — verification only.**

Run these commands from the repo root. All must exit 0.

```bash
# Gate 1: no stale module counts
grep -rn '21 core library' .planning/context/   # 0
grep -rn '26 agents'       .planning/context/   # 0
grep -rn '24 skills'       .planning/context/   # 0
grep -rn '3500 lines'      .planning/context/   # 0
grep -rn '~3500'           .planning/context/   # 0
grep -rn 'Node.js 18'      .planning/context/   # 0

# Gate 2: new content is present everywhere it should be
grep -l 'src/commands'     .planning/context/{CODEBASE,ARCHITECTURE,CONVENTIONS,STYLE_GUIDE}.md | wc -l  # == 4
grep -l 'branding'         .planning/context/{CODEBASE,ARCHITECTURE}.md | wc -l                          # == 2
grep -l '30 skills\|30 skill' .planning/context/{CODEBASE,ARCHITECTURE}.md | wc -l                       # == 2
grep -l '27 agents\|27 generated\|27 specialized' .planning/context/{CODEBASE,ARCHITECTURE}.md | wc -l   # == 2

# Gate 3: Wave 1's no-stale-versions test still passes against context files
node --test src/lib/housekeeping.test.cjs

# Gate 4: full test suite
npm test

# Gate 5: the sweep invariants from Wave 1 still hold
git grep -n 'v6\.1\.0' -- \
  ':!.planning/archive' \
  ':!.archive' \
  ':!node_modules' \
  ':!ROADMAP.md' \
  ':!docs/CHANGELOG.md' \
  ':!.planning/v6.1.0-AUDIT.md' \
  ':!.planning/v6.1.0-UX-AUDIT.md' \
  ':!tests/ux-audit.test.cjs' \
  ':!.planning/sets/docs-and-housekeeping' \
  ':!.planning/STATE.json' \
  ':!src/lib/housekeeping.test.cjs' \
  && { echo 'FAIL: sweep regression'; exit 1; } || echo 'OK'
```

If any gate fails, do NOT report COMPLETE — fix the leak and re-run all gates.

**No commit.** Gate only.

---

## Success Criteria (Wave 2)

- [ ] `CODEBASE.md` shows 41 lib modules, 23 commands, 27 agents, 30 skills, Node 22+, exact-pinned deps table
- [ ] `CODEBASE.md` mentions `src/commands/`, `branding-artifacts.cjs`, `branding-server.cjs`, `version.cjs` staleness primitives, `.rapid-install-meta.json`, `.planning/branding/`
- [ ] `ARCHITECTURE.md` diagram shows `30 skills`, `27 agents`, `41 modules`, and the router/handler split in the CLI LAYER box
- [ ] `ARCHITECTURE.md` has the new "v6.2.0 Subsystems" section covering branding server, install staleness reminder, and init branding integration
- [ ] `ARCHITECTURE.md` command flow includes both the CLI router and the `src/commands/` handler as distinct steps
- [ ] `CONVENTIONS.md` notes that the module structure pattern applies to both `src/lib/` and `src/commands/`
- [ ] `CONVENTIONS.md` warns against adding tests under `tests/` (use `src/**` instead)
- [ ] `STYLE_GUIDE.md` says Node 22+, not 18+
- [ ] `STYLE_GUIDE.md` source layout lists `src/commands/`
- [ ] `npm test` passes
- [ ] All gate commands in Task 5 pass

---

## File Ownership (Wave 2 only)

Exclusive — no overlap with Wave 1.

- `.planning/context/CODEBASE.md`
- `.planning/context/ARCHITECTURE.md`
- `.planning/context/CONVENTIONS.md`
- `.planning/context/STYLE_GUIDE.md`

Four files. No other file is touched by Wave 2.

---

## Expected Commits (Wave 2)

1. `docs(docs-and-housekeeping): refresh CODEBASE.md for v6.2.0 (modules, deps, commands split)`
2. `docs(docs-and-housekeeping): refresh ARCHITECTURE.md for v6.2.0 subsystems`
3. `docs(docs-and-housekeeping): note commands/ and test-placement in CONVENTIONS.md`
4. `docs(docs-and-housekeeping): update STYLE_GUIDE.md Node engine and src/commands layout`

4 commits. Task 5 (verification gate) produces no commit.

---

## Notes for the Executor

- **Surgical not-rewrites.** The existing files have hand-tuned phrasing. Use the `Edit` tool with focused `old_string`/`new_string` pairs. Do NOT regenerate a file from scratch — even if it would be faster.
- **Match prose tone.** The existing files use sentence case, hyphens-as-em-dashes, and a flat declarative voice. Keep that register. Do not add headers, emojis, or marketing phrasing.
- **If a patch would exceed ~20 lines of contiguous change,** pause and decide: is this truly surgical, or am I rewriting? If rewriting, split it into multiple smaller `Edit` calls.
- **The ASCII diagram in ARCHITECTURE.md is fragile.** Count characters. The right-edge `│` must stay at the same column across every line of the diagram.
- **The module table in CODEBASE.md requires fresh inspection.** Don't trust the counts above blindly — re-run the counting commands in the Prerequisites section before writing numbers into the table.
