'use strict';

const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

async function handleResolve(cwd, subcommand, args) {
  const resolveLib = require('../lib/resolve.cjs');

  switch (subcommand) {
    case 'set': {
      const input = args[0];
      if (!input) {
        throw new CliError('Usage: rapid-tools resolve set <input>');
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
        throw new CliError(err.message);
      }
      break;
    }

    case 'wave': {
      const { flags: waveFlags, positional: wavePos } = parseArgs(args, { set: 'string' });
      const input = wavePos[0];
      if (!input) {
        throw new CliError('Usage: rapid-tools resolve wave <input> [--set <setInput>]');
      }
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          throw new Error('Cannot read STATE.json. Run /rapid:plan first to initialize state.');
        }
        const setInput = waveFlags.set;
        const result = resolveLib.resolveWave(input, stateResult.state, cwd, setInput);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        throw new CliError(err.message);
      }
      break;
    }

    default:
      throw new CliError('Usage: rapid-tools resolve set <input> | wave <input>');
  }
}

module.exports = { handleResolve };
