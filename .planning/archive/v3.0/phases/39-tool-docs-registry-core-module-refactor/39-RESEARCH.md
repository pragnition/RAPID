# Phase 39: Tool Docs Registry & Core Module Refactor - Research

**Researched:** 2026-03-12
**Domain:** Agent prompt engineering, CLI tool documentation, build pipeline modification
**Confidence:** HIGH

## Summary

Phase 39 creates a per-agent tool documentation system (`src/lib/tool-docs.cjs`), defines an XML prompt schema for agent prompts, and consolidates 5 core modules down to 3. The codebase is entirely CommonJS (`require()`, `module.exports`), uses Node.js built-in test runner (`node:test`), and the build pipeline lives in `handleBuildAgents()` within `src/bin/rapid-tools.cjs` (lines 450-677). All 31 agents are currently generated from the same pipeline.

The existing `assembleAgentPrompt()` function already wraps core modules in XML tags (e.g., `<identity>`, `<returns>`, `<state-access>`, `<git>`, `<context-loading>`) and role modules in `<role>` tags. The XML schema document formalizes what already exists and adds the new `<tools>` and `<conventions>` tags. The core module consolidation retires `core-state-access.md` (2,767 bytes), `core-context-loading.md` (1,779 bytes), and `core-git.md` (1,056 bytes), absorbing their content into `core-identity.md` and a new `core-conventions.md`.

**Primary recommendation:** Implement in three waves: (1) tool-docs.cjs module with TOOL_REGISTRY and ROLE_TOOL_MAP, (2) core module consolidation and XML schema document, (3) build pipeline integration and executor proof-of-concept.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hybrid one-liner format with inline arg type hints: `state-get: state get <entity:milestone|set> <id:str> -- Read entity`
- Subcommand only -- no `node "${RAPID_TOOLS}"` prefix per entry
- `getToolDocsForRole()` returns raw YAML string, ready to embed
- 1,000-token budget per agent enforced as build-time warning, not error
- 5 top-level tags allowed: `<identity>`, `<role>`, `<tools>`, `<returns>`, `<context>`
- All tags are top-level -- no nesting required
- Content inside tags is Markdown
- Schema document lives at `src/modules/PROMPT-SCHEMA.md`
- Build-time validation: check required tags (identity, role, returns) are present -- warn if missing
- Schema is build-time reference only -- not embedded in agent prompts
- Consolidate from 5 modules to 3: core-identity.md (absorbs context-loading + RAPID_TOOLS setup), core-conventions.md (NEW, git commit conventions only), core-returns.md (unchanged)
- Retired modules deleted completely -- no stubs or redirects
- ROLE_CORE_MAP updated to reflect new 3-module set
- `assembleAgentPrompt()` directly injects tool docs via `getToolDocsForRole()`, wraps in `<tools>` tags
- No template file (core-tools.md) -- direct injection
- Roles with no CLI commands get no `<tools>` section
- `ROLE_TOOL_MAP` is a static explicit object in tool-docs.cjs
- One agent proof-of-concept: rebuild rapid-executor with new XML structure
- Full rebuild of all 31 agents deferred to Phase 41

