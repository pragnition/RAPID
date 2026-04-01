'use strict';

// ---------------------------------------------------------------------------
// TOOL_REGISTRY
// Static map of command keys to compact one-liner descriptions.
// Format: 'subcommand args -- description'
// Source: rapid-tools.cjs USAGE + core-state-access.md + role modules
// ---------------------------------------------------------------------------
const TOOL_REGISTRY = {
  // State reads
  'state-get':            'state get <entity:milestone|set> <id:str> -- Read entity',
  'state-get-all':        'state get --all -- Read full STATE.json',

  // State transitions
  'state-transition-set': 'state transition set <milestoneId:str> <setId:str> <status:str> -- Transition set status',

  // State integrity
  'state-detect':         'state detect-corruption -- Check STATE.json integrity',
  'state-recover':        'state recover -- Recover STATE.json from git',

  // Lock
  'lock-acquire':         'lock acquire <name:str> -- Acquire named lock',
  'lock-status':          'lock status <name:str> -- Check lock status',

  // Planning
  'plan-create-set':      'plan create-set -- Create set from stdin JSON',
  'plan-decompose':       'plan decompose -- Decompose sets from stdin JSON array',
  'plan-write-dag':       'plan write-dag -- Write DAG.json from stdin JSON',
  'plan-list-sets':       'plan list-sets -- List all defined sets',
  'plan-load-set':        'plan load-set <name:str> -- Load set definition + contract',

  // Execution
  'execute-prepare':      'execute prepare-context <set:str> -- Prepare execution context',
  'execute-verify':       'execute verify <set:str> --branch <branch:str> -- Verify set results',
  'execute-stubs':        'execute generate-stubs <set:str> -- Generate contract stubs',
  'execute-cleanup-stubs':'execute cleanup-stubs <set:str> -- Remove stub files',
  'execute-wave-status':  'execute wave-status -- Show execution progress',
  'execute-reconcile':    'execute reconcile <wave:str> -- Reconcile wave, write summary',
  'execute-job-status':   'execute job-status <set:str> -- Show per-job statuses',
  'execute-commit-state': 'execute commit-state [message:str] -- Commit STATE.json',
  'execute-pause':        'execute pause <set:str> -- Pause execution, write HANDOFF.md',
  'execute-resume':       'execute resume <set:str> -- Resume from HANDOFF.md',

  // Memory
  'memory-log-decision':  'memory log-decision --category <c:str> --decision <d:str> --rationale <r:str> --source <s:str> -- Log decision',
  'memory-log-correction': 'memory log-correction --original <o:str> --correction <c:str> --reason <r:str> -- Log correction',
  'memory-query':         'memory query [--category <c:str>] [--type <t:str>] [--limit <n:int>] -- Query memory',
  'memory-context':       'memory context <set:str> [--budget <n:int>] -- Build memory context',

  // Merge
  'merge-detect':         'merge detect <set:str> -- Run 5-level conflict detection',
  'merge-resolve':        'merge resolve <set:str> -- Run resolution cascade',
  'merge-execute':        'merge execute <set:str> -- Merge set branch into main',
  'merge-review':         'merge review <set:str> -- Run programmatic gate + REVIEW.md',
  'merge-status':         'merge status -- Show merge pipeline status',
  'merge-order':          'merge order -- Show merge order from DAG',
  'merge-update-status':  'merge update-status <set:str> <status:str> -- Update merge status',
  'merge-prepare-context':'merge prepare-context <set:str> -- Assemble merger launch briefing',

  // Worktree
  'worktree-create':      'worktree create <set:str> -- Create worktree + branch for set',
  'worktree-list':        'worktree list -- List registered worktrees',
  'worktree-status':      'worktree status -- Show all worktrees with table',
  'worktree-cleanup':     'worktree cleanup <set:str> -- Remove a worktree',

  // Set init
  'set-init-create':      'set-init create <set:str> -- Init set: worktree + CLAUDE.md + register',
  'set-init-list':        'set-init list-available -- List pending sets without worktrees',

  // Review
  'review-scope':         'review scope <set:str> <wave:str> -- Scope wave files for review',
  'review-log-issue':     'review log-issue <set:str> <wave:str> -- Log issue from stdin JSON',
  'review-list-issues':   'review list-issues <set:str> -- List issues for set',
  'review-update-issue':  'review update-issue <set:str> <wave:str> <issue:str> <status:str> -- Update issue status',
  'review-lean':          'review lean <set:str> <wave:str> -- Run lean wave review',
  'review-summary':       'review summary <set:str> -- Generate REVIEW-SUMMARY.md',

  // Resolve
  'resolve-set':          'resolve set <input:str> -- Resolve set reference to JSON',
  'resolve-wave':         'resolve wave <input:str> -- Resolve wave reference to JSON',

  // Context
  'context-detect':       'context detect -- Detect codebase characteristics',
  'context-generate':     'context generate -- Ensure context directory exists',

  // Init
  'init-detect':          'init detect -- Check if .planning/ exists',
  'init-scaffold':        'init scaffold --name <n:str> --desc <d:str> --team-size <N:int> -- Create .planning/',

  // Parse return
  'parse-return':         'parse-return <file:str> -- Parse RAPID:RETURN from file',
  'parse-return-validate':'parse-return --validate <file:str> -- Parse + validate return',

  // Verify artifacts
  'verify-light':         'verify-artifacts <files:str...> -- Verify files exist',
  'verify-heavy':         'verify-artifacts --heavy --test <cmd:str> <files:str...> -- Verify with tests',

  // Display
  'display-banner':       'display banner <stage:str> [target:str] -- Show RAPID banner',

  // Scaffold
  'scaffold-run':         'scaffold run [--type <type:str>] -- Generate project foundation files',
  'scaffold-status':      'scaffold status -- Show scaffold report',
  'scaffold-create-foundation-set': 'scaffold create-foundation-set --name <n:str> --contracts <json:str> -- Create foundation set #0 with merged contracts',

  // Prereqs
  'prereqs-check':        'prereqs -- Check prerequisites',

  // Hooks
  'hooks-list':           'hooks list -- List verification checks and status',
  'hooks-run':            'hooks run [--dry-run] -- Run post-task verification hooks',
  'hooks-enable':         'hooks enable <id:str> -- Enable a verification check',
  'hooks-disable':        'hooks disable <id:str> -- Disable a verification check',
};

