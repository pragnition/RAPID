'use strict';

const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

/**
 * Handle `memory` CLI subcommands.
 *
 * Subcommands:
 *   log-decision   -- Append a decision to DECISIONS.jsonl
 *   log-correction -- Append a correction to CORRECTIONS.jsonl
 *   query          -- Query decisions or corrections with filters
 *   context        -- Build token-budgeted memory context for a set
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand to execute
 * @param {string[]} args - Remaining CLI arguments
 */
async function handleMemory(cwd, subcommand, args) {
  switch (subcommand) {
    case 'log-decision': {
      const { flags } = parseArgs(args, {
        category: 'string',
        decision: 'string',
        rationale: 'string',
        source: 'string',
        milestone: 'string',
        'set-id': 'string',
        topic: 'string',
      });

      if (!flags.category || !flags.decision || !flags.rationale || !flags.source) {
        throw new CliError(
          'Usage: memory log-decision --category <c> --decision <d> --rationale <r> --source <s> [--milestone <m>] [--set-id <id>] [--topic <t>]',
        );
      }

      const memory = require('../lib/memory.cjs');
      const record = memory.appendDecision(cwd, {
        category: flags.category,
        decision: flags.decision,
        rationale: flags.rationale,
        source: flags.source,
        milestone: flags.milestone,
        setId: flags['set-id'],
        topic: flags.topic,
      });
      process.stdout.write(JSON.stringify(record) + '\n');
      break;
    }

    case 'log-correction': {
      const { flags } = parseArgs(args, {
        original: 'string',
        correction: 'string',
        reason: 'string',
        'affected-sets': 'string',
        'set-id': 'string',
        milestone: 'string',
      });

      if (!flags.original || !flags.correction || !flags.reason) {
        throw new CliError(
          'Usage: memory log-correction --original <o> --correction <c> --reason <r> [--affected-sets <s1,s2>] [--set-id <id>] [--milestone <m>]',
        );
      }

      const affectedSets = flags['affected-sets']
        ? flags['affected-sets'].split(',').map(s => s.trim())
        : [];

      const memory = require('../lib/memory.cjs');
      const record = memory.appendCorrection(cwd, {
        original: flags.original,
        correction: flags.correction,
        reason: flags.reason,
        affectedSets,
        setId: flags['set-id'],
        milestone: flags.milestone,
      });
      process.stdout.write(JSON.stringify(record) + '\n');
      break;
    }

    case 'query': {
      const { flags } = parseArgs(args, {
        category: 'string',
        milestone: 'string',
        'set-id': 'string',
        limit: 'string',
        type: 'string',
      });

      const queryType = flags.type || 'decisions';
      const memory = require('../lib/memory.cjs');

      let result;
      if (queryType === 'corrections') {
        result = memory.queryCorrections(cwd, {
          affectedSet: flags['set-id'],
          limit: flags.limit ? parseInt(flags.limit, 10) : undefined,
        });
      } else {
        result = memory.queryDecisions(cwd, {
          category: flags.category,
          milestone: flags.milestone,
          setId: flags['set-id'],
          limit: flags.limit ? parseInt(flags.limit, 10) : undefined,
        });
      }

      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'context': {
      const { flags, positional } = parseArgs(args, {
        'set-name': 'string',
        budget: 'string',
      });

      const setName = flags['set-name'] || positional[0];
      if (!setName) {
        throw new CliError('Usage: memory context <set-name> [--budget <n>]');
      }

      const budget = flags.budget ? parseInt(flags.budget, 10) : undefined;
      const memory = require('../lib/memory.cjs');
      const result = memory.buildMemoryContext(cwd, setName, budget);

      process.stdout.write(JSON.stringify({
        setName,
        tokenBudget: budget || 8000,
        context: result,
      }) + '\n');
      break;
    }

    default:
      throw new CliError(
        'Usage: memory <subcommand>\n\n' +
        'Subcommands:\n' +
        '  log-decision    Log an architectural or implementation decision\n' +
        '  log-correction  Log a correction to a prior decision or approach\n' +
        '  query           Query decision or correction logs\n' +
        '  context         Build token-budgeted memory context for a set',
      );
  }
}

module.exports = { handleMemory };