### Claude's Discretion
- Exact ordering of XML sections in assembled prompt
- Which specific CLI commands each role needs in ROLE_TOOL_MAP
- Content and structure of PROMPT-SCHEMA.md beyond the tag vocabulary
- How to restructure core-identity.md content when absorbing context-loading and state-access guidance

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | Each agent prompt embeds inline YAML of only the rapid-tools.cjs commands it needs | TOOL_REGISTRY + ROLE_TOOL_MAP + getToolDocsForRole() design; assembleAgentPrompt() injection pattern |
| AGENT-02 | XML-formatted prompt structure with defined schema document (allowed tags, nesting rules) | PROMPT-SCHEMA.md design; 5-tag vocabulary; build-time validation approach |
| AGENT-05 | Tool docs registry (tool-docs.cjs) with per-role command specs and 1000-token budget per agent | tool-docs.cjs module structure; token estimation approach; build-time warning implementation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | v22+ | Test framework | Already used throughout project (all *.test.cjs files) |
| Node.js built-in `node:assert/strict` | v22+ | Assertions | Already used throughout project |
| CommonJS modules | N/A | Module format | Entire codebase uses require()/module.exports |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs` (built-in) | N/A | File I/O | Reading core modules, writing agent files |
| `path` (built-in) | N/A | Path resolution | Module paths relative to __dirname |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Character-based token estimation | tiktoken npm package | Adds dependency for marginal accuracy gain; character heuristic (chars/4) is sufficient for a warning threshold |
| JSON tool registry | YAML parsing library | Adds dependency; the YAML output is a string template, not parsed YAML -- no parser needed |

**Installation:**
```bash
# No new dependencies required -- all built-in Node.js modules
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    tool-docs.cjs          # NEW: TOOL_REGISTRY + ROLE_TOOL_MAP + getToolDocsForRole()
    tool-docs.test.cjs     # NEW: Tests for tool-docs module
  bin/
    rapid-tools.cjs        # MODIFIED: assembleAgentPrompt(), ROLE_CORE_MAP, handleBuildAgents()
  modules/
    core/
      core-identity.md     # MODIFIED: absorbs context-loading + state-access guidance
      core-conventions.md  # NEW: git commit conventions (from core-git.md)
      core-returns.md      # UNCHANGED
      core-context-loading.md  # DELETED
      core-state-access.md     # DELETED
      core-git.md              # DELETED
    roles/
      role-executor.md     # Proof-of-concept target (content unchanged, XML structure validated)
    PROMPT-SCHEMA.md       # NEW: XML schema reference document
agents/
  rapid-executor.md        # REBUILT: proof-of-concept with new XML structure + tool docs
```

### Pattern 1: TOOL_REGISTRY as Static String Map
**What:** A plain object mapping command keys to compact one-liner descriptions
**When to use:** When the registry is authored by humans, not derived from code
**Example:**
```javascript
// Source: CONTEXT.md decision + codebase pattern analysis
const TOOL_REGISTRY = {
  'state-get':        'state get <entity:milestone|set> <id:str> -- Read entity',
  'state-get-all':    'state get --all -- Read full STATE.json',
  'state-transition': 'state transition set <milestoneId:str> <setId:str> <status:str> -- Transition set status',
  'state-detect':     'state detect-corruption -- Check STATE.json integrity',
  'state-recover':    'state recover -- Recover STATE.json from git',
  'lock-acquire':     'lock acquire <name:str> -- Acquire named lock',
  'lock-status':      'lock status <name:str> -- Check lock status',
  // ... more entries
};
```

### Pattern 2: ROLE_TOOL_MAP as Explicit Role-to-Keys Map
**What:** A plain object mapping role names to arrays of TOOL_REGISTRY keys
**When to use:** When each role's tool set is curated by hand for auditability
**Example:**
```javascript
// Source: CONTEXT.md decision
const ROLE_TOOL_MAP = {
  executor:     ['state-get', 'state-transition'],
  orchestrator: ['state-get', 'state-get-all', 'state-transition', 'state-detect', 'state-recover', 'lock-acquire', 'lock-status', 'merge-detect', 'merge-resolve', 'merge-execute', 'merge-status', 'merge-order', 'execute-prepare', 'execute-verify'],
  planner:      ['state-get', 'state-get-all', 'plan-create-set', 'plan-decompose', 'plan-write-dag'],
  // Roles with no CLI commands are omitted entirely
};
```

### Pattern 3: getToolDocsForRole() Returns Raw YAML String
**What:** A function that looks up a role's command keys and renders them as a YAML block
**When to use:** Called by assembleAgentPrompt() during build
**Example:**
```javascript
// Source: CONTEXT.md decision
function getToolDocsForRole(role) {
  const keys = ROLE_TOOL_MAP[role];
  if (!keys || keys.length === 0) return null;

  const lines = keys.map(key => {
    const doc = TOOL_REGISTRY[key];
    if (!doc) throw new Error(`Unknown tool key "${key}" in ROLE_TOOL_MAP for role "${role}"`);
    return `  ${key}: ${doc}`;
  });

  return `# rapid-tools.cjs commands\n${lines.join('\n')}`;
}
```

### Pattern 4: Build Pipeline Tool Doc Injection
**What:** assembleAgentPrompt() calls getToolDocsForRole() and wraps result in `<tools>` tags
**When to use:** During handleBuildAgents() for every role
**Example:**
```javascript
// Source: CONTEXT.md assembly order decision
function assembleAgentPrompt(role, coreModules) {
  const sections = [];

  // 1. YAML frontmatter
  sections.push(generateFrontmatter(role));

  // 2. Core modules (identity, conventions -- in specified order)
  for (const mod of coreModules) {
    const modPath = path.join(MODULES_DIR, 'core', mod);
    const content = fs.readFileSync(modPath, 'utf-8').trim();
    const tag = mod.replace('.md', '').replace('core-', '');
    sections.push(`<${tag}>\n${content}\n</${tag}>`);
  }

  // 3. Tool docs (injected between core and role)
  const toolDocs = getToolDocsForRole(role);
  if (toolDocs) {
    sections.push(`<tools>\n${toolDocs}\n</tools>`);
  }

  // 4. Role-specific module
  const rolePath = path.join(MODULES_DIR, 'roles', `role-${role}.md`);
  const roleContent = fs.readFileSync(rolePath, 'utf-8').trim();
  sections.push(`<role>\n${roleContent}\n</role>`);

  return sections.join('\n\n');
}
```

### Pattern 5: Token Budget Warning
**What:** Estimate token count of tool docs and warn if over 1000
**When to use:** During handleBuildAgents() after tool doc generation
**Example:**
```javascript
// Source: CONTEXT.md decision -- warning, not error
function estimateTokens(text) {
  // Claude tokenizer averages ~4 chars per token for English/code
  return Math.ceil(text.length / 4);
}

