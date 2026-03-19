'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  generateProjectMd,
  generateStateMd,
  generateRoadmapMd,
  generateRequirementsMd,
  generateConfigJson,
  detectExisting,
  scaffoldProject,
} = require('./init.cjs');

// Helper to create a temp directory for each test
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-init-test-'));
});

afterEach(() => {
  // Clean up temp directories
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Template Generator Tests ──

describe('generateProjectMd', () => {
  it('returns a non-empty string', () => {
    const result = generateProjectMd({ name: 'MyProject', description: 'A test project', teamSize: 3 });
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('contains project name as heading', () => {
    const result = generateProjectMd({ name: 'MyProject', description: 'A test project', teamSize: 3 });
    assert.ok(result.includes('# MyProject'));
  });

  it('contains description text', () => {
    const result = generateProjectMd({ name: 'MyProject', description: 'A test project', teamSize: 3 });
    assert.ok(result.includes('A test project'));
  });

  it('contains team size', () => {
    const result = generateProjectMd({ name: 'MyProject', description: 'A test project', teamSize: 3 });
    assert.ok(result.includes('3'));
  });

  it('contains Team Size label', () => {
    const result = generateProjectMd({ name: 'MyProject', description: 'A test project', teamSize: 3 });
    assert.match(result, /[Tt]eam [Ss]ize/);
  });

  it('contains a Key Decisions table', () => {
    const result = generateProjectMd({ name: 'TestProj', description: 'desc', teamSize: 1 });
    assert.ok(result.includes('Key Decisions'));
    assert.ok(result.includes('|'));
  });

  it('contains a created date', () => {
    const result = generateProjectMd({ name: 'TestProj', description: 'desc', teamSize: 1 });
    // Should contain a date like 2026-03-03
    assert.match(result, /\d{4}-\d{2}-\d{2}/);
  });
});

describe('generateStateMd', () => {
  it('returns a non-empty string', () => {
    const result = generateStateMd();
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('contains YAML frontmatter', () => {
    const result = generateStateMd();
    assert.ok(result.startsWith('---'));
    // Should have opening and closing ---
    const parts = result.split('---');
    assert.ok(parts.length >= 3, 'Should have opening and closing YAML frontmatter delimiters');
  });

  it('contains rapid_state_version', () => {
    const result = generateStateMd();
    assert.ok(result.includes('rapid_state_version: 1.0'));
  });

  it('does not contain gsd_state_version', () => {
    const result = generateStateMd();
    assert.ok(!result.includes('gsd_state_version'));
  });

  it('contains status initialized', () => {
    const result = generateStateMd();
    assert.ok(result.includes('status: initialized'));
  });

  it('contains progress fields with zero values', () => {
    const result = generateStateMd();
    assert.ok(result.includes('total_phases: 0'));
    assert.ok(result.includes('completed_phases: 0'));
    assert.ok(result.includes('total_plans: 0'));
    assert.ok(result.includes('completed_plans: 0'));
  });

  it('contains section headings for state sections', () => {
    const result = generateStateMd();
    assert.ok(result.includes('Current Position'));
    assert.ok(result.includes('Performance Metrics'));
    assert.ok(result.includes('Session Continuity'));
  });
});

describe('generateRoadmapMd', () => {
  it('returns a non-empty string', () => {
    const result = generateRoadmapMd('MyProject');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('contains project name', () => {
    const result = generateRoadmapMd('MyProject');
    assert.ok(result.includes('MyProject'));
  });

  it('contains phases section placeholder', () => {
    const result = generateRoadmapMd('MyProject');
    assert.match(result, /[Pp]hase/);
  });
});

describe('generateRequirementsMd', () => {
  it('returns a non-empty string', () => {
    const result = generateRequirementsMd('MyProject');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('contains project name', () => {
    const result = generateRequirementsMd('MyProject');
    assert.ok(result.includes('MyProject'));
  });

  it('contains requirements tracking structure', () => {
    const result = generateRequirementsMd('MyProject');
    assert.match(result, /[Rr]equirement/);
  });

  it('contains out of scope section', () => {
    const result = generateRequirementsMd('MyProject');
    assert.match(result, /[Oo]ut of [Ss]cope/);
  });

  it('contains traceability table', () => {
    const result = generateRequirementsMd('MyProject');
    assert.match(result, /[Tt]raceability/);
    assert.ok(result.includes('|'));
  });
});

describe('generateConfigJson', () => {
  it('returns a valid JSON string', () => {
    const result = generateConfigJson();
    assert.ok(typeof result === 'string');
    const parsed = JSON.parse(result);
    assert.ok(typeof parsed === 'object');
  });

  it('contains project section with name and version', () => {
    const parsed = JSON.parse(generateConfigJson());
    assert.ok(parsed.project);
    assert.equal(parsed.project.name, '');
    assert.equal(parsed.project.version, '0.1.0');
  });

  it('contains planning section with default max_parallel_sets', () => {
    const parsed = JSON.parse(generateConfigJson());
    assert.ok(parsed.planning);
    // Default teamSize=1 => floor(1*1.5) = 1
    assert.equal(parsed.planning.max_parallel_sets, 1);
  });

  it('defaults model to sonnet when no opts provided', () => {
    const parsed = JSON.parse(generateConfigJson());
    assert.equal(parsed.model, 'sonnet');
  });

  it('defaults model to sonnet when empty opts provided', () => {
    const parsed = JSON.parse(generateConfigJson({}));
    assert.equal(parsed.model, 'sonnet');
  });

  it('sets model to opus when specified', () => {
    const parsed = JSON.parse(generateConfigJson({ model: 'opus' }));
    assert.equal(parsed.model, 'opus');
  });

  it('sets model to sonnet when specified', () => {
    const parsed = JSON.parse(generateConfigJson({ model: 'sonnet' }));
    assert.equal(parsed.model, 'sonnet');
  });

  it('computes max_parallel_sets from teamSize 4 as 6', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 4 }));
    assert.equal(parsed.planning.max_parallel_sets, 6);
  });

  it('computes max_parallel_sets from teamSize 1 as 1', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 1 }));
    assert.equal(parsed.planning.max_parallel_sets, 1);
  });

  it('computes max_parallel_sets from teamSize 3 as 4', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 3 }));
    // floor(3 * 1.5) = floor(4.5) = 4
    assert.equal(parsed.planning.max_parallel_sets, 4);
  });

  it('includes all fields when name, model, and teamSize provided', () => {
    const parsed = JSON.parse(generateConfigJson({ name: 'MyProject', model: 'opus', teamSize: 3 }));
    assert.equal(parsed.project.name, 'MyProject');
    assert.equal(parsed.model, 'opus');
    assert.equal(parsed.planning.max_parallel_sets, 4);
    assert.equal(parsed.project.version, '0.1.0');
  });

  it('sets solo: true when teamSize is 1', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 1 }));
    assert.equal(parsed.solo, true);
  });

  it('sets solo: true when teamSize is omitted (defaults to 1)', () => {
    const parsed = JSON.parse(generateConfigJson({}));
    assert.equal(parsed.solo, true);
  });

  it('sets solo: false when teamSize is greater than 1', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 3 }));
    assert.equal(parsed.solo, false);
  });

  it('respects explicit solo: true override regardless of teamSize', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 5, solo: true }));
    assert.equal(parsed.solo, true);
  });

  it('respects explicit solo: false override regardless of teamSize', () => {
    const parsed = JSON.parse(generateConfigJson({ teamSize: 1, solo: false }));
    assert.equal(parsed.solo, false);
  });
});

