'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../lib/errors.cjs');

/**
 * Handle scaffold CLI commands.
 *
 * Subcommands:
 *   scaffold run [--type <type>]                          -- Generate project foundation files
 *   scaffold status                                       -- Show scaffold report (if scaffold has been run)
 *   scaffold verify-stubs                                 -- Check which stubs have been replaced by real implementations
 *   scaffold create-foundation-set --name <n> --contracts <json> -- Create foundation set #0 with merged contracts
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand (run, status, verify-stubs, create-foundation-set)
 * @param {string[]} args - Remaining arguments after subcommand
 */
function handleScaffold(cwd, subcommand, args) {
  const { scaffold, readScaffoldReport, createFoundationSet } = require('../lib/scaffold.cjs');

  const validSubcommands = ['run', 'status', 'verify-stubs', 'create-foundation-set'];
  if (!subcommand || !validSubcommands.includes(subcommand)) {
    throw new CliError('Usage: rapid-tools scaffold <run|status|verify-stubs|create-foundation-set> [options]');
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

  if (subcommand === 'verify-stubs') {
    const stubLib = require('../lib/stub.cjs');

    // Read the scaffold report to find stub file locations
    const report = readScaffoldReport(cwd);

    // Determine stubs directory -- check .rapid-stubs/ in project root
    // and also check report.stubs if available (v2 report)
    const stubPaths = [];
    const rapidStubsDir = path.join(cwd, '.rapid-stubs');

    if (fs.existsSync(rapidStubsDir)) {
      // Walk .rapid-stubs/ for all .cjs files
      const entries = fs.readdirSync(rapidStubsDir);
      for (const entry of entries) {
        if (entry.endsWith('.cjs')) {
          stubPaths.push(path.join(rapidStubsDir, entry));
        }
      }
    }

    // Also check v2 report stubs paths if present
    if (report && Array.isArray(report.stubs)) {
      for (const sp of report.stubs) {
        const abs = path.resolve(cwd, sp);
        if (!stubPaths.includes(abs) && fs.existsSync(abs)) {
          stubPaths.push(abs);
        }
      }
    }

    // Check each stub: is it still a stub or has it been replaced?
    const results = {
      total: stubPaths.length,
      replaced: [],
      remaining: [],
    };

    for (const stubPath of stubPaths) {
      const content = fs.readFileSync(stubPath, 'utf-8');
      const relPath = path.relative(cwd, stubPath);
      if (stubLib.isRapidStub(content)) {
        results.remaining.push(relPath);
      } else {
        results.replaced.push(relPath);
      }
    }

    process.stdout.write(JSON.stringify(results) + '\n');
    return;
  }

  if (subcommand === 'create-foundation-set') {
    // Parse --name and --contracts from args
    let name = 'foundation';
    let contractsJson = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--name' && i + 1 < args.length) {
        name = args[++i];
      } else if (args[i] === '--contracts' && i + 1 < args.length) {
        contractsJson = args[++i];
      }
    }

    if (contractsJson === null) {
      throw new CliError('scaffold create-foundation-set requires --contracts <json>');
    }

    let contracts;
    try {
      contracts = JSON.parse(contractsJson);
    } catch (err) {
      throw new CliError(`Invalid --contracts JSON: ${err.message}`);
    }

    const sets = Object.keys(contracts);
    const setConfig = { name, sets, contracts };

    // createFoundationSet is async -- use .then() to handle the promise
    createFoundationSet(cwd, setConfig).then(() => {
      const setDir = path.join(cwd, '.planning', 'sets', name);
      process.stdout.write(JSON.stringify({ created: true, name, setDir }) + '\n');
    }).catch((err) => {
      throw new CliError(`create-foundation-set failed: ${err.message}`);
    });
    return;
  }
}

module.exports = { handleScaffold };
