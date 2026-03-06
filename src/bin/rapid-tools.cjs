#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { acquireLock, isLocked } = require('../lib/lock.cjs');

const USAGE = `Usage: rapid-tools <command> [subcommand] [args...]

Commands:
  lock acquire <name>    Acquire a named lock
  lock status <name>     Check if a named lock is held
  lock release <name>    Release a named lock (not typically used directly)
  state get --all                                     Read full STATE.json
  state get milestone <id>                            Read milestone
  state get set <milestoneId> <setId>                 Read set
  state get wave <milestoneId> <setId> <waveId>       Read wave
  state get job <milestoneId> <setId> <waveId> <jobId>  Read job
  state transition set <milestoneId> <setId> <status>   Transition set status
  state transition wave <milestoneId> <setId> <waveId> <status>  Transition wave
  state transition job <milestoneId> <setId> <waveId> <jobId> <status>  Transition job
  state add-milestone --id <id> [--name <name>]        Add new milestone (stdin: JSON sets)
  state detect-corruption                             Check STATE.json integrity
  state recover                                       Recover STATE.json from git
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
  worktree delete-branch <branch> [--force]  Delete a git branch (safe or forced)
  resume <set-name>              Resume a paused set (extends execute resume with STATE.json)
  execute prepare-context <set>  Prepare execution context for a set
  execute verify <set> --branch <branch>  Verify set execution results
  execute generate-stubs <set>   Generate contract stubs for a set's imports
  execute cleanup-stubs <set>    Remove stub files from a set's worktree
  execute wave-status             Show execution progress per wave
  execute update-phase <set> <phase>  Update a set's lifecycle phase in registry
  execute pause <set>             Pause execution and write HANDOFF.md (reads CHECKPOINT JSON from stdin)
  execute resume <set>            Resume execution from HANDOFF.md
  execute reconcile <wave>        Reconcile a wave and write WAVE-{N}-SUMMARY.md
  execute detect-mode             Detect if agent teams mode is available
  merge review <set>              Run programmatic gate + write REVIEW.md
  merge execute <set>             Merge set branch into main (--no-ff)
  merge status                    Show merge pipeline status (per-set verdicts)
  merge integration-test          Run post-wave integration test suite on main
  merge order                     Show merge order from DAG (wave-grouped)
  merge update-status <set> <status>  Update merge status in registry (reviewing/cleanup/merged/failed)
  set-init create <set-name>     Initialize a set: create worktree + scoped CLAUDE.md + register
  set-init list-available        List pending sets without worktrees

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

    case 'merge':
      await handleMerge(cwd, subcommand, args.slice(2));
      break;

    case 'set-init':
      await handleSetInit(cwd, subcommand, args.slice(2));
      break;

    case 'resume':
      await handleResume(cwd, args.slice(1));
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
  const sm = require('../lib/state-machine.cjs');

  try {
    switch (subcommand) {
      case 'get': {
        const target = args[0];
        if (!target) {
          error('Usage: rapid-tools state get --all | milestone <id> | set <m> <s> | wave <m> <s> <w> | job <m> <s> <w> <j>');
          process.exit(1);
        }

        if (target === '--all') {
          const result = await sm.readState(cwd);
          if (result === null) {
            error('STATE.json not found. Run init to create project state.');
            process.exit(1);
          }
          if (!result.valid) {
            error('STATE.json is invalid: ' + JSON.stringify(result.errors));
            process.exit(1);
          }
          process.stdout.write(JSON.stringify(result.state, null, 2) + '\n');
          break;
        }

        // Hierarchy lookups: need to read state first
        const readResult = await sm.readState(cwd);
        if (readResult === null) {
          error('STATE.json not found.');
          process.exit(1);
        }
        if (!readResult.valid) {
          error('STATE.json is invalid: ' + JSON.stringify(readResult.errors));
          process.exit(1);
        }
        const state = readResult.state;

        switch (target) {
          case 'milestone': {
            const milestoneId = args[1];
            if (!milestoneId) { error('Usage: state get milestone <id>'); process.exit(1); }
            const milestone = sm.findMilestone(state, milestoneId);
            process.stdout.write(JSON.stringify(milestone, null, 2) + '\n');
            break;
          }
          case 'set': {
            const [, mId, sId] = args;
            if (!mId || !sId) { error('Usage: state get set <milestoneId> <setId>'); process.exit(1); }
            const set = sm.findSet(state, mId, sId);
            process.stdout.write(JSON.stringify(set, null, 2) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId] = args;
            if (!mId || !sId || !wId) { error('Usage: state get wave <milestoneId> <setId> <waveId>'); process.exit(1); }
            const wave = sm.findWave(state, mId, sId, wId);
            process.stdout.write(JSON.stringify(wave, null, 2) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId] = args;
            if (!mId || !sId || !wId || !jId) { error('Usage: state get job <milestoneId> <setId> <waveId> <jobId>'); process.exit(1); }
            const job = sm.findJob(state, mId, sId, wId, jId);
            process.stdout.write(JSON.stringify(job, null, 2) + '\n');
            break;
          }
          default:
            error(`Unknown state get target: ${target}. Use --all, milestone, set, wave, or job.`);
            process.exit(1);
        }
        break;
      }

      case 'transition': {
        const entity = args[0];
        if (!entity) {
          error('Usage: rapid-tools state transition set|wave|job <...ids> <newStatus>');
          process.exit(1);
        }

        switch (entity) {
          case 'set': {
            const [, mId, sId, newStatus] = args;
            if (!mId || !sId || !newStatus) {
              error('Usage: state transition set <milestoneId> <setId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionSet(cwd, mId, sId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'set', id: sId, status: newStatus }) + '\n');
            break;
          }
          case 'wave': {
            const [, mId, sId, wId, newStatus] = args;
            if (!mId || !sId || !wId || !newStatus) {
              error('Usage: state transition wave <milestoneId> <setId> <waveId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionWave(cwd, mId, sId, wId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'wave', id: wId, status: newStatus }) + '\n');
            break;
          }
          case 'job': {
            const [, mId, sId, wId, jId, newStatus] = args;
            if (!mId || !sId || !wId || !jId || !newStatus) {
              error('Usage: state transition job <milestoneId> <setId> <waveId> <jobId> <newStatus>');
              process.exit(1);
            }
            await sm.transitionJob(cwd, mId, sId, wId, jId, newStatus);
            process.stdout.write(JSON.stringify({ transitioned: true, entity: 'job', id: jId, status: newStatus }) + '\n');
            break;
          }
          default:
            error(`Unknown transition entity: ${entity}. Use set, wave, or job.`);
            process.exit(1);
        }
        break;
      }

      case 'add-milestone': {
        // Parse --id and --name from args
        let id = null;
        let name = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--id' && args[i + 1]) { id = args[i + 1]; i++; }
          if (args[i] === '--name' && args[i + 1]) { name = args[i + 1]; i++; }
        }
        if (!id) {
          error('Usage: state add-milestone --id <milestoneId> [--name <milestoneName>]');
          process.exit(1);
        }

        // Read stdin for carryForwardSets JSON (optional)
        let carryForwardSets = [];
        if (!process.stdin.isTTY) {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          const stdinData = Buffer.concat(chunks).toString('utf-8').trim();
          if (stdinData) {
            try {
              carryForwardSets = JSON.parse(stdinData);
              if (!Array.isArray(carryForwardSets)) {
                error('stdin must be a JSON array of sets');
                process.exit(1);
              }
            } catch (e) {
              error('Invalid JSON on stdin: ' + e.message);
              process.exit(1);
            }
          }
        }

        const result = await sm.addMilestone(cwd, id, name, carryForwardSets);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }

      case 'detect-corruption': {
        const result = sm.detectCorruption(cwd);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        break;
      }

      case 'recover': {
        sm.recoverFromGit(cwd);
        process.stdout.write(JSON.stringify({ recovered: true }) + '\n');
        break;
      }

      default:
        error(`Unknown state subcommand: ${subcommand}`);
        process.stdout.write(USAGE);
        process.exit(1);
    }
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
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

  if (subcommand === 'research-dir') {
    const fs = require('fs');
    const path = require('path');
    const researchDir = path.join(process.cwd(), '.planning', 'research');
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }
    process.stdout.write(JSON.stringify({ researchDir, ready: true }) + '\n');
    return;
  }

  if (subcommand === 'write-config') {
    const fs = require('fs');
    const path = require('path');
    const { generateConfigJson } = require('../lib/init.cjs');
    let model = null;
    let teamSize = null;
    let name = null;

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--model':
          model = args[++i];
          break;
        case '--team-size':
          teamSize = parseInt(args[++i], 10);
          break;
        case '--name':
          name = args[++i];
          break;
      }
    }

    const opts = {};
    if (model) opts.model = model;
    if (teamSize) opts.teamSize = teamSize;
    if (name) opts.name = name;

    const configContent = generateConfigJson(opts);
    const configPath = path.join(process.cwd(), '.planning', 'config.json');

    // Ensure .planning/ exists
    const planningDir = path.join(process.cwd(), '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    fs.writeFileSync(configPath, configContent);
    process.stdout.write(JSON.stringify({ written: true, configPath }) + '\n');
    return;
  }

  error(`Unknown init subcommand: ${subcommand}. Use 'detect', 'scaffold', 'research-dir', or 'write-config'.`);
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

    case 'status-v2': {
      // Mark II hierarchy dashboard from STATE.json
      const stateMachine = require('../lib/state-machine.cjs');
      const stateResult = await stateMachine.readState(cwd);

      if (!stateResult || !stateResult.valid) {
        error('STATE.json not found or invalid. Run /rapid:init to set up Mark II state.');
        process.exit(1);
      }

      const state = stateResult.state;
      const milestoneId = state.currentMilestone;
      const milestone = stateMachine.findMilestone(state, milestoneId);
      const registry = wt.loadRegistry(cwd);

      const stateData = {
        milestone: milestoneId,
        sets: milestone.sets,
      };

      const table = wt.formatMarkIIStatus(stateData, registry);
      const actions = wt.deriveNextActions(stateData, registry);

      // Human-readable table to stderr (same pattern as wave-status)
      process.stderr.write(table + '\n');

      // JSON to stdout
      process.stdout.write(JSON.stringify({
        table,
        actions,
        milestone: milestoneId,
      }) + '\n');
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

    case 'delete-branch': {
      const branchName = args[0];
      if (!branchName) {
        error('Usage: rapid-tools worktree delete-branch <branch-name> [--force]');
        process.exit(1);
      }
      const force = args.includes('--force');
      try {
        const result = wt.deleteBranch(cwd, branchName, force);
        process.stdout.write(JSON.stringify(result) + '\n');
        if (!result.deleted) {
          process.exit(1);
        }
      } catch (err) {
        process.stdout.write(JSON.stringify({ deleted: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    default:
      error(`Unknown worktree subcommand: ${subcommand}. Use: create, list, cleanup, reconcile, status, status-v2, generate-claude-md, delete-branch`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleSetInit(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'create': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools set-init create <set-name>');
        process.exit(1);
      }
      try {
        const result = await wt.setInit(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ created: false, error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    case 'list-available': {
      // Read STATE.json, find all sets with status 'pending' that don't have worktrees
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (!stateResult || !stateResult.valid) {
          process.stdout.write(JSON.stringify({ available: [], error: 'STATE.json not found or invalid' }) + '\n');
          break;
        }

        const registry = wt.loadRegistry(cwd);
        const registeredSets = new Set(Object.keys(registry.worktrees));

        const available = [];
        for (const milestone of stateResult.state.milestones) {
          for (const set of (milestone.sets || [])) {
            if (set.status === 'pending' && !registeredSets.has(set.id)) {
              available.push({
                id: set.id,
                milestone: milestone.id,
                status: set.status,
              });
            }
          }
        }

        process.stdout.write(JSON.stringify({ available }) + '\n');
      } catch (err) {
        process.stdout.write(JSON.stringify({ available: [], error: err.message }) + '\n');
        process.exit(1);
      }
      break;
    }

    default:
      error(`Unknown set-init subcommand: ${subcommand}. Use: create, list-available`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleResume(cwd, args) {
  const fs = require('fs');
  const path = require('path');
  const execute = require('../lib/execute.cjs');
  const wt = require('../lib/worktree.cjs');

  const setName = args[0];
  if (!setName) {
    error('Usage: rapid-tools resume <set-name>');
    process.exit(1);
  }

  // Validate registry entry exists and is Paused
  const registry = wt.loadRegistry(cwd);
  const entry = registry.worktrees[setName];
  if (!entry) {
    error(`No worktree registered for set "${setName}"`);
    process.exit(1);
  }
  if (entry.phase !== 'Paused') {
    error(`Set "${setName}" is in phase "${entry.phase}", not Paused. Resume is only available for paused sets.`);
    process.exit(1);
  }

  // Validate HANDOFF.md exists
  const handoffPath = path.join(cwd, '.planning', 'sets', setName, 'HANDOFF.md');
  if (!fs.existsSync(handoffPath)) {
    error(`No HANDOFF.md found for set "${setName}" at ${handoffPath}`);
    process.exit(1);
  }

  // Parse HANDOFF.md
  const handoffRaw = fs.readFileSync(handoffPath, 'utf-8');
  const handoff = execute.parseHandoff(handoffRaw);
  if (!handoff) {
    error(`Failed to parse HANDOFF.md for set "${setName}"`);
    process.exit(1);
  }

  // Read STATE.json for set context (wave/job progress)
  let stateContext = null;
  try {
    const sm = require('../lib/state-machine.cjs');
    const stateResult = await sm.readState(cwd);
    if (stateResult && stateResult.valid) {
      // Find the set in state
      for (const milestone of stateResult.state.milestones) {
        const setData = (milestone.sets || []).find(s => s.id === setName);
        if (setData) {
          stateContext = {
            milestoneId: milestone.id,
            setId: setData.id,
            status: setData.status,
            waves: setData.waves || [],
          };
          break;
        }
      }
    }
  } catch (err) {
    // Graceful -- STATE.json may not exist or be invalid
  }

  // Get definition and contract paths
  const definitionPath = path.join('.planning', 'sets', setName, 'DEFINITION.md');
  const contractPath = path.join('.planning', 'sets', setName, 'CONTRACT.json');

  // Update registry: phase = Executing
  await wt.registryUpdate(cwd, (reg) => {
    if (reg.worktrees[setName]) {
      reg.worktrees[setName].phase = 'Executing';
      reg.worktrees[setName].updatedAt = new Date().toISOString();
    }
    return reg;
  });

  process.stdout.write(JSON.stringify({
    resumed: true,
    setName,
    handoff,
    stateContext,
    definitionPath,
    contractPath,
    pauseCycles: entry.pauseCycles || 0,
  }) + '\n');
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

    case 'pause': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute pause <set-name>');
        process.exit(1);
      }
      // Validate registry entry exists and phase is Executing
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      if (entry.phase !== 'Executing') {
        error(`Set "${setName}" is in phase "${entry.phase}", not Executing. Pause is only available during execution.`);
        process.exit(1);
      }
      // Read CHECKPOINT data from stdin (JSON)
      let checkpointData;
      try {
        const input = fs.readFileSync(0, 'utf-8');
        checkpointData = JSON.parse(input);
      } catch (err) {
        error(`Failed to read CHECKPOINT JSON from stdin: ${err.message}`);
        process.exit(1);
      }
      // Load current pauseCycles from registry entry (default 0), increment
      const pauseCycles = (entry.pauseCycles || 0) + 1;
      if (pauseCycles >= 3) {
        process.stderr.write(`Warning: Set "${setName}" has been paused ${pauseCycles} times. Consider replanning this set.\n`);
      }
      // Generate HANDOFF.md content
      const handoffContent = execute.generateHandoff(checkpointData, setName, pauseCycles);
      const handoffPath = path.join(cwd, '.planning', 'sets', setName, 'HANDOFF.md');
      fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
      fs.writeFileSync(handoffPath, handoffContent, 'utf-8');
      // Update registry: phase = Paused, pauseCycles, updatedAt
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].phase = 'Paused';
          reg.worktrees[setName].pauseCycles = pauseCycles;
          reg.worktrees[setName].updatedAt = new Date().toISOString();
        }
        return reg;
      });
      process.stdout.write(JSON.stringify({ paused: true, setName, pauseCycles, handoffPath }) + '\n');
      break;
    }

    case 'resume': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools execute resume <set-name>');
        process.exit(1);
      }
      // Validate registry entry exists and is Paused
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setName];
      if (!entry) {
        error(`No worktree registered for set "${setName}"`);
        process.exit(1);
      }
      if (entry.phase !== 'Paused') {
        error(`Set "${setName}" is in phase "${entry.phase}", not Paused. Resume is only available for paused sets.`);
        process.exit(1);
      }
      // Validate HANDOFF.md exists
      const handoffPath = path.join(cwd, '.planning', 'sets', setName, 'HANDOFF.md');
      if (!fs.existsSync(handoffPath)) {
        error(`No HANDOFF.md found for set "${setName}" at ${handoffPath}`);
        process.exit(1);
      }
      // Read and parse HANDOFF.md
      const handoffRaw = fs.readFileSync(handoffPath, 'utf-8');
      const handoff = execute.parseHandoff(handoffRaw);
      if (!handoff) {
        error(`Failed to parse HANDOFF.md for set "${setName}"`);
        process.exit(1);
      }
      // Get definition and contract paths for the orchestrator
      const definitionPath = path.join('.planning', 'sets', setName, 'DEFINITION.md');
      const contractPath = path.join('.planning', 'sets', setName, 'CONTRACT.json');
      // Update registry: phase = Executing, updatedAt
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].phase = 'Executing';
          reg.worktrees[setName].updatedAt = new Date().toISOString();
        }
        return reg;
      });
      process.stdout.write(JSON.stringify({
        resumed: true,
        setName,
        handoff,
        definitionPath,
        contractPath,
      }) + '\n');
      break;
    }

    case 'reconcile': {
      const dag = require('../lib/dag.cjs');
      const waveNum = parseInt(args[0], 10);
      if (isNaN(waveNum)) {
        error('Usage: rapid-tools execute reconcile <wave-number> [--mode <mode>]');
        process.exit(1);
      }
      // Check for --mode flag
      const modeIdx = args.indexOf('--mode');
      const executionMode = modeIdx >= 0 ? args[modeIdx + 1] : undefined;
      // Load DAG.json and registry
      let dagJson;
      try {
        const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
        dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
      } catch (err) {
        error(`Cannot read DAG.json: ${err.message}`);
        process.exit(1);
      }
      const registry = wt.loadRegistry(cwd);
      // Run reconciliation
      const reconcileResult = execute.reconcileWave(cwd, waveNum, dagJson, registry);
      // Generate summary (pass executionMode for wave summary metadata)
      const summaryContent = execute.generateWaveSummary(waveNum, reconcileResult, new Date().toISOString(), executionMode);
      // Write summary
      const wavesDir = path.join(cwd, '.planning', 'waves');
      fs.mkdirSync(wavesDir, { recursive: true });
      const summaryPath = path.join(wavesDir, `WAVE-${waveNum}-SUMMARY.md`);
      fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
      // JSON output on stdout
      process.stdout.write(JSON.stringify({
        waveNum,
        overall: reconcileResult.overall,
        hardBlocks: reconcileResult.hardBlocks,
        softBlocks: reconcileResult.softBlocks,
        summaryPath,
      }) + '\n');
      // Human-readable summary on stderr
      process.stderr.write(`\nWave ${waveNum} Reconciliation: ${reconcileResult.overall}\n`);
      if (reconcileResult.hardBlocks.length > 0) {
        process.stderr.write(`  Hard blocks: ${reconcileResult.hardBlocks.length}\n`);
        for (const b of reconcileResult.hardBlocks) {
          process.stderr.write(`    - ${b.set}: ${b.type} -- ${b.detail}\n`);
        }
      }
      if (reconcileResult.softBlocks.length > 0) {
        process.stderr.write(`  Soft blocks: ${reconcileResult.softBlocks.length}\n`);
        for (const b of reconcileResult.softBlocks) {
          process.stderr.write(`    - ${b.set}: ${b.type} -- ${b.detail}\n`);
        }
      }
      if (reconcileResult.hardBlocks.length === 0 && reconcileResult.softBlocks.length === 0) {
        process.stderr.write(`  All contract obligations satisfied.\n`);
      }
      break;
    }

    case 'detect-mode': {
      const teams = require('../lib/teams.cjs');
      const result = teams.detectAgentTeams();
      output(JSON.stringify({ agentTeamsAvailable: result.available }));
      break;
    }

    default:
      error(`Unknown execute subcommand: ${subcommand}. Use: prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase, pause, resume, reconcile, detect-mode`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleMerge(cwd, subcommand, args) {
  const path = require('path');
  const merge = require('../lib/merge.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'review': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge review <set-name>');
        process.exit(1);
      }
      const result = merge.runProgrammaticGate(cwd, setName);
      const setDir = path.join(cwd, '.planning', 'sets', setName);
      // Write initial REVIEW.md with programmatic results only (agent review added by skill)
      merge.writeReviewMd(setDir, {
        setName,
        verdict: result.passed ? 'PENDING_REVIEW' : 'BLOCK',
        contractResults: { valid: result.contractValid },
        ownershipResults: { violations: result.ownershipViolations },
        testResults: { passed: result.testsPass, output: result.testOutput },
        findings: {
          blocking: result.ownershipViolations.map(v => `Ownership: ${v.file} owned by ${v.owner}`),
          fixable: [],
          suggestions: [],
        },
      });
      output(JSON.stringify(result));
      break;
    }

    case 'execute': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge execute <set-name>');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      const result = merge.mergeSet(cwd, setName, baseBranch);
      if (result.merged) {
        // Update registry with merge status
        await wt.registryUpdate(cwd, (reg) => {
          if (reg.worktrees[setName]) {
            reg.worktrees[setName].mergeStatus = 'merged';
            reg.worktrees[setName].mergedAt = new Date().toISOString();
            reg.worktrees[setName].mergeCommit = result.commitHash;
          }
          return reg;
        });
      }
      output(JSON.stringify(result));
      break;
    }

    case 'status': {
      const registry = wt.loadRegistry(cwd);
      const statuses = {};
      for (const [name, entry] of Object.entries(registry.worktrees || {})) {
        statuses[name] = {
          phase: entry.phase || 'unknown',
          mergeStatus: entry.mergeStatus || 'pending',
          mergedAt: entry.mergedAt || null,
          mergeCommit: entry.mergeCommit || null,
        };
      }
      output(JSON.stringify(statuses));
      break;
    }

    case 'integration-test': {
      const result = merge.runIntegrationTests(cwd);
      output(JSON.stringify(result));
      break;
    }

    case 'order': {
      const order = merge.getMergeOrder(cwd);
      output(JSON.stringify(order));
      break;
    }

    case 'update-status': {
      const setName = args[0];
      const status = args[1];
      if (!setName || !status) {
        error('Usage: rapid-tools merge update-status <set> <status>');
        process.exit(1);
      }
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].mergeStatus = status;
        }
        return reg;
      });
      output(JSON.stringify({ updated: true, set: setName, mergeStatus: status }));
      break;
    }

    default:
      error(`Unknown merge subcommand: ${subcommand}. Use: review, execute, status, integration-test, order, update-status`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
