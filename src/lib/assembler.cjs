'use strict';

const fs = require('fs');
const path = require('path');
const { output, loadConfig, resolveRapidDir } = require('./core.cjs');

const MODULES_DIR = path.join(__dirname, '..', 'modules');

/**
 * Tool configuration per agent role.
 * Defines which Claude Code tools each role has access to.
 */
const ROLE_TOOLS = {
  planner: 'Read, Write, Edit, Bash, Grep, Glob',
  executor: 'Read, Write, Edit, Bash, Grep, Glob',
  reviewer: 'Read, Grep, Glob, Bash',
  verifier: 'Read, Bash, Grep, Glob',
  orchestrator: 'Read, Write, Bash, Grep, Glob, Agent',
  'wave-researcher': 'Read, Grep, Glob, Bash, WebFetch',
  'wave-planner': 'Read, Write, Grep, Glob',
  'job-planner': 'Read, Write, Grep, Glob',
  'job-executor': 'Read, Write, Edit, Bash, Grep, Glob',
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
  'research-synthesizer':  'Read, Write, Grep, Glob',
  'roadmapper':            'Read, Write, Grep, Glob',
  'codebase-synthesizer':  'Read, Grep, Glob, Bash',
  'context-generator':     'Read, Write, Grep, Glob, Bash',
  'set-planner':           'Read, Write, Grep, Glob',
};

/**
 * Color configuration per agent role.
 * Maps each role to a Claude Code frontmatter color value.
 * Valid values: red, blue, green, purple, yellow, orange, cyan, default
 */
const ROLE_COLORS = {
  // PLANNING roles = blue
  planner: 'blue',
  'wave-planner': 'blue',
  'job-planner': 'blue',
  'wave-researcher': 'blue',
  orchestrator: 'blue',
  verifier: 'blue',
  // EXECUTION roles = green
  executor: 'green',
  'job-executor': 'green',
  bugfix: 'green',
  merger: 'green',
  // REVIEW roles = designated colors
  reviewer: 'red',
  judge: 'red',
  'bug-hunter': 'yellow',
  'devils-advocate': 'purple',
  'unit-tester': 'cyan',
  uat: 'cyan',
  // Research/init roles = blue (planning category)
  'research-stack': 'blue',
  'research-features': 'blue',
  'research-architecture': 'blue',
  'research-pitfalls': 'blue',
  'research-oversights': 'blue',
  'research-synthesizer': 'blue',
  'roadmapper': 'blue',
  'codebase-synthesizer': 'blue',
  'context-generator': 'blue',
  'set-planner': 'blue',
};

/**
 * Role descriptions for frontmatter.
 */
const ROLE_DESCRIPTIONS = {
  planner: 'RAPID planner agent -- decomposes work into parallelizable sets',
  executor: 'RAPID executor agent -- implements tasks within assigned worktree',
  reviewer: 'RAPID reviewer agent -- performs deep code review before merge',
  verifier: 'RAPID verifier agent -- verifies task completion via filesystem checks',
  orchestrator: 'RAPID orchestrator agent -- coordinates planning, execution, verification, and merge',
  'wave-researcher': 'RAPID wave research agent -- investigates implementation specifics for a wave',
  'wave-planner': 'RAPID wave planner agent -- produces high-level per-job plans for a wave',
  'job-planner': 'RAPID job planner agent -- creates detailed implementation plan for a single job',
  'job-executor': 'RAPID job executor agent -- implements a single job within a wave per JOB-PLAN.md',
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
  'research-synthesizer':  'RAPID research synthesizer agent -- combines research findings into coherent recommendations',
  'roadmapper':            'RAPID roadmapper agent -- creates phased implementation roadmaps from requirements',
  'codebase-synthesizer':  'RAPID codebase synthesizer agent -- analyzes existing codebase structure and patterns',
  'context-generator':     'RAPID context generator agent -- produces project context documents for agent consumption',
  'set-planner':           'RAPID set planner agent -- decomposes milestones into parallelizable development sets',
};

/**
 * Generate YAML frontmatter for an agent.
 *
 * @param {string} role - Agent role (planner|executor|reviewer|verifier|orchestrator)
 * @returns {string} YAML frontmatter string with --- delimiters
 */
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

