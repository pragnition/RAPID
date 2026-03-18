'use strict';

const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

/**
 * Handle `quick` CLI subcommands.
 *
 * Subcommands:
 *   log   -- Append a quick task entry to the JSONL log
 *   list  -- List quick task history
 *   show  -- Show a single quick task by ID
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand to execute
 * @param {string[]} args - Remaining CLI arguments
 */
async function handleQuick(cwd, subcommand, args) {
  switch (subcommand) {
    case 'log': {
      const { flags } = parseArgs(args, {
        description: 'string',
        outcome: 'string',
        slug: 'string',
        branch: 'string',
      });

      if (!flags.description || !flags.outcome || !flags.slug || !flags.branch) {
        throw new CliError(
          'Usage: quick log --description <d> --outcome <o> --slug <s> --branch <b>',
        );
      }

      const { appendQuickTask } = require('../lib/quick-log.cjs');
      const record = appendQuickTask(cwd, {
        description: flags.description,
        outcome: flags.outcome,
        slug: flags.slug,
        branch: flags.branch,
      });
      process.stdout.write(JSON.stringify(record) + '\n');
      break;
    }

    case 'list': {
      const { flags } = parseArgs(args, {
        limit: 'string',
      });

      const limit = flags.limit ? parseInt(flags.limit, 10) : undefined;

      const { listQuickTasks } = require('../lib/quick-log.cjs');
      const result = listQuickTasks(cwd, limit);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'show': {
      const { positional } = parseArgs(args, {});

      if (positional.length === 0) {
        throw new CliError('Usage: quick show <id>');
      }

      const id = parseInt(positional[0], 10);
      if (isNaN(id)) {
        throw new CliError('ID must be a number');
      }

      const { showQuickTask } = require('../lib/quick-log.cjs');
      const result = showQuickTask(cwd, id);

      if (result === null) {
        throw new CliError('Quick task not found: ' + id);
      }

      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      throw new CliError(
        'Usage: quick <subcommand>\n\n' +
        'Subcommands:\n' +
        '  log   Append a quick task entry to the log\n' +
        '  list  List quick task history\n' +
        '  show  Show a quick task by ID',
      );
  }
}

module.exports = { handleQuick };