// In handleBuildAgents loop:
if (toolDocs) {
  const tokenEstimate = estimateTokens(toolDocs);
  if (tokenEstimate > 1000) {
    output(`WARNING: Tool docs for rapid-${role} are ~${tokenEstimate} tokens (budget: 1000)`);
  }
}
```

### Anti-Patterns to Avoid
- **Deriving ROLE_TOOL_MAP from frontmatter or code analysis:** The CONTEXT.md explicitly says "static explicit object -- no magic derivation." Each role's commands are hand-curated.
- **Parsing YAML output as structured data:** The tool docs are a raw YAML string for embedding. No YAML parser is needed.
- **Creating core-tools.md as a template file:** Direct injection from getToolDocsForRole() is simpler and was explicitly chosen over a template file.
- **Making token budget a hard error:** The CONTEXT.md specifies "build-time warning, not error" to allow temporary overages during development.
- **Keeping stub files for retired modules:** Git history preserves old content. No stubs or redirect notices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Exact tokenizer | Character-length heuristic (chars/4) | Claude averages ~4 chars/token for English/code; this is a warning threshold, not a billing meter |
| YAML serialization | YAML parser/emitter | String concatenation with template literals | The output format is trivially simple (key: value lines); no nested structures or special characters |
| XML validation | Full XML parser/validator | Regex or string.includes() checks for required tags | Schema has 5 flat tags with markdown content; formal XML parsing is overkill |

**Key insight:** The tool docs system is fundamentally a string-templating system, not a data processing pipeline. Every piece of it is human-authored strings being concatenated in a specific order.

## Common Pitfalls

### Pitfall 1: Forgetting to Update ROLE_CORE_MAP When Deleting Modules
**What goes wrong:** Build pipeline crashes with `ENOENT: no such file or directory` for deleted core modules
**Why it happens:** ROLE_CORE_MAP still references `core-state-access.md`, `core-context-loading.md`, `core-git.md`
**How to avoid:** Update ROLE_CORE_MAP to only reference the 3 surviving modules (`core-identity.md`, `core-conventions.md`, `core-returns.md`) BEFORE deleting the old files
**Warning signs:** Any test that runs `build-agents` will crash immediately

### Pitfall 2: Losing Critical Content During Module Consolidation
**What goes wrong:** Agent behavior degrades because guidance was lost
**Why it happens:** Absorbing 3 modules into 2 requires careful content migration, not just deletion
**How to avoid:** Methodically transfer each section:
- `core-context-loading.md` Prerequisites section (RAPID_TOOLS env var setup) --> `core-identity.md`
- `core-context-loading.md` Loading Strategy section --> `core-identity.md` (condensed)
- `core-state-access.md` CLI Commands section --> tool docs (TOOL_REGISTRY entries) instead of prose
- `core-state-access.md` Rules section --> `core-identity.md` (condensed as principles)
- `core-git.md` full content --> `core-conventions.md` (renamed, otherwise identical)
**Warning signs:** Run a diff of content before/after to verify nothing important was dropped

### Pitfall 3: Test File Expecting Old Module Count or Tag Names
**What goes wrong:** `build-agents.test.cjs` fails because it checks for old XML tags like `<state-access>`, `<git>`, `<context-loading>`
**Why it happens:** The test has an `EXPECTED_ROLE_CORE_MAP` and `allCoreTags` array that must be updated
**How to avoid:** Update `build-agents.test.cjs` in the SAME task that updates `ROLE_CORE_MAP` and deletes modules
**Warning signs:** Tests showing "should NOT contain <state-access> tag" failing

### Pitfall 4: Executor Proof-of-Concept Does Not Exercise Tool Injection
**What goes wrong:** Phase 41 discovers tool injection is broken because executor proof-of-concept skipped it
**Why it happens:** The executor is rebuilt but tool docs are not actually verified in the output
**How to avoid:** Add a test that checks `rapid-executor.md` contains `<tools>` tag with expected command entries
**Warning signs:** Generated executor file has no `<tools>` section

### Pitfall 5: ROLE_TOOL_MAP Keys Not Matching TOOL_REGISTRY Keys
**What goes wrong:** `getToolDocsForRole()` throws for unknown keys
**Why it happens:** Typo in ROLE_TOOL_MAP key or TOOL_REGISTRY key added/renamed
**How to avoid:** Add a validation test that iterates all ROLE_TOOL_MAP values and verifies each key exists in TOOL_REGISTRY
**Warning signs:** Build crashes with "Unknown tool key" error

## Code Examples

### Complete TOOL_REGISTRY (Recommended Initial Set)

Based on analysis of `rapid-tools.cjs` USAGE string (lines 7-95) and which commands agents actually reference in current modules:

```javascript
// Source: rapid-tools.cjs USAGE + src/modules/core/core-state-access.md + src/modules/roles/*
const TOOL_REGISTRY = {
  // State reads
  'state-get':            'state get <entity:milestone|set> <id:str> -- Read entity',
  'state-get-all':        'state get --all -- Read full STATE.json',

  // State transitions
  'state-transition-set': 'state transition set <milestoneId:str> <setId:str> <status:str> -- Transition set',

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
  'plan-check-gate':      'plan check-gate <wave:str> -- Check planning gate for wave',
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

  // Wave planning
  'wave-plan-resolve':    'wave-plan resolve-wave <waveId:str> -- Find wave in state',
  'wave-plan-create-dir': 'wave-plan create-wave-dir <setId:str> <waveId:str> -- Create wave directory',
  'wave-plan-validate':   'wave-plan validate-contracts <setId:str> <waveId:str> -- Validate against CONTRACT.json',
  'wave-plan-list-jobs':  'wave-plan list-jobs <setId:str> <waveId:str> -- List JOB-PLAN.md files',

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

  // Prereqs
  'prereqs-check':        'prereqs -- Check prerequisites',
};
```

### Recommended ROLE_TOOL_MAP (Initial Set)

Based on analysis of which CLI commands each role actually invokes or needs:

```javascript
const ROLE_TOOL_MAP = {
  // Core roles that use CLI heavily
  'orchestrator':     ['state-get', 'state-get-all', 'state-transition-set', 'state-detect', 'state-recover',
                       'lock-acquire', 'lock-status', 'plan-list-sets', 'plan-load-set',
                       'execute-prepare', 'execute-verify', 'execute-wave-status', 'execute-commit-state',
                       'merge-execute', 'merge-status', 'merge-order', 'merge-prepare-context',
                       'worktree-list', 'worktree-status', 'display-banner', 'parse-return', 'parse-return-validate',
                       'resolve-set', 'resolve-wave'],
  'executor':         ['state-get', 'state-transition-set', 'verify-light'],
  'job-executor':     ['state-get', 'state-transition-set', 'verify-light'],
  'planner':          ['state-get', 'state-get-all', 'plan-create-set', 'plan-decompose', 'plan-write-dag',
                       'plan-list-sets', 'plan-load-set', 'resolve-set', 'resolve-wave'],
  'set-planner':      ['state-get', 'state-get-all', 'plan-create-set', 'plan-decompose', 'plan-write-dag'],
  'reviewer':         ['state-get', 'review-scope', 'review-log-issue', 'review-list-issues',
                       'review-update-issue', 'review-lean', 'review-summary'],
  'verifier':         ['state-get', 'verify-light', 'verify-heavy'],
  'merger':           ['merge-detect', 'merge-resolve', 'merge-review'],
  'set-merger':       ['merge-detect', 'merge-resolve', 'merge-review', 'merge-update-status'],
  'conflict-resolver':['merge-detect'],
  'bugfix':           ['state-get'],

  // Planner variants
  'wave-planner':     ['state-get', 'wave-plan-resolve', 'wave-plan-create-dir',
                       'wave-plan-validate', 'wave-plan-list-jobs'],
  'job-planner':      ['state-get', 'wave-plan-resolve', 'wave-plan-list-jobs'],
  'plan-verifier':    ['state-get', 'plan-load-set', 'wave-plan-validate'],
  'wave-analyzer':    ['state-get', 'plan-list-sets'],

  // Init/context pipeline
  'roadmapper':       ['state-get', 'init-scaffold'],
  'codebase-synthesizer': ['context-detect'],
  'context-generator': ['state-get', 'context-generate'],

  // These roles have NO CLI commands (omitted from map):
  // 'research-stack', 'research-features', 'research-architecture',
  // 'research-pitfalls', 'research-oversights', 'research-synthesizer',
  // 'wave-researcher', 'unit-tester', 'bug-hunter', 'devils-advocate',
  // 'judge', 'uat', 'scoper'
};
```

### Updated ROLE_CORE_MAP (After Consolidation)

```javascript
const ROLE_CORE_MAP = {
  // All roles get identity + returns (the 2 universal modules)
  // Roles that commit code also get conventions
  'planner':              ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'executor':             ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'reviewer':             ['core-identity.md', 'core-returns.md'],
  'verifier':             ['core-identity.md', 'core-returns.md'],
  'orchestrator':         ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'wave-researcher':      ['core-identity.md', 'core-returns.md'],
  'wave-planner':         ['core-identity.md', 'core-returns.md'],
  'job-planner':          ['core-identity.md', 'core-returns.md'],
  'set-planner':          ['core-identity.md', 'core-returns.md'],
  'job-executor':         ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'bugfix':               ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'merger':               ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
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
  'research-synthesizer': ['core-identity.md', 'core-returns.md'],
  'roadmapper':           ['core-identity.md', 'core-returns.md'],
  'plan-verifier':        ['core-identity.md', 'core-returns.md'],
  'wave-analyzer':        ['core-identity.md', 'core-returns.md'],
  'scoper':               ['core-identity.md', 'core-returns.md'],
  'set-merger':           ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
  'conflict-resolver':    ['core-identity.md', 'core-returns.md', 'core-conventions.md'],
};
```

**Key changes from current ROLE_CORE_MAP:**
- `core-state-access.md` removed from all roles (its CLI commands become tool docs, its rules absorbed into core-identity.md)
- `core-context-loading.md` removed from all roles (its loading strategy absorbed into core-identity.md)
- `core-git.md` replaced by `core-conventions.md` for all roles that had it
- Roles that previously had `core-context-loading.md` but not `core-git.md` (wave-researcher, wave-planner, job-planner, set-planner, plan-verifier, wave-analyzer) lose their extra module -- the content now lives in core-identity.md

### Core Module Content Migration Plan

**core-identity.md (absorbs from 2 retired modules):**
```markdown
# Existing sections (keep as-is):
- RAPID Agent Identity introduction
- Working Directory protocol
- RAPID Workflow

