'use strict';

const { CliError } = require('../lib/errors.cjs');

/**
 * Handle scaffold CLI commands.
 *
 * Subcommands:
 *   scaffold run [--type <type>]  -- Generate project foundation files
 *   scaffold status               -- Show scaffold report (if scaffold has been run)
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand (run, status)
 * @param {string[]} args - Remaining arguments after subcommand
 */
function handleScaffold(cwd, subcommand, args) {
  const { scaffold, readScaffoldReport } = require('../lib/scaffold.cjs');

  if (!subcommand || (subcommand !== 'run' && subcommand !== 'status')) {
    throw new CliError('Usage: rapid-tools scaffold <run|status> [--type <type>]');
  }

  if (subcommand === 'run') {
    // Parse --type from args
    let projectType = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--type' && i + 1 < args.length) {
        projectType = args[++i];
      }
    }

    const options = {};
    if (projectType) {
      options.projectType = projectType;
    }

    const result = scaffold(cwd, options);
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (subcommand === 'status') {
    const report = readScaffoldReport(cwd);
    if (report) {
      process.stdout.write(JSON.stringify(report) + '\n');
    } else {
      process.stdout.write(JSON.stringify({ scaffolded: false }) + '\n');
    }
    return;
  }
}

module.exports = { handleScaffold };
