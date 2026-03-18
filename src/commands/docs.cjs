'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

/**
 * Handle docs CLI commands.
 *
 * Subcommands:
 *   docs generate [--scope <s>]   -- Generate documentation templates
 *   docs list                     -- List existing documentation files
 *   docs diff <milestone>         -- Show changelog entries for a milestone
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand (generate, list, diff)
 * @param {string[]} args - Remaining arguments after subcommand
 */
function handleDocs(cwd, subcommand, args) {
  switch (subcommand) {
    case 'generate': {
      const { flags } = parseArgs(args, { scope: 'string' });
      const scope = flags.scope || 'full';

      // Validate scope
      const validScopes = ['full', 'changelog', 'api', 'architecture'];
      if (!validScopes.includes(scope)) {
        throw new CliError(
          `Invalid scope: "${scope}". Valid scopes: ${validScopes.join(', ')}`,
        );
      }

      const { scaffoldDocTemplates } = require('../lib/docs.cjs');
      const created = scaffoldDocTemplates(cwd, scope);

      const result = { created, scope };
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'list': {
      const docsDir = path.join(cwd, 'docs');

      if (!fs.existsSync(docsDir)) {
        process.stdout.write(JSON.stringify({ files: [], count: 0 }) + '\n');
        break;
      }

      const entries = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));
      const files = entries.map((name) => {
        const filePath = path.join(docsDir, name);
        const content = fs.readFileSync(filePath, 'utf-8');
        const firstLine = content.split('\n')[0] || '';
        const titleMatch = firstLine.match(/^#\s+(.+)$/);
        const title = titleMatch ? titleMatch[1] : name;

        return { name, title, path: filePath };
      });

      process.stdout.write(JSON.stringify({ files, count: files.length }) + '\n');
      break;
    }

    case 'diff': {
      const { positional } = parseArgs(args, {});
      const milestoneId = positional[0];

      if (!milestoneId) {
        throw new CliError(
          'Usage: rapid-tools docs diff <milestone>',
        );
      }

      const { extractChangelog } = require('../lib/docs.cjs');
      const entries = extractChangelog(cwd, milestoneId);

      // Group entries by category
      const grouped = { Added: [], Changed: [], Fixed: [], Breaking: [] };
      for (const entry of entries) {
        grouped[entry.category].push(entry);
      }

      const result = { milestone: milestoneId, entries, grouped };
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      throw new CliError(
        'Usage: rapid-tools docs <generate|list|diff> [options]',
      );
  }
}

module.exports = { handleDocs };
