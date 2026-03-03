#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { acquireLock, isLocked } = require('../lib/lock.cjs');

const USAGE = `Usage: rapid-tools <command> [subcommand] [args...]

Commands:
  lock acquire <name>    Acquire a named lock
  lock status <name>     Check if a named lock is held
  lock release <name>    Release a named lock (not typically used directly)
  state get [field]      Read a field from STATE.md (or full content with --all)
  state update <field> <value>  Update a field in STATE.md
  assemble-agent <role>  Assemble an agent from modules (planner|executor|reviewer|verifier|orchestrator)
  assemble-agent --list  List available modules
  assemble-agent --validate  Validate agent assembly config
  parse-return <file>    Parse a RAPID:RETURN marker from a file
  parse-return --validate <file>  Parse and validate return data from a file
  verify-artifacts <file1> [file2...]  Verify artifact files exist (lightweight)
  verify-artifacts --heavy --test "<cmd>" <file1> [file2...]  Heavy verification with tests
  verify-artifacts --report <file1> [file2...]  Generate verification report
  prereqs                Check prerequisites (git, Node.js, jq)
  prereqs --git-check    Check if current directory is a git repository
  prereqs --json         Output raw prerequisite results as JSON
  init detect            Check if .planning/ already exists
  init scaffold --name <n> --desc <d> --team-size <N>  Create .planning/ files
               [--mode fresh|reinitialize|upgrade|cancel]

Options:
  --help, -h             Show this help message
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    if (args.length === 0) process.exit(1);
    return;
  }

  const command = args[0];
  const subcommand = args[1];

  // Commands that don't need project root
  if (command === 'prereqs') {
    await handlePrereqs(args.slice(1));
    return;
  }
  if (command === 'init') {
    handleInit(args.slice(1));
    return;
  }

  // All other commands need project root
  let cwd;
  try {
    cwd = findProjectRoot();
  } catch (err) {
    error(`Cannot find project root: ${err.message}`);
    process.exit(1);
  }

  switch (command) {
    case 'lock':
      await handleLock(cwd, subcommand, args.slice(2));
      break;

    case 'state':
      await handleState(cwd, subcommand, args.slice(2));
      break;

    case 'assemble-agent':
      handleAssembleAgent(cwd, args.slice(1));
      break;

    case 'parse-return':
      handleParseReturn(args.slice(1));
      break;

    case 'verify-artifacts':
      handleVerifyArtifacts(args.slice(1));
      break;

    default:
      error(`Unknown command: ${command}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleLock(cwd, subcommand, args) {
  const lockName = args[0];

  if (!lockName) {
    error('Lock name required. Usage: rapid-tools lock <acquire|status|release> <name>');
    process.exit(1);
  }

  switch (subcommand) {
    case 'acquire': {
      const release = await acquireLock(cwd, lockName);
      // For CLI usage, we hold the lock and print confirmation.
      // The lock will be released when the process exits.
      const result = JSON.stringify({ acquired: true, lock: lockName });
      process.stdout.write(result + '\n');
      // Note: In CLI mode, the lock is held until the process exits.
      // For programmatic use, callers should use the library directly.
      break;
    }

    case 'status': {
      const locked = isLocked(cwd, lockName);
      const result = JSON.stringify({ locked, lock: lockName });
      process.stdout.write(result + '\n');
      break;
    }

    case 'release': {
      error('Lock release via CLI is not supported. Locks are released when the acquiring process exits.');
      process.exit(1);
      break;
    }

    default:
      error(`Unknown lock subcommand: ${subcommand}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleState(cwd, subcommand, args) {
  // State subcommands will be wired in Task 2
  let stateModule;
  try {
    stateModule = require('../lib/state.cjs');
  } catch (err) {
    error('State module not yet available. It will be added in a subsequent task.');
    process.exit(1);
  }

  switch (subcommand) {
    case 'get': {
      const field = args[0];
      const useAll = args.includes('--all');
      if (!field || useAll) {
        const content = stateModule.stateGet(cwd);
        process.stdout.write(content + '\n');
      } else {
        const value = stateModule.stateGet(cwd, field);
        const result = JSON.stringify({ field, value });
        process.stdout.write(result + '\n');
      }
      break;
    }

    case 'update': {
      const field = args[0];
      const value = args.slice(1).join(' ');
      if (!field || !value) {
        error('Usage: rapid-tools state update <field> <value>');
        process.exit(1);
      }
      const result = await stateModule.stateUpdate(cwd, field, value);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      error(`Unknown state subcommand: ${subcommand}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

function handleAssembleAgent(cwd, args) {
  const { assembleAgent, listModules, validateConfig } = require('../lib/assembler.cjs');
  const { loadConfig, resolveRapidDir } = require('../lib/core.cjs');
  const path = require('path');

  // Handle --list flag
  if (args.includes('--list')) {
    const modules = listModules();
    output('Available modules:');
    output(`  Core (${modules.core.length}):`);
    for (const mod of modules.core) {
      output(`    - ${mod}`);
    }
    output(`  Roles (${modules.roles.length}):`);
    for (const mod of modules.roles) {
      output(`    - ${mod}`);
    }
    return;
  }

  // Handle --validate flag
  if (args.includes('--validate')) {
    const config = loadConfig(cwd);
    const result = validateConfig(config);
    if (result.valid) {
      output('Configuration is valid.');
    } else {
      error('Configuration errors:');
      for (const err of result.errors) {
        error(`  - ${err}`);
      }
      process.exit(1);
    }
    return;
  }

  // assemble-agent <role>
  const role = args[0];
  if (!role) {
    error('Usage: rapid-tools assemble-agent <role> | --list | --validate');
    process.exit(1);
  }

  const config = loadConfig(cwd);
  const agentName = `rapid-${role}`;
  const agentConfig = config.agents[agentName];

  if (!agentConfig) {
    error(`Unknown agent: ${agentName}. Available: ${Object.keys(config.agents).join(', ')}`);
    process.exit(1);
  }

  const rapidDir = resolveRapidDir();
  const agentsDir = path.join(rapidDir, 'agents');
  const outputPath = path.join(agentsDir, `${agentName}.md`);

  const result = assembleAgent({
    role: agentConfig.role,
    coreModules: agentConfig.core,
    context: {},
    outputPath,
  });

  output(`Assembled ${agentName} -> ${result}`);
}

function handleParseReturn(args) {
  const fs = require('fs');
  const { parseReturn, validateReturn } = require('../lib/returns.cjs');

  const doValidate = args.includes('--validate');
  const filePath = args.filter(a => !a.startsWith('--'))[0];

  if (!filePath) {
    error('Usage: rapid-tools parse-return [--validate] <file>');
    process.exit(1);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    error(`Cannot read file: ${err.message}`);
    process.exit(1);
  }

  const result = parseReturn(content);

  if (doValidate && result.parsed) {
    const validation = validateReturn(result.data);
    process.stdout.write(JSON.stringify({ ...result, validation }) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
}

function handleVerifyArtifacts(args) {
  // Will be fully implemented in Task 2
  let verifyModule;
  try {
    verifyModule = require('../lib/verify.cjs');
  } catch (err) {
    error('Verify module not yet available. It will be added in a subsequent task.');
    process.exit(1);
  }

  const isHeavy = args.includes('--heavy');
  const isReport = args.includes('--report');
  let testCommand = null;

  const testIdx = args.indexOf('--test');
  if (testIdx !== -1 && args[testIdx + 1]) {
    testCommand = args[testIdx + 1];
  }

  // Collect file paths (skip flags and their arguments)
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--heavy' || args[i] === '--report') continue;
    if (args[i] === '--test') { i++; continue; }
    if (!args[i].startsWith('--')) {
      files.push(args[i]);
    }
  }

  if (files.length === 0) {
    error('Usage: rapid-tools verify-artifacts [--heavy --test "<cmd>"] [--report] <file1> [file2...]');
    process.exit(1);
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

function handleInit(args) {
  const { scaffoldProject, detectExisting } = require('../lib/init.cjs');

  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: rapid-tools init <detect|scaffold> [options]');
    process.exit(1);
  }

  if (subcommand === 'detect') {
    const result = detectExisting(process.cwd());
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (subcommand === 'scaffold') {
    // Parse named arguments
    let name = null;
    let desc = null;
    let teamSize = null;
    let mode = 'fresh';

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--name':
          name = args[++i];
          break;
        case '--desc':
          desc = args[++i];
          break;
        case '--team-size':
          teamSize = parseInt(args[++i], 10);
          break;
        case '--mode':
          mode = args[++i];
          break;
      }
    }

    // Cancel mode doesn't require other args
    if (mode === 'cancel') {
      const result = scaffoldProject(process.cwd(), {}, mode);
      process.stdout.write(JSON.stringify(result) + '\n');
      return;
    }

    if (!name || !desc || !teamSize) {
      error('Usage: rapid-tools init scaffold --name <name> --desc <description> --team-size <N> [--mode fresh|reinitialize|upgrade|cancel]');
      process.exit(1);
    }

    const result = scaffoldProject(process.cwd(), { name, description: desc, teamSize }, mode);
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  error(`Unknown init subcommand: ${subcommand}. Use 'detect' or 'scaffold'.`);
  process.exit(1);
}

async function handlePrereqs(args) {
  const { validatePrereqs, checkGitRepo, formatPrereqSummary } = require('../lib/prereqs.cjs');

  // --git-check: Check if cwd is a git repository
  if (args.includes('--git-check')) {
    const result = checkGitRepo(process.cwd());
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  // Run prerequisite validation
  const results = await validatePrereqs();

  // --json: Output raw JSON array
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(results) + '\n');
    return;
  }

  // Default: Output formatted summary with results
  const summary = formatPrereqSummary(results);
  const output = { results, summary: { table: summary.table, hasBlockers: summary.hasBlockers, hasWarnings: summary.hasWarnings } };
  process.stdout.write(JSON.stringify(output) + '\n');
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
