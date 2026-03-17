'use strict';

const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

async function handleCompact(cwd, subcommand, args) {
  const path = require('path');
  const compaction = require('../lib/compaction.cjs');

  switch (subcommand) {
    case 'context': {
      const { flags, positional } = parseArgs(args, { 'active-wave': 'string' });
      const setId = positional[0];
      if (!setId) {
        throw new CliError('Usage: rapid-tools compact context <set-id> [--active-wave N]');
      }

      const activeWave = parseInt(flags['active-wave'] || '0', 10);
      if (Number.isNaN(activeWave)) {
        throw new CliError('Invalid --active-wave value: must be a number');
      }
      const setDir = path.join(cwd, '.planning', 'sets', setId);

      const waves = compaction.collectWaveArtifacts(setDir);
      if (waves.length === 0) {
        throw new CliError(`No artifacts found for set "${setId}" at ${setDir}`);
      }

      const result = compaction.compactContext({
        setId,
        setDir,
        activeWave,
        waves,
      });

      // Build flat artifact list for diagnostic output
      const artifacts = [];
      for (const waveGroup of result.compacted) {
        for (const artifact of waveGroup.artifacts) {
          artifacts.push({
            wave: waveGroup.wave,
            name: artifact.name,
            tokens: artifact.tokens,
            isDigest: artifact.isDigest,
          });
        }
      }

      const output = {
        totalTokens: result.totalTokens,
        digestsUsed: result.digestsUsed,
        fullsUsed: result.fullsUsed,
        budgetExceeded: result.budgetExceeded,
        artifacts,
      };

      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      break;
    }

    default:
      throw new CliError(`Unknown compact subcommand: ${subcommand}. Use: context`);
  }
}

module.exports = { handleCompact };
