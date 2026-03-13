# Phase 19: Set Lifecycle - Research

**Researched:** 2026-03-06
**Domain:** CLI commands, git worktree management, state machine orchestration, SKILL.md authoring
**Confidence:** HIGH

## Summary

Phase 19 delivers five slash commands (/set-init, /status, /pause, /resume, /cleanup) that manage the full lifecycle of isolated development sets. The domain is internal to RAPID -- no external libraries are needed. All required infrastructure exists: worktree.cjs handles git worktree CRUD, state-machine.cjs manages hierarchical state, state-transitions.cjs enforces valid transitions, execute.cjs provides handoff generation/parsing, and assembler.cjs handles agent prompt assembly.

The primary challenge is **coordination between two state stores**: the worktree REGISTRY.json (v1.0 legacy, used by current skills) and STATE.json (v2.0 hierarchical state machine). The CONTEXT.md decisions indicate /status should read from STATE.json, but existing CLI commands still write to REGISTRY.json. This phase must bridge both or fully migrate status reads to STATE.json while keeping REGISTRY.json for worktree path tracking.

**Primary recommendation:** Build each command as a SKILL.md + CLI subcommand pair, following the established pattern. Rewrite /status to read from STATE.json for hierarchy data (set > wave > job) while still using REGISTRY.json for worktree path/branch info. Add `set-init` and `resume` as new CLI subcommands in rapid-tools.cjs. Create a new `role-set-planner.md` agent role for SET-OVERVIEW.md generation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- /set-init is a manual per-set command: dev runs `/set-init <set-name>` explicitly to claim and prepare a set
- /set-init does NOT transition the set to 'planning' -- set stays 'pending' until /discuss explicitly transitions it
- /set-init creates the git worktree, generates scoped CLAUDE.md, and runs the set planner
- Set planner produces a high-level SET-OVERVIEW.md (1-page: approach summary, key files, risks) -- detailed wave/job planning deferred to /discuss + /plan (Phase 20)
- Scoped CLAUDE.md is self-contained: this set's CONTRACT.json + project style guide + explicit "DO NOT TOUCH" deny list for other sets' files
- Scoped CLAUDE.md replaces project CLAUDE.md entirely in the worktree -- no reference back to full project context
- Deny list derived from OWNERSHIP.json (carries forward Phase 5 decision)
- Generated during /set-init (carries forward Phase 5 timing decision -- before execution starts)
- Status dashboard: set rows + compact wave progress summary per set (e.g., "Wave 1: 3/5 jobs done"). Jobs not listed individually
- Format: ASCII table (docker ps / kubectl style) -- compact, scannable columns
- After displaying dashboard, present actionable next steps via AskUserQuestion based on current state
- Reads from STATE.json for all hierarchy data
- /pause is per-set only -- pauses the entire set, not individual waves
- Handoff file (HANDOFF.md) captures: current wave/job status snapshot, last completed action, user-provided notes
- /resume is a separate dedicated command (`/resume <set-name>`), not a subcommand of /execute
- Resume reads HANDOFF.md + STATE.json to restore context and pick up from last completed wave/job
- Auto-prompt after merge: after a successful /merge, automatically ask "Clean up worktree for set X?"
- /cleanup also available as standalone manual command
- After removing worktree directory, offer branch deletion via AskUserQuestion: "Also delete branch rapid/<set>?"
- Block cleanup if uncommitted changes exist -- show specific fix commands (git stash, git commit)
- Worktree directory removed, branch deletion is optional (user chooses per cleanup)

