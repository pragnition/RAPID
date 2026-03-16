'use strict';

const { output } = require('../lib/core.cjs');
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

async function handleMerge(cwd, subcommand, args) {
  const path = require('path');
  const fs = require('fs');
  const merge = require('../lib/merge.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'review': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools merge review <set-name>');
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
        throw new CliError('Usage: rapid-tools merge execute <set-name>');
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
      const { flags: usFlags, positional: usPos } = parseArgs(args, {
        'agent-phase': 'string',
        'agent-phase2': 'multi:2',
      });
      const setName = usPos[0];
      const status = usPos[1];
      if (!setName || !status) {
        throw new CliError('Usage: rapid-tools merge update-status <set> <status> [--agent-phase <idle|spawned|done|failed>] [--agent-phase2 <conflictId> <idle|spawned|done|failed>]');
      }
      // Validate --agent-phase
      let agentPhase1 = undefined;
      if (usFlags['agent-phase'] !== undefined) {
        const agentPhaseValue = usFlags['agent-phase'];
        const validPhases = ['idle', 'spawned', 'done', 'failed'];
        if (!validPhases.includes(agentPhaseValue)) {
          throw new CliError(`Invalid agent-phase value: "${agentPhaseValue}". Must be one of: ${validPhases.join(', ')}`);
        }
        agentPhase1 = agentPhaseValue;
      }
      // Validate --agent-phase2 (multi:2 yields [conflictId, phase])
      let agentPhase2Update = undefined;
      const agentPhase2Raw = usFlags['agent-phase2'];
      if (agentPhase2Raw && agentPhase2Raw.length === 2) {
        const [conflictId, phase2Value] = agentPhase2Raw;
        const validPhases2 = ['idle', 'spawned', 'done', 'failed'];
        if (!validPhases2.includes(phase2Value)) {
          throw new CliError(`Invalid --agent-phase2 phase: "${phase2Value}". Must be one of: ${validPhases2.join(', ')}`);
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
        throw new CliError('Usage: rapid-tools merge detect <set-name>');
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
        throw new CliError('Usage: rapid-tools merge resolve <set-name>');
      }
      // Load detection results from MERGE-STATE.json
      const mergeState = merge.readMergeState(cwd, setName);
      if (!mergeState || !mergeState.detection) {
        throw new CliError(`No detection results found for set '${setName}'. Run 'merge detect ${setName}' first.`);
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
        throw new CliError('Usage: rapid-tools merge bisect <waveNum>');
      }
      const waveNum = parseInt(waveNumStr, 10);
      if (isNaN(waveNum) || waveNum < 1) {
        throw new CliError('Wave number must be a positive integer');
      }
      const baseBranch = wt.detectMainBranch(cwd);
      // Get wave-grouped merge order
      const waves = merge.getMergeOrder(cwd);
      if (waveNum > waves.length) {
        throw new CliError(`Wave ${waveNum} does not exist. There are ${waves.length} waves.`);
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
        throw new CliError(`No merged sets found in wave ${waveNum}. Nothing to bisect.`);
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
        throw new CliError('Usage: rapid-tools merge rollback <set-name> [--force]');
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
        throw new CliError('Usage: rapid-tools merge merge-state <set-name>');
      }
      const state = merge.readMergeState(cwd, setName);
      output(JSON.stringify(state || {}));
      break;
    }

    case 'prepare-context': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools merge prepare-context <set-name>');
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
      throw new CliError(`Unknown merge subcommand: ${subcommand}. Use: review, execute, status, integration-test, order, update-status, detect, resolve, bisect, rollback, merge-state, prepare-context`);
  }
}

module.exports = { handleMerge };
