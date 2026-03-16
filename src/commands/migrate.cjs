'use strict';

const { CliError } = require('../lib/errors.cjs');

/**
 * CLI handler for the `migrate` command.
 *
 * Dispatches subcommands to the src/lib/migrate.cjs library functions.
 * All operations are synchronous -- no async needed.
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The migrate subcommand (detect, is-latest, backup, restore, cleanup)
 * @param {string[]} args - Remaining positional arguments
 */
function handleMigrate(cwd, subcommand, args) {
  const migrate = require('../lib/migrate.cjs');

  if (!subcommand) {
    throw new CliError('Usage: rapid-tools migrate <detect|is-latest|backup|restore|cleanup>');
  }

  switch (subcommand) {
    case 'detect': {
      const result = migrate.detectVersion(cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'is-latest': {
      const detection = migrate.detectVersion(cwd);
      if (detection.detected === null) {
        throw new CliError('Cannot detect current version. No state files found.');
      }
      const isLatest = migrate.isLatestVersion(detection.detected);
      const { getVersion } = require('../lib/version.cjs');
      process.stdout.write(JSON.stringify({
        isLatest,
        detected: detection.detected,
        current: getVersion(),
      }) + '\n');
      break;
    }

    case 'backup': {
      const result = migrate.createBackup(cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'restore': {
      const result = migrate.restoreBackup(cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'cleanup': {
      const result = migrate.cleanupBackup(cwd);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      throw new CliError(`Unknown migrate subcommand: ${subcommand}. Valid: detect, is-latest, backup, restore, cleanup`);
  }
}

module.exports = { handleMigrate };