### Claude's Discretion
- SET-OVERVIEW.md template structure and level of detail
- Exact ASCII table column widths and formatting
- How /resume detects and loads the handoff file
- Internal state tracking for worktree registry updates
- Error messages and edge case handling (branch already exists, worktree conflicts)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETL-01 | /set-init creates git worktree and branch for a specified set | Existing `createWorktree()` in worktree.cjs + `worktree create` CLI command. Need new `set-init` CLI subcommand that orchestrates worktree creation + scoped CLAUDE.md + set planner. |
| SETL-02 | /set-init generates scoped CLAUDE.md per worktree with relevant contracts and context | Existing `generateScopedClaudeMd()` in worktree.cjs already handles contract + ownership + deny list + style guide. Needs to be written to worktree path. `worktree generate-claude-md` CLI command exists. |
| SETL-03 | Set planner runs during /set-init producing high-level set overview | New agent role `role-set-planner.md` needed. Assembler.cjs supports prompt assembly. Agent tool spawns subagent with set context. Produces SET-OVERVIEW.md. |
| SETL-04 | /status displays cross-set dashboard with set > wave > job hierarchy | Rewrite status SKILL.md. STATE.json provides hierarchical data (milestones > sets > waves > jobs). Format as ASCII table with wave progress per set. |
| SETL-05 | /pause saves per-set state with handoff file for later resumption | Existing `generateHandoff()` and `execute pause` CLI command. Rewrite pause SKILL.md for Mark II (per-set, reads STATE.json for wave/job snapshot). |
| SETL-06 | /cleanup removes completed set worktrees with safety checks | Existing `removeWorktree()` and `worktree cleanup` CLI command. Rewrite cleanup SKILL.md to add branch deletion option via AskUserQuestion. |
| SETL-07 | /context generates CLAUDE.md and project context files | Context skill already exists and works. May need minor updates to align with Mark II scoped CLAUDE.md pattern. |
| UX-01 | AskUserQuestion used at every decision gate, queries batched to save tokens/time | Pattern already established across all v1.1 skills. Apply consistently in all new/rewritten skills. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Test framework | Already used in all existing test files |
| node:assert/strict | built-in | Assertions | Already used in all existing test files |
| zod | 3.24.4 | State schema validation | Locked per Phase 16 decision for CJS compat |
| proper-lockfile | 4.1.2 | Lock-protected writes | Already in dependencies, used by lock.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.17.1 | Contract JSON schema validation | Already in deps, used by contract.cjs |

### Alternatives Considered
None -- this phase uses only existing project dependencies. No new external libraries needed.

## Architecture Patterns

### Recommended Project Structure
```
skills/
  set-init/SKILL.md       # NEW: /set-init command
  resume/SKILL.md          # NEW: /resume command
  status/SKILL.md          # REWRITE: Mark II hierarchy dashboard
  pause/SKILL.md           # REWRITE: per-set handoff with STATE.json
  cleanup/SKILL.md         # REWRITE: branch deletion + auto-prompt
src/
  bin/rapid-tools.cjs      # EXTEND: set-init and resume subcommands
  lib/worktree.cjs         # EXTEND: set-init orchestration, status from STATE.json
  lib/worktree.test.cjs    # EXTEND: tests for new functions
  modules/roles/
    role-set-planner.md    # NEW: agent role for SET-OVERVIEW.md
```

### Pattern 1: SKILL.md + CLI Subcommand
**What:** Each slash command is a SKILL.md (user-facing instructions) paired with CLI subcommands in rapid-tools.cjs (backend logic). The SKILL.md calls CLI via `node "${RAPID_TOOLS}" <command> <subcommand>` and parses JSON stdout.
**When to use:** Every command in this phase.
**Example:**
```bash
# SKILL.md calls CLI for data
node "${RAPID_TOOLS}" set-init create <set-name>
# CLI returns structured JSON on stdout
{"created": true, "branch": "rapid/auth", "worktreePath": ".rapid-worktrees/auth", ...}
```

