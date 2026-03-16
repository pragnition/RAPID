'use strict';

const { error } = require('../lib/core.cjs');

async function handleState(cwd, subcommand, args) {
  const sm = require('../lib/state-machine.cjs');

  try {
    switch (subcommand) {
      case 'get': {
        const target = args[0];
        if (!target) {
          error('Usage: rapid-tools state get --all | milestone <id> | set <m> <s> | wave <m> <s> <w> | job <m> <s> <w> <j>');
          process.exit(1);
        }

        if (target === '--all') {
          const result = await sm.readState(cwd);
          if (result === null) {
            error('STATE.json not found. Run init to create project state.');
            process.exit(1);
          }
          if (!result.valid) {
            error('STATE.json is invalid: ' + JSON.stringify(result.errors));
            process.exit(1);
          }
          process.stdout.write(JSON.stringify(result.state, null, 2) + '\n');
          break;
        }

        // Hierarchy lookups: need to read state first
        const readResult = await sm.readState(cwd);
        if (readResult === null) {
          error('STATE.json not found.');
          process.exit(1);
        }
        if (!readResult.valid) {
          error('STATE.json is invalid: ' + JSON.stringify(readResult.errors));
          process.exit(1);
        }
        const state = readResult.state;

        switch (target) {
          case 'milestone': {
            const milestoneId = args[1];
            if (!milestoneId) { error('Usage: state get milestone <id>'); process.exit(1); }
            const milestone = sm.findMilestone(state, milestoneId);
            process.stdout.write(JSON.stringify(milestone, null, 2) + '\n');
            break;
          }
          case 'set': {
            const [, mId, sId] = args;
            if (!mId || !sId) { error('Usage: state get set <milestoneId> <setId>'); process.exit(1); }
            const set = sm.findSet(state, mId, sId);
            process.stdout.write(JSON.stringify(set, null, 2) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId] = args;
            if (!mId || !sId || !wId) { error('Usage: state get wave <milestoneId> <setId> <waveId>'); process.exit(1); }
            const wave = sm.findWave(state, mId, sId, wId);
            process.stdout.write(JSON.stringify(wave, null, 2) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId] = args;
            if (!mId || !sId || !wId || !jId) { error('Usage: state get job <milestoneId> <setId> <waveId> <jobId>'); process.exit(1); }
            const job = sm.findJob(state, mId, sId, wId, jId);
            process.stdout.write(JSON.stringify(job, null, 2) + '\n');
            break;
          }
          default:
            error(`Unknown state get target: ${target}. Use --all, milestone, set, wave, or job.`);
            process.exit(1);
        }
        break;
      }

      case 'transition': {
        const entity = args[0];
        if (!entity) {
          error('Usage: rapid-tools state transition set|wave|job <...ids> <newStatus>');
          process.exit(1);
        }

        switch (entity) {
          case 'set': {
            const [, mId, sId, newStatus] = args;
            if (!mId || !sId || !newStatus) {
              error('Usage: state transition set <milestoneId> <setId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionSet(cwd, mId, sId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'set', id: sId, status: newStatus }) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId, newStatus] = args;
            if (!mId || !sId || !wId || !newStatus) {
              error('Usage: state transition wave <milestoneId> <setId> <waveId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionWave(cwd, mId, sId, wId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'wave', id: wId, status: newStatus }) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId, newStatus] = args;
            if (!mId || !sId || !wId || !jId || !newStatus) {
              error('Usage: state transition job <milestoneId> <setId> <waveId> <jobId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionJob(cwd, mId, sId, wId, jId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'job', id: jId, status: newStatus }) + '\n');
            break;
          }
          default:
            error(`Unknown transition entity: ${entity}. Use set, wave, or job.`);
            process.exit(1);
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
          error('Usage: state add-milestone --id <milestoneId> [--name <milestoneName>]');
          process.exit(1);
        }

        // Read stdin for carryForwardSets JSON (optional)
        let carryForwardSets = [];
        if (!process.stdin.isTTY) {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          const stdinData = Buffer.concat(chunks).toString('utf-8').trim();
          if (stdinData) {
            try {
              carryForwardSets = JSON.parse(stdinData);
              if (!Array.isArray(carryForwardSets)) {
                error('stdin must be a JSON array of sets');
                process.exit(1);
              }
            } catch (e) {
              error('Invalid JSON on stdin: ' + e.message);
              process.exit(1);
            }
          }
        }

        const result = await sm.addMilestone(cwd, id, name, carryForwardSets);
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

      default:
        error(`Unknown state subcommand: ${subcommand}`);
        process.exit(1);
    }
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
    process.exit(1);
  }
}

module.exports = { handleState };
