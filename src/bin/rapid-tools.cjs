#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { CliError, exitWithError } = require('../lib/errors.cjs');
const { handleDisplay } = require('../commands/display.cjs');
const { handleLock } = require('../commands/lock.cjs');
const { handlePrereqs } = require('../commands/prereqs.cjs');
const { handleAssumptions, handleParseReturn, handleResume, handleVerifyArtifacts, handleContext } = require('../commands/misc.cjs');
const { handleResolve } = require('../commands/resolve.cjs');
const { handlePlan } = require('../commands/plan.cjs');
const { handleSetInit } = require('../commands/set-init.cjs');
const { handleInit } = require('../commands/init.cjs');
const { handleState } = require('../commands/state.cjs');
const { handleWorktree } = require('../commands/worktree.cjs');
const { handleReview } = require('../commands/review.cjs');
const { handleBuildAgents } = require('../commands/build-agents.cjs');
const { handleExecute } = require('../commands/execute.cjs');
const { handleMemory } = require('../commands/memory.cjs');
const { handleQuick } = require('../commands/quick.cjs');
const { handleMerge } = require('../commands/merge.cjs');
const { handleMigrate } = require('../commands/migrate.cjs');
const { handleScaffold } = require('../commands/scaffold.cjs');
const { handleCompact } = require('../commands/compact.cjs');

