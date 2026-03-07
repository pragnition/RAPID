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

  return `---
name: rapid-${role}
description: ${description}
tools: ${tools}
model: inherit
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

module.exports = {
  assembleAgent,
  listModules,
  validateConfig,
  generateFrontmatter,
  loadContextFiles,
};
