'use strict';

const { CliError, formatBreadcrumb } = require('../lib/errors.cjs');
const { readStdinAsync } = require('../lib/stdin.cjs');

async function handleState(cwd, subcommand, args) {
  const sm = require('../lib/state-machine.cjs');

  try {
    switch (subcommand) {
      case 'get': {
        const target = args[0];
        if (!target) {
          throw new CliError('Usage: rapid-tools state get --all | milestone <id> | set <m> <s> | wave <m> <s> <w> | job <m> <s> <w> <j>');
        }

        if (target === '--all') {
          const result = await sm.readState(cwd);
          if (result === null) {
            throw new CliError(formatBreadcrumb('STATE.json not found', '/rapid:init'));
          }
          if (!result.valid) {
            throw new CliError(formatBreadcrumb('STATE.json is invalid: ' + JSON.stringify(result.errors), 'git checkout HEAD -- .planning/STATE.json'));
          }
          process.stdout.write(JSON.stringify(result.state, null, 2) + '\n');
          break;
        }

        // Hierarchy lookups: need to read state first
        const readResult = await sm.readState(cwd);
        if (readResult === null) {
          throw new CliError(formatBreadcrumb('STATE.json not found', '/rapid:init'));
        }
        if (!readResult.valid) {
          throw new CliError(formatBreadcrumb('STATE.json is invalid: ' + JSON.stringify(readResult.errors), 'git checkout HEAD -- .planning/STATE.json'));
        }
        const state = readResult.state;

        switch (target) {
          case 'milestone': {
            const milestoneId = args[1];
            if (!milestoneId) { throw new CliError('Usage: state get milestone <id>'); }
            const milestone = sm.findMilestone(state, milestoneId);
            process.stdout.write(JSON.stringify(milestone, null, 2) + '\n');
            break;
          }
          case 'set': {
            const [, mId, sId] = args;
            if (!mId || !sId) { throw new CliError('Usage: state get set <milestoneId> <setId>'); }
            const set = sm.findSet(state, mId, sId);
            process.stdout.write(JSON.stringify(set, null, 2) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId] = args;
            if (!mId || !sId || !wId) { throw new CliError('Usage: state get wave <milestoneId> <setId> <waveId>'); }
            const wave = sm.findWave(state, mId, sId, wId);
            process.stdout.write(JSON.stringify(wave, null, 2) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId] = args;
            if (!mId || !sId || !wId || !jId) { throw new CliError('Usage: state get job <milestoneId> <setId> <waveId> <jobId>'); }
            const job = sm.findJob(state, mId, sId, wId, jId);
            process.stdout.write(JSON.stringify(job, null, 2) + '\n');
            break;
          }
          default:
            throw new CliError(`Unknown state get target: ${target}. Use --all, milestone, set, wave, or job.`);
        }
        break;
      }

      case 'transition': {
        const entity = args[0];
        if (!entity) {
          throw new CliError('Usage: rapid-tools state transition set|wave|job <...ids> <newStatus>');
        }

        switch (entity) {
          case 'set': {
            const [, mId, sId, newStatus] = args;
            if (!mId || !sId || !newStatus) {
              throw new CliError('Usage: state transition set <milestoneId> <setId> <newStatus>');
            }
            await sm.transitionSet(cwd, mId, sId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'set', id: sId, status: newStatus }) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId, newStatus] = args;
            if (!mId || !sId || !wId || !newStatus) {
              throw new CliError('Usage: state transition wave <milestoneId> <setId> <waveId> <newStatus>');
            }
            await sm.transitionWave(cwd, mId, sId, wId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'wave', id: wId, status: newStatus }) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId, newStatus] = args;
            if (!mId || !sId || !wId || !jId || !newStatus) {
              throw new CliError('Usage: state transition job <milestoneId> <setId> <waveId> <jobId> <newStatus>');
            }
            await sm.transitionJob(cwd, mId, sId, wId, jId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'job', id: jId, status: newStatus }) + '\n');
            break;
          }
          default:
            throw new CliError(`Unknown transition entity: ${entity}. Use set, wave, or job.`);
        }
        break;
      }

      case 'add-milestone': {
        // Parse --id and --name from args
        let id = null;
        let name = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--id' && args[i + 1]) { id = args[i + 1]; i++; }
          if (args[i] === '--name' && args[i + 1]) { name = args[i + 1]; i++; }
        }
        if (!id) {
          throw new CliError('Usage: state add-milestone --id <milestoneId> [--name <milestoneName>]');
        }

        // Read stdin for carryForwardSets JSON (optional)
        let carryForwardSets = [];
        if (!process.stdin.isTTY) {
          try {
            const stdinData = await readStdinAsync();
            carryForwardSets = JSON.parse(stdinData);
            if (!Array.isArray(carryForwardSets)) {
              throw new CliError('stdin must be a JSON array of sets');
            }
          } catch (e) {
            // Empty stdin is OK for add-milestone (stdin is optional)
            if (e instanceof CliError && e.message === 'No data on stdin') {
              // No-op: proceed with empty carryForwardSets
            } else if (e instanceof CliError) {
              throw e;
            } else {
              throw new CliError('Invalid JSON on stdin: ' + e.message);
            }
          }
        }

        const result = await sm.addMilestone(cwd, id, name, carryForwardSets);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }

      case 'add-set': {
        const { parseArgs } = require('../lib/args.cjs');
        const { flags } = parseArgs(args, {
          milestone: 'string',
          'set-id': 'string',
          'set-name': 'string',
          deps: 'string',
        });

        if (!flags.milestone || !flags['set-id'] || !flags['set-name']) {
          throw new CliError(
            'Usage: state add-set --milestone <id> --set-id <id> --set-name <name> [--deps <dep1,dep2>]'
          );
        }

        const deps = flags.deps ? flags.deps.split(',').map(d => d.trim()).filter(Boolean) : [];

        const { addSetToMilestone } = require('../lib/add-set.cjs');
        const result = await addSetToMilestone(
          cwd,
          flags.milestone,
          flags['set-id'],
          flags['set-name'],
          deps
        );
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }

      case 'detect-corruption': {
        const result = sm.detectCorruption(cwd);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }

      case 'recover': {
        sm.recoverFromGit(cwd);
        process.stdout.write(JSON.stringify({ recovered: true }) + '\n');
        break;
      }

      case 'install-meta': {
        const path = require('path');
        const { readInstallTimestamp, isUpdateStale } = require('../lib/version.cjs');
        const pluginRoot = path.resolve(__dirname, '../..');
        const timestamp = readInstallTimestamp(pluginRoot);
        const isStale = isUpdateStale(pluginRoot);
        const envOverride = parseInt(process.env.RAPID_UPDATE_THRESHOLD_DAYS, 10);
        const thresholdDays = Number.isFinite(envOverride) && envOverride > 0 ? envOverride : 7;
        process.stdout.write(JSON.stringify({ timestamp, isStale, thresholdDays }, null, 2) + '\n');
        break;
      }

      default:
        throw new CliError(formatBreadcrumb(`Unknown state subcommand: ${subcommand}`, 'node rapid-tools.cjs --help'));
    }
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(err.message);
  }
}

module.exports = { handleState };
