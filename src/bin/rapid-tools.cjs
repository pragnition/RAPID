#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { handleDisplay } = require('../commands/display.cjs');
const { handleLock } = require('../commands/lock.cjs');
const { handlePrereqs } = require('../commands/prereqs.cjs');
const { handleAssumptions, handleParseReturn, handleResume, handleVerifyArtifacts, handleContext } = require('../commands/misc.cjs');
const { handleResolve } = require('../commands/resolve.cjs');
const { handlePlan } = require('../commands/plan.cjs');
const { handleSetInit } = require('../commands/set-init.cjs');

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
  execute reconcile-jobs <set> <wave> [--branch <b>] [--mode <m>]  Reconcile jobs in a wave
  execute job-status <set>        Show per-wave/per-job statuses from STATE.json
  execute commit-state [message]  Commit STATE.json with a given message
  merge review <set>              Run programmatic gate + write REVIEW.md
  merge execute <set>             Merge set branch into main (--no-ff) + update MERGE-STATE
  merge status                    Show merge pipeline status (per-set verdicts + MERGE-STATE)
  merge integration-test          Run post-wave integration test suite on main
  merge order                     Show merge order from DAG (wave-grouped)
  merge update-status <set> <status> [--agent-phase <phase>] [--agent-phase2 <conflictId> <phase>]  Update merge status + optional agentPhase1/agentPhase2
  resolve set <input>                Resolve set reference (numeric index or string ID) to JSON
  resolve wave <input>               Resolve wave reference (N.N dot notation or string ID) to JSON
  merge detect <set>              Run 5-level conflict detection (returns JSON)
  merge resolve <set>             Run resolution cascade on detected conflicts
  merge bisect <waveNum>          Run bisection recovery for a failed wave
  merge rollback <set> [--force]  Revert a merged set's merge commit (cascade check)
  merge merge-state <set>         Show MERGE-STATE.json for a set
  merge prepare-context <set>    Assemble launch briefing for set-merger subagent
  set-init create <set-name>     Initialize a set: create worktree + scoped CLAUDE.md + register
  set-init list-available        List pending sets without worktrees
  review scope <set-id> [<wave-id>] [--branch <b>] [--post-merge]  Scope files for review
  review log-issue <set-id> [<wave-id>] [--post-merge]  Log issue from stdin JSON
  review list-issues <set-id> [--status <s>]         List all issues for a set
  review update-issue <set-id> <wave-id> <issue-id> <status>  Update issue status
  review lean <set-id> <wave-id>                     Run lean wave-level review
  review summary <set-id> [--post-merge]             Generate REVIEW-SUMMARY.md
  display banner <stage> [target]  Display branded RAPID stage banner
  build-agents              Build all agent .md files from source modules

Options:
  --help, -h             Show this help message
