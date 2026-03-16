'use strict';

const { output, error } = require('../lib/core.cjs');
const { parseArgs } = require('../lib/args.cjs');

async function handleExecute(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const execute = require('../lib/execute.cjs');
  const stub = require('../lib/stub.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'prepare-context': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute prepare-context <set-name>');
        process.exit(1);
      }
      const context = execute.prepareSetContext(cwd, setName);
      const result = {
        setName: context.setName,
        scopedMdPreview: context.scopedMd.slice(0, 200) + '...',
        definitionLength: context.definition.length,
        contractKeys: Object.keys(JSON.parse(context.contractStr)),
      };
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'verify': {
      const { flags: verifyFlags, positional: verifyPos } = parseArgs(args, { branch: 'string' });
      const setName = verifyPos[0];
      if (!setName) {
        error('Usage: rapid-tools execute verify <set-name> --branch <branch>');
        process.exit(1);
      }
      let branch = verifyFlags.branch || 'main';
      // Load registry to find worktree path
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      const worktreePath = path.resolve(cwd, entry.path);
      // Try to load LAST_RETURN.json
      const returnPath = path.join(cwd, '.planning', 'sets', setName, 'LAST_RETURN.json');
      let returnData;
      try {
        returnData = JSON.parse(fs.readFileSync(returnPath, 'utf-8'));
      } catch (err) {
        error(`Cannot read ${returnPath}: ${err.message}. Create LAST_RETURN.json first.`);
        process.exit(1);
      }
      const results = execute.verifySetExecution(cwd, setName, returnData, worktreePath, branch);
      process.stdout.write(JSON.stringify(results) + '\n');
      break;
    }

    case 'generate-stubs': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute generate-stubs <set-name>');
        process.exit(1);
      }
      const stubPaths = stub.generateStubFiles(cwd, setName);
      process.stdout.write(JSON.stringify({ setName, stubs: stubPaths }) + '\n');
      break;
    }

    case 'cleanup-stubs': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute cleanup-stubs <set-name>');
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      const worktreePath = path.resolve(cwd, entry.path);
      const result = stub.cleanupStubFiles(worktreePath);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'wave-status': {
      const dag = require('../lib/dag.cjs');
      // Load DAG.json
      let dagJson = null;
      try {
        const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
        dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
      } catch (err) {
        error('No DAG.json found. Run /rapid:plan first to create sets and DAG.');
        process.exit(1);
      }
      // Load and reconcile registry
      const registry = await wt.reconcileRegistry(cwd);
      const executionOrder = dag.getExecutionOrder(dagJson);

      // Build wave status
      const waves = executionOrder.map((sets, index) => {
        const waveNum = index + 1;
        const setStatuses = sets.map(setName => {
          const entry = registry.worktrees[setName];
          return {
            name: setName,
            phase: entry ? entry.phase : 'Pending',
            status: entry ? entry.status : 'not-started',
          };
        });
        // Gate is open if all sets in the wave are Done
        const gateOpen = setStatuses.every(s => s.phase === 'Done');
        return { wave: waveNum, sets: setStatuses, gateOpen };
      });

      // JSON output
      process.stdout.write(JSON.stringify({ waves }) + '\n');

      // Human-readable fallback on stderr
      const waveSummary = wt.formatWaveSummary(registry, dagJson);
      if (waveSummary) {
        process.stderr.write(waveSummary + '\n');
      }
      break;
    }

    case 'update-phase': {
      const setName = args[0];
      const phase = args[1];
      if (!setName || !phase) {
        error('Usage: rapid-tools execute update-phase <set-name> <phase>');
        process.exit(1);
      }
      const validPhases = ['Discussing', 'Planning', 'Executing', 'Verifying', 'Done', 'Error', 'Paused'];
      if (!validPhases.includes(phase)) {
        error(`Invalid phase: "${phase}". Must be one of: ${validPhases.join(', ')}`);
        process.exit(1);
      }
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].phase = phase;
          reg.worktrees[setName].updatedAt = new Date().toISOString();
        } else {
          // Create entry if not present (set may not have a worktree yet)
          reg.worktrees[setName] = {
            setName,
            branch: `rapid/${setName}`,
            path: `.rapid-worktrees/${setName}`,
            phase,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return reg;
      });
      // Validation guard: warn if registry phase implies STATE.json inconsistency
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (stateResult && stateResult.valid) {
          for (const milestone of stateResult.state.milestones) {
            const setData = (milestone.sets || []).find(s => s.id === setName);
            if (setData) {
              // Phase-status consistency rules:
              // Done registry phase should correspond to 'executed' or 'merged' status
              // Error registry phase should not have 'executing' status
              const phaseStatusWarnings = [];
              if (phase === 'Done' && !['executed', 'merged'].includes(setData.status)) {
                phaseStatusWarnings.push(`Registry phase "Done" but STATE.json status is "${setData.status}" (expected "executed" or "merged")`);
              }
              if (phase === 'Error' && setData.status === 'planned') {
                phaseStatusWarnings.push(`Registry phase "Error" but STATE.json status is still "planned"`);
              }
              if (phase === 'Executing' && setData.status === 'merged') {
                phaseStatusWarnings.push(`Registry phase "Executing" but STATE.json status is already "merged"`);
              }
              for (const w of phaseStatusWarnings) {
                process.stderr.write(`[WARN] Phase/status inconsistency for "${setName}": ${w}\n`);
              }
              break;
            }
          }
        }
      } catch {
        // Graceful -- STATE.json may not exist
      }
      process.stdout.write(JSON.stringify({ updated: true, setName, phase }) + '\n');
      break;
    }

    case 'pause': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute pause <set-name>');
        process.exit(1);
      }
      // Validate registry entry exists and phase is Executing
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      if (entry.phase !== 'Executing') {
        error(`Set "${setName}" is in phase "${entry.phase}", not Executing. Pause is only available during execution.`);
        process.exit(1);
      }
      // Read CHECKPOINT data from stdin (JSON)
      let checkpointData;
      try {
        const input = fs.readFileSync(0, 'utf-8');
        checkpointData = JSON.parse(input);
      } catch (err) {
        error(`Failed to read CHECKPOINT JSON from stdin: ${err.message}`);
        process.exit(1);
      }
      // Load current pauseCycles from registry entry (default 0), increment
      const pauseCycles = (entry.pauseCycles || 0) + 1;
      if (pauseCycles >= 3) {
        process.stderr.write(`Warning: Set "${setName}" has been paused ${pauseCycles} times. Consider replanning this set.\n`);
      }
      // Generate HANDOFF.md content
      const handoffContent = execute.generateHandoff(checkpointData, setName, pauseCycles);
      const handoffPath = path.join(cwd, '.planning', 'sets', setName, 'HANDOFF.md');
      fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
      fs.writeFileSync(handoffPath, handoffContent, 'utf-8');
      // Update registry: phase = Paused, pauseCycles, updatedAt
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].phase = 'Paused';
          reg.worktrees[setName].pauseCycles = pauseCycles;
          reg.worktrees[setName].updatedAt = new Date().toISOString();
        }
        return reg;
      });
      process.stdout.write(JSON.stringify({ paused: true, setName, pauseCycles, handoffPath }) + '\n');
      break;
    }

    case 'resume': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute resume <set-name>');
        process.exit(1);
      }
      try {
        const result = await execute.resumeSet(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
      break;
    }

    case 'reconcile': {
      const dag = require('../lib/dag.cjs');
      const { flags: reconcileFlags, positional: reconcilePos } = parseArgs(args, { mode: 'string' });
      const waveNum = parseInt(reconcilePos[0], 10);
      if (isNaN(waveNum)) {
        error('Usage: rapid-tools execute reconcile <wave-number> [--mode <mode>]');
        process.exit(1);
      }
      const executionMode = reconcileFlags.mode;
      // Load DAG.json and registry
      let dagJson;
      try {
        const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
        dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
      } catch (err) {
        error(`Cannot read DAG.json: ${err.message}`);
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      // Run reconciliation
      const reconcileResult = execute.reconcileWave(cwd, waveNum, dagJson, registry);
      // Generate summary (pass executionMode for wave summary metadata)
      const summaryContent = execute.generateWaveSummary(waveNum, reconcileResult, new Date().toISOString(), executionMode);
      // Write summary
      const wavesDir = path.join(cwd, '.planning', 'waves');
      fs.mkdirSync(wavesDir, { recursive: true });
      const summaryPath = path.join(wavesDir, `WAVE-${waveNum}-SUMMARY.md`);
      fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
      // JSON output on stdout
      process.stdout.write(JSON.stringify({
        waveNum,
        overall: reconcileResult.overall,
        hardBlocks: reconcileResult.hardBlocks,
        softBlocks: reconcileResult.softBlocks,
        summaryPath,
      }) + '\n');
      // Human-readable summary on stderr
      process.stderr.write(`\nWave ${waveNum} Reconciliation: ${reconcileResult.overall}\n`);
      if (reconcileResult.hardBlocks.length > 0) {
        process.stderr.write(`  Hard blocks: ${reconcileResult.hardBlocks.length}\n`);
        for (const b of reconcileResult.hardBlocks) {
          process.stderr.write(`    - ${b.set}: ${b.type} -- ${b.detail}\n`);
        }
      }
      if (reconcileResult.softBlocks.length > 0) {
        process.stderr.write(`  Soft blocks: ${reconcileResult.softBlocks.length}\n`);
        for (const b of reconcileResult.softBlocks) {
          process.stderr.write(`    - ${b.set}: ${b.type} -- ${b.detail}\n`);
        }
      }
      if (reconcileResult.hardBlocks.length === 0 && reconcileResult.softBlocks.length === 0) {
        process.stderr.write(`  All contract obligations satisfied.\n`);
      }
      break;
    }

    case 'reconcile-jobs': {
      const { flags: rjFlags, positional: rjPos } = parseArgs(args, { branch: 'string', mode: 'string' });
      const setId = rjPos[0];
      const waveId = rjPos[1];
      if (!setId || !waveId) {
        error('Usage: rapid-tools execute reconcile-jobs <set-id> <wave-id> [--branch <branch>] [--mode <mode>]');
        process.exit(1);
      }
      let branch = rjFlags.branch || 'main';
      let mode = rjFlags.mode || 'Subagents';
      // Find worktree path for this set
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      // Run job-level reconciliation
      if (typeof execute.reconcileWaveJobs !== 'function') {
        error('reconcileWaveJobs not available -- ensure plan 01 (execution engine library) is implemented first');
        process.exit(1);
      }
      const result = execute.reconcileWaveJobs(cwd, setId, waveId, worktreePath, branch);
      // Generate wave summary
      const timestamp = new Date().toISOString();
      const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);
      const summaryContent = typeof execute.generateWaveJobsSummary === 'function'
        ? execute.generateWaveJobsSummary(waveId, result, timestamp, mode)
        : JSON.stringify(result, null, 2);
      // Write summary file
      const summaryPath = path.join(waveDir, 'WAVE-SUMMARY.md');
      fs.mkdirSync(waveDir, { recursive: true });
      fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
      output(JSON.stringify({ ...result, summaryPath }));
      break;
    }

    case 'job-status': {
      const sm = require('../lib/state-machine.cjs');
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools execute job-status <set-id>');
        process.exit(1);
      }
      const result = await sm.readState(cwd);
      if (!result || !result.valid) {
        error('STATE.json is missing or invalid');
        process.exit(1);
      }
      const state = result.state;
      const milestoneId = state.currentMilestone;
      const set = sm.findSet(state, milestoneId, setId);
      const waves = (set.waves || []).map(w => ({
        waveId: w.id,
        status: w.status,
        jobs: (w.jobs || []).map(j => ({
          jobId: j.id,
          status: j.status,
          startedAt: j.startedAt || null,
          completedAt: j.completedAt || null,
        })),
      }));
      output(JSON.stringify({ setId, milestoneId, waves }));
      break;
    }

    case 'commit-state': {
      const sm = require('../lib/state-machine.cjs');
      const message = args.join(' ') || 'chore: update STATE.json';
      const result = sm.commitState(cwd, message);
      output(JSON.stringify(result));
      break;
    }

    default:
      error(`Unknown execute subcommand: ${subcommand}. Use: prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase, pause, resume, reconcile, reconcile-jobs, job-status, commit-state`);
      process.exit(1);
  }
}

module.exports = { handleExecute };