# New section: Tool Invocation (from core-context-loading.md Prerequisites)
## Tool Invocation
Before running any rapid-tools.cjs command, ensure RAPID_TOOLS is set:
[RAPID_TOOLS env var setup block]

# New section: Context Loading (condensed from core-context-loading.md)
## Context Loading
- Start with your plan/summary files
- Use `state get` CLI for state (never read STATE.json directly)
- Use Grep/Glob before reading files
- Never load more than 5 files speculatively

# New section: State Access Rules (condensed from core-state-access.md Rules)
## State Rules
- All state accessed through CLI (never edit .planning/ directly)
- Transition commands handle locking automatically
- Lock contention retries automatically -- do not retry manually
```

**core-conventions.md (new, content from core-git.md):**
```markdown
# Git Commit Conventions
[Exact content from current core-git.md -- commit format, rules, etc.]
```

### PROMPT-SCHEMA.md Structure

```markdown
# RAPID Agent Prompt Schema

## Overview
Agent prompts are assembled from XML-tagged sections containing Markdown content.
This schema defines the allowed tags and their semantics.

## Tags

### Required Tags
| Tag | Purpose | Content |
|-----|---------|---------|
| `<identity>` | Agent identity, workflow, state rules | From core-identity.md |
| `<role>` | Role-specific instructions | From role-{name}.md |
| `<returns>` | Structured return protocol | From core-returns.md |