### Pattern 2: Dual State Store Bridge
**What:** STATE.json holds the hierarchical state (project > milestone > set > wave > job with validated transitions). REGISTRY.json holds worktree metadata (paths, branches, git state). The /status command reads from STATE.json for hierarchy and from REGISTRY.json for worktree paths.
**When to use:** Any command that needs both hierarchy position and worktree filesystem info.
**Key functions:**
- `readState(cwd)` from state-machine.cjs -- reads STATE.json with Zod validation
- `loadRegistry(cwd)` from worktree.cjs -- reads REGISTRY.json
- `findSet(state, milestoneId, setId)` -- navigates hierarchy

### Pattern 3: AskUserQuestion at Decision Gates
**What:** Every point where user input is needed uses the AskUserQuestion tool with structured options. Never use freeform text prompts for decisions with known choices.
**When to use:** All decision points: set selection, cleanup confirmation, branch deletion, pause notes, next actions.
**Established pattern from v1.1:**
```
Use AskUserQuestion with:
- question: "Select set to initialize"
- options: One option per pending set from STATE.json
  - name: set id
  - description: set purpose/scope summary
```

### Pattern 4: Lock-Protected Atomic Writes
**What:** All state mutations go through lock-protected functions that validate-before-write and use atomic rename.
**When to use:** Any write to STATE.json or REGISTRY.json.
**Key functions:**
- `writeState(cwd, state)` -- validates via Zod, acquires lock, writes to tmp then renames
- `registryUpdate(cwd, updateFn)` -- acquires lock, applies update function, writes
- `transitionSet(cwd, milestoneId, setId, newStatus)` -- validates transition, acquires lock, writes