// ---------------------------------------------------------------------------
// ROLE_TOOL_MAP
// Static explicit object mapping role names to arrays of TOOL_REGISTRY keys.
// Roles with no CLI commands are omitted entirely.
// ---------------------------------------------------------------------------
const ROLE_TOOL_MAP = {
  // Core roles that use CLI heavily
  'executor':         ['state-get', 'state-transition-set', 'verify-light', 'memory-log-decision', 'memory-log-correction', 'hooks-run', 'hooks-list'],
  'planner':          ['state-get', 'state-get-all', 'plan-create-set', 'plan-decompose', 'plan-write-dag',
                       'plan-list-sets', 'plan-load-set', 'resolve-set', 'resolve-wave', 'memory-query', 'memory-context'],
  'set-planner':      ['state-get', 'state-get-all', 'plan-create-set', 'plan-decompose', 'plan-write-dag', 'memory-log-decision'],
  'reviewer':         ['state-get', 'review-scope', 'review-log-issue', 'review-list-issues',
                       'review-update-issue', 'review-lean', 'review-summary'],
  'verifier':         ['state-get', 'verify-light', 'verify-heavy', 'hooks-list', 'hooks-enable', 'hooks-disable'],
  'merger':           ['merge-detect', 'merge-resolve', 'merge-review'],
  'set-merger':       ['merge-detect', 'merge-resolve', 'merge-review', 'merge-update-status'],
  'conflict-resolver':['merge-detect'],
  'bugfix':           ['state-get'],

  // Planner variants
  'plan-verifier':    ['state-get', 'plan-load-set'],

  // Init/context pipeline
  'roadmapper':       ['state-get', 'init-scaffold'],
  'codebase-synthesizer': ['context-detect'],
  'context-generator': ['state-get', 'context-generate'],

  // These roles have NO CLI commands (omitted from map):
  // 'research-stack', 'research-features', 'research-architecture',
  // 'research-pitfalls', 'research-oversights', 'research-ux',
  // 'research-synthesizer',
  // 'unit-tester', 'bug-hunter', 'devils-advocate',
  // 'judge', 'uat', 'scoper'
};

// ---------------------------------------------------------------------------
// getToolDocsForRole(role)
// Returns a YAML-formatted string of tool docs for the given role,
// or null if the role has no CLI commands.
// Throws Error if ROLE_TOOL_MAP references a key not in TOOL_REGISTRY.
// ---------------------------------------------------------------------------
function getToolDocsForRole(role) {
  const keys = ROLE_TOOL_MAP[role];
  if (!keys || keys.length === 0) return null;

  const lines = keys.map(key => {
    const doc = TOOL_REGISTRY[key];
    if (!doc) {
      throw new Error(`Unknown tool key "${key}" in ROLE_TOOL_MAP for role "${role}"`);
    }
    return `  ${key}: ${doc}`;
  });

  return `# rapid-tools.cjs commands\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// estimateTokens(text)
// Simple character-based heuristic: ~4 chars per token for English/code.
// Returns Math.ceil(text.length / 4).
// ---------------------------------------------------------------------------
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

module.exports = {
  TOOL_REGISTRY,
  ROLE_TOOL_MAP,
  getToolDocsForRole,
  estimateTokens,
};
