'use strict';

const { CliError } = require('../lib/errors.cjs');

function handleDisplay(subcommand, args) {
  const { renderBanner, renderFooter, renderUpdateReminder } = require('../lib/display.cjs');

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
    case 'footer': {
      const nextCommand = args[0];
      if (!nextCommand) {
        throw new CliError('Usage: rapid-tools display footer <next-command> [--breadcrumb "<text>"] [--no-clear]');
      }
      const remaining = args.slice(1);
      let breadcrumb;
      const bcIndex = remaining.indexOf('--breadcrumb');
      if (bcIndex !== -1 && bcIndex + 1 < remaining.length) {
        breadcrumb = remaining[bcIndex + 1];
      }
      const clearRequired = !remaining.includes('--no-clear');
      const result = renderFooter(nextCommand, { breadcrumb, clearRequired });
      process.stdout.write(result + '\n');
      break;
    }
    case 'update-reminder': {
      // Deferred update reminder banner. Must NEVER throw -- a banner failure
      // must not break the exit code of the parent command. Swallow all errors.
      try {
        const path = require('path');
        const pluginRoot = path.resolve(__dirname, '../..');
        const output = renderUpdateReminder(pluginRoot);
        if (output) {
          process.stdout.write(output + '\n');
        }
        // If output is empty (fresh install, non-TTY, suppressed) write nothing,
        // not even a bare newline. Caller skills depend on this.
      } catch (_err) {
        // Swallow -- never throw out of update-reminder
      }
      break;
    }
    default:
      throw new CliError(`Unknown display subcommand: ${subcommand}`);
  }
}

module.exports = { handleDisplay };