/**
 * Load context files from .planning/context/ for injection into agent prompts.
 *
 * Reads files from the project's .planning/context/ directory based on a list
 * of filenames. Missing files are silently skipped.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {string[]} fileList - Array of filenames to load (e.g., ['STYLE_GUIDE.md', 'CONVENTIONS.md'])
 * @returns {Object} Object mapping filename to file content (only for files that exist)
 */
function loadContextFiles(projectRoot, fileList) {
  const contextDir = path.join(projectRoot, '.planning', 'context');
  const loaded = {};
  for (const file of fileList) {
    const fp = path.join(contextDir, file);
    if (fs.existsSync(fp)) {
      loaded[file] = fs.readFileSync(fp, 'utf-8');
    }
  }
  return loaded;
}

/**
 * Assemble an agent prompt from composable modules.
 *
 * Concatenates YAML frontmatter + core modules (in order) + role module + optional context sections.
 * Each module is wrapped in XML tags derived from its filename.
 *
 * @param {Object} options - Assembly options
 * @param {string} options.role - Agent role (planner|executor|reviewer|verifier|orchestrator)
 * @param {string[]} options.coreModules - Core module filenames to include, in order
 * @param {Object} [options.context={}] - Context data to inject
 * @param {string} [options.context.project] - Project context content
 * @param {string} [options.context.contracts] - Interface contracts content
 * @param {string} [options.context.style] - Style guide content
 * @param {string} [options.outputPath] - If provided, write assembled agent to this file and return the path
 * @returns {string} Assembled agent string, or outputPath if written to file
 */
function assembleAgent({ role, coreModules, context = {}, outputPath }) {
  const sections = [];

  // 1. YAML frontmatter
  sections.push(generateFrontmatter(role));

  // 2. Core modules (in specified order)
  for (const mod of coreModules) {
    const modPath = path.join(MODULES_DIR, 'core', mod);
    const content = fs.readFileSync(modPath, 'utf-8').trim();
    // Derive tag name from filename: core-identity.md -> identity
    const tag = mod.replace('.md', '').replace('core-', '');
    sections.push(`<${tag}>\n${content}\n</${tag}>`);
  }

  // 3. Role-specific module
  const rolePath = path.join(MODULES_DIR, 'roles', `role-${role}.md`);
  const roleContent = fs.readFileSync(rolePath, 'utf-8').trim();
  sections.push(`<role>\n${roleContent}\n</role>`);

  // 4. Context sections (optional)
  if (context.project) {
    sections.push(`<project_context>\n${context.project}\n</project_context>`);
  }
  if (context.contracts) {
    sections.push(`<contracts>\n${context.contracts}\n</contracts>`);
  }
  if (context.style) {
    sections.push(`<style_guide>\n${context.style}\n</style_guide>`);
  }

  // 5. Context files from .planning/context/ (role-specific)
  if (context.contextFiles && typeof context.contextFiles === 'object') {
    for (const [filename, content] of Object.entries(context.contextFiles)) {
      const tag = filename.replace('.md', '').toLowerCase().replace(/_/g, '-');
      sections.push(`<context-${tag}>\n${content}\n</context-${tag}>`);
    }
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

  // Write to file or return string
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, assembled, 'utf-8');
    return outputPath;
  }

  return assembled;
}

/**
 * List all available modules.
 *
 * @returns {{ core: string[], roles: string[] }} Object with core and roles arrays of filenames
 */
function listModules() {
  const coreDir = path.join(MODULES_DIR, 'core');
  const rolesDir = path.join(MODULES_DIR, 'roles');

  const core = fs.readdirSync(coreDir).filter(f => f.endsWith('.md')).sort();
  const roles = fs.readdirSync(rolesDir).filter(f => f.endsWith('.md')).sort();

  return { core, roles };
}

