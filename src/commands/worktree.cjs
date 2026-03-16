'use strict';

const { CliError } = require('../lib/errors.cjs');

async function handleWorktree(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools worktree create <set-name>');
      }
      try {
        const { branch, path: wtPath } = wt.createWorktree(cwd, setName);
        // Register in REGISTRY.json
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
        process.stdout.write(JSON.stringify({ created: true, branch, path: wtPath, setName }) + '\n');
      } catch (err) {
        // Write structured result JSON (callers parse this shape)
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'list': {
      const registry = await wt.reconcileRegistry(cwd);
      process.stdout.write(JSON.stringify({ worktrees: Object.values(registry.worktrees) }) + '\n');
      break;
    }

    case 'cleanup': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools worktree cleanup <set-name>');
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        throw new CliError(`No worktree registered for set "${setName}"`);
      }

      // Solo sets: just deregister (no worktree to remove)
      if (entry.solo === true) {
        await wt.registryUpdate(cwd, (reg) => {
          delete reg.worktrees[setName];
          return reg;
        });
        process.stdout.write(JSON.stringify({ removed: true, setName, solo: true }) + '\n');
        break;
      }

      // Non-solo: existing worktree removal logic
      const absolutePath = path.resolve(cwd, entry.path);
      const result = wt.removeWorktree(cwd, absolutePath);
      if (result.removed) {
        // Deregister from REGISTRY.json
        await wt.registryUpdate(cwd, (reg) => {
          delete reg.worktrees[setName];
          return reg;
        });
        process.stdout.write(JSON.stringify({ removed: true, setName }) + '\n');
      } else {
        // Write structured result JSON (not CliError -- callers parse this shape)
        process.stdout.write(JSON.stringify({ removed: false, reason: result.reason, setName, message: result.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'reconcile': {
      const beforeRegistry = wt.loadRegistry(cwd);
      const beforeEntries = Object.keys(beforeRegistry.worktrees);
      const beforeStatuses = {};
      for (const [k, v] of Object.entries(beforeRegistry.worktrees)) {
        beforeStatuses[k] = v.status;
      }

      const reconciled = await wt.reconcileRegistry(cwd);
      const afterEntries = Object.keys(reconciled.worktrees);

      // Count orphaned: entries that changed to 'orphaned' status
      let orphaned = 0;
      for (const [k, v] of Object.entries(reconciled.worktrees)) {
        if (v.status === 'orphaned' && beforeStatuses[k] !== 'orphaned') {
          orphaned++;
        }
      }

      // Count discovered: new entries that weren't in before
      let discovered = 0;
      for (const k of afterEntries) {
        if (!beforeEntries.includes(k)) {
          discovered++;
        }
      }

      process.stdout.write(JSON.stringify({ reconciled: true, orphaned, discovered }) + '\n');
      break;
    }

    case 'status': {
      const registry = await wt.reconcileRegistry(cwd);
      const isJson = args.includes('--json');

      if (isJson) {
        // Machine-readable JSON output
        let dagJson = null;
        try {
          const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
          dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
        } catch (err) {
          // Graceful -- no DAG available
        }
        const waveSummary = dagJson && dagJson.waves ? dagJson.waves : null;
        process.stdout.write(JSON.stringify({
          worktrees: Object.values(registry.worktrees),
          waves: waveSummary,
        }) + '\n');
      } else {
        // Human-readable table output
        let dagJson = null;
        try {
          const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
          dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
        } catch (err) {
          // Graceful -- no DAG available
        }
        const waveSummary = wt.formatWaveSummary(registry, dagJson);
        const table = wt.formatStatusTable(Object.values(registry.worktrees), dagJson);
        let output = '';
        if (waveSummary) {
          output += waveSummary + '\n\n';
        }
        output += table;
        process.stdout.write(output + '\n');
      }
      break;
    }

    case 'status-v2': {
      // Mark II hierarchy dashboard from STATE.json
      const stateMachine = require('../lib/state-machine.cjs');
      const stateResult = await stateMachine.readState(cwd);

      if (!stateResult || !stateResult.valid) {
        throw new CliError('STATE.json not found or invalid. Run /rapid:init to set up Mark II state.');
      }

      const state = stateResult.state;
      const milestoneId = state.currentMilestone;
      const milestone = stateMachine.findMilestone(state, milestoneId);
      const registry = wt.loadRegistry(cwd);

      const stateData = {
        milestone: milestoneId,
        sets: milestone.sets,
      };

      const table = wt.formatMarkIIStatus(stateData, registry);
      const actions = wt.deriveNextActions(stateData, registry);

      // Human-readable table to stderr (same pattern as wave-status)
      process.stderr.write(table + '\n');

      // JSON to stdout
      process.stdout.write(JSON.stringify({
        table,
        actions,
        milestone: milestoneId,
      }) + '\n');
      break;
    }

    case 'generate-claude-md': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools worktree generate-claude-md <set-name>');
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        throw new CliError(`No worktree registered for set "${setName}"`);
      }
      const md = wt.generateScopedClaudeMd(cwd, setName);
      const wtClaudeMdPath = path.join(path.resolve(cwd, entry.path), 'CLAUDE.md');
      fs.mkdirSync(path.dirname(wtClaudeMdPath), { recursive: true });
      fs.writeFileSync(wtClaudeMdPath, md, 'utf-8');
      process.stdout.write(JSON.stringify({ generated: true, setName, path: wtClaudeMdPath }) + '\n');
      break;
    }

    case 'delete-branch': {
      const branchName = args[0];
      if (!branchName) {
        throw new CliError('Usage: rapid-tools worktree delete-branch <branch-name> [--force]');
      }
      const force = args.includes('--force');
      try {
        const result = wt.deleteBranch(cwd, branchName, force);
        process.stdout.write(JSON.stringify(result) + '\n');
        if (!result.deleted) {
          process.exit(1);
        }
      } catch (err) {
        // Write structured result JSON (callers parse this shape)
        process.stdout.write(JSON.stringify({ deleted: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    default:
      throw new CliError(`Unknown worktree subcommand: ${subcommand}. Use: create, list, cleanup, reconcile, status, status-v2, generate-claude-md, delete-branch`);
  }
}

module.exports = { handleWorktree };
