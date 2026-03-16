'use strict';

const { error } = require('../lib/core.cjs');
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');

function handleAssumptions(cwd, args) {
  const plan = require('../lib/plan.cjs');

  const setName = args[0];
  if (!setName) {
    // If no set name, list available sets
    const sets = plan.listSets(cwd);
    if (sets.length === 0) {
      throw new CliError('No sets found. Run /rapid:plan first to create sets.');
    }
    process.stdout.write(JSON.stringify({ availableSets: sets, usage: 'rapid-tools assumptions <set-name>' }) + '\n');
    return;
  }

  try {
    const assumptions = plan.surfaceAssumptions(cwd, setName);
    process.stdout.write(assumptions + '\n');
  } catch (err) {
    throw new CliError(`Cannot surface assumptions for set "${setName}": ${err.message}`);
  }
}

function handleParseReturn(args) {
  const fs = require('fs');
  const { parseReturn, validateReturn } = require('../lib/returns.cjs');

  const doValidate = args.includes('--validate');
  const filePath = args.filter(a => !a.startsWith('--'))[0];

  if (!filePath) {
    throw new CliError('Usage: rapid-tools parse-return [--validate] <file>');
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new CliError(`Cannot read file: ${err.message}`);
  }

  const result = parseReturn(content);

  if (doValidate && result.parsed) {
    const validation = validateReturn(result.data);
    process.stdout.write(JSON.stringify({ ...result, validation }) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
}

async function handleResume(cwd, args) {
  const execute = require('../lib/execute.cjs');

  const infoOnly = args.includes('--info-only');
  const positionalArgs = args.filter(a => !a.startsWith('--'));
  const setName = positionalArgs[0];
  if (!setName) {
    throw new CliError('Usage: rapid-tools resume <set-name> [--info-only]');
  }

  try {
    const result = await execute.resumeSet(cwd, setName, { infoOnly });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    throw new CliError(err.message);
  }
}

function handleVerifyArtifacts(args) {
  let verifyModule;
  try {
    verifyModule = require('../lib/verify.cjs');
  } catch (err) {
    throw new CliError('Verify module not yet available. It will be added in a subsequent task.');
  }

  const { flags: vaFlags, positional: vaPos } = parseArgs(args, {
    test: 'string',
    heavy: 'boolean',
    report: 'boolean',
  });
  const isHeavy = vaFlags.heavy;
  const isReport = vaFlags.report;
  const testCommand = vaFlags.test || null;
  const files = vaPos;

  if (files.length === 0) {
    throw new CliError('Usage: rapid-tools verify-artifacts [--heavy --test "<cmd>"] [--report] <file1> [file2...]');
  }

  let results;
  if (isHeavy) {
    results = verifyModule.verifyHeavy(files, testCommand);
  } else {
    results = verifyModule.verifyLight(files, []);
  }

  if (isReport) {
    const tier = isHeavy ? 'heavy' : 'light';
    const report = verifyModule.generateVerificationReport(results, tier);
    process.stdout.write(report + '\n');
  } else {
    process.stdout.write(JSON.stringify(results) + '\n');
  }
}

function handleContext(args) {
  const fs = require('fs');
  const path = require('path');
  const { findProjectRoot } = require('../lib/core.cjs');

  const subcommand = args[0];
  if (!subcommand) {
    throw new CliError('Usage: rapid-tools context <detect|generate> [options]');
  }

  if (subcommand === 'detect') {
    // Can run without .planning/ -- just scans for source code
    const { detectCodebase, buildScanManifest } = require('../lib/context.cjs');
    const codebase = detectCodebase(process.cwd());
    if (!codebase.hasSourceCode) {
      process.stdout.write(JSON.stringify({ hasSourceCode: false, message: 'No source code detected. Run /rapid:context later when code exists.' }) + '\n');
      return;
    }
    const manifest = buildScanManifest(process.cwd());
    process.stdout.write(JSON.stringify({ hasSourceCode: true, manifest }) + '\n');
    return;
  }

  if (subcommand === 'generate') {
    // Needs project root -- writes to .planning/context/
    let cwd;
    try {
      cwd = findProjectRoot();
    } catch (err) {
      throw new CliError(`Cannot find project root: ${err.message}`);
    }
    // generate just ensures .planning/context/ dir exists and outputs the path
    const contextDir = path.join(cwd, '.planning', 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    process.stdout.write(JSON.stringify({ contextDir, ready: true }) + '\n');
    return;
  }

  throw new CliError(`Unknown context subcommand: ${subcommand}. Use 'detect' or 'generate'.`);
}

module.exports = { handleAssumptions, handleParseReturn, handleResume, handleVerifyArtifacts, handleContext };
