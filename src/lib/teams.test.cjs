'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const teams = require('./teams.cjs');

describe('teams.cjs', () => {
  // ────────────────────────────────────────
  // detectAgentTeams()
  // ────────────────────────────────────────
  describe('detectAgentTeams()', () => {
    let savedEnv;

    beforeEach(() => {
      savedEnv = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    });

    afterEach(() => {
      if (savedEnv === undefined) {
        delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      } else {
        process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = savedEnv;
      }
    });

    it('returns { available: true } when env var is "1"', () => {
      process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
      const result = teams.detectAgentTeams();
      assert.deepStrictEqual(result, { available: true });
    });

    it('returns { available: false } when env var is undefined', () => {
      delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      const result = teams.detectAgentTeams();
      assert.deepStrictEqual(result, { available: false });
    });

    it('returns { available: false } when env var is "0"', () => {
      process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '0';
      const result = teams.detectAgentTeams();
      assert.deepStrictEqual(result, { available: false });
    });

    it('returns { available: false } when env var is "false"', () => {
      process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = 'false';
      const result = teams.detectAgentTeams();
      assert.deepStrictEqual(result, { available: false });
    });

    it('returns { available: false } when env var is empty string', () => {
      process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '';
      const result = teams.detectAgentTeams();
      assert.deepStrictEqual(result, { available: false });
    });
  });

  // ────────────────────────────────────────
  // waveTeamMeta()
  // ────────────────────────────────────────
  describe('waveTeamMeta()', () => {
    it('returns correct metadata for wave 1', () => {
      const result = teams.waveTeamMeta(1);
      assert.deepStrictEqual(result, { teamName: 'rapid-wave-1', waveNum: 1 });
    });

    it('returns correct metadata for wave 3', () => {
      const result = teams.waveTeamMeta(3);
      assert.deepStrictEqual(result, { teamName: 'rapid-wave-3', waveNum: 3 });
    });

    it('uses rapid-wave-{N} naming convention', () => {
      const result = teams.waveTeamMeta(42);
      assert.equal(result.teamName, 'rapid-wave-42');
      assert.equal(result.waveNum, 42);
    });
  });

  // ────────────────────────────────────────
  // buildTeammateConfig()
  // ────────────────────────────────────────
  describe('buildTeammateConfig()', () => {
    it('returns object with name, prompt, and worktreePath fields', () => {
      // We test the shape -- buildTeammateConfig calls execute.assembleExecutorPrompt
      // which requires real set data. We test shape with a mock approach:
      // Create a minimal .planning/sets directory structure
      let tmpDir;
      try {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-teams-test-'));
        const setsDir = path.join(tmpDir, '.planning', 'sets', 'test-set');
        fs.mkdirSync(setsDir, { recursive: true });
        // Create CONTRACT.json
        fs.writeFileSync(path.join(setsDir, 'CONTRACT.json'), JSON.stringify({
          name: 'test-set',
          exports: { functions: ['foo'] },
          imports: { fromSets: [] },
        }));
        // Create DEFINITION.md
        fs.writeFileSync(path.join(setsDir, 'DEFINITION.md'), '# test-set\nA test set.');

        const result = teams.buildTeammateConfig(tmpDir, 'test-set', '/path/to/worktree', 'My plan text');
        assert.equal(result.name, 'test-set');
        assert.equal(typeof result.prompt, 'string');
        assert.ok(result.prompt.length > 0, 'prompt should not be empty');
        assert.equal(result.worktreePath, '/path/to/worktree');
      } finally {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('includes plan text in the prompt', () => {
      let tmpDir;
      try {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-teams-test-'));
        const setsDir = path.join(tmpDir, '.planning', 'sets', 'auth-set');
        fs.mkdirSync(setsDir, { recursive: true });
        fs.writeFileSync(path.join(setsDir, 'CONTRACT.json'), JSON.stringify({
          name: 'auth-set',
          exports: { functions: ['login'] },
          imports: { fromSets: [] },
        }));
        fs.writeFileSync(path.join(setsDir, 'DEFINITION.md'), '# auth-set\nAuth implementation.');

        const result = teams.buildTeammateConfig(tmpDir, 'auth-set', '/wt/auth', 'Step 1: Create auth module');
        assert.ok(result.prompt.includes('Step 1: Create auth module'), 'prompt should contain plan text');
      } finally {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ────────────────────────────────────────
  // readCompletions()
  // ────────────────────────────────────────
  describe('readCompletions()', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-teams-comp-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns parsed JSON objects from JSONL file', () => {
      const teamsDir = path.join(tmpDir, '.planning', 'teams');
      fs.mkdirSync(teamsDir, { recursive: true });
      const records = [
        { task_id: 't1', subject: 'auth', teammate: 'auth-set', team: 'rapid-wave-1', completed_at: '2026-03-05T00:00:00Z' },
        { task_id: 't2', subject: 'db', teammate: 'db-set', team: 'rapid-wave-1', completed_at: '2026-03-05T00:01:00Z' },
      ];
      fs.writeFileSync(
        path.join(teamsDir, 'rapid-wave-1-completions.jsonl'),
        records.map(r => JSON.stringify(r)).join('\n') + '\n'
      );

      const result = teams.readCompletions(tmpDir, 'rapid-wave-1');
      assert.equal(result.length, 2);
      assert.equal(result[0].task_id, 't1');
      assert.equal(result[1].task_id, 't2');
    });

    it('returns [] when tracking file does not exist', () => {
      const result = teams.readCompletions(tmpDir, 'rapid-wave-999');
      assert.deepStrictEqual(result, []);
    });

    it('returns [] when tracking file is empty', () => {
      const teamsDir = path.join(tmpDir, '.planning', 'teams');
      fs.mkdirSync(teamsDir, { recursive: true });
      fs.writeFileSync(path.join(teamsDir, 'rapid-wave-empty-completions.jsonl'), '');

      const result = teams.readCompletions(tmpDir, 'rapid-wave-empty');
      assert.deepStrictEqual(result, []);
    });

    it('skips blank lines in JSONL file', () => {
      const teamsDir = path.join(tmpDir, '.planning', 'teams');
      fs.mkdirSync(teamsDir, { recursive: true });
      const content = '{"task_id":"t1","team":"rapid-wave-2"}\n\n\n{"task_id":"t2","team":"rapid-wave-2"}\n\n';
      fs.writeFileSync(path.join(teamsDir, 'rapid-wave-2-completions.jsonl'), content);

      const result = teams.readCompletions(tmpDir, 'rapid-wave-2');
      assert.equal(result.length, 2);
      assert.equal(result[0].task_id, 't1');
      assert.equal(result[1].task_id, 't2');
    });
  });

  // ────────────────────────────────────────
  // cleanupTeamTracking()
  // ────────────────────────────────────────
  describe('cleanupTeamTracking()', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-teams-cleanup-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('removes the JSONL tracking file', () => {
      const teamsDir = path.join(tmpDir, '.planning', 'teams');
      fs.mkdirSync(teamsDir, { recursive: true });
      const filePath = path.join(teamsDir, 'rapid-wave-1-completions.jsonl');
      fs.writeFileSync(filePath, '{"task_id":"t1"}\n');
      assert.ok(fs.existsSync(filePath), 'file should exist before cleanup');

      teams.cleanupTeamTracking(tmpDir, 'rapid-wave-1');
      assert.ok(!fs.existsSync(filePath), 'file should be removed after cleanup');
    });

    it('succeeds silently when tracking file does not exist', () => {
      // Should not throw
      teams.cleanupTeamTracking(tmpDir, 'rapid-wave-nonexistent');
    });
  });

  // ────────────────────────────────────────
  // buildJobTeammateConfig()
  // ────────────────────────────────────────
  describe('buildJobTeammateConfig()', () => {
    it('returns { name, prompt, worktreePath } with correct name format', () => {
      const jobPlanContent = [
        '# JOB-PLAN: job-schema',
        '',
        '## Files to Create/Modify',
        '',
        '| File | Action | Purpose |',
        '|------|--------|---------|',
        '| src/lib/schema.cjs | Create | Schema defs |',
        '',
        '## Implementation Steps',
        '1. Create schema',
      ].join('\n');

      const result = teams.buildJobTeammateConfig(
        '/fake/cwd', 'auth-core', 'wave-1', 'job-schema',
        '/path/to/worktree', jobPlanContent
      );

      assert.equal(result.name, 'auth-core-job-schema', 'name should be {setId}-{jobId}');
      assert.equal(typeof result.prompt, 'string', 'prompt should be a string');
      assert.ok(result.prompt.length > 0, 'prompt should not be empty');
      assert.equal(result.worktreePath, '/path/to/worktree', 'worktreePath should match');
    });

    it('prompt contains jobId and setId', () => {
      const jobPlanContent = '# JOB-PLAN: job-transitions\n\n## Implementation Steps\n1. Do stuff';

      const result = teams.buildJobTeammateConfig(
        '/fake/cwd', 'my-set', 'wave-2', 'job-transitions',
        '/wt/path', jobPlanContent
      );

      assert.ok(result.prompt.includes('job-transitions'), 'prompt should contain jobId');
      assert.ok(result.prompt.includes('my-set'), 'prompt should contain setId');
    });

    it('prompt contains job plan content', () => {
      const jobPlanContent = '# JOB-PLAN: job-test\n\n## Files to Create/Modify\n\n| File | Action |\n|------|--------|\n| src/test.cjs | Create |\n\n## Implementation Steps\n1. Create test module with special logic';

      const result = teams.buildJobTeammateConfig(
        '/fake/cwd', 'test-set', 'wave-1', 'job-test',
        '/wt/test', jobPlanContent
      );

      assert.ok(result.prompt.includes('special logic'), 'prompt should contain plan content');
    });

    it('prompt contains commit convention with set name', () => {
      const jobPlanContent = '# JOB-PLAN: job-x\n\n## Steps\n1. Do it';

      const result = teams.buildJobTeammateConfig(
        '/fake/cwd', 'data-layer', 'wave-1', 'job-x',
        '/wt/data', jobPlanContent
      );

      assert.ok(result.prompt.includes('data-layer'), 'commit convention should reference set name');
      assert.ok(result.prompt.includes('type('), 'should have type( prefix in commit convention');
    });
  });

  // ────────────────────────────────────────
  // waveJobTeamMeta()
  // ────────────────────────────────────────
  describe('waveJobTeamMeta()', () => {
    it('returns correct metadata with teamName format rapid-{setId}-{waveId}', () => {
      const result = teams.waveJobTeamMeta('auth-core', 'wave-1');
      assert.deepStrictEqual(result, {
        teamName: 'rapid-auth-core-wave-1',
        setId: 'auth-core',
        waveId: 'wave-1',
      });
    });

    it('returns correct metadata for different inputs', () => {
      const result = teams.waveJobTeamMeta('data-layer', 'wave-3');
      assert.equal(result.teamName, 'rapid-data-layer-wave-3');
      assert.equal(result.setId, 'data-layer');
      assert.equal(result.waveId, 'wave-3');
    });
  });
});

// ────────────────────────────────────────────────────────────────
// Agent registration tests for job-executor role
// ────────────────────────────────────────────────────────────────
describe('job-executor agent registration', () => {
  const fs = require('fs');
  const path = require('path');

  it('role-job-executor.md source module exists', () => {
    const rolePath = path.join(__dirname, '..', 'modules', 'roles', 'role-job-executor.md');
    assert.ok(fs.existsSync(rolePath), 'role-job-executor.md should exist in roles directory');
  });

  it('rapid-job-executor.md generated agent exists with correct tools', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-job-executor.md');
    assert.ok(fs.existsSync(agentPath), 'rapid-job-executor.md should exist in agents directory');
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('rapid-job-executor'), 'agent should include rapid-job-executor name');
    assert.ok(content.includes('Read'), 'should include Read tool');
    assert.ok(content.includes('Write'), 'should include Write tool');
    assert.ok(content.includes('Bash'), 'should include Bash tool');
  });
});