const USAGE = `Usage: rapid-tools <command> [subcommand] [args...]

Commands:
  lock acquire <name>    Acquire a named lock
  lock status <name>     Check if a named lock is held
  lock release <name>    Release a named lock (not typically used directly)
  state get --all                                     Read full STATE.json
  state get milestone <id>                            Read milestone
  state get set <milestoneId> <setId>                 Read set
  state get wave <milestoneId> <setId> <waveId>       Read wave
  state get job <milestoneId> <setId> <waveId> <jobId>  Read job
  state transition set <milestoneId> <setId> <status>   Transition set status
  state transition wave <milestoneId> <setId> <waveId> <status>  Transition wave
  state transition job <milestoneId> <setId> <waveId> <jobId> <status>  Transition job
  state add-milestone --id <id> [--name <name>]        Add new milestone (stdin: JSON sets)
  state detect-corruption                             Check STATE.json integrity
  state recover                                       Recover STATE.json from git
  parse-return <file>    Parse a RAPID:RETURN marker from a file
  parse-return --validate <file>  Parse and validate return data from a file
  verify-artifacts <file1> [file2...]  Verify artifact files exist (lightweight)
  verify-artifacts --heavy --test "<cmd>" <file1> [file2...]  Heavy verification with tests
  verify-artifacts --report <file1> [file2...]  Generate verification report
  prereqs                Check prerequisites (git, Node.js, jq)
  prereqs --git-check    Check if current directory is a git repository
  prereqs --json         Output raw prerequisite results as JSON
  init detect            Check if .planning/ already exists
  init scaffold --name <n> --desc <d> --team-size <N>  Create .planning/ files
               [--mode fresh|reinitialize|upgrade|cancel]
  context detect         Detect codebase characteristics (languages, frameworks, configs)
  context generate       Ensure .planning/context/ directory exists and return its path
  plan create-set             Create a set from JSON on stdin
  plan decompose              Decompose sets from JSON array on stdin
  plan write-dag              Write DAG.json from JSON on stdin
  plan list-sets              List all defined sets
  plan load-set <name>        Load a set's definition and contract
  assumptions [set-name]      Surface assumptions about a set (or list sets)
  worktree create <set-name>  Create worktree and branch for a set
  worktree list               List all registered worktrees with status
  worktree cleanup <set-name> Remove a worktree (blocks if dirty)
  worktree reconcile          Sync registry with actual git state
  worktree status             Show all worktrees with status table
  worktree status --json      Machine-readable worktree status
  worktree generate-claude-md <set>  Generate scoped CLAUDE.md for a worktree
  worktree delete-branch <branch> [--force]  Delete a git branch (safe or forced)
  resume <set-name>              Resume a paused set (extends execute resume with STATE.json)
  execute prepare-context <set>  Prepare execution context for a set
  execute verify <set> --branch <branch>  Verify set execution results
  execute generate-stubs <set>   Generate contract stubs for a set's imports
  execute cleanup-stubs <set>    Remove stub files from a set's worktree
  execute wave-status             Show execution progress per wave
  execute update-phase <set> <phase>  Update a set's lifecycle phase in registry
  execute pause <set>             Pause execution and write HANDOFF.md (reads CHECKPOINT JSON from stdin)
  execute resume <set>            Resume execution from HANDOFF.md
  execute reconcile <wave>        Reconcile a wave and write WAVE-{N}-SUMMARY.md
  execute reconcile-jobs <set> <wave> [--branch <b>] [--mode <m>]  Reconcile jobs in a wave
  execute job-status <set>        Show per-wave/per-job statuses from STATE.json
  execute commit-state [message]  Commit STATE.json with a given message
  merge review <set>              Run programmatic gate + write REVIEW.md
  merge execute <set>             Merge set branch into main (--no-ff) + update MERGE-STATE
  merge status                    Show merge pipeline status (per-set verdicts + MERGE-STATE)
  merge integration-test          Run post-wave integration test suite on main
  merge order                     Show merge order from DAG (wave-grouped)
  merge update-status <set> <status> [--agent-phase <phase>] [--agent-phase2 <conflictId> <phase>]  Update merge status + optional agentPhase1/agentPhase2
  resolve set <input>                Resolve set reference (numeric index or string ID) to JSON
  resolve wave <input>               Resolve wave reference (N.N dot notation or string ID) to JSON
  merge detect <set>              Run 5-level conflict detection (returns JSON)
  merge resolve <set>             Run resolution cascade on detected conflicts
  merge bisect <waveNum>          Run bisection recovery for a failed wave
  merge rollback <set> [--force]  Revert a merged set's merge commit (cascade check)
  merge merge-state <set>         Show MERGE-STATE.json for a set
  merge prepare-context <set>    Assemble launch briefing for set-merger subagent
  memory log-decision --category <c> --decision <d> --rationale <r> --source <s>  Log a decision
                      [--milestone <m>] [--set-id <id>] [--topic <t>]
  memory log-correction --original <o> --correction <c> --reason <r>  Log a correction
                        [--affected-sets <s1,s2>] [--set-id <id>]
  memory query [--category <c>] [--type decisions|corrections]  Query memory logs
               [--set-id <id>] [--milestone <m>] [--limit <n>]
  memory context <set-name> [--budget <n>]  Build token-budgeted memory context
  quick log --description <d> --outcome <o> --slug <s> --branch <b>  Append quick task to log
  quick list [--limit <n>]                                           List quick task history
  quick show <id>                                                    Show a quick task by ID
  set-init create <set-name>     Initialize a set: create worktree + scoped CLAUDE.md + register
  set-init list-available        List pending sets without worktrees
  review scope <set-id> [<wave-id>] [--branch <b>] [--post-merge]  Scope files for review
  review log-issue <set-id> [<wave-id>] [--post-merge]  Log issue from stdin JSON
  review list-issues <set-id> [--status <s>]         List all issues for a set
  review update-issue <set-id> <wave-id> <issue-id> <status>  Update issue status
  review lean <set-id> <wave-id>                     Run lean wave-level review
  review summary <set-id> [--post-merge]             Generate REVIEW-SUMMARY.md
  display banner <stage> [target]  Display branded RAPID stage banner
  build-agents              Build all agent .md files from source modules
  scaffold run [--type <type>]  Generate project-type-aware foundation files
  scaffold status               Show scaffold report (if scaffold has been run)
  compact context <set-id> [--active-wave N]  Diagnostic: show compaction stats for a set
  migrate detect                   Detect current RAPID version from .planning/ state
  migrate is-latest                Check if .planning/ state is at the latest version
  migrate backup                   Create pre-migration backup of .planning/
  migrate restore                  Restore .planning/ from pre-migration backup
  migrate cleanup                  Remove pre-migration backup

Options:
  --help, -h             Show this help message
`;

