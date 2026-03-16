'use strict';

const { error } = require('../lib/core.cjs');

function handleDisplay(subcommand, args) {
  const { renderBanner } = require('../lib/display.cjs');

  switch (subcommand) {
    case 'banner': {
      const stage = args[0];
      if (!stage) {
        error('Usage: rapid-tools display banner <stage> [target]');
        process.exit(1);
      }
      const target = args.slice(1).join(' ');
      // Banner outputs raw formatted text, NOT JSON
      // This is intentional -- banners are visual output, not data
      process.stdout.write(renderBanner(stage, target) + '\n');
      break;
    }
    default:
      error(`Unknown display subcommand: ${subcommand}`);
      process.exit(1);
  }
}

module.exports = { handleDisplay };
