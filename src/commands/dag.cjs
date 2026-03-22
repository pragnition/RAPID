'use strict';

const { CliError } = require('../lib/errors.cjs');

/**
 * Handle dag CLI commands.
 *
 * Subcommands:
 *   dag generate   -- Generate DAG.json from set dependencies
 *   dag show       -- Display DAG with wave grouping and status colors
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand (generate, show)
 * @param {string[]} args - Remaining arguments after subcommand
 */
async function handleDag(cwd, subcommand, args) {
  switch (subcommand) {
    case 'generate': {
      const { readState } = require('../lib/state-machine.cjs');
      const { recalculateDAG } = require('../lib/add-set.cjs');
      const { DAG_CANONICAL_SUBPATH } = require('../lib/dag.cjs');

      const readResult = await readState(cwd);
      if (!readResult || !readResult.valid) {
        throw new CliError('STATE.json is missing or invalid. Run init first.');
      }

      const state = readResult.state;
      const milestoneId = state.currentMilestone;

      try {
        await recalculateDAG(cwd, milestoneId);
      } catch (err) {
        process.stderr.write(`Error generating DAG: ${err.message}\n`);
        process.exit(1);
      }

      const result = { path: DAG_CANONICAL_SUBPATH, message: 'DAG.json generated' };
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'show': {
      const { tryLoadDAG, getExecutionOrder } = require('../lib/dag.cjs');
      const { readState } = require('../lib/state-machine.cjs');

      const { dag } = tryLoadDAG(cwd);
      if (!dag) {
        throw new CliError('No DAG.json found. Run `dag generate` first.');
      }

      const waves = getExecutionOrder(dag);

      // Build set status map from STATE.json
      const statusMap = {};
      try {
        const readResult = await readState(cwd);
        if (readResult && readResult.valid) {
          const state = readResult.state;
          const milestoneId = state.currentMilestone;
          const milestone = state.milestones.find(m => m.id === milestoneId);
          if (milestone) {
            for (const set of milestone.sets) {
              statusMap[set.id] = set.status || 'unknown';
            }
          }
        }
      } catch {
        // Fallback: statuses remain unknown
      }

      const totalSets = waves.reduce((sum, w) => sum + w.length, 0);
      const totalWaves = waves.length;

      const BOLD = '\x1b[1m';
      const RESET = '\x1b[0m';

      const statusColor = {
        pending: '\x1b[90m',
        discussed: '\x1b[33m',
        planned: '\x1b[34m',
        executing: '\x1b[92m',
        executed: '\x1b[92m',
        complete: '\x1b[32m',
        merged: '\x1b[2m',
      };

      let out = `${BOLD}DAG: ${totalSets} sets, ${totalWaves} waves${RESET}\n`;

      for (let i = 0; i < waves.length; i++) {
        out += `\n${BOLD}Wave ${i + 1}:${RESET}\n`;
        for (const setId of waves[i]) {
          const status = statusMap[setId] || 'unknown';
          const color = statusColor[status] || '';
          const colorEnd = color ? RESET : '';
          out += `  ${setId}  (${color}${status}${colorEnd})\n`;
        }
      }

      process.stdout.write(out);
      break;
    }

    case undefined:
      throw new CliError('Usage: dag <generate|show>');

    default:
      throw new CliError(
        `Unknown subcommand: "${subcommand}". Valid subcommands: generate, show`,
      );
  }
}

module.exports = { handleDag };
