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
    it('returns correct counts (5 core, 6 roles)', () => {
      const result = assembler.listModules();
      assert.ok(result.core, 'Should have core array');
      assert.ok(result.roles, 'Should have roles array');
      assert.equal(result.core.length, 5, `Expected 5 core modules, got ${result.core.length}`);
      assert.equal(result.roles.length, 6, `Expected 6 role modules, got ${result.roles.length}`);
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
        'role-context-generator.md',
        'role-executor.md',
        'role-orchestrator.md',
        'role-planner.md',
        'role-reviewer.md',
        'role-verifier.md',
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
});