### Pattern 5: .env Fallback Loading
**What:** Every SKILL.md starts with environment loading that falls back to .env file.
**When to use:** All skills (per global CLAUDE.md instruction).
**Template:**
```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### Anti-Patterns to Avoid
- **Writing to STATE.json without lock:** Always use `writeState()` or `transitionSet()` -- never write directly
- **Skipping Zod validation:** `ProjectState.parse()` must run before every write
- **Using `$HOME` in shell commands:** Use `~` instead (per CLAUDE.md instruction)
- **Mixing REGISTRY.json and STATE.json writes for the same field:** Pick one canonical store per field
- **Creating worktree without registering it:** Always update REGISTRY.json after `git worktree add`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git worktree creation | Raw `git worktree add` calls | `worktree.createWorktree(cwd, setName)` | Handles branch naming, path resolution, error detection |
| Git worktree removal | Raw `git worktree remove` | `worktree.removeWorktree(cwd, wtPath)` | Returns structured result with dirty detection |
| State transitions | Direct JSON manipulation | `transitionSet()` / `transitionWave()` | Validates transitions, acquires locks, derives parent status |
| Scoped CLAUDE.md | Manual markdown assembly | `worktree.generateScopedClaudeMd(cwd, setName)` | Handles contract, ownership, deny list, style guide |
| Handoff file generation | Manual HANDOFF.md writing | `execute.generateHandoff(data, setName, cycle)` | Structured frontmatter + sections |
| Handoff file parsing | Manual markdown parsing | `execute.parseHandoff(content)` | Extracts frontmatter + section content |
| Lock-protected writes | Manual lockfile management | `acquireLock(cwd, name)` from lock.cjs | Handles stale lock detection, cleanup |
| Agent prompt assembly | Manual string concatenation | `assembleAgent()` from assembler.cjs | Handles frontmatter, modules, context injection, size warning |
| Registry updates | Direct JSON file writes | `registryUpdate(cwd, updateFn)` | Lock-protected, atomic |

**Key insight:** Nearly all infrastructure for this phase already exists. The work is composing existing primitives into new commands, not building new primitives.

## Common Pitfalls

### Pitfall 1: Set State Not Transitioning Correctly
**What goes wrong:** /set-init transitions set to 'planning' when CONTEXT.md says it should stay 'pending'
**Why it happens:** Natural assumption that creating a worktree means work has started
**How to avoid:** CONTEXT.md explicitly states: "/set-init does NOT transition the set to 'planning' -- set stays 'pending' until /discuss explicitly transitions it". The worktree creation is preparation, not execution start.
**Warning signs:** Tests that assert set status is 'planning' after /set-init

### Pitfall 2: Branch Already Exists
**What goes wrong:** `git worktree add -b rapid/setname` fails because branch already exists from a previous run
**Why it happens:** Cleanup removed worktree directory but user chose not to delete branch
**How to avoid:** Check for existing branch before creating worktree. Offer recovery options: use existing branch, force delete and recreate, or abort. The existing `createWorktree()` already throws with "already exists" message.
**Warning signs:** Unhandled error from `createWorktree()`

### Pitfall 3: REGISTRY.json and STATE.json Divergence
**What goes wrong:** STATUS command shows inconsistent data because REGISTRY.json says one thing and STATE.json says another
**Why it happens:** Two independent state stores updated at different times
**How to avoid:** Clearly define which store is authoritative for which data: STATE.json owns set/wave/job status, REGISTRY.json owns worktree path/branch/git state. Status command reads from both and merges.
**Warning signs:** Dashboard shows a set as "executing" but worktree is missing

### Pitfall 4: Cleanup Without Checking Uncommitted Changes
**What goes wrong:** `git worktree remove` fails unexpectedly on dirty worktree
**Why it happens:** The existing `removeWorktree()` returns `{removed: false, reason: 'dirty'}` but caller doesn't handle it
**How to avoid:** Already handled in existing cleanup SKILL.md pattern. The rewrite must preserve the dirty-check flow with AskUserQuestion for commit/stash/force/cancel options.
**Warning signs:** Error output instead of recovery prompt

### Pitfall 5: Set Planner Subagent Timeout
**What goes wrong:** Agent tool call for set planner takes too long or fails silently
**Why it happens:** Large codebases with many files in the set scope
**How to avoid:** Keep SET-OVERVIEW.md lightweight (1-page). The set planner should receive only the set's CONTRACT.json, DEFINITION.md, and OWNERSHIP.json -- not the full codebase. Set a clear scope boundary in the role module.
**Warning signs:** /set-init hanging during "Generating set overview..."

### Pitfall 6: Resume Without Valid HANDOFF.md
**What goes wrong:** /resume called but HANDOFF.md is missing or corrupted
**Why it happens:** Manual file deletion, or pause completed without writing handoff
**How to avoid:** The existing `execute resume` CLI command already validates HANDOFF.md exists. The new /resume SKILL.md should also check STATE.json for the set's current status before attempting resume. If set is not paused, inform the user.
**Warning signs:** Cryptic parse errors from `parseHandoff()`

## Code Examples

### Creating a worktree and registering it (existing pattern)
```javascript
// Source: src/bin/rapid-tools.cjs lines 834-860
const { branch, path: wtPath } = wt.createWorktree(cwd, setName);
await wt.registryUpdate(cwd, (reg) => {
  reg.worktrees[setName] = {
    setName,
    branch,
    path: path.relative(cwd, wtPath),
    phase: 'Created',
    status: 'active',
    wave: null,
    createdAt: new Date().toISOString(),
  };
  return reg;
});
```

### Generating scoped CLAUDE.md (existing pattern)
```javascript
// Source: src/lib/worktree.cjs lines 469-564
const md = wt.generateScopedClaudeMd(cwd, setName);
const wtClaudeMdPath = path.join(path.resolve(cwd, entry.path), 'CLAUDE.md');
fs.writeFileSync(wtClaudeMdPath, md, 'utf-8');
```

### Reading STATE.json hierarchy (existing pattern)
```javascript
// Source: src/lib/state-machine.cjs
const result = await readState(cwd);
if (!result || !result.valid) throw new Error('STATE.json missing or invalid');
const state = result.state;
const milestone = findMilestone(state, state.currentMilestone);
// milestone.sets[] contains SetState objects with .waves[].jobs[]
```

### State transition validation (existing pattern)
```javascript
// Source: src/lib/state-transitions.cjs
// Set: pending > planning > executing > reviewing > merging > complete
// Wave: pending > discussing > planning > executing > reconciling > complete (+ failed > executing)
// Job: pending > executing > complete/failed (+ failed > executing)
```

### HANDOFF.md generation (existing pattern)
```javascript
// Source: src/lib/execute.cjs lines 316-347
const handoffContent = execute.generateHandoff(checkpointData, setName, pauseCycles);
const handoffPath = path.join(cwd, '.planning', 'sets', setName, 'HANDOFF.md');
fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
fs.writeFileSync(handoffPath, handoffContent, 'utf-8');
```

### ASCII table formatting (existing pattern from worktree.cjs)
```javascript
// Source: src/lib/worktree.cjs lines 345-390
// Headers: ['SET', 'WAVE', 'PHASE', 'PROGRESS', 'LAST ACTIVITY']
// Column widths auto-calculated from max content length
// Separator uses dashes: join(widths.map(w => '-'.repeat(w)))
```

### SET-OVERVIEW.md Template (Claude's discretion)
```markdown
# Set: {set-name} -- Overview

