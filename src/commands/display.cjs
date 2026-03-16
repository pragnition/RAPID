'use strict';

const { CliError } = require('../lib/errors.cjs');

function handleDisplay(subcommand, args) {
  const { renderBanner } = require('../lib/display.cjs');

  switch (subcommand) {
    case 'banner': {
      const stage = args[0];
      if (!stage) {
        throw new CliError('Usage: rapid-tools display banner <stage> [target]');
      }
      const target = args.slice(1).join(' ');
      // Banner outputs raw formatted text, NOT JSON
      // This is intentional -- banners are visual output, not data
      process.stdout.write(renderBanner(stage, target) + '\n');
      break;
    }
    default:
      throw new CliError(`Unknown display subcommand: ${subcommand}`);
  }
}

module.exports = { handleDisplay };
