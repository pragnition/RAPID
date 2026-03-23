'use strict';

const { output, error, resolveRapidDir, loadConfig } = require('../lib/core.cjs');
const { CliError } = require('../lib/errors.cjs');

function handleBuildAgents(cwd, args) {
  const fs = require('fs');
  const path = require('path');
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
    'auditor':               'Read, Grep, Glob, Bash',
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
    'auditor': 'blue',
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
    'auditor':               'RAPID auditor agent -- cross-references requirements against delivery for gap analysis',
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
    'auditor':              ['core-identity.md', 'core-returns.md'],
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
      throw new CliError(`SKIP_GENERATION references unknown role "${role}" not in ROLE_CORE_MAP`);
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

  // SKIP_GENERATION roles: never overwrite existing files, only create if missing
  for (const role of SKIP_GENERATION) {
    const filePath = path.join(agentsDir, `rapid-${role}.md`);
    if (fs.existsSync(filePath)) {
      continue; // Preserve existing core agent file unconditionally
    }
    const coreModules = ROLE_CORE_MAP[role];
    const assembled = assembleStubPrompt(role, coreModules);
    const content = STUB_COMMENT + assembled;
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  output(`Built ${built.length} agents (${skipped.length} core skipped) in ${agentsDir}`);
}

module.exports = { handleBuildAgents };