## Approach
{2-3 paragraph summary of implementation strategy}

## Key Files
| File | Purpose | Status |
|------|---------|--------|
| {path} | {what it does} | New / Modify / Extend |

## Integration Points
- {set-name} imports: {what from which set}
- {set-name} exports: {what for which consumers}

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| {description} | HIGH/MED/LOW | {how to handle} |

## Wave Breakdown (Preliminary)
- Wave 1: {scope summary}
- Wave 2: {scope summary}
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0) | When Changed | Impact |
|----------------------|-------------------------|--------------|--------|
| REGISTRY.json as sole state store | STATE.json (hierarchical) + REGISTRY.json (worktree metadata) | Phase 16 | Status reads STATE.json for hierarchy, REGISTRY.json for paths |
| Flat set list in registry | Milestone > Set > Wave > Job hierarchy in STATE.json | Phase 16 | Dashboard can show wave/job breakdown per set |
| Pause writes to registry only | Pause writes HANDOFF.md + updates both STATE.json and REGISTRY.json | Phase 16-17 | Resume has richer context from structured handoff |
| No state transition validation | Zod-validated transitions via state-transitions.cjs | Phase 16 | Cannot skip states (pending > planning > executing > ...) |
| Manual cleanup only | Auto-prompt after merge + standalone manual cleanup | Phase 19 (new) | Less orphaned worktrees |

**Note on Zod version:** Package.json shows `"zod": "^3.25.76"` which contradicts the Phase 16 decision of locking to 3.24.4. The installed version should be verified. If 3.25+ is installed, it may have ESM-only issues with CommonJS require(). This should be checked during implementation but does not block planning.

## Open Questions

1. **REGISTRY.json migration path**
   - What we know: STATE.json tracks set status (pending/planning/executing/...) and REGISTRY.json also tracks phase and status independently
   - What's unclear: Should /set-init write the worktree path/branch info to STATE.json SetState (extending the schema) or continue using REGISTRY.json alongside?
   - Recommendation: Keep REGISTRY.json for worktree path/branch info (git-level metadata), read STATUS from STATE.json (lifecycle state). This avoids a Zod schema change and keeps concerns separated.

2. **Branch deletion via git**
   - What we know: `git branch -d rapid/setname` deletes merged branches; `-D` force-deletes
   - What's unclear: Should cleanup use `-d` (safe, fails if unmerged) or `-D` (force)?
   - Recommendation: Use `-d` by default. If it fails because branch is unmerged, inform the user and offer `-D` via AskUserQuestion with warning.

3. **Set planner context scope**
   - What we know: The set planner needs CONTRACT.json, DEFINITION.md, and enough context to write a useful SET-OVERVIEW.md
   - What's unclear: Whether OWNERSHIP.json and STYLE_GUIDE.md should also be passed to the set planner
   - Recommendation: Pass CONTRACT.json + DEFINITION.md + OWNERSHIP.json (for owned files list). Skip STYLE_GUIDE.md -- the overview is about approach, not code style.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 18+) |
