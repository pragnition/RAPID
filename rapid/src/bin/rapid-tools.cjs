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
  context detect         Detect codebase characteristics (languages, frameworks, configs)
  context generate       Ensure .planning/context/ directory exists and return its path
  plan create-set             Create a set from JSON on stdin
  plan decompose              Decompose sets from JSON array on stdin
  plan write-dag              Write DAG.json from JSON on stdin
  plan check-gate <wave>      Check planning gate status for a wave (verifies artifacts on disk)
  plan update-gate <set>      Mark a set as planned (update gate)
  plan list-sets              List all defined sets
  plan load-set <name>        Load a set's definition and contract
  assumptions [set-name]      Surface assumptions about a set (or list sets)
  worktree create <set-name>  Create worktree and branch for a set
  worktree list               List all registered worktrees with status
  worktree cleanup <set-name> Remove a worktree (blocks if dirty)
  worktree reconcile          Sync registry with actual git state
  worktree status             Show all worktrees with status table
  worktree status --json      Machine-readable worktree status
  worktree generate-claude-md <set>  Generate scoped CLAUDE.md for a worktree
  execute prepare-context <set>  Prepare execution context for a set
  execute verify <set> --branch <branch>  Verify set execution results
  execute generate-stubs <set>   Generate contract stubs for a set's imports
  execute cleanup-stubs <set>    Remove stub files from a set's worktree
  execute wave-status             Show execution progress per wave
  execute update-phase <set> <phase>  Update a set's lifecycle phase in registry

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
  if (command === 'context') {
    handleContext(args.slice(1));
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

    case 'plan':
      handlePlan(cwd, subcommand, args.slice(2));
      break;

    case 'assumptions':
      handleAssumptions(cwd, args.slice(1));
      break;

    case 'worktree':
      await handleWorktree(cwd, subcommand, args.slice(2));
      break;

    case 'execute':
      await handleExecute(cwd, subcommand, args.slice(2));
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
  const { assembleAgent, listModules, validateConfig, loadContextFiles } = require('../lib/assembler.cjs');
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

  const contextFiles = loadContextFiles(cwd, agentConfig.context_files || []);

  const result = assembleAgent({
    role: agentConfig.role,
    coreModules: agentConfig.core,
    context: { contextFiles },
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

function handleContext(args) {
  const fs = require('fs');
  const path = require('path');

  const subcommand = args[0];
  if (!subcommand) {
    error('Usage: rapid-tools context <detect|generate> [options]');
    process.exit(1);
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
      error(`Cannot find project root: ${err.message}`);
      process.exit(1);
    }
    // generate just ensures .planning/context/ dir exists and outputs the path
    const contextDir = path.join(cwd, '.planning', 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    process.stdout.write(JSON.stringify({ contextDir, ready: true }) + '\n');
    return;
  }

  error(`Unknown context subcommand: ${subcommand}. Use 'detect' or 'generate'.`);
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

function handlePlan(cwd, subcommand, args) {
  const fs = require('fs');
  const plan = require('../lib/plan.cjs');

  switch (subcommand) {
    case 'create-set': {
      // Reads set definition from stdin (JSON)
      // Usage: echo '{"name":"auth",...}' | rapid-tools plan create-set
      const input = fs.readFileSync(0, 'utf-8');
      const setDef = JSON.parse(input);
      const result = plan.createSet(cwd, setDef);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'decompose': {
      // Reads array of set definitions from stdin (JSON)
      // Usage: echo '[{...}, {...}]' | rapid-tools plan decompose
      const input = fs.readFileSync(0, 'utf-8');
      const setDefs = JSON.parse(input);
      const result = plan.decomposeIntoSets(cwd, setDefs);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'write-dag': {
      // Reads DAG object from stdin
      const input = fs.readFileSync(0, 'utf-8');
      const dagObj = JSON.parse(input);
      plan.writeDAG(cwd, dagObj);
      process.stdout.write(JSON.stringify({ written: true, path: '.planning/sets/DAG.json' }) + '\n');
      break;
    }

    case 'check-gate': {
      // Usage: rapid-tools plan check-gate <wave-number>
      const wave = parseInt(args[0], 10);
      if (isNaN(wave)) {
        error('Usage: rapid-tools plan check-gate <wave-number>');
        process.exit(1);
      }
      const result = plan.checkPlanningGateArtifact(cwd, wave);
      process.stdout.write(JSON.stringify(result) + '\n');
      // Enhanced stderr output for actionable guidance
      if (result.missingArtifacts && result.missingArtifacts.length > 0) {
        const blockers = result.missingArtifacts.map(a => `${a.set} (missing ${a.file})`).join(', ');
        const readySets = result.required.filter(s => !result.missingArtifacts.some(a => a.set === s));
        const readyText = readySets.length > 0 ? ` Ready: ${readySets.join(', ')}.` : '';
        process.stderr.write(`Gate blocked: ${blockers}.${readyText} Run /rapid:plan to continue.\n`);
      } else if (!result.open && result.missing.length > 0) {
        process.stderr.write(`Gate blocked: ${result.missing.join(', ')} not yet planned. Run /rapid:plan to continue.\n`);
      }
      break;
    }

    case 'update-gate': {
      // Usage: rapid-tools plan update-gate <set-name>
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools plan update-gate <set-name>');
        process.exit(1);
      }
      plan.updateGate(cwd, setName);
      process.stdout.write(JSON.stringify({ updated: true, set: setName }) + '\n');
      break;
    }

    case 'list-sets': {
      const sets = plan.listSets(cwd);
      process.stdout.write(JSON.stringify({ sets }) + '\n');
      break;
    }

    case 'load-set': {
      // Usage: rapid-tools plan load-set <set-name>
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools plan load-set <set-name>');
        process.exit(1);
      }
      const set = plan.loadSet(cwd, setName);
      process.stdout.write(JSON.stringify(set) + '\n');
      break;
    }

    default:
      error(`Unknown plan subcommand: ${subcommand}. Use: create-set, decompose, write-dag, check-gate, update-gate, list-sets, load-set`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

function handleAssumptions(cwd, args) {
  const plan = require('../lib/plan.cjs');

  const setName = args[0];
  if (!setName) {
    // If no set name, list available sets
    const sets = plan.listSets(cwd);
    if (sets.length === 0) {
      error('No sets found. Run /rapid:plan first to create sets.');
      process.exit(1);
    }
    process.stdout.write(JSON.stringify({ availableSets: sets, usage: 'rapid-tools assumptions <set-name>' }) + '\n');
    return;
  }

  try {
    const assumptions = plan.surfaceAssumptions(cwd, setName);
    process.stdout.write(assumptions + '\n');
  } catch (err) {
    error(`Cannot surface assumptions for set "${setName}": ${err.message}`);
    process.exit(1);
  }
}

async function handleWorktree(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools worktree create <set-name>');
        process.exit(1);
      }
      try {
        const { branch, path: wtPath } = wt.createWorktree(cwd, setName);
        // Register in REGISTRY.json
        await wt.registryUpdate(cwd, (reg) => {
          reg.worktrees[setName] = {
            setName,
            branch,
            path: path.relative(cwd, wtPath),
            phase: 'Created',
            status: 'active',
            wave: null,
            createdAt: new Date().toISOString(),
          };
          return reg;
        });
        process.stdout.write(JSON.stringify({ created: true, branch, path: wtPath, setName }) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'list': {
      const registry = await wt.reconcileRegistry(cwd);
      process.stdout.write(JSON.stringify({ worktrees: Object.values(registry.worktrees) }) + '\n');
      break;
    }

    case 'cleanup': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools worktree cleanup <set-name>');
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      // Resolve absolute path from the stored relative path
      const absolutePath = path.resolve(cwd, entry.path);
      const result = wt.removeWorktree(cwd, absolutePath);
      if (result.removed) {
        // Deregister from REGISTRY.json
        await wt.registryUpdate(cwd, (reg) => {
          delete reg.worktrees[setName];
          return reg;
        });
        process.stdout.write(JSON.stringify({ removed: true, setName }) + '\n');
      } else {
        process.stdout.write(JSON.stringify({ removed: false, reason: result.reason, setName, message: result.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'reconcile': {
      const beforeRegistry = wt.loadRegistry(cwd);
      const beforeEntries = Object.keys(beforeRegistry.worktrees);
      const beforeStatuses = {};
      for (const [k, v] of Object.entries(beforeRegistry.worktrees)) {
        beforeStatuses[k] = v.status;
      }

      const reconciled = await wt.reconcileRegistry(cwd);
      const afterEntries = Object.keys(reconciled.worktrees);

      // Count orphaned: entries that changed to 'orphaned' status
      let orphaned = 0;
      for (const [k, v] of Object.entries(reconciled.worktrees)) {
        if (v.status === 'orphaned' && beforeStatuses[k] !== 'orphaned') {
          orphaned++;
        }
      }

      // Count discovered: new entries that weren't in before
      let discovered = 0;
      for (const k of afterEntries) {
        if (!beforeEntries.includes(k)) {
          discovered++;
        }
      }

      process.stdout.write(JSON.stringify({ reconciled: true, orphaned, discovered }) + '\n');
      break;
    }

    case 'status': {
      const registry = await wt.reconcileRegistry(cwd);
      const isJson = args.includes('--json');

      if (isJson) {
        // Machine-readable JSON output
        let dagJson = null;
        try {
          const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
          dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
        } catch (err) {
          // Graceful -- no DAG available
        }
        const waveSummary = dagJson && dagJson.waves ? dagJson.waves : null;
        process.stdout.write(JSON.stringify({
          worktrees: Object.values(registry.worktrees),
          waves: waveSummary,
        }) + '\n');
      } else {
        // Human-readable table output
        let dagJson = null;
        try {
          const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
          dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
        } catch (err) {
          // Graceful -- no DAG available
        }
        const waveSummary = wt.formatWaveSummary(registry, dagJson);
        const table = wt.formatStatusTable(Object.values(registry.worktrees), dagJson);
        let output = '';
        if (waveSummary) {
          output += waveSummary + '\n\n';
        }
        output += table;
        process.stdout.write(output + '\n');
      }
      break;
    }

    case 'generate-claude-md': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools worktree generate-claude-md <set-name>');
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      const md = wt.generateScopedClaudeMd(cwd, setName);
      const wtClaudeMdPath = path.join(path.resolve(cwd, entry.path), 'CLAUDE.md');
      fs.mkdirSync(path.dirname(wtClaudeMdPath), { recursive: true });
      fs.writeFileSync(wtClaudeMdPath, md, 'utf-8');
      process.stdout.write(JSON.stringify({ generated: true, setName, path: wtClaudeMdPath }) + '\n');
      break;
    }

    default:
      error(`Unknown worktree subcommand: ${subcommand}. Use: create, list, cleanup, reconcile, status, generate-claude-md`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleExecute(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const execute = require('../lib/execute.cjs');
  const stub = require('../lib/stub.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'prepare-context': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute prepare-context <set-name>');
        process.exit(1);
      }
      const context = execute.prepareSetContext(cwd, setName);
      const result = {
        setName: context.setName,
        scopedMdPreview: context.scopedMd.slice(0, 200) + '...',
        definitionLength: context.definition.length,
        contractKeys: Object.keys(JSON.parse(context.contractStr)),
      };
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'verify': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute verify <set-name> --branch <branch>');
        process.exit(1);
      }
      // Parse --branch flag
      let branch = 'main';
      const branchIdx = args.indexOf('--branch');
      if (branchIdx !== -1 && args[branchIdx + 1]) {
        branch = args[branchIdx + 1];
      }
      // Load registry to find worktree path
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      const worktreePath = path.resolve(cwd, entry.path);
      // Try to load LAST_RETURN.json
      const returnPath = path.join(cwd, '.planning', 'sets', setName, 'LAST_RETURN.json');
      let returnData;
      try {
        returnData = JSON.parse(fs.readFileSync(returnPath, 'utf-8'));
      } catch (err) {
        error(`Cannot read ${returnPath}: ${err.message}. Create LAST_RETURN.json first.`);
        process.exit(1);
      }
      const results = execute.verifySetExecution(cwd, setName, returnData, worktreePath, branch);
      process.stdout.write(JSON.stringify(results) + '\n');
      break;
    }

    case 'generate-stubs': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute generate-stubs <set-name>');
        process.exit(1);
      }
      const stubPaths = stub.generateStubFiles(cwd, setName);
      process.stdout.write(JSON.stringify({ setName, stubs: stubPaths }) + '\n');
      break;
    }

    case 'cleanup-stubs': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute cleanup-stubs <set-name>');
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      const worktreePath = path.resolve(cwd, entry.path);
      const result = stub.cleanupStubFiles(worktreePath);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'wave-status': {
      const dag = require('../lib/dag.cjs');
      // Load DAG.json
      let dagJson = null;
      try {
        const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
        dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
      } catch (err) {
        error('No DAG.json found. Run /rapid:plan first to create sets and DAG.');
        process.exit(1);
      }
      // Load and reconcile registry
      const registry = await wt.reconcileRegistry(cwd);
      const executionOrder = dag.getExecutionOrder(dagJson);

      // Build wave status
      const waves = executionOrder.map((sets, index) => {
        const waveNum = index + 1;
        const setStatuses = sets.map(setName => {
          const entry = registry.worktrees[setName];
          return {
            name: setName,
            phase: entry ? entry.phase : 'Pending',
            status: entry ? entry.status : 'not-started',
          };
        });
        // Gate is open if all sets in the wave are Done
        const gateOpen = setStatuses.every(s => s.phase === 'Done');
        return { wave: waveNum, sets: setStatuses, gateOpen };
      });

      // JSON output
      process.stdout.write(JSON.stringify({ waves }) + '\n');

      // Human-readable fallback on stderr
      const waveSummary = wt.formatWaveSummary(registry, dagJson);
      if (waveSummary) {
        process.stderr.write(waveSummary + '\n');
      }
      break;
    }

    case 'update-phase': {
      const setName = args[0];
      const phase = args[1];
      if (!setName || !phase) {
        error('Usage: rapid-tools execute update-phase <set-name> <phase>');
        process.exit(1);
      }
      const validPhases = ['Discussing', 'Planning', 'Executing', 'Verifying', 'Done', 'Error', 'Paused'];
      if (!validPhases.includes(phase)) {
        error(`Invalid phase: "${phase}". Must be one of: ${validPhases.join(', ')}`);
        process.exit(1);
      }
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].phase = phase;
          reg.worktrees[setName].updatedAt = new Date().toISOString();
        } else {
          // Create entry if not present (set may not have a worktree yet)
          reg.worktrees[setName] = {
            setName,
            branch: `rapid/${setName}`,
            path: `.rapid-worktrees/${setName}`,
            phase,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return reg;
      });
      process.stdout.write(JSON.stringify({ updated: true, setName, phase }) + '\n');
      break;
    }

    default:
      error(`Unknown execute subcommand: ${subcommand}. Use: prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