### Optional Tags
| Tag | Purpose | Content |
|-----|---------|---------|
| `<conventions>` | Git commit conventions | From core-conventions.md |
| `<tools>` | Per-role CLI command reference | Generated by tool-docs.cjs |
| `<context>` | Runtime task-specific context | Injected by skills at spawn time |

## Assembly Order
1. YAML frontmatter (name, description, tools, model, color)
2. `<identity>` -- always first content section
3. `<conventions>` -- if role commits code
4. `<tools>` -- if role uses CLI commands
5. `<role>` -- role-specific instructions
6. `<returns>` -- always last static section

Note: `<context>` is injected at runtime by the spawning skill, not during build.

## Rules
- All tags are top-level -- no nesting
- Content inside tags is Markdown
- Tags may be omitted if the role does not need them
- Required tags must be present in every built agent (build-time warning if missing)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5 core modules (identity, returns, state-access, git, context-loading) | 3 core modules (identity, conventions, returns) | Phase 39 | ~40% reduction in core module token overhead; state CLI docs move to compact per-role YAML |
| Full CLI documentation in prose form per module | Compact one-liner YAML per command | Phase 39 | Each agent gets only the commands it needs instead of full CLI reference |
| Implicit XML tags (partially used) | Formal XML schema with 5 defined tags | Phase 39 | Build-time validation of prompt structure |

