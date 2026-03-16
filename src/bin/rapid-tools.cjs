#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
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
    error(`Cannot find project root: ${err.message}`);
    process.exit(1);
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

    default:
      error(`Unknown command: ${command}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

// handleExecute extracted to ../commands/execute.cjs
// handleMerge follows below
async function handleMerge(cwd, subcommand, args) {
  const path = require('path');
  const fs = require('fs');
  const merge = require('../lib/merge.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'review': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge review <set-name>');
        process.exit(1);
      }
      const result = merge.runProgrammaticGate(cwd, setName);
      const setDir = path.join(cwd, '.planning', 'sets', setName);
      // Write initial REVIEW.md with programmatic results only (agent review added by skill)
      merge.writeReviewMd(setDir, {
        setName,
        verdict: result.passed ? 'PENDING_REVIEW' : 'BLOCK',
        contractResults: { valid: result.contractValid },
        ownershipResults: { violations: result.ownershipViolations },
        testResults: { passed: result.testsPass, output: result.testOutput },
        findings: {
          blocking: result.ownershipViolations.map(v => `Ownership: ${v.file} owned by ${v.owner}`),
          fixable: [],
          suggestions: [],
        },
      });
      output(JSON.stringify(result));
      break;
    }

    case 'execute': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge execute <set-name>');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      const result = merge.mergeSet(cwd, setName, baseBranch);
      if (result.merged) {
        // Update registry with merge status
        await wt.registryUpdate(cwd, (reg) => {
          if (reg.worktrees[setName]) {
            reg.worktrees[setName].mergeStatus = 'merged';
            reg.worktrees[setName].mergedAt = new Date().toISOString();
            reg.worktrees[setName].mergeCommit = result.commitHash;
          }
          return reg;
        });
        // Also update MERGE-STATE.json with merge commit and status
        await merge.ensureMergeState(cwd, setName, {
          status: 'complete',
          mergeCommit: result.commitHash,
          completedAt: new Date().toISOString(),
        });
      }
      output(JSON.stringify(result));
      break;
    }

    case 'status': {
      const registry = wt.loadRegistry(cwd);
      const statuses = {};
      for (const [name, entry] of Object.entries(registry.worktrees || {})) {
        const mergeState = merge.readMergeState(cwd, name);
        statuses[name] = {
          phase: entry.phase || 'unknown',
          mergeStatus: entry.mergeStatus || 'pending',
          mergedAt: entry.mergedAt || null,
          mergeCommit: entry.mergeCommit || null,
          mergeState: mergeState || null,
        };
      }
      output(JSON.stringify(statuses));
      break;
    }

    case 'integration-test': {
      const result = merge.runIntegrationTests(cwd);
      output(JSON.stringify(result));
      break;
    }

    case 'order': {
      const order = merge.getMergeOrder(cwd);
      output(JSON.stringify(order));
      break;
    }

    case 'update-status': {
      const setName = args[0];
      const status = args[1];
      if (!setName || !status) {
        error('Usage: rapid-tools merge update-status <set> <status> [--agent-phase <idle|spawned|done|failed>] [--agent-phase2 <conflictId> <idle|spawned|done|failed>]');
        process.exit(1);
      }
      // Parse optional --agent-phase flag
      const agentPhaseIdx = args.indexOf('--agent-phase');
      let agentPhase1 = undefined;
      if (agentPhaseIdx !== -1) {
        const agentPhaseValue = args[agentPhaseIdx + 1];
        const validPhases = ['idle', 'spawned', 'done', 'failed'];
        if (!agentPhaseValue || !validPhases.includes(agentPhaseValue)) {
          error(`Invalid agent-phase value: "${agentPhaseValue || ''}". Must be one of: ${validPhases.join(', ')}`);
          process.exit(1);
        }
        agentPhase1 = agentPhaseValue;
      }
      // Parse optional --agent-phase2 flag (per-conflict tracking)
      const agentPhase2Idx = args.indexOf('--agent-phase2');
      let agentPhase2Update = undefined;
      if (agentPhase2Idx !== -1) {
        const conflictId = args[agentPhase2Idx + 1];
        const phase2Value = args[agentPhase2Idx + 2];
        const validPhases2 = ['idle', 'spawned', 'done', 'failed'];
        if (!conflictId || !phase2Value || !validPhases2.includes(phase2Value)) {
          error(`Invalid --agent-phase2 args: "${conflictId || ''}" "${phase2Value || ''}". Usage: --agent-phase2 <conflictId> <idle|spawned|done|failed>`);
          process.exit(1);
        }
        agentPhase2Update = { conflictId, phase: phase2Value };
      }
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].mergeStatus = status;
        }
        return reg;
      });
      // Build updates object
      const stateUpdates = { status };
      if (agentPhase1 !== undefined) {
        stateUpdates.agentPhase1 = agentPhase1;
      }
      // Handle agentPhase2 per-conflict update (merge into existing object map)
      if (agentPhase2Update) {
        await merge.withMergeStateTransaction(cwd, setName, (state) => {
          const existingPhase2 = state.agentPhase2 || {};
          existingPhase2[agentPhase2Update.conflictId] = agentPhase2Update.phase;
          state.agentPhase2 = existingPhase2;
          Object.assign(state, { status });
          if (agentPhase1 !== undefined) state.agentPhase1 = agentPhase1;
        }).catch(() => {
          // No existing state -- create minimal
          return merge.ensureMergeState(cwd, setName, {
            status,
            startedAt: new Date().toISOString(),
            ...(agentPhase1 !== undefined ? { agentPhase1 } : {}),
            agentPhase2: { [agentPhase2Update.conflictId]: agentPhase2Update.phase },
          });
        });
        // Read back for result
        stateUpdates.agentPhase2 = (merge.readMergeState(cwd, setName) || {}).agentPhase2;
      } else {
        // Update MERGE-STATE.json status (and optionally agentPhase1)
        await merge.ensureMergeState(cwd, setName, stateUpdates);
      }
      const result = { updated: true, set: setName, mergeStatus: status };
      if (agentPhase1 !== undefined) {
        result.agentPhase1 = agentPhase1;
      }
      if (agentPhase2Update) {
        result.agentPhase2 = stateUpdates.agentPhase2;
      }
      output(JSON.stringify(result));
      break;
    }

    case 'detect': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge detect <set-name>');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      // Create/update MERGE-STATE with detecting status
      await merge.ensureMergeState(cwd, setName, { status: 'detecting', startedAt: new Date().toISOString() });
      // Run 5-level detection (L5 semantic = null, filled by agent)
      const detectionResults = merge.detectConflicts(cwd, setName, baseBranch);
      // Update MERGE-STATE with detection results
      await merge.withMergeStateTransaction(cwd, setName, (state) => {
        state.detection = {
          textual: {
            ran: true,
            conflicts: (detectionResults.textual && detectionResults.textual.conflicts) || [],
          },
          structural: {
            ran: true,
            conflicts: (detectionResults.structural && detectionResults.structural.conflicts) || [],
          },
          dependency: {
            ran: true,
            conflicts: (detectionResults.dependency && detectionResults.dependency.conflicts) || [],
          },
          api: {
            ran: true,
            conflicts: (detectionResults.api && detectionResults.api.conflicts) || [],
          },
          semantic: detectionResults.semantic || undefined,
        };
      });
      output(JSON.stringify(detectionResults));
      break;
    }

    case 'resolve': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge resolve <set-name>');
        process.exit(1);
      }
      // Load detection results from MERGE-STATE.json
      const mergeState = merge.readMergeState(cwd, setName);
      if (!mergeState || !mergeState.detection) {
        error(`No detection results found for set '${setName}'. Run 'merge detect ${setName}' first.`);
        process.exit(1);
      }
      // Update status to resolving
      await merge.withMergeStateTransaction(cwd, setName, (state) => { state.status = 'resolving'; });
      // Flatten detection results into allConflicts array for resolveConflicts()
      const allConflicts = [];
      const det = mergeState.detection;
      if (det.textual && det.textual.conflicts) {
        for (const c of det.textual.conflicts) {
          allConflicts.push({ ...c, level: 'textual' });
        }
      }
      if (det.structural && det.structural.conflicts) {
        for (const c of det.structural.conflicts) {
          allConflicts.push({ ...c, level: 'structural' });
        }
      }
      if (det.dependency && det.dependency.conflicts) {
        for (const c of det.dependency.conflicts) {
          allConflicts.push({ ...c, level: 'dependency' });
        }
      }
      if (det.api && det.api.conflicts) {
        for (const c of det.api.conflicts) {
          allConflicts.push({ ...c, level: 'api' });
        }
      }
      // Load OWNERSHIP.json and DAG.json for heuristic context
      let ownership = {};
      let dagOrder = [];
      try {
        const ownershipPath = path.join(cwd, '.planning', 'sets', setName, 'OWNERSHIP.json');
        if (fs.existsSync(ownershipPath)) {
          ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
        }
      } catch { /* no ownership data */ }
      try {
        const dagPath = path.join(cwd, '.planning', 'DAG.json');
        if (fs.existsSync(dagPath)) {
          const dagData = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
          dagOrder = dagData.order || dagData.edges || [];
        }
      } catch { /* no DAG data */ }
      // Run resolution cascade
      const resolutionResults = merge.resolveConflicts({ allConflicts }, { ownership, dagOrder });
      // Compute resolution summary
      const tier1Count = resolutionResults.filter(r => r.tier === 1 && r.resolved).length;
      const tier2Count = resolutionResults.filter(r => r.tier === 2 && r.resolved).length;
      const unresolvedCount = resolutionResults.filter(r => !r.resolved).length;
      // Update MERGE-STATE with resolution counts
      await merge.withMergeStateTransaction(cwd, setName, (state) => {
        state.resolution = {
          tier1Resolved: tier1Count,
          tier2Resolved: tier2Count,
          unresolvedForAgent: unresolvedCount,
          total: resolutionResults.length,
        };
      });
      output(JSON.stringify({
        results: resolutionResults,
        summary: {
          tier1Resolved: tier1Count,
          tier2Resolved: tier2Count,
          unresolvedForAgent: unresolvedCount,
          total: resolutionResults.length,
        },
      }));
      break;
    }

    case 'bisect': {
      const waveNumStr = args[0];
      if (!waveNumStr) {
        error('Usage: rapid-tools merge bisect <waveNum>');
        process.exit(1);
      }
      const waveNum = parseInt(waveNumStr, 10);
      if (isNaN(waveNum) || waveNum < 1) {
        error('Wave number must be a positive integer');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      // Get wave-grouped merge order
      const waves = merge.getMergeOrder(cwd);
      if (waveNum > waves.length) {
        error(`Wave ${waveNum} does not exist. There are ${waves.length} waves.`);
        process.exit(1);
      }
      const waveSets = waves[waveNum - 1]; // 0-indexed
      // Find merged sets and their pre-wave commit from MERGE-STATE.json
      const mergedSets = [];
      let earliestMergeTime = null;
      let preWaveCommit = null;
      for (const setName of waveSets) {
        const ms = merge.readMergeState(cwd, setName);
        if (ms && ms.status === 'complete' && ms.mergeCommit) {
          mergedSets.push(setName);
          // Track earliest merge to find preWaveCommit
          if (ms.startedAt && (!earliestMergeTime || ms.startedAt < earliestMergeTime)) {
            earliestMergeTime = ms.startedAt;
          }
        }
      }
      if (mergedSets.length === 0) {
        error(`No merged sets found in wave ${waveNum}. Nothing to bisect.`);
        process.exit(1);
      }
      // Get preWaveCommit: commit before earliest merge in this wave
      // Use git log to find commit before the earliest merge commit
      try {
        const firstMergedState = merge.readMergeState(cwd, mergedSets[0]);
        if (firstMergedState && firstMergedState.mergeCommit) {
          preWaveCommit = require('child_process').execFileSync(
            'git', ['rev-parse', firstMergedState.mergeCommit + '~1'],
            { cwd, encoding: 'utf-8', stdio: 'pipe' }
          ).trim();
        }
      } catch {
        // Fallback: use getPreWaveCommit
        preWaveCommit = merge.getPreWaveCommit(cwd);
      }
      // Run bisection
      const result = merge.bisectWave(cwd, baseBranch, mergedSets, preWaveCommit);
      // Update MERGE-STATE for breaking set
      if (result.breakingSet) {
        try {
          await merge.withMergeStateTransaction(cwd, result.breakingSet, (state) => {
            state.bisection = { isBreaking: true, iterations: result.iterations, detectedAt: new Date().toISOString() };
          });
        } catch { /* may not have MERGE-STATE */ }
      }
      output(JSON.stringify(result));
      break;
    }

    case 'rollback': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge rollback <set-name> [--force]');
        process.exit(1);
      }
      const forceFlag = args.includes('--force');
      // Check cascade impact first
      const cascadeResult = merge.detectCascadeImpact(cwd, setName);
      if (cascadeResult.hasCascade && !forceFlag) {
        // Output warning JSON with affected sets -- caller decides whether to proceed
        output(JSON.stringify({
          rolledBack: false,
          cascadeWarning: true,
          affectedSets: cascadeResult.affectedSets,
          recommendation: cascadeResult.recommendation,
          hint: 'Use --force to rollback despite cascade impact',
        }));
        break;
      }
      // Proceed with rollback
      const result = merge.revertSetMerge(cwd, setName);
      if (result.reverted) {
        // Update MERGE-STATE status to reverted
        await merge.ensureMergeState(cwd, setName, { status: 'reverted' });
        // Update registry mergeStatus to reverted
        await wt.registryUpdate(cwd, (reg) => {
          if (reg.worktrees[setName]) {
            reg.worktrees[setName].mergeStatus = 'reverted';
          }
          return reg;
        });
      }
      output(JSON.stringify({
        rolledBack: result.reverted,
        revertCommit: result.revertCommit || null,
        reason: result.reason || null,
        detail: result.detail || null,
        cascadeImpact: cascadeResult,
      }));
      break;
    }

    case 'merge-state': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge merge-state <set-name>');
        process.exit(1);
      }
      const state = merge.readMergeState(cwd, setName);
      output(JSON.stringify(state || {}));
      break;
    }

    case 'prepare-context': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge prepare-context <set-name>');
        process.exit(1);
      }
      // Read MERGE-STATE for conflicts
      const mergeState = merge.readMergeState(cwd, setName);
      // Get worktree path from registry
      const reg = wt.loadRegistry(cwd);
      const worktreeInfo = reg.worktrees[setName];
      const worktreePath = worktreeInfo ? worktreeInfo.path : '';
      // Get changed files (best effort -- may fail if branch doesn't exist in test envs)
      let changedFiles = [];
      try {
        const baseBranch = wt.detectMainBranch(cwd);
        changedFiles = merge.getChangedFiles(cwd, `rapid/${setName}`, baseBranch);
      } catch {
        // Branch may not exist yet -- proceed with empty file list
      }
      // Flatten conflicts from detection
      const conflicts = [];
      if (mergeState && mergeState.detection) {
        for (const [level, data] of Object.entries(mergeState.detection)) {
          if (data && data.conflicts) {
            for (const c of data.conflicts) {
              conflicts.push({
                type: level.toUpperCase(),
                file: c.file || c.path || '',
                detail: c.description || c.detail || '',
              });
            }
          }
        }
      }
      // Build file entries
      const files = changedFiles.map(f => ({ path: f, summary: '' }));
      // Contract path
      const contractPath = path.join(cwd, '.planning', 'sets', setName, 'CONTRACT.json');
      // Call prepareMergerContext
      const briefing = merge.prepareMergerContext({
        setId: setName,
        worktreePath,
        files,
        conflicts,
        contractPath,
      });
      output(JSON.stringify({
        setName,
        briefing,
        tokenEstimate: Math.ceil(briefing.length / 4),
      }));
      break;
    }

    default:
      error(`Unknown merge subcommand: ${subcommand}. Use: review, execute, status, integration-test, order, update-status, detect, resolve, bisect, rollback, merge-state, prepare-context`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    error(err.message);
    process.exit(1);
  });
}

module.exports = { migrateStateVersion };
