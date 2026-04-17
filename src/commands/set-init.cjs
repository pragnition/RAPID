'use strict';

const { CliError } = require('../lib/errors.cjs');

async function handleSetInit(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      let isSolo = args.includes('--solo');
      if (!isSolo) {
        try {
          const configPath = path.join(cwd, '.planning', 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.solo === true) {
            isSolo = true;
          }
        } catch {
          // Graceful -- config.json may not exist
        }
      }
      if (!setName) {
        throw new CliError('Usage: rapid-tools set-init create <set-name> [--solo]');
      }
      try {
        const result = isSolo
          ? await wt.setInitSolo(cwd, setName)
          : await wt.setInit(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        // Write structured result JSON (callers parse this shape)
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'list-available': {
      // Read STATE.json, find all sets with status 'pending' that don't have worktrees
      try {
        const sm = require('../lib/state-machine.cjs');
        const { tryLoadDAG, getExecutionOrder } = require('../lib/dag.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          process.stdout.write(JSON.stringify({ available: [], error: 'STATE.json not found or invalid' }) + '\n');
          break;
        }

        const registry = wt.readRegistry(cwd);
        const registeredSets = new Set(Object.keys(registry.worktrees));

        const available = [];
        const availableById = new Map();
        for (const milestone of stateResult.state.milestones) {
          for (const set of (milestone.sets || [])) {
            if (set.status === 'pending' && !registeredSets.has(set.id)) {
              const entry = {
                id: set.id,
                milestone: milestone.id,
                status: set.status,
              };
              available.push(entry);
              availableById.set(set.id, entry);
            }
          }
        }

        // Attempt DAG-wave ordering; fall back to STATE.json insertion order on any failure
        // (matches /rapid:status "non-fatal" philosophy -- see src/commands/dag.cjs 'show').
        let ordered = null;
        try {
          const { dag } = tryLoadDAG(cwd);
          if (dag) {
            const waves = getExecutionOrder(dag);
            const result = [];
            for (const wave of waves) {
              for (const setId of wave) {
                if (availableById.has(setId)) {
                  result.push(availableById.get(setId));
                  availableById.delete(setId);
                }
              }
            }
            // Append any sets present in STATE.json but missing from DAG.json
            // (e.g., added after `dag generate` last ran) in STATE insertion order.
            for (const entry of available) {
              if (availableById.has(entry.id)) {
                result.push(entry);
              }
            }
            ordered = result;
          }
        } catch {
          // Non-fatal: malformed DAG.json or unreadable file -- fall back to insertion order.
          ordered = null;
        }

        process.stdout.write(JSON.stringify({ available: ordered || available }) + '\n');
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    default:
      throw new CliError(`Unknown set-init subcommand: ${subcommand}. Use: create, list-available`);
  }
}

module.exports = { handleSetInit };