`;

/**
 * Silently migrate gsd_state_version -> rapid_state_version in STATE.md.
 * Preserves the version number. No-op if already migrated or file missing.
 *
 * @param {string} cwd - Project root directory
 */
function migrateStateVersion(cwd) {
  const fs = require('fs');
  const path = require('path');
  const stateMdPath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(stateMdPath)) return;

  const content = fs.readFileSync(stateMdPath, 'utf-8');
  if (!content.includes('gsd_state_version')) return;

  const migrated = content.replace(/gsd_state_version/g, 'rapid_state_version');
  fs.writeFileSync(stateMdPath, migrated);
}

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
  if (command === 'display') {
    handleDisplay(args[1], args.slice(2));
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

  migrateStateVersion(cwd);

  switch (command) {
    case 'lock':
      await handleLock(cwd, subcommand, args.slice(2));
      break;

    case 'state':
      await handleState(cwd, subcommand, args.slice(2));
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

    case 'review':
      await handleReview(cwd, subcommand, args.slice(2));
      break;

    case 'resume':
      await handleResume(cwd, args.slice(1));
      break;

    case 'resolve':
      await handleResolve(cwd, subcommand, args.slice(2));
      break;

    case 'build-agents':
      handleBuildAgents(cwd, args.slice(1));
      break;

    default:
      error(`Unknown command: ${command}`);
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

function handleBuildAgents(cwd, args) {
  const fs = require('fs');
  const path = require('path');
  const { resolveRapidDir, loadConfig } = require('../lib/core.cjs');
  const { getToolDocsForRole, estimateTokens } = require('../lib/tool-docs.cjs');

  const MODULES_DIR = path.join(__dirname, '..', 'modules');

  /**
   * Tool configuration per agent role.
   */
  const ROLE_TOOLS = {
    planner: 'Read, Write, Edit, Bash, Grep, Glob',
    executor: 'Read, Write, Edit, Bash, Grep, Glob',
    reviewer: 'Read, Grep, Glob, Bash',
    verifier: 'Read, Bash, Grep, Glob',
    'unit-tester': 'Read, Write, Bash, Grep, Glob',
    'bug-hunter': 'Read, Grep, Glob, Bash',
    'devils-advocate': 'Read, Grep, Glob',
    'judge': 'Read, Write, Grep, Glob',
    'bugfix': 'Read, Write, Edit, Bash, Grep, Glob',
    'uat': 'Read, Write, Bash, Grep, Glob',
    'merger': 'Read, Write, Bash, Grep, Glob',
    'research-stack':        'Read, Grep, Glob, WebFetch, WebSearch',
    'research-features':     'Read, Grep, Glob, WebFetch, WebSearch',
    'research-architecture': 'Read, Grep, Glob, WebFetch, WebSearch',
    'research-pitfalls':     'Read, Grep, Glob, WebFetch, WebSearch',
    'research-oversights':   'Read, Grep, Glob, WebFetch, WebSearch',
    'research-ux':           'Read, Grep, Glob, WebFetch, WebSearch',
    'research-synthesizer':  'Read, Write, Grep, Glob',
    'roadmapper':            'Read, Write, Grep, Glob',
    'codebase-synthesizer':  'Read, Grep, Glob, Bash',
    'context-generator':     'Read, Write, Grep, Glob, Bash',
    'set-planner':           'Read, Write, Grep, Glob',
    'plan-verifier':         'Read, Write, Grep, Glob',
    'scoper':                'Read, Grep, Glob',
    'set-merger':            'Read, Write, Edit, Bash, Grep, Glob',
    'conflict-resolver':     'Read, Write, Edit, Bash, Grep, Glob',
  };

  /**
   * Color configuration per agent role.
   */
  const ROLE_COLORS = {
    planner: 'blue',
    verifier: 'blue',
    executor: 'green',
    bugfix: 'green',
    merger: 'green',
    reviewer: 'red',
    judge: 'red',
    'bug-hunter': 'yellow',
    'devils-advocate': 'purple',
    'unit-tester': 'cyan',
    uat: 'cyan',
    'research-stack': 'blue',
    'research-features': 'blue',
    'research-architecture': 'blue',
    'research-pitfalls': 'blue',
    'research-oversights': 'blue',
    'research-ux': 'blue',
    'research-synthesizer': 'blue',
    'roadmapper': 'blue',
    'codebase-synthesizer': 'blue',
    'context-generator': 'blue',
    'set-planner': 'blue',
    'plan-verifier': 'blue',
    'scoper': 'blue',
    'set-merger': 'green',
    'conflict-resolver': 'yellow',
  };

  /**
   * Role descriptions for frontmatter.
   */
  const ROLE_DESCRIPTIONS = {
    planner: 'RAPID planner agent -- decomposes work into parallelizable sets',
    executor: 'RAPID executor agent -- implements tasks within assigned worktree',
    reviewer: 'RAPID reviewer agent -- performs deep code review before merge',
    verifier: 'RAPID verifier agent -- verifies task completion via filesystem checks',
    'unit-tester': 'RAPID unit test agent -- generates test plans and writes/runs tests',
    'bug-hunter': 'RAPID bug hunter agent -- performs static analysis and identifies bugs',
    'devils-advocate': 'RAPID devils advocate agent -- challenges bug hunter findings with evidence',
    'judge': 'RAPID judge agent -- rules on contested findings with ACCEPTED/DISMISSED/DEFERRED',
    'bugfix': 'RAPID bugfix agent -- fixes accepted bugs with atomic commits',
    'uat': 'RAPID UAT agent -- generates and executes acceptance test plans',
    'merger': 'RAPID merger agent -- performs semantic conflict detection and AI-assisted resolution',
    'research-stack':        'RAPID research agent -- investigates technology stack options and recommendations',
    'research-features':     'RAPID research agent -- analyzes feature requirements and implementation approaches',
    'research-architecture': 'RAPID research agent -- evaluates architecture patterns and design decisions',
    'research-pitfalls':     'RAPID research agent -- identifies common pitfalls and anti-patterns to avoid',
    'research-oversights':   'RAPID research agent -- discovers overlooked concerns and edge cases',
    'research-ux':           'RAPID research agent -- investigates domain conventions and UX patterns',
    'research-synthesizer':  'RAPID research synthesizer agent -- combines research findings into coherent recommendations',
    'roadmapper':            'RAPID roadmapper agent -- creates phased implementation roadmaps from requirements',
    'codebase-synthesizer':  'RAPID codebase synthesizer agent -- analyzes existing codebase structure and patterns',
    'context-generator':     'RAPID context generator agent -- produces project context documents for agent consumption',
    'set-planner':           'RAPID set planner agent -- decomposes milestones into parallelizable development sets',
    'plan-verifier':         'RAPID plan verifier agent -- validates job plans for coverage, implementability, and consistency',
    'scoper':                'RAPID scoper agent -- categorizes files by concern area for focused review scoping',
    'set-merger':            'RAPID set merger agent -- runs detection, resolution, and gate for a single set merge',
    'conflict-resolver':     'RAPID conflict resolver agent -- deep analysis and resolution of mid-confidence merge conflicts',
  };

  /**
   * Per-role core module mapping.
   */
  const ROLE_CORE_MAP = {
    // All roles get identity + returns (the 2 universal modules)
    // Roles that commit code also get conventions
    'planner':              ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
    'executor':             ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
    'reviewer':             ['core-identity.md', 'core-returns.md'],
    'verifier':             ['core-identity.md', 'core-returns.md'],
    'set-planner':          ['core-identity.md', 'core-returns.md'],
    'bugfix':               ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
    'merger':               ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
    'unit-tester':          ['core-identity.md', 'core-returns.md'],
    'bug-hunter':           ['core-identity.md', 'core-returns.md'],
    'devils-advocate':      ['core-identity.md', 'core-returns.md'],
    'judge':                ['core-identity.md', 'core-returns.md'],
    'uat':                  ['core-identity.md', 'core-returns.md'],
    'codebase-synthesizer': ['core-identity.md', 'core-returns.md'],
    'context-generator':    ['core-identity.md', 'core-returns.md'],
    'research-stack':       ['core-identity.md', 'core-returns.md'],
    'research-features':    ['core-identity.md', 'core-returns.md'],
    'research-architecture':['core-identity.md', 'core-returns.md'],
    'research-pitfalls':    ['core-identity.md', 'core-returns.md'],
    'research-oversights':  ['core-identity.md', 'core-returns.md'],
    'research-ux':          ['core-identity.md', 'core-returns.md'],
    'research-synthesizer': ['core-identity.md', 'core-returns.md'],
    'roadmapper':           ['core-identity.md', 'core-returns.md'],
    'plan-verifier':        ['core-identity.md', 'core-returns.md'],
    'scoper':               ['core-identity.md', 'core-returns.md'],
    'set-merger':           ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
    'conflict-resolver':    ['core-identity.md', 'core-conventions.md', 'core-returns.md'],
  };

  function generateFrontmatter(role) {
    const tools = ROLE_TOOLS[role] || 'Read, Bash, Grep, Glob';
    const description = ROLE_DESCRIPTIONS[role] || `RAPID ${role} agent`;
    const color = ROLE_COLORS[role] || 'default';

    return `---