**Deprecated/outdated:**
- `core-state-access.md`: CLI commands become TOOL_REGISTRY entries, rules absorbed into core-identity.md
- `core-context-loading.md`: Prerequisites section absorbed into core-identity.md, loading strategy condensed
- `core-git.md`: Renamed to core-conventions.md with identical content

## Open Questions

1. **Exact executor ROLE_TOOL_MAP entries**
   - What we know: Executor needs at minimum `state-get` and `state-transition-set` (from current core-state-access.md usage)
   - What's unclear: Whether executor also needs `verify-light` or `execute-commit-state` depends on v3.0 executor role scope (Phase 42)
   - Recommendation: Start with minimal set (`state-get`, `state-transition-set`, `verify-light`) and expand in Phase 42 when the executor role is rewritten

2. **Token budget accuracy**
   - What we know: chars/4 is a reasonable approximation for Claude's tokenizer
   - What's unclear: Whether the 1000-token budget is tight enough for complex roles like orchestrator
   - Recommendation: Implement the warning, see which roles trigger it, adjust registry content to fit. The orchestrator may need its tool docs split or commands condensed.

3. **Core-identity.md size after absorption**
   - What we know: Currently 2,313 bytes. Adding context-loading (~1,000 bytes condensed) and state-access rules (~500 bytes condensed) brings it to ~3,800 bytes
   - What's unclear: Whether this makes the identity module too large (affects all 31 agents)
   - Recommendation: Be aggressive about condensing. The full CLI command list is no longer needed in identity (it's in tool docs). Focus on principles, not command reference.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) v22+ |
| Config file | None -- uses node --test directly |
| Quick run command | `node --test src/lib/tool-docs.test.cjs` |
| Full suite command | `node --test src/lib/build-agents.test.cjs src/lib/tool-docs.test.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | getToolDocsForRole() returns YAML with only role's commands | unit | `node --test src/lib/tool-docs.test.cjs -x` | No -- Wave 0 |
| AGENT-01 | Generated executor agent contains `<tools>` section with expected commands | integration | `node --test src/lib/build-agents.test.cjs -x` | Yes -- needs update |
| AGENT-02 | Generated agents have required XML tags (identity, role, returns) | integration | `node --test src/lib/build-agents.test.cjs -x` | Yes -- needs update |
| AGENT-02 | PROMPT-SCHEMA.md exists and documents 5 tags | unit | `node --test src/lib/tool-docs.test.cjs -x` | No -- Wave 0 |
| AGENT-05 | TOOL_REGISTRY keys all have descriptions | unit | `node --test src/lib/tool-docs.test.cjs -x` | No -- Wave 0 |
| AGENT-05 | ROLE_TOOL_MAP keys exist in TOOL_REGISTRY | unit | `node --test src/lib/tool-docs.test.cjs -x` | No -- Wave 0 |
| AGENT-05 | Tool docs per role under 1000 estimated tokens | unit | `node --test src/lib/tool-docs.test.cjs -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test src/lib/tool-docs.test.cjs src/lib/build-agents.test.cjs`
- **Per wave merge:** `node --test src/lib/tool-docs.test.cjs src/lib/build-agents.test.cjs`
- **Phase gate:** Both test files green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `src/lib/tool-docs.test.cjs` -- covers AGENT-01, AGENT-05 (tool-docs module tests)
- [ ] `src/lib/build-agents.test.cjs` -- update existing tests to reflect new 3-module core, 5-tag XML schema, tool injection (covers AGENT-02)

## Sources

### Primary (HIGH confidence)
- `/home/kek/Projects/RAPID/src/bin/rapid-tools.cjs` (lines 450-677) -- Current assembleAgentPrompt(), ROLE_CORE_MAP, handleBuildAgents() implementation
- `/home/kek/Projects/RAPID/src/lib/build-agents.test.cjs` -- Current test structure (8 tests, 2 failing due to count mismatch from v2.2 agent additions)
- `/home/kek/Projects/RAPID/src/modules/core/*.md` -- Current 5 core modules with exact content and sizes
- `/home/kek/Projects/RAPID/src/modules/roles/*.md` -- All 31 role modules with CLI command usage patterns
- `/home/kek/Projects/RAPID/.planning/phases/39-tool-docs-registry-core-module-refactor/39-CONTEXT.md` -- User decisions and locked implementation choices

### Secondary (MEDIUM confidence)
- Token estimation heuristic (chars/4) -- widely used approximation, accuracy within ~20% for Claude's tokenizer on English/code text

### Tertiary (LOW confidence)
- ROLE_TOOL_MAP command assignments -- derived from reading role modules and inferring which CLI commands each role would invoke. The exact set per role is a Claude's Discretion item and will need validation during Phase 42 core agent rewrites.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all built-in Node.js modules
- Architecture: HIGH -- extending existing build pipeline pattern with well-understood string templating
- Pitfalls: HIGH -- derived from direct codebase analysis of existing test expectations and module references
- ROLE_TOOL_MAP command assignments: MEDIUM -- reasonable inference from codebase, but exact v3.0 role needs will solidify in Phase 42

**Research date:** 2026-03-12
**Valid until:** 2026-03-19 (stable -- internal tooling, no external dependency changes)
