# PLAN: ux-audit / Wave 3

**Objective:** Improve command discoverability by restructuring the USAGE string with workflow-based section headers, and finalize the UX audit report with all grades filled in. This wave completes the audit.

**Owned Files (Wave 3 only):**
- `src/bin/rapid-tools.cjs` (modify -- USAGE string restructuring only)
- `.planning/v6.1.0-UX-AUDIT.md` (modify -- fill in grades from Wave 1, 2, and 3 work)

**Read-Only References:**
- `src/lib/display.cjs` -- reference for banner/footer patterns
- `src/commands/state.cjs` -- verify breadcrumb work from Wave 2
- `src/lib/errors.cjs` -- verify breadcrumb helper from Wave 2
- `skills/status/SKILL.md` -- reference for status command behavior

**Depends on:** Wave 1 (audit checklist), Wave 2 (breadcrumb standardization)

---

## Task 1: Restructure USAGE string with workflow-based section headers

**What:** Add workflow-based section headers to the USAGE string in `src/bin/rapid-tools.cjs`. Currently the USAGE is a flat listing of ~116 lines with no grouping. Per CONTEXT.md: add section headers -- Setup, Planning, Execution, Review & Merge, Utilities.

**Why:** New users see a wall of undifferentiated commands. Section headers guide them to the right commands for their current workflow stage.

**File:** `src/bin/rapid-tools.cjs`

**Actions:**
1. Replace the USAGE string (lines 30-145) with a restructured version that groups commands under workflow-based headers. The command list and arguments stay exactly the same -- only add section headers and reorder commands into logical groups.

2. The new structure should be:

```
Usage: rapid-tools <command> [subcommand] [args...]

--- Setup ---
  prereqs                Check prerequisites (git, Node.js, jq)
  prereqs --git-check    Check if current directory is a git repository
  prereqs --json         Output raw prerequisite results as JSON
  init detect            Check if .planning/ already exists
  init scaffold --name <n> --desc <d> --team-size <N>  Create .planning/ files
               [--mode fresh|reinitialize|upgrade|cancel]
  context detect         Detect codebase characteristics
  context generate       Ensure .planning/context/ directory exists
  migrate detect         Detect current RAPID version from .planning/ state
  migrate is-latest      Check if .planning/ state is at the latest version
  migrate backup         Create pre-migration backup of .planning/
  migrate restore        Restore .planning/ from pre-migration backup
  migrate cleanup        Remove pre-migration backup

--- Planning ---
  state get --all                                     Read full STATE.json
  state get milestone <id>                            Read milestone
  state get set <milestoneId> <setId>                 Read set
  state get wave <milestoneId> <setId> <waveId>       Read wave
  state get job <milestoneId> <setId> <waveId> <jobId>  Read job
  state transition set <milestoneId> <setId> <status>   Transition set status
  state transition wave <milestoneId> <setId> <waveId> <status>  Transition wave
  state transition job <milestoneId> <setId> <waveId> <jobId> <status>  Transition job
  state add-milestone --id <id> [--name <name>]        Add new milestone
  state add-set --milestone <id> --set-id <id> --set-name <name> [--deps <dep1,dep2>]  Add set
  state detect-corruption                             Check STATE.json integrity
  state recover                                       Recover STATE.json from git
  plan create-set             Create a set from JSON on stdin
  plan decompose              Decompose sets from JSON array on stdin
  plan write-dag              Write DAG.json from JSON on stdin
  plan list-sets              List all defined sets
  plan load-set <name>        Load a set's definition and contract
  set-init create <set-name>     Initialize a set: worktree + CLAUDE.md + register
  set-init list-available        List pending sets without worktrees
  resolve set <input>            Resolve set reference to JSON
  resolve wave <input>           Resolve wave reference to JSON
  assumptions [set-name]         Surface assumptions about a set
  dag generate                   Generate DAG.json from set dependencies
  dag show                       Display DAG with wave grouping and status colors
  scaffold run [--type <type>]   Generate project-type-aware foundation files
  scaffold status                Show scaffold report

--- Execution ---
  execute prepare-context <set>  Prepare execution context for a set
  execute verify <set> --branch <branch>  Verify set execution results
  execute generate-stubs <set>   Generate contract stubs for imports
  execute cleanup-stubs <set>    Remove stub files from worktree
  execute wave-status            Show execution progress per wave
  execute update-phase <set> <phase>  Update set lifecycle phase
  execute pause <set>            Pause execution and write HANDOFF.md
  execute resume <set>           Resume execution from HANDOFF.md
  execute reconcile <wave>       Reconcile a wave and write summary
  execute reconcile-jobs <set> <wave> [--branch <b>] [--mode <m>]  Reconcile jobs
  execute job-status <set>       Show per-wave/per-job statuses
  execute commit-state [message] Commit STATE.json with a given message
  resume <set-name>              Resume a paused set
  worktree create <set-name>     Create worktree and branch for a set
  worktree list                  List all registered worktrees
  worktree cleanup <set-name>    Remove a worktree (blocks if dirty)
  worktree reconcile             Sync registry with actual git state
  worktree status                Show all worktrees with status table
  worktree status --json         Machine-readable worktree status
  worktree generate-claude-md <set>  Generate scoped CLAUDE.md
  worktree delete-branch <branch> [--force]  Delete a git branch

--- Review & Merge ---
  review scope <set-id> [<wave-id>] [--branch <b>] [--post-merge]  Scope files
  review log-issue <set-id> [<wave-id>] [--post-merge]  Log issue from stdin
  review list-issues <set-id> [--status <s>]         List issues for a set
  review update-issue <set-id> <wave-id> <issue-id> <status>  Update issue
  review lean <set-id> <wave-id>                     Lean wave-level review
  review summary <set-id> [--post-merge]             Generate REVIEW-SUMMARY.md
  merge review <set>              Programmatic gate + REVIEW.md
  merge execute <set>             Merge set branch into main
  merge status                    Show merge pipeline status
  merge integration-test          Post-wave integration tests on main
  merge order                     Merge order from DAG (wave-grouped)
  merge update-status <set> <status> [--agent-phase <p>]  Update merge status
  merge detect <set>              5-level conflict detection
  merge resolve <set>             Resolution cascade on conflicts
  merge bisect <waveNum>          Bisection recovery for failed wave
  merge rollback <set> [--force]  Revert a merged set's merge commit
  merge merge-state <set>         Show MERGE-STATE.json for a set
  merge prepare-context <set>     Assemble launch briefing for merger

--- Utilities ---
  lock acquire <name>    Acquire a named lock
  lock status <name>     Check if a named lock is held
  lock release <name>    Release a named lock
  display banner <stage> [target]  Display branded RAPID stage banner
  build-agents              Build all agent .md files from source modules
  parse-return <file>       Parse a RAPID:RETURN marker from a file
  parse-return --validate <file>  Parse and validate return data
  verify-artifacts <file1> [file2...]  Verify artifact files exist
  verify-artifacts --heavy --test "<cmd>" <file1> [file2...]  Heavy verification
  verify-artifacts --report <file1> [file2...]  Generate verification report
  memory log-decision --category <c> --decision <d> --rationale <r> --source <s>  Log decision
                      [--milestone <m>] [--set-id <id>] [--topic <t>]
  memory log-correction --original <o> --correction <c> --reason <r>  Log correction
                        [--affected-sets <s1,s2>] [--set-id <id>]
  memory query [--category <c>] [--type decisions|corrections]  Query memory
               [--set-id <id>] [--milestone <m>] [--limit <n>]
  memory context <set-name> [--budget <n>]  Build token-budgeted memory context
  quick log --description <d> --outcome <o> --slug <s> --branch <b>  Log quick task
  quick list [--limit <n>]                                           List quick tasks
  quick show <id>                                                    Show quick task
  compact context <set-id> [--active-wave N]  Show compaction stats
  hooks list                     List verification checks
  hooks run [--dry-run]          Run post-task hooks
  hooks enable <id>              Enable a verification check
  hooks disable <id>             Disable a verification check
  ui-contract validate <set>     Validate UI-CONTRACT.json
  ui-contract check-consistency  Check cross-set UI consistency
  ui-contract show <set>         Show formatted UI contract summary
  docs generate [--scope <s>]    Generate documentation templates
  docs list                      List existing documentation files
  docs diff <milestone>          Show changelog entries for a milestone

Options:
  --help, -h             Show this help message
```