name: rapid-${role}
description: ${description}
tools: ${tools}
model: inherit
color: ${color}
---`;
  }

  function assembleAgentPrompt(role, coreModules) {
    const sections = [];

    // 1. YAML frontmatter
    sections.push(generateFrontmatter(role));

    // 2. Core modules (in specified order, but defer core-returns.md to after <role>)
    let returnsModule = null;
    for (const mod of coreModules) {
      if (mod === 'core-returns.md') {
        returnsModule = mod;
        continue;
      }
      const modPath = path.join(MODULES_DIR, 'core', mod);
      const content = fs.readFileSync(modPath, 'utf-8').trim();
      const tag = mod.replace('.md', '').replace('core-', '');
      sections.push(`<${tag}>\n${content}\n</${tag}>`);
    }

    // 3. Tool docs (injected between core and role)
    const toolDocs = getToolDocsForRole(role);
    if (toolDocs) {
      sections.push(`<tools>\n${toolDocs}\n</tools>`);
      // Token budget warning
      const tokenEstimate = estimateTokens(toolDocs);
      if (tokenEstimate > 1000) {
        output(`WARNING: Tool docs for rapid-${role} are ~${tokenEstimate} tokens (budget: 1000)`);
      }
    }

    // 4. Role-specific module
    const rolePath = path.join(MODULES_DIR, 'roles', `role-${role}.md`);
    const roleContent = fs.readFileSync(rolePath, 'utf-8').trim();
    sections.push(`<role>\n${roleContent}\n</role>`);

    // 5. Returns (last static section per PROMPT-SCHEMA.md)
    if (returnsModule) {
      const modPath = path.join(MODULES_DIR, 'core', returnsModule);
      const content = fs.readFileSync(modPath, 'utf-8').trim();
      sections.push(`<returns>\n${content}\n</returns>`);
    }

    const assembled = sections.join('\n\n');

    // Check size against warning threshold
    const sizeKB = Buffer.byteLength(assembled, 'utf-8') / 1024;
    const rapidDir = resolveRapidDir();
    let warnKB = 15;
    try {
      const config = loadConfig(path.dirname(rapidDir));
      warnKB = config.agent_size_warn_kb || 15;
    } catch {
      // Use default if config not available
    }
    if (sizeKB > warnKB) {
      output(`WARNING: Assembled agent rapid-${role} is ${sizeKB.toFixed(1)}KB (limit: ${warnKB}KB)`);
    }

    return assembled;
  }

  function assembleStubPrompt(role, coreModules) {
    const sections = [];
    sections.push(generateFrontmatter(role));

    let returnsModule = null;
    for (const mod of coreModules) {
      if (mod === 'core-returns.md') { returnsModule = mod; continue; }
      const modPath = path.join(MODULES_DIR, 'core', mod);
      const content = fs.readFileSync(modPath, 'utf-8').trim();
      const tag = mod.replace('.md', '').replace('core-', '');
      sections.push(`<${tag}>\n${content}\n</${tag}>`);
    }

    const toolDocs = getToolDocsForRole(role);
    if (toolDocs) {
      sections.push(`<tools>\n${toolDocs}\n</tools>`);
    }

    sections.push(`<role>\n<!-- TODO: Phase 42 -- hand-write ${role} role instructions -->\n</role>`);

    if (returnsModule) {
      const modPath = path.join(MODULES_DIR, 'core', returnsModule);
      const content = fs.readFileSync(modPath, 'utf-8').trim();
      sections.push(`<returns>\n${content}\n</returns>`);
    }

    return sections.join('\n\n');
  }

  // Build all agents
  const rapidDir = resolveRapidDir();
  const agentsDir = path.join(rapidDir, 'agents');

  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  const GENERATED_COMMENT = '<!-- GENERATED by build-agents -- do not edit directly. Edit src/modules/ instead. -->\n';
  const STUB_COMMENT = '<!-- STUB: Core agent -- role section is hand-written in Phase 42 -->\n';

  const SKIP_GENERATION = ['planner', 'executor', 'merger', 'reviewer'];

  // Validate SKIP_GENERATION entries exist in ROLE_CORE_MAP
  for (const role of SKIP_GENERATION) {
    if (!ROLE_CORE_MAP[role]) {
      error(`SKIP_GENERATION references unknown role "${role}" not in ROLE_CORE_MAP`);
      process.exit(1);
    }
  }

  const built = [];
  const skipped = [];

  for (const [role, coreModules] of Object.entries(ROLE_CORE_MAP)) {
    if (SKIP_GENERATION.includes(role)) {
      skipped.push(role);
      continue;
    }
    const assembled = assembleAgentPrompt(role, coreModules);
    const content = GENERATED_COMMENT + assembled;
    const filePath = path.join(agentsDir, `rapid-${role}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    built.push(filePath);
  }

  // Generate stubs for core agents (skip if already hand-written with CORE prefix)
  for (const role of SKIP_GENERATION) {
    const filePath = path.join(agentsDir, `rapid-${role}.md`);
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      if (existing.startsWith('<!-- CORE: Hand-written agent')) {
        continue; // Preserve hand-written core agent
      }
    }
    const coreModules = ROLE_CORE_MAP[role];
    const assembled = assembleStubPrompt(role, coreModules);
    const content = STUB_COMMENT + assembled;
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  output(`Built ${built.length} agents (${skipped.length} core skipped) in ${agentsDir}`);
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