/**
 * Silently migrate gsd_state_version -> rapid_state_version in STATE.md.
 * Preserves the version number. No-op if already migrated or file missing.
 *
 * @param {string} cwd - Project root directory
 */
function migrateStateVersion(cwd) {
  const fs = require('fs');
  const path = require('path');
  const stateMdPath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(stateMdPath)) return;

  const content = fs.readFileSync(stateMdPath, 'utf-8');
  if (!content.includes('gsd_state_version')) return;

  const migrated = content.replace(/gsd_state_version/g, 'rapid_state_version');
  fs.writeFileSync(stateMdPath, migrated);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    if (args.length === 0) process.exit(1);
    return;
  }

  const command = args[0];
  const subcommand = args[1];

  try {
    // Commands that don't need project root
    if (command === 'prereqs') {
      await handlePrereqs(args.slice(1));
      return;
    }
    if (command === 'init') {
      handleInit(args.slice(1));
      return;
    }
    if (command === 'context') {
      handleContext(args.slice(1));
      return;
    }
    if (command === 'display') {
      handleDisplay(args[1], args.slice(2));
      return;
    }

    // All other commands need project root
    let cwd;
    try {
      cwd = findProjectRoot();
    } catch (err) {
      throw new CliError(`Cannot find project root: ${err.message}`);
    }

    migrateStateVersion(cwd);

    switch (command) {
      case 'lock':
        await handleLock(cwd, subcommand, args.slice(2));
        break;

      case 'state':
        await handleState(cwd, subcommand, args.slice(2));
        break;

      case 'parse-return':
        handleParseReturn(args.slice(1));
        break;

      case 'verify-artifacts':
        handleVerifyArtifacts(args.slice(1));
        break;

      case 'plan':
        handlePlan(cwd, subcommand, args.slice(2));
        break;

      case 'assumptions':
        handleAssumptions(cwd, args.slice(1));
        break;

      case 'worktree':
        await handleWorktree(cwd, subcommand, args.slice(2));
        break;

      case 'execute':
        await handleExecute(cwd, subcommand, args.slice(2));
        break;

      case 'memory':
        await handleMemory(cwd, subcommand, args.slice(2));
        break;

      case 'quick':
        await handleQuick(cwd, subcommand, args.slice(2));
        break;

      case 'merge':
        await handleMerge(cwd, subcommand, args.slice(2));
        break;

      case 'set-init':
        await handleSetInit(cwd, subcommand, args.slice(2));
        break;

      case 'review':
        await handleReview(cwd, subcommand, args.slice(2));
        break;

      case 'resume':
        await handleResume(cwd, args.slice(1));
        break;

      case 'resolve':
        await handleResolve(cwd, subcommand, args.slice(2));
        break;

      case 'build-agents':
        handleBuildAgents(cwd, args.slice(1));
        break;

      case 'migrate':
        handleMigrate(cwd, subcommand, args.slice(2));
        break;

      case 'scaffold':
        handleScaffold(cwd, subcommand, args.slice(2));
        break;

      case 'compact':
        await handleCompact(cwd, subcommand, args.slice(2));
        break;

      default:
        error(`Unknown command: ${command}`);
        process.stdout.write(USAGE);
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof CliError) {
      exitWithError(err.message, err.code);
    }
    throw err; // re-throw unexpected errors for the outer .catch()
  }
}

if (require.main === module) {
  main().catch((err) => {
    error(err.message);
    process.exit(1);
  });
}

module.exports = { migrateStateVersion };
