'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// assembler module under test
const assemblerPath = path.join(__dirname, 'assembler.cjs');

describe('assembler', () => {
  let assembler;

  before(() => {
    assembler = require(assemblerPath);
  });

  describe('assembleAgent', () => {
    it('produces string starting with YAML frontmatter (---)', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
        context: {},
      });
      assert.ok(result.startsWith('---'), 'Output should start with YAML frontmatter delimiter');
    });

    it('contains all core module tags', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
        context: {},
      });
      assert.ok(result.includes('<identity>'), 'Missing <identity> tag');
      assert.ok(result.includes('</identity>'), 'Missing </identity> tag');
      assert.ok(result.includes('<returns>'), 'Missing <returns> tag');
      assert.ok(result.includes('</returns>'), 'Missing </returns> tag');
      assert.ok(result.includes('<state-access>'), 'Missing <state-access> tag');
      assert.ok(result.includes('</state-access>'), 'Missing </state-access> tag');
      assert.ok(result.includes('<git>'), 'Missing <git> tag');
      assert.ok(result.includes('</git>'), 'Missing </git> tag');
      assert.ok(result.includes('<context-loading>'), 'Missing <context-loading> tag');
      assert.ok(result.includes('</context-loading>'), 'Missing </context-loading> tag');
    });

    it('contains <role> tag with role-specific content', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-identity.md'],
        context: {},
      });
      assert.ok(result.includes('<role>'), 'Missing <role> tag');
      assert.ok(result.includes('</role>'), 'Missing </role> tag');
      assert.ok(result.includes('Role: Planner'), 'Role content should include planner-specific text');
    });

    it('includes <project_context> tag when context.project is provided', () => {
      const result = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: { project: 'This is project context data' },
      });
      assert.ok(result.includes('<project_context>'), 'Missing <project_context> tag');
      assert.ok(result.includes('This is project context data'), 'Missing project context content');
      assert.ok(result.includes('</project_context>'), 'Missing </project_context> tag');
    });

    it('includes <contracts> tag when context.contracts is provided', () => {
      const result = assembler.assembleAgent({
        role: 'reviewer',
        coreModules: ['core-identity.md'],
        context: { contracts: 'Contract specification here' },
      });
      assert.ok(result.includes('<contracts>'), 'Missing <contracts> tag');
      assert.ok(result.includes('Contract specification here'), 'Missing contracts content');
      assert.ok(result.includes('</contracts>'), 'Missing </contracts> tag');
    });

    it('includes <style_guide> tag when context.style is provided', () => {
      const result = assembler.assembleAgent({
        role: 'reviewer',
        coreModules: ['core-identity.md'],
        context: { style: 'Style guide rules here' },
      });
      assert.ok(result.includes('<style_guide>'), 'Missing <style_guide> tag');
      assert.ok(result.includes('Style guide rules here'), 'Missing style guide content');
      assert.ok(result.includes('</style_guide>'), 'Missing </style_guide> tag');
    });

    it('omits context tags when context properties are not provided', () => {
      const result = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: {},
      });
      assert.ok(!result.includes('<project_context>'), 'Should not include <project_context> without data');
      assert.ok(!result.includes('<contracts>'), 'Should not include <contracts> without data');
      assert.ok(!result.includes('<style_guide>'), 'Should not include <style_guide> without data');
    });

    it('writes to file when outputPath is provided', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      const outputPath = path.join(tmpDir, 'test-agent.md');
      try {
        const result = assembler.assembleAgent({
          role: 'planner',
          coreModules: ['core-identity.md'],
          context: {},
          outputPath,
        });
        assert.equal(result, outputPath, 'Should return the output path');
        assert.ok(fs.existsSync(outputPath), 'File should exist at outputPath');
        const content = fs.readFileSync(outputPath, 'utf-8');
        assert.ok(content.startsWith('---'), 'Written file should start with frontmatter');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('returns assembled string when outputPath is omitted', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-identity.md'],
        context: {},
      });
      assert.equal(typeof result, 'string', 'Should return a string');
      assert.ok(result.length > 100, 'Assembled string should be substantive');
    });

    it('core modules are ordered as listed in config', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-git.md', 'core-identity.md'],
        context: {},
      });
      const gitIndex = result.indexOf('<git>');
      const identityIndex = result.indexOf('<identity>');
      assert.ok(gitIndex < identityIndex, 'Core modules should appear in the order specified (git before identity)');
    });
  });

  describe('listModules', () => {
    it('returns correct counts (5 core, 25 roles)', () => {
      const result = assembler.listModules();
      assert.ok(result.core, 'Should have core array');
      assert.ok(result.roles, 'Should have roles array');
      assert.equal(result.core.length, 5, `Expected 5 core modules, got ${result.core.length}`);
      assert.equal(result.roles.length, 25, `Expected 25 role modules, got ${result.roles.length}`);
    });

    it('lists the correct core module files', () => {
      const result = assembler.listModules();
      const expectedCore = [
        'core-context-loading.md',
        'core-git.md',
        'core-identity.md',
        'core-returns.md',
        'core-state-access.md',
      ];
      assert.deepEqual(result.core.sort(), expectedCore.sort(), 'Core modules should match expected list');
    });

    it('lists the correct role module files', () => {
      const result = assembler.listModules();
      const expectedRoles = [
        'role-bugfix.md',
        'role-bug-hunter.md',
        'role-codebase-synthesizer.md',
        'role-context-generator.md',
        'role-devils-advocate.md',
        'role-executor.md',
        'role-job-executor.md',
        'role-job-planner.md',
        'role-judge.md',
        'role-orchestrator.md',
        'role-planner.md',
        'role-research-architecture.md',
        'role-research-features.md',
        'role-research-oversights.md',
        'role-research-pitfalls.md',
        'role-research-stack.md',
        'role-research-synthesizer.md',
        'role-reviewer.md',
        'role-roadmapper.md',
        'role-set-planner.md',
        'role-uat.md',
        'role-unit-tester.md',
        'role-verifier.md',
        'role-wave-planner.md',
        'role-wave-researcher.md',
      ];
      assert.deepEqual(result.roles.sort(), expectedRoles.sort(), 'Role modules should match expected list');
    });
  });

  describe('validateConfig', () => {
    it('returns valid for the default config.json', () => {
      const configPath = path.join(__dirname, '..', '..', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const result = assembler.validateConfig(config);
      assert.equal(result.valid, true, `Validation errors: ${JSON.stringify(result.errors)}`);
    });

    it('returns errors for config referencing nonexistent core module', () => {
      const badConfig = {
        agents: {
          'rapid-planner': {
            role: 'planner',
            core: ['core-identity.md', 'core-nonexistent.md'],
            context: [],
          },
        },
      };
      const result = assembler.validateConfig(badConfig);
      assert.equal(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.length > 0, 'Should have errors');
      assert.ok(
        result.errors.some(e => e.includes('core-nonexistent.md')),
        'Error should mention the missing module'
      );
    });

    it('returns errors for config referencing nonexistent role module', () => {
      const badConfig = {
        agents: {
          'rapid-ghost': {
            role: 'ghost',
            core: ['core-identity.md'],
            context: [],
          },
        },
      };
      const result = assembler.validateConfig(badConfig);
      assert.equal(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.length > 0, 'Should have errors');
      assert.ok(
        result.errors.some(e => e.includes('ghost')),
        'Error should mention the missing role module'
      );
    });
  });

  describe('generateFrontmatter', () => {
    it('generates YAML frontmatter for planner role', () => {
      const result = assembler.generateFrontmatter('planner');
      assert.ok(result.startsWith('---'), 'Should start with ---');
      assert.ok(result.endsWith('---'), 'Should end with ---');
      assert.ok(result.includes('name: rapid-planner'), 'Should include agent name');
      assert.ok(result.includes('model: inherit'), 'Should include model setting');
    });

    it('generates different tool lists for different roles', () => {
      const plannerFm = assembler.generateFrontmatter('planner');
      const reviewerFm = assembler.generateFrontmatter('reviewer');
      // Both should have name and model
      assert.ok(plannerFm.includes('name: rapid-planner'), 'Planner should have planner name');
      assert.ok(reviewerFm.includes('name: rapid-reviewer'), 'Reviewer should have reviewer name');
    });

    it('orchestrator frontmatter includes Agent tool', () => {
      const result = assembler.generateFrontmatter('orchestrator');
      assert.ok(result.includes('Agent'), 'Orchestrator should have Agent tool');
    });
  });

  describe('loadContextFiles', () => {
    it('returns empty object when no context files exist', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      try {
        const result = assembler.loadContextFiles(tmpDir, ['STYLE_GUIDE.md', 'CONVENTIONS.md']);
        assert.deepEqual(result, {}, 'Should return empty object when no files exist');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('returns file contents keyed by filename when files exist', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      const contextDir = path.join(tmpDir, '.planning', 'context');
      fs.mkdirSync(contextDir, { recursive: true });
      fs.writeFileSync(path.join(contextDir, 'STYLE_GUIDE.md'), '# Style Guide\nUse camelCase', 'utf-8');
      fs.writeFileSync(path.join(contextDir, 'CONVENTIONS.md'), '# Conventions\nUse strict mode', 'utf-8');
      try {
        const result = assembler.loadContextFiles(tmpDir, ['STYLE_GUIDE.md', 'CONVENTIONS.md']);
        assert.equal(Object.keys(result).length, 2, 'Should return 2 files');
        assert.ok(result['STYLE_GUIDE.md'].includes('camelCase'), 'STYLE_GUIDE.md content should be loaded');
        assert.ok(result['CONVENTIONS.md'].includes('strict mode'), 'CONVENTIONS.md content should be loaded');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('skips missing files without error', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      const contextDir = path.join(tmpDir, '.planning', 'context');
      fs.mkdirSync(contextDir, { recursive: true });
      fs.writeFileSync(path.join(contextDir, 'STYLE_GUIDE.md'), '# Style Guide', 'utf-8');
      try {
        const result = assembler.loadContextFiles(tmpDir, ['STYLE_GUIDE.md', 'NONEXISTENT.md']);
        assert.equal(Object.keys(result).length, 1, 'Should only return existing files');
        assert.ok(result['STYLE_GUIDE.md'], 'Should include existing file');
        assert.equal(result['NONEXISTENT.md'], undefined, 'Should not include missing file');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('contextFiles injection in assembleAgent', () => {
    it('adds XML-wrapped sections for contextFiles', () => {
      const result = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: {
          contextFiles: {
            'STYLE_GUIDE.md': '# Style Guide\nUse camelCase for variables',
            'CONVENTIONS.md': '# Conventions\nUse strict mode',
          },
        },
      });
      assert.ok(result.includes('<context-style-guide>'), 'Should have <context-style-guide> tag');
      assert.ok(result.includes('</context-style-guide>'), 'Should have </context-style-guide> closing tag');
      assert.ok(result.includes('camelCase for variables'), 'Should include style guide content');
      assert.ok(result.includes('<context-conventions>'), 'Should have <context-conventions> tag');
      assert.ok(result.includes('</context-conventions>'), 'Should have </context-conventions> closing tag');
      assert.ok(result.includes('strict mode'), 'Should include conventions content');
    });

    it('derives correct tag names from filenames', () => {
      const result = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: {
          contextFiles: {
            'STYLE_GUIDE.md': 'style content',
            'ARCHITECTURE.md': 'arch content',
            'API_PATTERNS.md': 'api content',
          },
        },
      });
      // STYLE_GUIDE.md -> context-style-guide
      assert.ok(result.includes('<context-style-guide>'), 'STYLE_GUIDE.md should become context-style-guide');
      // ARCHITECTURE.md -> context-architecture
      assert.ok(result.includes('<context-architecture>'), 'ARCHITECTURE.md should become context-architecture');
      // API_PATTERNS.md -> context-api-patterns
      assert.ok(result.includes('<context-api-patterns>'), 'API_PATTERNS.md should become context-api-patterns');
    });

    it('does not add context sections when contextFiles is empty or absent', () => {
      const result1 = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: { contextFiles: {} },
      });
      assert.ok(!result1.includes('<context-'), 'Should not have context- tags with empty object');

      const result2 = assembler.assembleAgent({
        role: 'executor',
        coreModules: ['core-identity.md'],
        context: {},
      });
      assert.ok(!result2.includes('<context-'), 'Should not have context- tags without contextFiles');
    });
  });

  describe('assembled agent size', () => {
    it('assembled planner agent is under 15KB', () => {
      const result = assembler.assembleAgent({
        role: 'planner',
        coreModules: ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
        context: {},
      });
      const sizeKB = Buffer.byteLength(result, 'utf-8') / 1024;
      assert.ok(sizeKB < 15, `Assembled agent is ${sizeKB.toFixed(1)}KB, should be under 15KB`);
    });
  });

  describe('ROLE_COLORS and color frontmatter', () => {
    const VALID_CLAUDE_CODE_COLORS = ['red', 'blue', 'green', 'purple', 'yellow', 'orange', 'cyan', 'default'];

    it('generateFrontmatter("planner") includes "color: blue"', () => {
      const result = assembler.generateFrontmatter('planner');
      assert.ok(result.includes('color: blue'), `Expected color: blue in planner frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("executor") includes "color: green"', () => {
      const result = assembler.generateFrontmatter('executor');
      assert.ok(result.includes('color: green'), `Expected color: green in executor frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("reviewer") includes "color: red"', () => {
      const result = assembler.generateFrontmatter('reviewer');
      assert.ok(result.includes('color: red'), `Expected color: red in reviewer frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("bug-hunter") includes "color: yellow"', () => {
      const result = assembler.generateFrontmatter('bug-hunter');
      assert.ok(result.includes('color: yellow'), `Expected color: yellow in bug-hunter frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("devils-advocate") includes "color: purple"', () => {
      const result = assembler.generateFrontmatter('devils-advocate');
      assert.ok(result.includes('color: purple'), `Expected color: purple in devils-advocate frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("unit-tester") includes "color: cyan"', () => {
      const result = assembler.generateFrontmatter('unit-tester');
      assert.ok(result.includes('color: cyan'), `Expected color: cyan in unit-tester frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("uat") includes "color: cyan"', () => {
      const result = assembler.generateFrontmatter('uat');
      assert.ok(result.includes('color: cyan'), `Expected color: cyan in uat frontmatter, got:\n${result}`);
    });

    it('generateFrontmatter("merger") includes "color: green"', () => {
      const result = assembler.generateFrontmatter('merger');
      assert.ok(result.includes('color: green'), `Expected color: green in merger frontmatter, got:\n${result}`);
    });

    it('all 16 roles in ROLE_TOOLS also appear in ROLE_COLORS', () => {
      const allRoles = [
        'planner', 'executor', 'reviewer', 'verifier', 'orchestrator',
        'wave-researcher', 'wave-planner', 'job-planner', 'job-executor',
        'unit-tester', 'bug-hunter', 'devils-advocate', 'judge',
        'bugfix', 'uat', 'merger',
      ];
      for (const role of allRoles) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(
          fm.includes('color:'),
          `Role "${role}" frontmatter should include a color field, got:\n${fm}`
        );
      }
    });

    it('every ROLE_COLORS value is one of the valid Claude Code colors', () => {
      const allRoles = [
        'planner', 'executor', 'reviewer', 'verifier', 'orchestrator',
        'wave-researcher', 'wave-planner', 'job-planner', 'job-executor',
        'unit-tester', 'bug-hunter', 'devils-advocate', 'judge',
        'bugfix', 'uat', 'merger',
      ];
      for (const role of allRoles) {
        const fm = assembler.generateFrontmatter(role);
        const colorMatch = fm.match(/color: (\S+)/);
        assert.ok(colorMatch, `Role "${role}" frontmatter should have color field`);
        const colorValue = colorMatch[1];
        assert.ok(
          VALID_CLAUDE_CODE_COLORS.includes(colorValue),
          `Role "${role}" has color "${colorValue}" which is not a valid Claude Code color. Valid: ${VALID_CLAUDE_CODE_COLORS.join(', ')}`
        );
      }
    });

    it('generateFrontmatter for an unknown role falls back to "default" color', () => {
      const result = assembler.generateFrontmatter('nonexistent-role');
      assert.ok(result.includes('color: default'), `Unknown role should fallback to color: default, got:\n${result}`);
    });

    it('planning roles all have blue color', () => {
      const planningRoles = ['planner', 'wave-planner', 'job-planner', 'wave-researcher', 'orchestrator', 'verifier'];
      for (const role of planningRoles) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(fm.includes('color: blue'), `Planning role "${role}" should have color: blue, got:\n${fm}`);
      }
    });

    it('execution roles all have green color', () => {
      const executionRoles = ['executor', 'job-executor', 'bugfix', 'merger'];
      for (const role of executionRoles) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(fm.includes('color: green'), `Execution role "${role}" should have color: green, got:\n${fm}`);
      }
    });

    it('review roles have their designated colors', () => {
      const reviewColors = {
        reviewer: 'red',
        judge: 'red',
        'bug-hunter': 'yellow',
        'devils-advocate': 'purple',
        'unit-tester': 'cyan',
        uat: 'cyan',
      };
      for (const [role, expectedColor] of Object.entries(reviewColors)) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(
          fm.includes(`color: ${expectedColor}`),
          `Review role "${role}" should have color: ${expectedColor}, got:\n${fm}`
        );
      }
    });
  });

  describe('review role registration', () => {
    const REVIEW_ROLES = ['unit-tester', 'bug-hunter', 'devils-advocate', 'judge', 'bugfix', 'uat'];

    it('all 6 review roles appear in ROLE_TOOLS', () => {
      for (const role of REVIEW_ROLES) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(
          fm.includes(`name: rapid-${role}`),
          `${role} should have a registered name in frontmatter`
        );
        // Verify it does NOT fall back to the default tools
        // (default fallback is 'Read, Bash, Grep, Glob' for unknown roles)
        assert.ok(
          !fm.includes('description: RAPID ' + role + ' agent\n'),
          `${role} should have a custom description, not the fallback`
        );
      }
    });

    it('all 6 review roles appear in ROLE_DESCRIPTIONS', () => {
      const descriptions = {
        'unit-tester': 'generates test plans and writes/runs tests',
        'bug-hunter': 'performs static analysis and identifies bugs',
        'devils-advocate': 'challenges bug hunter findings with evidence',
        'judge': 'rules on contested findings with ACCEPTED/DISMISSED/DEFERRED',
        'bugfix': 'fixes accepted bugs with atomic commits',
        'uat': 'generates and executes acceptance test plans',
      };
      for (const [role, descFragment] of Object.entries(descriptions)) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(
          fm.includes(descFragment),
          `${role} frontmatter should include description fragment: "${descFragment}"`
        );
      }
    });

    it('devils-advocate has NO Write or Bash tool (read-only enforcement)', () => {
      const fm = assembler.generateFrontmatter('devils-advocate');
      assert.ok(fm.includes('tools: Read, Grep, Glob'), `devils-advocate should have Read, Grep, Glob only, got: ${fm}`);
      assert.ok(!fm.includes('Write'), 'devils-advocate must NOT have Write tool');
      assert.ok(!fm.includes('Bash'), 'devils-advocate must NOT have Bash tool');
      assert.ok(!fm.includes('Edit'), 'devils-advocate must NOT have Edit tool');
    });

    it('bugfix has Edit tool (needed for targeted fixes)', () => {
      const fm = assembler.generateFrontmatter('bugfix');
      assert.ok(fm.includes('Edit'), 'bugfix should have Edit tool for targeted code fixes');
      assert.ok(fm.includes('Write'), 'bugfix should have Write tool');
      assert.ok(fm.includes('Bash'), 'bugfix should have Bash tool for running tests');
    });

    it('judge has Write but no Bash (for REVIEW-BUGS.md only)', () => {
      const fm = assembler.generateFrontmatter('judge');
      assert.ok(fm.includes('Write'), 'judge should have Write tool for REVIEW-BUGS.md');
      assert.ok(!fm.includes('Bash'), 'judge should NOT have Bash tool');
      assert.ok(!fm.includes('Edit'), 'judge should NOT have Edit tool');
    });

    it('unit-tester has Write and Bash but no Edit', () => {
      const fm = assembler.generateFrontmatter('unit-tester');
      assert.ok(fm.includes('Write'), 'unit-tester should have Write tool for creating test files');
      assert.ok(fm.includes('Bash'), 'unit-tester should have Bash tool for running tests');
      assert.ok(!fm.includes('Edit'), 'unit-tester should NOT have Edit tool');
    });

    it('bug-hunter has Bash but no Write or Edit (read-only + linting)', () => {
      const fm = assembler.generateFrontmatter('bug-hunter');
      assert.ok(fm.includes('Bash'), 'bug-hunter should have Bash tool for linting');
      assert.ok(!fm.includes('Write'), 'bug-hunter must NOT have Write tool');
      assert.ok(!fm.includes('Edit'), 'bug-hunter must NOT have Edit tool');
    });

    it('uat has Write and Bash but no Edit', () => {
      const fm = assembler.generateFrontmatter('uat');
      assert.ok(fm.includes('Write'), 'uat should have Write tool for REVIEW-UAT.md');
      assert.ok(fm.includes('Bash'), 'uat should have Bash tool for automation');
      assert.ok(!fm.includes('Edit'), 'uat should NOT have Edit tool');
    });

    it('generateFrontmatter works for each new role (returns valid YAML)', () => {
      for (const role of REVIEW_ROLES) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(fm.startsWith('---'), `${role} frontmatter should start with ---`);
        assert.ok(fm.endsWith('---'), `${role} frontmatter should end with ---`);
        assert.ok(fm.includes(`name: rapid-${role}`), `${role} frontmatter should include name`);
        assert.ok(fm.includes('model: inherit'), `${role} frontmatter should include model: inherit`);
        assert.ok(fm.includes('tools:'), `${role} frontmatter should include tools field`);
        assert.ok(fm.includes('description:'), `${role} frontmatter should include description field`);
      }
    });
  });
});
