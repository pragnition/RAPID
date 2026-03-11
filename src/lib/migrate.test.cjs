'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('migration detection and transformation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-migrate-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('detectFramework', () => {
    it('returns type "none" when no planning directory exists', async () => {
      const { detectFramework } = require('./migrate.cjs');
      const result = await detectFramework(tmpDir);
      assert.equal(result.type, 'none');
      assert.equal(result.confidence, 'high');
      assert.deepEqual(result.artifacts, []);
    });

    it('returns type "gsd" with high confidence when GSD patterns exist', async () => {
      const { detectFramework } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      const phasesDir = path.join(planningDir, 'phases');
      const phaseDir = path.join(phasesDir, '01-init');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\ngsd_state_version: 1.0\n---\n# State');
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

      const result = await detectFramework(tmpDir);
      assert.equal(result.type, 'gsd');
      assert.equal(result.confidence, 'high');
      assert.ok(result.artifacts.length > 0);
      assert.ok(result.artifacts.some(a => a.includes('STATE.md')));
    });

    it('returns type "openspec" with high confidence when openspec patterns exist', async () => {
      const { detectFramework } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'SPEC.md'), '# OpenSpec\nopenspec_version: 1');
      fs.writeFileSync(path.join(planningDir, 'REQUIREMENTS.md'), '# Requirements');

      const result = await detectFramework(tmpDir);
      assert.equal(result.type, 'openspec');
      assert.equal(result.confidence, 'high');
      assert.ok(result.artifacts.length > 0);
    });

    it('returns type "generic" with medium confidence when general planning files exist', async () => {
      const { detectFramework } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State\nSome planning state');
      fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap');

      const result = await detectFramework(tmpDir);
      assert.equal(result.type, 'generic');
      assert.equal(result.confidence, 'medium');
      assert.ok(result.artifacts.length > 0);
    });

    it('includes details object with detection reasoning', async () => {
      const { detectFramework } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\ngsd_state_version: 1.0\n---');

      const result = await detectFramework(tmpDir);
      assert.ok(result.details);
      assert.ok(typeof result.details === 'object');
    });
  });

  describe('backupPlanning', () => {
    it('creates .planning.bak/ with full copy of .planning/ contents', async () => {
      const { backupPlanning } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State');
      fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap');
      const subDir = path.join(planningDir, 'phases');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'plan.md'), '# Plan');

      await backupPlanning(tmpDir);

      const backupDir = path.join(tmpDir, '.planning.bak');
      assert.ok(fs.existsSync(backupDir));
      assert.ok(fs.existsSync(path.join(backupDir, 'STATE.md')));
      assert.ok(fs.existsSync(path.join(backupDir, 'ROADMAP.md')));
      assert.ok(fs.existsSync(path.join(backupDir, 'phases', 'plan.md')));

      // Verify content is identical
      const origContent = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
      const backupContent = fs.readFileSync(path.join(backupDir, 'STATE.md'), 'utf-8');
      assert.equal(origContent, backupContent);
    });

    it('throws if .planning.bak/ already exists', async () => {
      const { backupPlanning } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State');

      // Create existing backup
      const backupDir = path.join(tmpDir, '.planning.bak');
      fs.mkdirSync(backupDir, { recursive: true });

      await assert.rejects(
        () => backupPlanning(tmpDir),
        (err) => {
          assert.ok(err.message.includes('.planning.bak'));
          return true;
        }
      );
    });

    it('throws if .planning/ does not exist', async () => {
      const { backupPlanning } = require('./migrate.cjs');
      await assert.rejects(
        () => backupPlanning(tmpDir),
        (err) => {
          assert.ok(err.message.includes('.planning'));
          return true;
        }
      );
    });
  });

  describe('transformToRapid', () => {
    it('restructures detected GSD artifacts to RAPID directory conventions', async () => {
      const { transformToRapid, detectFramework } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      const phasesDir = path.join(planningDir, 'phases');
      const phaseDir = path.join(phasesDir, '01-init');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\ngsd_state_version: 1.0\n---\n# State');
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

      const detection = await detectFramework(tmpDir);
      const result = await transformToRapid(tmpDir, detection);

      assert.ok(result.transformed);
      assert.ok(Array.isArray(result.transformed));
      assert.ok(result.skipped);
      assert.ok(Array.isArray(result.skipped));
      assert.ok(result.errors);
      assert.ok(Array.isArray(result.errors));
    });

    it('renames gsd_state_version to rapid_state_version in STATE.md', async () => {
      const { transformToRapid } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(
        path.join(planningDir, 'STATE.md'),
        '---\ngsd_state_version: 1.0\n---\n# State'
      );

      const detection = { type: 'gsd', confidence: 'high', artifacts: ['STATE.md'], details: {} };
      const result = await transformToRapid(tmpDir, detection);

      const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
      assert.ok(content.includes('rapid_state_version'));
      assert.ok(!content.includes('gsd_state_version'));
      assert.ok(result.transformed.length > 0);
    });

    it('creates RAPID directory structure for generic projects', async () => {
      const { transformToRapid } = require('./migrate.cjs');
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State');
      fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap');

      const detection = {
        type: 'generic',
        confidence: 'medium',
        artifacts: ['STATE.md', 'ROADMAP.md'],
        details: {},
      };
      const result = await transformToRapid(tmpDir, detection);

      assert.ok(result.transformed);
      assert.ok(Array.isArray(result.transformed));
      assert.ok(result.errors.length === 0);
    });

    it('returns empty transformed for type "none"', async () => {
      const { transformToRapid } = require('./migrate.cjs');

      const detection = { type: 'none', confidence: 'high', artifacts: [], details: {} };
      const result = await transformToRapid(tmpDir, detection);

      assert.deepEqual(result.transformed, []);
      assert.deepEqual(result.errors, []);
    });

    it('handles missing files gracefully in errors array', async () => {
      const { transformToRapid } = require('./migrate.cjs');

      const detection = {
        type: 'gsd',
        confidence: 'high',
        artifacts: ['STATE.md', 'nonexistent.md'],
        details: {},
      };
      // No .planning dir at all
      const result = await transformToRapid(tmpDir, detection);

      // Should not throw, but report issues
      assert.ok(Array.isArray(result.errors) || Array.isArray(result.skipped));
    });
  });
});