async function handleReview(cwd, subcommand, args) {
  const fs = require('fs');
  const path = require('path');
  const review = require('../lib/review.cjs');
  const wt = require('../lib/worktree.cjs');

  switch (subcommand) {
    case 'scope': {
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools review scope <set-id> [<wave-id>] [--branch <branch>] [--post-merge]');
        process.exit(1);
      }
      const postMerge = args.includes('--post-merge');
      // Post-merge mode: scope from merge commit, skip worktree resolution
      if (postMerge) {
        try {
          const result = review.scopeSetPostMerge(cwd, setId);
          const allFiles = [...result.changedFiles, ...result.dependentFiles];
          const chunks = review.chunkByDirectory(allFiles);
          output(JSON.stringify({ ...result, chunks, postMerge: true }));
        } catch (err) {
          output(JSON.stringify({ error: err.message }));
          process.exit(1);
        }
        break;
      }
      // Detect mode: if args[1] is missing or starts with '--', set-level mode
      const waveId = (args[1] && !args[1].startsWith('--')) ? args[1] : null;
      // Parse --branch flag (default: main)
      let baseBranch = 'main';
      const branchIdx = args.indexOf('--branch');
      if (branchIdx !== -1 && args[branchIdx + 1]) baseBranch = args[branchIdx + 1];
      // Resolve worktree path from registry
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      try {
        const result = review.scopeSetForReview(cwd, worktreePath, baseBranch);
        if (!waveId) {
          // Set-level mode: include chunks and wave attribution
          const allFiles = [...result.changedFiles, ...result.dependentFiles];
          const chunks = review.chunkByDirectory(allFiles);
          const waveAttribution = review.buildWaveAttribution(cwd, setId);
          output(JSON.stringify({ ...result, chunks, waveAttribution }));
        } else {
          // Wave-level mode (backward compat for lean review): no chunks/attribution
          output(JSON.stringify(result));
        }
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    case 'log-issue': {
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools review log-issue <set-id> [<wave-id>] [--post-merge]  (reads JSON issue from stdin)');
        process.exit(1);
      }
      const logPostMerge = args.includes('--post-merge');
      // Detect mode: if args[1] present and not a flag, it is the wave-id (lean compat)
      const waveId = (args[1] && !args[1].startsWith('--')) ? args[1] : null;
      try {
        const stdinData = fs.readFileSync(0, 'utf-8').trim();
        if (!stdinData) {
          error('No issue data on stdin. Pipe a JSON issue object.');
          process.exit(1);
        }
        const issue = JSON.parse(stdinData);
        // If wave-id provided (lean compat), add originatingWave to issue
        if (waveId) {
          issue.originatingWave = waveId;
        }
        if (logPostMerge) {
          review.logIssuePostMerge(cwd, setId, issue);
        } else {
          review.logIssue(cwd, setId, issue);
        }
        output(JSON.stringify({ logged: true, issueId: issue.id, postMerge: logPostMerge }));
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    case 'list-issues': {
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools review list-issues <set-id> [--status <status>]');
        process.exit(1);
      }
      // Parse optional --status filter
      let statusFilter = null;
      const statusIdx = args.indexOf('--status');
      if (statusIdx !== -1 && args[statusIdx + 1]) statusFilter = args[statusIdx + 1];
      try {
        let issues = review.loadSetIssues(cwd, setId);
        if (statusFilter) {
          issues = issues.filter(i => i.status === statusFilter);
        }
        output(JSON.stringify(issues));
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    case 'update-issue': {
      const setId = args[0];
      // Detect mode by arg count:
      // 4-arg: set-id wave-id issue-id status (lean compat -- wave-id accepted but ignored)
      // 3-arg: set-id issue-id status (set-level)
      let issueId, newStatus;
      if (args.length >= 4) {
        // 4-arg mode: args[1] is wave-id (ignored for path), args[2] is issue-id, args[3] is status
        issueId = args[2];
        newStatus = args[3];
      } else if (args.length >= 3) {
        // 3-arg mode: args[1] is issue-id, args[2] is status
        issueId = args[1];
        newStatus = args[2];
      } else {
        error('Usage: rapid-tools review update-issue <set-id> [<wave-id>] <issue-id> <status>');
        process.exit(1);
      }
      if (!setId || !issueId || !newStatus) {
        error('Usage: rapid-tools review update-issue <set-id> [<wave-id>] <issue-id> <status>');
        process.exit(1);
      }
      try {
        review.updateIssueStatus(cwd, setId, issueId, newStatus);
        output(JSON.stringify({ updated: true }));
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    case 'lean': {
      const setId = args[0];
      const waveId = args[1];
      if (!setId || !waveId) {
        error('Usage: rapid-tools review lean <set-id> <wave-id>');
        process.exit(1);
      }
      // Resolve worktree path from registry
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);

      const issues = [];
      let autoFixed = 0;
      const needsAttention = [];

      try {
        // Read JOB-PLAN.md files in the wave dir to find planned artifacts
        const plannedArtifacts = [];
        if (fs.existsSync(waveDir)) {
          const planFiles = fs.readdirSync(waveDir).filter(f => f.endsWith('-PLAN.md'));
          for (const planFile of planFiles) {
            const content = fs.readFileSync(path.join(waveDir, planFile), 'utf-8');
            // Extract files from "Files to Create/Modify" table
            const tableRegex = /\|\s*`?([^`\|]+?)`?\s*\|\s*(Create|Modify)\s*\|/gi;
            let match;
            while ((match = tableRegex.exec(content)) !== null) {
              const filePath = match[1].trim();
              if (filePath && filePath !== 'File' && !filePath.startsWith('---')) {
                plannedArtifacts.push({ file: filePath, jobId: planFile.replace('-PLAN.md', '') });
              }
            }
          }
        }

        // Verify each planned artifact exists in the worktree
        for (const artifact of plannedArtifacts) {
          const fullPath = path.join(worktreePath, artifact.file);
          if (!fs.existsSync(fullPath)) {
            const issueId = `lean-${waveId}-${artifact.jobId}-${path.basename(artifact.file)}`;
            const issue = {
              id: issueId,
              type: 'artifact',
              severity: 'high',
              file: artifact.file,
              description: `Missing artifact: ${artifact.file} (expected from job ${artifact.jobId})`,
              autoFixAttempted: false,
              autoFixSucceeded: false,
              source: 'lean-review',
              status: 'open',
              createdAt: new Date().toISOString(),
            };
            // Log the issue (3-param: cwd, setId, issue with originatingWave)
            issue.originatingWave = waveId;
            review.logIssue(cwd, setId, issue);
            issues.push(issue);
            needsAttention.push(issue);
          }
        }

        output(JSON.stringify({ issues, autoFixed, needsAttention }));
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    case 'summary': {
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools review summary <set-id> [--post-merge]');
        process.exit(1);
      }
      const summaryPostMerge = args.includes('--post-merge');
      try {
        if (summaryPostMerge) {
          const issues = review.loadPostMergeIssues(cwd, setId);
          const summaryPath = review.generatePostMergeReviewSummary(cwd, setId, issues);
          output(JSON.stringify({ written: true, path: summaryPath, issueCount: issues.length, postMerge: true }));
        } else {
          const issues = review.loadSetIssues(cwd, setId);
          const summaryContent = review.generateReviewSummary(setId, issues);
          const summaryPath = path.join(cwd, '.planning', 'waves', setId, 'REVIEW-SUMMARY.md');
          fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
          fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
          output(JSON.stringify({ written: true, path: summaryPath, issueCount: issues.length }));
        }
      } catch (err) {
        output(JSON.stringify({ error: err.message }));
        process.exit(1);
      }
      break;
    }

    default:
      error(`Unknown review subcommand: ${subcommand}. Use: scope, log-issue, list-issues, update-issue, lean, summary`);
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
      // Validation guard: warn if registry phase implies STATE.json inconsistency
      try {
        const sm = require('../lib/state-machine.cjs');
        const stateResult = await sm.readState(cwd);
        if (stateResult && stateResult.valid) {
          for (const milestone of stateResult.state.milestones) {
            const setData = (milestone.sets || []).find(s => s.id === setName);
            if (setData) {
              // Phase-status consistency rules:
              // Done registry phase should correspond to 'executed' or 'merged' status
              // Error registry phase should not have 'executing' status
              const phaseStatusWarnings = [];
              if (phase === 'Done' && !['executed', 'merged'].includes(setData.status)) {
                phaseStatusWarnings.push(`Registry phase "Done" but STATE.json status is "${setData.status}" (expected "executed" or "merged")`);
              }
              if (phase === 'Error' && setData.status === 'planned') {
                phaseStatusWarnings.push(`Registry phase "Error" but STATE.json status is still "planned"`);
              }
              if (phase === 'Executing' && setData.status === 'merged') {
                phaseStatusWarnings.push(`Registry phase "Executing" but STATE.json status is already "merged"`);
              }
              for (const w of phaseStatusWarnings) {
                process.stderr.write(`[WARN] Phase/status inconsistency for "${setName}": ${w}\n`);
              }
              break;
            }
          }
        }
      } catch {
        // Graceful -- STATE.json may not exist
      }
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
      try {
        const result = await execute.resumeSet(cwd, setName);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
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

    case 'reconcile-jobs': {
      const setId = args[0];
      const waveId = args[1];
      if (!setId || !waveId) {
        error('Usage: rapid-tools execute reconcile-jobs <set-id> <wave-id> [--branch <branch>] [--mode <mode>]');
        process.exit(1);
      }
      // Parse --branch flag (default: main)
      let branch = 'main';
      const branchIdx = args.indexOf('--branch');
      if (branchIdx !== -1 && args[branchIdx + 1]) branch = args[branchIdx + 1];
      // Parse --mode flag (default: Subagents)
      let mode = 'Subagents';
      const modeIdx = args.indexOf('--mode');
      if (modeIdx !== -1 && args[modeIdx + 1]) mode = args[modeIdx + 1];
      // Find worktree path for this set
      const registry = wt.loadRegistry(cwd);
      const entry = registry.worktrees[setId];
      const worktreePath = entry ? path.resolve(cwd, entry.path) : cwd;
      // Run job-level reconciliation
      if (typeof execute.reconcileWaveJobs !== 'function') {
        error('reconcileWaveJobs not available -- ensure plan 01 (execution engine library) is implemented first');
        process.exit(1);
      }
      const result = execute.reconcileWaveJobs(cwd, setId, waveId, worktreePath, branch);
      // Generate wave summary
      const timestamp = new Date().toISOString();
      const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);
      const summaryContent = typeof execute.generateWaveJobsSummary === 'function'
        ? execute.generateWaveJobsSummary(waveId, result, timestamp, mode)
        : JSON.stringify(result, null, 2);
      // Write summary file
      const summaryPath = path.join(waveDir, 'WAVE-SUMMARY.md');
      fs.mkdirSync(waveDir, { recursive: true });
      fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
      output(JSON.stringify({ ...result, summaryPath }));
      break;
    }

    case 'job-status': {
      const sm = require('../lib/state-machine.cjs');
      const setId = args[0];
      if (!setId) {
        error('Usage: rapid-tools execute job-status <set-id>');
        process.exit(1);
      }
      const result = await sm.readState(cwd);
      if (!result || !result.valid) {
        error('STATE.json is missing or invalid');
        process.exit(1);
      }
      const state = result.state;
      const milestoneId = state.currentMilestone;
      const set = sm.findSet(state, milestoneId, setId);
      const waves = (set.waves || []).map(w => ({
        waveId: w.id,
        status: w.status,
        jobs: (w.jobs || []).map(j => ({
          jobId: j.id,
          status: j.status,
          startedAt: j.startedAt || null,
          completedAt: j.completedAt || null,
        })),
      }));
      output(JSON.stringify({ setId, milestoneId, waves }));
      break;
    }

    case 'commit-state': {
      const sm = require('../lib/state-machine.cjs');
      const message = args.join(' ') || 'chore: update STATE.json';
      const result = sm.commitState(cwd, message);
      output(JSON.stringify(result));
      break;
    }

    default:
      error(`Unknown execute subcommand: ${subcommand}. Use: prepare-context, verify, generate-stubs, cleanup-stubs, wave-status, update-phase, pause, resume, reconcile, reconcile-jobs, job-status, commit-state`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleMerge(cwd, subcommand, args) {
  const path = require('path');
  const fs = require('fs');
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
        // Also update MERGE-STATE.json with merge commit and status
        await merge.ensureMergeState(cwd, setName, {
          status: 'complete',
          mergeCommit: result.commitHash,
          completedAt: new Date().toISOString(),
        });
      }
      output(JSON.stringify(result));
      break;
    }

    case 'status': {
      const registry = wt.loadRegistry(cwd);
      const statuses = {};
      for (const [name, entry] of Object.entries(registry.worktrees || {})) {
        const mergeState = merge.readMergeState(cwd, name);
        statuses[name] = {
          phase: entry.phase || 'unknown',
          mergeStatus: entry.mergeStatus || 'pending',
          mergedAt: entry.mergedAt || null,
          mergeCommit: entry.mergeCommit || null,
          mergeState: mergeState || null,
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
        error('Usage: rapid-tools merge update-status <set> <status> [--agent-phase <idle|spawned|done|failed>] [--agent-phase2 <conflictId> <idle|spawned|done|failed>]');
        process.exit(1);
      }
      // Parse optional --agent-phase flag
      const agentPhaseIdx = args.indexOf('--agent-phase');
      let agentPhase1 = undefined;
      if (agentPhaseIdx !== -1) {
        const agentPhaseValue = args[agentPhaseIdx + 1];
        const validPhases = ['idle', 'spawned', 'done', 'failed'];
        if (!agentPhaseValue || !validPhases.includes(agentPhaseValue)) {
          error(`Invalid agent-phase value: "${agentPhaseValue || ''}". Must be one of: ${validPhases.join(', ')}`);
          process.exit(1);
        }
        agentPhase1 = agentPhaseValue;
      }
      // Parse optional --agent-phase2 flag (per-conflict tracking)
      const agentPhase2Idx = args.indexOf('--agent-phase2');
      let agentPhase2Update = undefined;
      if (agentPhase2Idx !== -1) {
        const conflictId = args[agentPhase2Idx + 1];
        const phase2Value = args[agentPhase2Idx + 2];
        const validPhases2 = ['idle', 'spawned', 'done', 'failed'];
        if (!conflictId || !phase2Value || !validPhases2.includes(phase2Value)) {
          error(`Invalid --agent-phase2 args: "${conflictId || ''}" "${phase2Value || ''}". Usage: --agent-phase2 <conflictId> <idle|spawned|done|failed>`);
          process.exit(1);
        }
        agentPhase2Update = { conflictId, phase: phase2Value };
      }
      await wt.registryUpdate(cwd, (reg) => {
        if (reg.worktrees[setName]) {
          reg.worktrees[setName].mergeStatus = status;
        }
        return reg;
      });
      // Build updates object
      const stateUpdates = { status };
      if (agentPhase1 !== undefined) {
        stateUpdates.agentPhase1 = agentPhase1;
      }
      // Handle agentPhase2 per-conflict update (merge into existing object map)
      if (agentPhase2Update) {
        await merge.withMergeStateTransaction(cwd, setName, (state) => {
          const existingPhase2 = state.agentPhase2 || {};
          existingPhase2[agentPhase2Update.conflictId] = agentPhase2Update.phase;
          state.agentPhase2 = existingPhase2;
          Object.assign(state, { status });
          if (agentPhase1 !== undefined) state.agentPhase1 = agentPhase1;
        }).catch(() => {
          // No existing state -- create minimal
          return merge.ensureMergeState(cwd, setName, {
            status,
            startedAt: new Date().toISOString(),
            ...(agentPhase1 !== undefined ? { agentPhase1 } : {}),
            agentPhase2: { [agentPhase2Update.conflictId]: agentPhase2Update.phase },
          });
        });
        // Read back for result
        stateUpdates.agentPhase2 = (merge.readMergeState(cwd, setName) || {}).agentPhase2;
      } else {
        // Update MERGE-STATE.json status (and optionally agentPhase1)
        await merge.ensureMergeState(cwd, setName, stateUpdates);
      }
      const result = { updated: true, set: setName, mergeStatus: status };
      if (agentPhase1 !== undefined) {
        result.agentPhase1 = agentPhase1;
      }
      if (agentPhase2Update) {
        result.agentPhase2 = stateUpdates.agentPhase2;
      }
      output(JSON.stringify(result));
      break;
    }

    case 'detect': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge detect <set-name>');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      // Create/update MERGE-STATE with detecting status
      await merge.ensureMergeState(cwd, setName, { status: 'detecting', startedAt: new Date().toISOString() });
      // Run 5-level detection (L5 semantic = null, filled by agent)
      const detectionResults = merge.detectConflicts(cwd, setName, baseBranch);
      // Update MERGE-STATE with detection results
      await merge.withMergeStateTransaction(cwd, setName, (state) => {
        state.detection = {
          textual: {
            ran: true,
            conflicts: (detectionResults.textual && detectionResults.textual.conflicts) || [],
          },
          structural: {
            ran: true,
            conflicts: (detectionResults.structural && detectionResults.structural.conflicts) || [],
          },
          dependency: {
            ran: true,
            conflicts: (detectionResults.dependency && detectionResults.dependency.conflicts) || [],
          },
          api: {
            ran: true,
            conflicts: (detectionResults.api && detectionResults.api.conflicts) || [],
          },
          semantic: detectionResults.semantic || undefined,
        };
      });
      output(JSON.stringify(detectionResults));
      break;
    }

    case 'resolve': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge resolve <set-name>');
        process.exit(1);
      }
      // Load detection results from MERGE-STATE.json
      const mergeState = merge.readMergeState(cwd, setName);
      if (!mergeState || !mergeState.detection) {
        error(`No detection results found for set '${setName}'. Run 'merge detect ${setName}' first.`);
        process.exit(1);
      }
      // Update status to resolving
      await merge.withMergeStateTransaction(cwd, setName, (state) => { state.status = 'resolving'; });
      // Flatten detection results into allConflicts array for resolveConflicts()
      const allConflicts = [];
      const det = mergeState.detection;
      if (det.textual && det.textual.conflicts) {
        for (const c of det.textual.conflicts) {
          allConflicts.push({ ...c, level: 'textual' });
        }
      }
      if (det.structural && det.structural.conflicts) {
        for (const c of det.structural.conflicts) {
          allConflicts.push({ ...c, level: 'structural' });
        }
      }
      if (det.dependency && det.dependency.conflicts) {
        for (const c of det.dependency.conflicts) {
          allConflicts.push({ ...c, level: 'dependency' });
        }
      }
      if (det.api && det.api.conflicts) {
        for (const c of det.api.conflicts) {
          allConflicts.push({ ...c, level: 'api' });
        }
      }
      // Load OWNERSHIP.json and DAG.json for heuristic context
      let ownership = {};
      let dagOrder = [];
      try {
        const ownershipPath = path.join(cwd, '.planning', 'sets', setName, 'OWNERSHIP.json');
        if (fs.existsSync(ownershipPath)) {
          ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
        }
      } catch { /* no ownership data */ }
      try {
        const dagPath = path.join(cwd, '.planning', 'DAG.json');
        if (fs.existsSync(dagPath)) {
          const dagData = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
          dagOrder = dagData.order || dagData.edges || [];
        }
      } catch { /* no DAG data */ }
      // Run resolution cascade
      const resolutionResults = merge.resolveConflicts({ allConflicts }, { ownership, dagOrder });
      // Compute resolution summary
      const tier1Count = resolutionResults.filter(r => r.tier === 1 && r.resolved).length;
      const tier2Count = resolutionResults.filter(r => r.tier === 2 && r.resolved).length;
      const unresolvedCount = resolutionResults.filter(r => !r.resolved).length;
      // Update MERGE-STATE with resolution counts
      await merge.withMergeStateTransaction(cwd, setName, (state) => {
        state.resolution = {
          tier1Resolved: tier1Count,
          tier2Resolved: tier2Count,
          unresolvedForAgent: unresolvedCount,
          total: resolutionResults.length,
        };
      });
      output(JSON.stringify({
        results: resolutionResults,
        summary: {
          tier1Resolved: tier1Count,
          tier2Resolved: tier2Count,
          unresolvedForAgent: unresolvedCount,
          total: resolutionResults.length,
        },
      }));
      break;
    }

    case 'bisect': {
      const waveNumStr = args[0];
      if (!waveNumStr) {
        error('Usage: rapid-tools merge bisect <waveNum>');
        process.exit(1);
      }
      const waveNum = parseInt(waveNumStr, 10);
      if (isNaN(waveNum) || waveNum < 1) {
        error('Wave number must be a positive integer');
        process.exit(1);
      }
      const baseBranch = wt.detectMainBranch(cwd);
      // Get wave-grouped merge order
      const waves = merge.getMergeOrder(cwd);
      if (waveNum > waves.length) {
        error(`Wave ${waveNum} does not exist. There are ${waves.length} waves.`);
        process.exit(1);
      }
      const waveSets = waves[waveNum - 1]; // 0-indexed
      // Find merged sets and their pre-wave commit from MERGE-STATE.json
      const mergedSets = [];
      let earliestMergeTime = null;
      let preWaveCommit = null;
      for (const setName of waveSets) {
        const ms = merge.readMergeState(cwd, setName);
        if (ms && ms.status === 'complete' && ms.mergeCommit) {
          mergedSets.push(setName);
          // Track earliest merge to find preWaveCommit
          if (ms.startedAt && (!earliestMergeTime || ms.startedAt < earliestMergeTime)) {
            earliestMergeTime = ms.startedAt;
          }
        }
      }
      if (mergedSets.length === 0) {
        error(`No merged sets found in wave ${waveNum}. Nothing to bisect.`);
        process.exit(1);
      }
      // Get preWaveCommit: commit before earliest merge in this wave
      // Use git log to find commit before the earliest merge commit
      try {
        const firstMergedState = merge.readMergeState(cwd, mergedSets[0]);
        if (firstMergedState && firstMergedState.mergeCommit) {
          preWaveCommit = require('child_process').execFileSync(
            'git', ['rev-parse', firstMergedState.mergeCommit + '~1'],
            { cwd, encoding: 'utf-8', stdio: 'pipe' }
          ).trim();
        }
      } catch {
        // Fallback: use getPreWaveCommit
        preWaveCommit = merge.getPreWaveCommit(cwd);
      }
      // Run bisection
      const result = merge.bisectWave(cwd, baseBranch, mergedSets, preWaveCommit);
      // Update MERGE-STATE for breaking set
      if (result.breakingSet) {
        try {
          await merge.withMergeStateTransaction(cwd, result.breakingSet, (state) => {
            state.bisection = { isBreaking: true, iterations: result.iterations, detectedAt: new Date().toISOString() };
          });
        } catch { /* may not have MERGE-STATE */ }
      }
      output(JSON.stringify(result));
      break;
    }

    case 'rollback': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge rollback <set-name> [--force]');
        process.exit(1);
      }
      const forceFlag = args.includes('--force');
      // Check cascade impact first
      const cascadeResult = merge.detectCascadeImpact(cwd, setName);
      if (cascadeResult.hasCascade && !forceFlag) {
        // Output warning JSON with affected sets -- caller decides whether to proceed
        output(JSON.stringify({
          rolledBack: false,
          cascadeWarning: true,
          affectedSets: cascadeResult.affectedSets,
          recommendation: cascadeResult.recommendation,
          hint: 'Use --force to rollback despite cascade impact',
        }));
        break;
      }
      // Proceed with rollback
      const result = merge.revertSetMerge(cwd, setName);
      if (result.reverted) {
        // Update MERGE-STATE status to reverted
        await merge.ensureMergeState(cwd, setName, { status: 'reverted' });
        // Update registry mergeStatus to reverted
        await wt.registryUpdate(cwd, (reg) => {
          if (reg.worktrees[setName]) {
            reg.worktrees[setName].mergeStatus = 'reverted';
          }
          return reg;
        });
      }
      output(JSON.stringify({
        rolledBack: result.reverted,
        revertCommit: result.revertCommit || null,
        reason: result.reason || null,
        detail: result.detail || null,
        cascadeImpact: cascadeResult,
      }));
      break;
    }

    case 'merge-state': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge merge-state <set-name>');
        process.exit(1);
      }
      const state = merge.readMergeState(cwd, setName);
      output(JSON.stringify(state || {}));
      break;
    }

    case 'prepare-context': {
      const setName = args[0];
      if (!setName) {
        error('Usage: rapid-tools merge prepare-context <set-name>');
        process.exit(1);
      }
      // Read MERGE-STATE for conflicts
      const mergeState = merge.readMergeState(cwd, setName);
      // Get worktree path from registry
      const reg = wt.loadRegistry(cwd);
      const worktreeInfo = reg.worktrees[setName];
      const worktreePath = worktreeInfo ? worktreeInfo.path : '';
      // Get changed files (best effort -- may fail if branch doesn't exist in test envs)
      let changedFiles = [];
      try {
        const baseBranch = wt.detectMainBranch(cwd);
        changedFiles = merge.getChangedFiles(cwd, `rapid/${setName}`, baseBranch);
      } catch {
        // Branch may not exist yet -- proceed with empty file list
      }
      // Flatten conflicts from detection
      const conflicts = [];
      if (mergeState && mergeState.detection) {
        for (const [level, data] of Object.entries(mergeState.detection)) {
          if (data && data.conflicts) {
            for (const c of data.conflicts) {
              conflicts.push({
                type: level.toUpperCase(),
                file: c.file || c.path || '',
                detail: c.description || c.detail || '',
              });
            }
          }
        }
      }
      // Build file entries
      const files = changedFiles.map(f => ({ path: f, summary: '' }));
      // Contract path
      const contractPath = path.join(cwd, '.planning', 'sets', setName, 'CONTRACT.json');
      // Call prepareMergerContext
      const briefing = merge.prepareMergerContext({
        setId: setName,
        worktreePath,
        files,
        conflicts,
        contractPath,
      });
      output(JSON.stringify({
        setName,
        briefing,
        tokenEstimate: Math.ceil(briefing.length / 4),
      }));
      break;
    }

    default:
      error(`Unknown merge subcommand: ${subcommand}. Use: review, execute, status, integration-test, order, update-status, detect, resolve, bisect, rollback, merge-state, prepare-context`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    error(err.message);
    process.exit(1);
  });
}

module.exports = { migrateStateVersion };
