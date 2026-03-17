'use strict';

const fs = require('fs');
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

/**
 * Handle `hooks` CLI subcommands.
 *
 * Subcommands:
 *   list     -- List all verification checks and their enabled status
 *   run      -- Run post-task hooks (reads RAPID:RETURN JSON from stdin)
 *   enable   -- Enable a verification check by ID
 *   disable  -- Disable a verification check by ID
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand to execute
 * @param {string[]} args - Remaining CLI arguments
 */
async function handleHooks(cwd, subcommand, args) {
  switch (subcommand) {
    case 'list': {
      const hooks = require('../lib/hooks.cjs');
      const config = hooks.loadHooksConfig(cwd);
      const output = {
        checks: config.checks.map(c => ({ id: c.id, enabled: c.enabled })),
      };
      process.stdout.write(JSON.stringify(output) + '\n');
      break;
    }

    case 'run': {
      const { flags } = parseArgs(args, { 'dry-run': 'boolean' });

      let stdinData;
      try {
        stdinData = fs.readFileSync('/dev/stdin', 'utf-8').trim();
      } catch {
        stdinData = '';
      }

      if (!stdinData) {
        throw new CliError('hooks run expects RAPID:RETURN JSON on stdin');
      }

      let returnData;
      try {
        returnData = JSON.parse(stdinData);
      } catch {
        throw new CliError('hooks run expects RAPID:RETURN JSON on stdin');
      }

      if (flags['dry-run']) {
        const hooks = require('../lib/hooks.cjs');
        const config = hooks.loadHooksConfig(cwd);
        const enabledChecks = config.checks
          .filter(c => c.enabled)
          .map(c => c.id);
        process.stdout.write(JSON.stringify({ dryRun: true, enabledChecks }) + '\n');
        break;
      }

      const hooks = require('../lib/hooks.cjs');
      const result = await hooks.runPostTaskHooks(cwd, returnData);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'enable': {
      const checkId = args[0];
      if (!checkId) {
        throw new CliError('Usage: hooks enable <check-id>');
      }

      const hooks = require('../lib/hooks.cjs');
      const config = hooks.loadHooksConfig(cwd);
      const check = config.checks.find(c => c.id === checkId);

      if (!check) {
        const available = config.checks.map(c => c.id).join(', ');
        throw new CliError(`Unknown check: ${checkId}. Available: ${available}`);
      }

      check.enabled = true;
      hooks.saveHooksConfig(cwd, config);
      process.stdout.write(JSON.stringify({ id: checkId, enabled: true }) + '\n');
      break;
    }

    case 'disable': {
      const checkId = args[0];
      if (!checkId) {
        throw new CliError('Usage: hooks disable <check-id>');
      }

      const hooks = require('../lib/hooks.cjs');
      const config = hooks.loadHooksConfig(cwd);
      const check = config.checks.find(c => c.id === checkId);

      if (!check) {
        const available = config.checks.map(c => c.id).join(', ');
        throw new CliError(`Unknown check: ${checkId}. Available: ${available}`);
      }

      check.enabled = false;
      hooks.saveHooksConfig(cwd, config);
      process.stdout.write(JSON.stringify({ id: checkId, enabled: false }) + '\n');
      break;
    }

    default:
      throw new CliError(
        'Usage: hooks <subcommand>\n\n' +
        'Subcommands:\n' +
        '  list              List all verification checks and their status\n' +
        '  run [--dry-run]   Run post-task verification hooks\n' +
        '  enable <id>       Enable a verification check\n' +
        '  disable <id>      Disable a verification check',
      );
  }
}

module.exports = { handleHooks };