/**
 * Validate an agent assembly configuration.
 *
 * Checks that all referenced core modules and role modules exist on disk.
 *
 * @param {Object} config - Configuration object with agents property
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
function validateConfig(config) {
  const errors = [];
  const coreDir = path.join(MODULES_DIR, 'core');
  const rolesDir = path.join(MODULES_DIR, 'roles');

  if (!config.agents || typeof config.agents !== 'object') {
    return { valid: false, errors: ['Missing or invalid "agents" property'] };
  }

  for (const [agentName, agentConfig] of Object.entries(config.agents)) {
    // Check core modules exist
    if (agentConfig.core && Array.isArray(agentConfig.core)) {
      for (const mod of agentConfig.core) {
        const modPath = path.join(coreDir, mod);
        if (!fs.existsSync(modPath)) {
          errors.push(`Agent "${agentName}": core module "${mod}" not found at ${modPath}`);
        }
      }
    }

    // Check role module exists
    if (agentConfig.role) {
      const rolePath = path.join(rolesDir, `role-${agentConfig.role}.md`);
      if (!fs.existsSync(rolePath)) {
        errors.push(`Agent "${agentName}": role module "role-${agentConfig.role}.md" not found at ${rolePath}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Per-role core module mapping.
 * Defines which core modules each role needs in its assembled agent.
 */
const ROLE_CORE_MAP = {
  // Original 5 -- keep their existing core module assignments
  'planner':      ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
  'executor':     ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md'],
  'reviewer':     ['core-identity.md', 'core-returns.md', 'core-state-access.md'],
  'verifier':     ['core-identity.md', 'core-returns.md', 'core-state-access.md'],
  'orchestrator': ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],

  // Wave planning agents -- need context loading
  'wave-researcher': ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'wave-planner':    ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'job-planner':     ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'set-planner':     ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],

  // Execution agents -- need git for commits
  'job-executor': ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md'],
  'bugfix':       ['core-identity.md', 'core-returns.md', 'core-git.md'],
  'merger':       ['core-identity.md', 'core-returns.md', 'core-git.md'],

  // Review agents -- mostly read-only, returns for structured output
  'unit-tester':      ['core-identity.md', 'core-returns.md'],
  'bug-hunter':       ['core-identity.md', 'core-returns.md'],
  'devils-advocate':  ['core-identity.md', 'core-returns.md'],
  'judge':            ['core-identity.md', 'core-returns.md'],
  'uat':              ['core-identity.md', 'core-returns.md'],

  // Init/research agents -- lightweight, just identity + returns
  'codebase-synthesizer':  ['core-identity.md', 'core-returns.md'],
  'context-generator':     ['core-identity.md', 'core-returns.md'],
  'research-stack':        ['core-identity.md', 'core-returns.md'],
  'research-features':     ['core-identity.md', 'core-returns.md'],
  'research-architecture': ['core-identity.md', 'core-returns.md'],
  'research-pitfalls':     ['core-identity.md', 'core-returns.md'],
  'research-oversights':   ['core-identity.md', 'core-returns.md'],
  'research-synthesizer':  ['core-identity.md', 'core-returns.md'],
  'roadmapper':            ['core-identity.md', 'core-returns.md'],
};

/**
 * Build all 26 agent .md files from source modules.
 *
 * Iterates over ROLE_CORE_MAP, assembles each agent with the correct core modules,
 * prepends the GENERATED comment, and writes to the output directory.
 *
 * @param {string} agentsDir - Absolute path to the output agents/ directory
 * @returns {{ built: number, files: string[] }} Count and list of generated file paths
 */
function buildAllAgents(agentsDir) {
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  const GENERATED_COMMENT = '<!-- GENERATED by build-agents -- do not edit directly. Edit src/modules/ instead. -->\n';
  const built = [];

  for (const [role, coreModules] of Object.entries(ROLE_CORE_MAP)) {
    const assembled = assembleAgent({ role, coreModules, context: {} });
    const content = GENERATED_COMMENT + assembled;
    const filePath = path.join(agentsDir, `rapid-${role}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    built.push(filePath);
  }

  return { built: built.length, files: built };
}

module.exports = {
  assembleAgent,
  listModules,
  validateConfig,
  generateFrontmatter,
  loadContextFiles,
  buildAllAgents,
  ROLE_CORE_MAP,
  ROLE_TOOLS,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
};
