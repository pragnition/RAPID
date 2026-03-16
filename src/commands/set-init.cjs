'use strict';

const { CliError } = require('../lib/errors.cjs');

async function handleSetInit(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools set-init create <set-name>');
      }
      try {
        const result = await wt.setInit(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        throw new CliError(err.message);
      }
      break;
    }

    case 'list-available': {
      // Read STATE.json, find all sets with status 'pending' that don't have worktrees
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          process.stdout.write(JSON.stringify({ available: [], error: 'STATE.json not found or invalid' }) + '\n');
          break;
        }

        const registry = wt.loadRegistry(cwd);
        const registeredSets = new Set(Object.keys(registry.worktrees));

        const available = [];
        for (const milestone of stateResult.state.milestones) {
          for (const set of (milestone.sets || [])) {
            if (set.status === 'pending' && !registeredSets.has(set.id)) {
              available.push({
                id: set.id,
                milestone: milestone.id,
                status: set.status,
              });
            }
          }
        }

        process.stdout.write(JSON.stringify({ available }) + '\n');
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