3. Key principles for the restructuring:
   - Every existing command must appear in exactly one section
   - Command syntax and descriptions stay identical (copy-paste, do not rewrite)
   - Section headers use `--- Name ---` format for visual separation
   - Commands within each section are grouped by their primary command prefix

**What NOT to do:**
- Do NOT change any command syntax, argument names, or descriptions -- only add section headers and reorder.
- Do NOT add new commands or remove existing ones.
- Do NOT modify the `main()` function, command routing, or any logic below the USAGE string.
- Do NOT change the `Options:` section at the bottom.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs --help 2>&1 | head -5
# Should show "Usage:" line then "--- Setup ---" header
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs --help 2>&1 | grep -c "^---"
# Should output 5 (Setup, Planning, Execution, Review & Merge, Utilities)
```

---

## Task 2: Finalize UX audit report with grades

**What:** Update `.planning/v6.1.0-UX-AUDIT.md` to fill in all 16 checklist items with their grades (Pass/Fail/Deferred) and notes based on the work done in Waves 1-3.

**File:** `.planning/v6.1.0-UX-AUDIT.md` (modify)

**Actions:**
1. Update each checklist item grade based on what was actually implemented:

   **Pillar 1 (Breadcrumb Consistency):**
   - 1.1: Grade based on whether state transition errors now include recovery commands (Wave 2, Task 3)
   - 1.2: Grade based on whether set lifecycle errors include recovery commands (Wave 2, Tasks 2+4)
   - 1.3: Grade based on whether `exitWithError()` uses red ANSI on `[ERROR]` (Wave 2, Task 1)
   - 1.4: Grade based on whether format is compact inline (Wave 2, Task 1)
   - 1.5: Grade based on whether REMEDIATION_HINTS follow new format (Wave 2, Task 2)

   **Pillar 2 (Command Discoverability):**
   - 2.1: Grade based on whether USAGE has workflow headers (Wave 3, Task 1)
   - 2.2: Deferred -- unknown command suggestion (fuzzy matching) is out of scope for this audit
   - 2.3: Deferred -- `/rapid:status` contextual hints require modifying a SKILL.md (which is not an owned file for this set). Note: the status skill already has per-status next-action mapping but lacks the "no sets started" workflow guide
   - 2.4: Grade based on whether USAGE sections match the five workflow groups (Wave 3, Task 1)

   **Pillar 3 (First-Run Experience):**
   - 3.1: Deferred -- post-init workflow guide requires modifying the init skill (SKILL.md), not an owned file
   - 3.2: Deferred -- `/rapid:status` modification requires SKILL.md changes, not an owned file
   - 3.3: Deferred -- depends on 3.1 and 3.2

   **Pillar 4 (Auto-Regroup Wiring):**
   - 4.1: Grade based on whether `autoRegroup()` is called after `recalculateDAG()` (Wave 1, Task 2)
   - 4.2: Grade based on whether teamSize is in STATE.json (Wave 1, Task 1)
   - 4.3: Grade based on whether solo mode skips (Wave 1, Task 2)
   - 4.4: Grade based on whether missing teamSize gracefully skips (Wave 1, Task 2)

2. Update the Summary section with final counts.

3. Fill in the Remediation Log with actions taken and their commit hashes (use placeholder `{wave-N-commit}` -- the executor will fill in actual hashes).

**What NOT to do:**
- Do NOT mark items as Pass unless the implementation is verified.
- Do NOT change the checklist item descriptions -- only fill in Grade and Notes.
- Do NOT add new checklist items.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -c "| Pass\|| Fail\|| Deferred" .planning/v6.1.0-UX-AUDIT.md
# Should be 16 (all items graded)
grep -c "| --" .planning/v6.1.0-UX-AUDIT.md
# Should be 0 (no ungraded items remain, excluding the remediation log template)
```

---

## Success Criteria

1. USAGE string contains 5 section headers: Setup, Planning, Execution, Review & Merge, Utilities
2. All existing commands appear in exactly one section (no commands lost or duplicated)
3. `node src/bin/rapid-tools.cjs --help` output is well-structured with clear grouping
4. UX audit report has all 16 items graded (Pass, Fail, or Deferred)
5. Summary counts match the actual grades
6. Existing tests pass: `node --test tests/display.test.cjs`
7. UX audit tests pass: `node --test tests/ux-audit.test.cjs`
