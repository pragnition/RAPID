'use strict';

const { error } = require('../lib/core.cjs');

async function handleResolve(cwd, subcommand, args) {
  const resolveLib = require('../lib/resolve.cjs');
  const input = args[0];

  switch (subcommand) {
    case 'set': {
      if (!input) {
        error('Usage: rapid-tools resolve set <input>');
        process.exit(1);
      }
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          throw new Error('Cannot read STATE.json. Run /rapid:plan first to initialize state.');
        }
        const result = resolveLib.resolveSet(input, cwd, stateResult.state);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'wave': {
      if (!input) {
        error('Usage: rapid-tools resolve wave <input> [--set <setInput>]');
        process.exit(1);
      }
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          throw new Error('Cannot read STATE.json. Run /rapid:plan first to initialize state.');
        }
        const setIdx = args.indexOf('--set');
        const setInput = (setIdx !== -1 && args[setIdx + 1]) ? args[setIdx + 1] : undefined;
        const result = resolveLib.resolveWave(input, stateResult.state, cwd, setInput);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    default:
      error('Usage: rapid-tools resolve set <input> | wave <input>');
      process.exit(1);
  }
}

module.exports = { handleResolve };