| Config file | none -- uses built-in runner |
| Quick run command | `node --test src/lib/worktree.test.cjs` |
| Full suite command | `node --test src/lib/*.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETL-01 | /set-init creates worktree + branch | unit | `node --test src/lib/worktree.test.cjs` | Partially (createWorktree tests exist) |
| SETL-02 | Scoped CLAUDE.md generation | unit | `node --test src/lib/worktree.test.cjs` | Partially (generateScopedClaudeMd tests may exist) |
| SETL-03 | Set planner produces SET-OVERVIEW.md | manual-only | N/A -- requires Agent tool | N/A (agent subagent integration) |
| SETL-04 | Status dashboard from STATE.json | unit | `node --test src/lib/worktree.test.cjs` | Partially (formatStatusTable tests exist, but not STATE.json-based) |
| SETL-05 | Pause with HANDOFF.md | unit | `node --test src/lib/execute.test.cjs` | Partially (generateHandoff/parseHandoff tests may exist) |
| SETL-06 | Cleanup with safety checks | unit | `node --test src/lib/worktree.test.cjs` | Partially (removeWorktree tests exist) |
| SETL-07 | Context generation | unit | `node --test src/lib/context.test.cjs` | Yes |
| UX-01 | AskUserQuestion at decision gates | manual-only | N/A -- requires Claude tool | N/A (skill-level testing) |

### Sampling Rate
- **Per task commit:** `node --test src/lib/worktree.test.cjs`
- **Per wave merge:** `node --test src/lib/*.test.cjs`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] New tests for STATE.json-based status reading in worktree.test.cjs
- [ ] New tests for set-init orchestration function (worktree create + scoped CLAUDE.md + registry update)
- [ ] New tests for /resume CLI command logic
- [ ] New tests for branch deletion function (if added to worktree.cjs)
- [ ] Verify existing generateHandoff/parseHandoff test coverage in execute.test.cjs

## Sources

### Primary (HIGH confidence)
- `src/lib/worktree.cjs` -- All worktree CRUD, registry, status formatting, scoped CLAUDE.md generation
- `src/lib/state-machine.cjs` -- readState, writeState, findSet, transitionSet, addMilestone
- `src/lib/state-transitions.cjs` -- SET_TRANSITIONS, WAVE_TRANSITIONS, validateTransition
- `src/lib/state-schemas.cjs` -- Zod schemas for ProjectState hierarchy
- `src/lib/execute.cjs` -- generateHandoff, parseHandoff, prepareSetContext
- `src/lib/assembler.cjs` -- assembleAgent, loadContextFiles, generateFrontmatter
- `src/bin/rapid-tools.cjs` -- All existing CLI commands (worktree create/cleanup/status, execute pause/resume)
- `skills/status/SKILL.md` -- Current v1.0 status skill (to be rewritten)
- `skills/pause/SKILL.md` -- Current v1.0 pause skill (to be rewritten)
- `skills/cleanup/SKILL.md` -- Current v1.0 cleanup skill (to be rewritten)
- `skills/context/SKILL.md` -- Current context skill (SETL-07)
- `.planning/phases/19-set-lifecycle/19-CONTEXT.md` -- All user decisions

### Secondary (MEDIUM confidence)
- `src/modules/roles/` -- 14 existing role modules establish the pattern for new role-set-planner.md

### Tertiary (LOW confidence)
- Zod version concern (^3.25.76 in package.json vs 3.24.4 lock decision) -- needs verification at implementation time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in project, no new libraries needed
- Architecture: HIGH - patterns established across 18 prior phases, code thoroughly reviewed
- Pitfalls: HIGH - derived from actual code paths and known state divergence risks

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable internal domain, no external dependency changes expected)
