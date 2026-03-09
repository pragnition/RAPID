'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Module under test
const assemblerPath = path.join(__dirname, 'assembler.cjs');

// All 26 roles that must have explicit map entries
const ALL_26_ROLES = [
  'planner', 'executor', 'reviewer', 'verifier', 'orchestrator',
  'wave-researcher', 'wave-planner', 'job-planner', 'job-executor',
  'unit-tester', 'bug-hunter', 'devils-advocate', 'judge',
  'bugfix', 'uat', 'merger',
  'research-stack', 'research-features', 'research-architecture',
  'research-pitfalls', 'research-oversights', 'research-synthesizer',
  'roadmapper', 'codebase-synthesizer', 'context-generator', 'set-planner',
];

// Per-role core module mapping (must match the production ROLE_CORE_MAP)
const EXPECTED_ROLE_CORE_MAP = {
  'planner':      ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
  'executor':     ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md'],
  'reviewer':     ['core-identity.md', 'core-returns.md', 'core-state-access.md'],
  'verifier':     ['core-identity.md', 'core-returns.md', 'core-state-access.md'],
  'orchestrator': ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md', 'core-context-loading.md'],
  'wave-researcher': ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'wave-planner':    ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'job-planner':     ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'set-planner':     ['core-identity.md', 'core-returns.md', 'core-context-loading.md'],
  'job-executor': ['core-identity.md', 'core-returns.md', 'core-state-access.md', 'core-git.md'],
  'bugfix':       ['core-identity.md', 'core-returns.md', 'core-git.md'],
  'merger':       ['core-identity.md', 'core-returns.md', 'core-git.md'],
  'unit-tester':      ['core-identity.md', 'core-returns.md'],
  'bug-hunter':       ['core-identity.md', 'core-returns.md'],
  'devils-advocate':  ['core-identity.md', 'core-returns.md'],
  'judge':            ['core-identity.md', 'core-returns.md'],
  'uat':              ['core-identity.md', 'core-returns.md'],
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

describe('build-agents', () => {
  let assembler;

  before(() => {
    assembler = require(assemblerPath);
  });

  describe('ROLE_TOOLS completeness', () => {
    it('all 26 roles have explicit ROLE_TOOLS entries (no fallback to defaults)', () => {
      for (const role of ALL_26_ROLES) {
        const fm = assembler.generateFrontmatter(role);
        // Default fallback is 'Read, Bash, Grep, Glob' -- ensure no role uses it
        assert.ok(
          !fm.includes('tools: Read, Bash, Grep, Glob'),
          `Role "${role}" is using the default tools fallback -- needs explicit ROLE_TOOLS entry`
        );
      }
    });
  });

  describe('ROLE_COLORS completeness', () => {
    it('all 26 roles have explicit ROLE_COLORS entries (no fallback to "default")', () => {
      for (const role of ALL_26_ROLES) {
        const fm = assembler.generateFrontmatter(role);
        assert.ok(
          !fm.includes('color: default'),
          `Role "${role}" is using the default color fallback -- needs explicit ROLE_COLORS entry`
        );
      }
    });
  });

  describe('ROLE_DESCRIPTIONS completeness', () => {
    it('all 26 roles have explicit ROLE_DESCRIPTIONS entries (no generic fallback)', () => {
      for (const role of ALL_26_ROLES) {
        const fm = assembler.generateFrontmatter(role);
        // Generic fallback is `RAPID ${role} agent` with no further detail
        const genericPattern = new RegExp(`description: RAPID ${role} agent\\n`);
        assert.ok(
          !genericPattern.test(fm),
          `Role "${role}" is using the generic description fallback -- needs explicit ROLE_DESCRIPTIONS entry`
        );
      }
    });
  });

  describe('buildAllAgents function', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-build-agents-test-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('buildAllAgents is exported from assembler', () => {
      assert.ok(typeof assembler.buildAllAgents === 'function', 'buildAllAgents should be exported as a function');
    });

    it('generates exactly 26 .md files', () => {
      const result = assembler.buildAllAgents(tmpDir);
      assert.equal(result.built, 26, `Expected 26 built agents, got ${result.built}`);
      assert.equal(result.files.length, 26, `Expected 26 files, got ${result.files.length}`);

      const mdFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
      assert.equal(mdFiles.length, 26, `Expected 26 .md files in output dir, got ${mdFiles.length}`);
    });

    it('each generated file starts with valid YAML frontmatter', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(tmpDir, file), 'utf-8');
        // Must start with GENERATED comment then frontmatter
        assert.ok(
          content.startsWith('<!-- GENERATED by build-agents'),
          `${file} should start with GENERATED comment, got: ${content.substring(0, 60)}`
        );

        // Find frontmatter delimiters
        const fmStart = content.indexOf('---');
        const fmEnd = content.indexOf('---', fmStart + 3);
        assert.ok(fmStart !== -1 && fmEnd !== -1, `${file} should have YAML frontmatter delimiters`);

        const frontmatter = content.substring(fmStart, fmEnd + 3);
        assert.ok(frontmatter.includes('name:'), `${file} frontmatter should have name field`);
        assert.ok(frontmatter.includes('description:'), `${file} frontmatter should have description field`);
        assert.ok(frontmatter.includes('tools:'), `${file} frontmatter should have tools field`);
        assert.ok(frontmatter.includes('model:'), `${file} frontmatter should have model field`);
        assert.ok(frontmatter.includes('color:'), `${file} frontmatter should have color field`);
      }
    });

    it('each generated file contains correct core module XML tags per ROLE_CORE_MAP', () => {
      for (const [role, coreModules] of Object.entries(EXPECTED_ROLE_CORE_MAP)) {
        const filePath = path.join(tmpDir, `rapid-${role}.md`);
        assert.ok(fs.existsSync(filePath), `${filePath} should exist`);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const mod of coreModules) {
          const tag = mod.replace('.md', '').replace('core-', '');
          assert.ok(
            content.includes(`<${tag}>`),
            `rapid-${role}.md should contain <${tag}> tag (from ${mod})`
          );
          assert.ok(
            content.includes(`</${tag}>`),
            `rapid-${role}.md should contain </${tag}> closing tag (from ${mod})`
          );
        }

        // Verify it does NOT contain core modules it shouldn't
        const allCoreTags = ['identity', 'returns', 'state-access', 'git', 'context-loading'];
        const expectedTags = coreModules.map(m => m.replace('.md', '').replace('core-', ''));
        for (const tag of allCoreTags) {
          if (!expectedTags.includes(tag)) {
            assert.ok(
              !content.includes(`<${tag}>`),
              `rapid-${role}.md should NOT contain <${tag}> tag`
            );
          }
        }
      }
    });

    it('each generated file contains a <role> tag', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(tmpDir, file), 'utf-8');
        assert.ok(content.includes('<role>'), `${file} should contain <role> tag`);
        assert.ok(content.includes('</role>'), `${file} should contain </role> closing tag`);
      }
    });

    it('no generated file exceeds 15KB', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(tmpDir, file), 'utf-8');
        const sizeBytes = Buffer.byteLength(content, 'utf-8');
        assert.ok(
          sizeBytes <= 15360,
          `${file} is ${(sizeBytes / 1024).toFixed(1)}KB, exceeds 15KB limit`
        );
      }
    });

    it('each generated file starts with the GENERATED comment', () => {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(tmpDir, file), 'utf-8');
        assert.ok(
          content.startsWith('<!-- GENERATED by build-agents -- do not edit directly. Edit src/modules/ instead. -->'),
          `${file} should start with GENERATED comment`
        );
      }
    });
  });
});