// ── Detection Tests ──

describe('detectExisting', () => {
  it('returns exists:false when no .planning/ directory', () => {
    const result = detectExisting(tmpDir);
    assert.deepStrictEqual(result, { exists: false, files: [] });
  });

  it('returns exists:true when .planning/ exists with files', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir);
    fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# Test');
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\n---');

    const result = detectExisting(tmpDir);
    assert.equal(result.exists, true);
    assert.ok(result.files.includes('PROJECT.md'));
    assert.ok(result.files.includes('STATE.md'));
    assert.equal(result.files.length, 2);
  });

  it('returns exists:true with empty files array when .planning/ is empty', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir);

    const result = detectExisting(tmpDir);
    assert.equal(result.exists, true);
    assert.deepStrictEqual(result.files, []);
  });
});

// ── Scaffold Tests ──

describe('scaffoldProject', () => {
  describe('fresh mode (default)', () => {
    it('creates .planning/ with all 6 files', () => {
      const result = scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      assert.ok(result.created);
      assert.equal(result.created.length, 6);
      assert.ok(result.created.includes('PROJECT.md'));
      assert.ok(result.created.includes('STATE.md'));
      assert.ok(result.created.includes('STATE.json'));
      assert.ok(result.created.includes('ROADMAP.md'));
      assert.ok(result.created.includes('REQUIREMENTS.md'));
      assert.ok(result.created.includes('config.json'));
      assert.deepStrictEqual(result.skipped, []);
    });

    it('files actually exist on disk', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const planningDir = path.join(tmpDir, '.planning');
      assert.ok(fs.existsSync(path.join(planningDir, 'PROJECT.md')));
      assert.ok(fs.existsSync(path.join(planningDir, 'STATE.md')));
      assert.ok(fs.existsSync(path.join(planningDir, 'ROADMAP.md')));
      assert.ok(fs.existsSync(path.join(planningDir, 'REQUIREMENTS.md')));
      assert.ok(fs.existsSync(path.join(planningDir, 'config.json')));
    });

    it('creates .planning/research/ directory', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const researchDir = path.join(tmpDir, '.planning', 'research');
      assert.ok(fs.existsSync(researchDir), '.planning/research/ should exist after fresh scaffold');
      assert.ok(fs.statSync(researchDir).isDirectory(), '.planning/research/ should be a directory');
    });

    it('does NOT create .planning/phases/ directory', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'phases')));
    });

    it('PROJECT.md contains the project name', () => {
      scaffoldProject(tmpDir, { name: 'MyProject', description: 'A cool project', teamSize: 3 });
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), 'utf-8');
      assert.ok(content.includes('# MyProject'));
      assert.ok(content.includes('A cool project'));
    });

    it('config.json is valid JSON', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const raw = fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      assert.ok(parsed.project);
      assert.ok(parsed.planning);
    });
  });

  describe('reinitialize mode', () => {
    it('backs up existing .planning/ and creates fresh', () => {
      // Set up existing .planning/
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir);
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# OldProject');

      const result = scaffoldProject(tmpDir, { name: 'NewProject', description: 'fresh start', teamSize: 1 }, 'reinitialize');

      // Should have created backup
      assert.ok(result.backed_up_to);
      assert.ok(fs.existsSync(result.backed_up_to));

      // Backup should contain old file
      const backupProject = fs.readFileSync(path.join(result.backed_up_to, 'PROJECT.md'), 'utf-8');
      assert.ok(backupProject.includes('OldProject'));

      // New files should be fresh
      const newProject = fs.readFileSync(path.join(planningDir, 'PROJECT.md'), 'utf-8');
      assert.ok(newProject.includes('NewProject'));

      assert.ok(result.created.length === 6);
    });
  });

  describe('upgrade mode', () => {
    it('keeps existing files and adds missing ones', () => {
      // Set up existing .planning/ with only PROJECT.md
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir);
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# ExistingProject');

      const result = scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 }, 'upgrade');

      // PROJECT.md should be skipped (preserved)
      assert.ok(result.skipped.includes('PROJECT.md'));
      // Other 4 files should be created
      assert.equal(result.created.length, 5);
      assert.ok(result.created.includes('STATE.md'));
      assert.ok(result.created.includes('ROADMAP.md'));
      assert.ok(result.created.includes('REQUIREMENTS.md'));
      assert.ok(result.created.includes('config.json'));

      // Original file should be preserved
      const content = fs.readFileSync(path.join(planningDir, 'PROJECT.md'), 'utf-8');
      assert.ok(content.includes('ExistingProject'));
    });

    it('creates .planning/ if it does not exist', () => {
      const result = scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 }, 'upgrade');
      assert.equal(result.created.length, 6);
      assert.deepStrictEqual(result.skipped, []);
    });
  });

  describe('STATE.json generation', () => {
    it('creates STATE.json in .planning/ during fresh scaffold', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const stateJsonPath = path.join(tmpDir, '.planning', 'STATE.json');
      assert.ok(fs.existsSync(stateJsonPath), 'STATE.json should exist after fresh scaffold');
    });

    it('STATE.json is valid JSON', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const raw = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      assert.ok(typeof parsed === 'object');
      assert.equal(parsed.version, 1);
      assert.equal(parsed.projectName, 'TestProj');
    });

    it('STATE.json passes Zod validation via readState', async () => {
      const { readState } = require('./state-machine.cjs');
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      const result = await readState(tmpDir);
      assert.ok(result !== null, 'readState should not return null');
      assert.equal(result.valid, true, 'STATE.json should be valid');
      assert.equal(result.state.projectName, 'TestProj');
      assert.equal(result.state.currentMilestone, 'v1.0');
      assert.equal(result.state.milestones.length, 1);
    });

    it('STATE.md is still created alongside STATE.json (dual source)', () => {
      scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'STATE.md')), 'STATE.md should still exist');
      assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'STATE.json')), 'STATE.json should also exist');
    });

    it('includes STATE.json in created files list', () => {
      const result = scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 });
      assert.ok(result.created.includes('STATE.json'), 'created list should include STATE.json');
    });

    it('reinitialize mode also creates STATE.json', () => {
      // Set up existing .planning/
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir);
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# OldProject');

      const result = scaffoldProject(tmpDir, { name: 'NewProject', description: 'fresh', teamSize: 1 }, 'reinitialize');
      assert.ok(result.created.includes('STATE.json'));
      assert.ok(fs.existsSync(path.join(planningDir, 'STATE.json')));

      const parsed = JSON.parse(fs.readFileSync(path.join(planningDir, 'STATE.json'), 'utf-8'));
      assert.equal(parsed.projectName, 'NewProject');
    });

    it('upgrade mode creates STATE.json if missing', () => {
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir);
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# Existing');

      const result = scaffoldProject(tmpDir, { name: 'TestProj', description: 'A test', teamSize: 2 }, 'upgrade');
      assert.ok(result.created.includes('STATE.json'));
      assert.ok(fs.existsSync(path.join(planningDir, 'STATE.json')));
    });
  });

  describe('cancel mode', () => {
    it('returns cancelled:true without modifying anything', () => {
      // Set up existing .planning/
      const planningDir = path.join(tmpDir, '.planning');
      fs.mkdirSync(planningDir);
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# OriginalProject');

      const result = scaffoldProject(tmpDir, { name: 'Test', description: 'x', teamSize: 1 }, 'cancel');

      assert.deepStrictEqual(result, { cancelled: true });

      // Original files should be untouched
      const content = fs.readFileSync(path.join(planningDir, 'PROJECT.md'), 'utf-8');
      assert.ok(content.includes('OriginalProject'));
    });

    it('works when no .planning/ exists', () => {
      const result = scaffoldProject(tmpDir, { name: 'Test', description: 'x', teamSize: 1 }, 'cancel');
      assert.deepStrictEqual(result, { cancelled: true });
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning')));
    });
  });
});
