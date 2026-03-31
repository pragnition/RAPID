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

    case 'regroup': {
      const fs = require('fs');
      const path = require('path');
      const { tryLoadDAG } = require('../lib/dag.cjs');
      const {
        partitionIntoGroups,
        annotateDAGWithGroups,
        generateGroupReport,
      } = require('../lib/group.cjs');

      // Parse --team-size N
      const tsIdx = args.indexOf('--team-size');
      const tsRaw = tsIdx !== -1 ? args[tsIdx + 1] : undefined;
      const teamSize = tsRaw !== undefined ? parseInt(tsRaw, 10) : NaN;

      if (!Number.isFinite(teamSize) || teamSize < 1) {
        throw new CliError(
          'Usage: dag regroup --team-size N (where N >= 1)',
        );
      }

      if (teamSize === 1) {
        process.stdout.write(
          'Team size is 1 -- group features are hidden for solo developers.\n',
        );
        break;
      }

      const { dag, path: dagPath, migrated } = tryLoadDAG(cwd);
      if (!dag) {
        throw new CliError('No DAG.json found. Run `dag generate` first.');
      }

      // If the DAG was auto-migrated, persist the migration first
      if (migrated) {
        fs.writeFileSync(dagPath, JSON.stringify(dag, null, 2));
      }

      // Load contracts for all sets in the DAG
      const contracts = {};
      for (const node of dag.nodes) {
        const contractPath = path.join(
          cwd,
          '.planning',
          'sets',
          node.id,
          'CONTRACT.json',
        );
        try {
          const raw = fs.readFileSync(contractPath, 'utf-8');
          contracts[node.id] = JSON.parse(raw);
        } catch {
          // Missing or malformed contract -- skip
        }
      }

      const groupResult = partitionIntoGroups(dag, contracts, teamSize);
      const annotatedDag = annotateDAGWithGroups(dag, groupResult);

      fs.writeFileSync(dagPath, JSON.stringify(annotatedDag, null, 2));

      const report = generateGroupReport(groupResult);
      process.stdout.write(report + '\n');

      const totalGroups = Object.keys(groupResult.groups).length;
      process.stdout.write(
        `\nDAG.json updated with ${totalGroups} group assignments.\n`,
      );
      break;
    }

    case 'groups': {
      const { tryLoadDAG } = require('../lib/dag.cjs');

      const { dag } = tryLoadDAG(cwd);
      if (!dag) {
        throw new CliError('No DAG.json found. Run `dag generate` first.');
      }

      if (!dag.groups || Object.keys(dag.groups).length === 0) {
        process.stdout.write(
          'No groups assigned. Run `dag regroup --team-size N` to assign groups.\n',
        );
        break;
      }

      if (args.includes('--json')) {
        process.stdout.write(JSON.stringify(dag.groups, null, 2) + '\n');
        break;
      }

      // Build a terminal-friendly summary from the DAG groups data
      const BOLD_G = '\x1b[1m';
      const CYAN_G = '\x1b[36m';
      const RESET_G = '\x1b[0m';

      let groupOut = `${BOLD_G}Developer Groups:${RESET_G}\n\n`;

      const groupIds = Object.keys(dag.groups).sort();
      for (const gId of groupIds) {
        const group = dag.groups[gId];
        const setList = (group.sets || []).join(', ');
        groupOut += `  ${CYAN_G}${gId}:${RESET_G} ${setList}\n`;
      }

      // Cross-group edges
      const nodeGroupMap = {};
      for (const node of dag.nodes) {
        if (node.group) nodeGroupMap[node.id] = node.group;
      }

      const crossEdges = [];
      for (const edge of dag.edges) {
        const fg = nodeGroupMap[edge.from];
        const tg = nodeGroupMap[edge.to];
        if (fg && tg && fg !== tg) {
          crossEdges.push({ from: edge.from, to: edge.to, fromGroup: fg, toGroup: tg });
        }
      }

      groupOut += `\n${BOLD_G}Cross-Group Dependencies:${RESET_G} ${crossEdges.length}\n`;
      for (const ce of crossEdges) {
        groupOut += `  ${ce.from} -> ${ce.to}  (${ce.fromGroup} -> ${ce.toGroup})\n`;
      }

      process.stdout.write(groupOut);
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
