'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  JobStatus,
  JobState,
  WaveStatus,
  WaveState,
  SetStatus,
  SetState,
  MilestoneState,
  ProjectState,
  QuickTask,
} = require('./state-schemas.cjs');

describe('JobStatus', () => {
  it('allows valid statuses', () => {
    for (const s of ['pending', 'executing', 'complete', 'failed']) {
      assert.equal(JobStatus.parse(s), s);
    }
  });

  it('rejects invalid status', () => {
    assert.throws(() => JobStatus.parse('running'), { name: 'ZodError' });
  });
});

describe('JobState', () => {
  it('requires id and defaults status to pending', () => {
    const job = JobState.parse({ id: 'job-1' });
    assert.equal(job.id, 'job-1');
    assert.equal(job.status, 'pending');
    assert.deepEqual(job.artifacts, []);
  });

  it('accepts all optional fields', () => {
    const job = JobState.parse({
      id: 'job-2',
      status: 'executing',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T01:00:00Z',
      commitSha: 'abc123',
      artifacts: ['file.js'],
    });
    assert.equal(job.status, 'executing');
    assert.equal(job.startedAt, '2026-01-01T00:00:00Z');
    assert.equal(job.completedAt, '2026-01-01T01:00:00Z');
    assert.equal(job.commitSha, 'abc123');
    assert.deepEqual(job.artifacts, ['file.js']);
  });

  it('rejects missing id', () => {
    const result = JobState.safeParse({ status: 'pending' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('id')));
  });

  it('rejects invalid status value', () => {
    const result = JobState.safeParse({ id: 'j1', status: 'bogus' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('status')));
  });
});

describe('WaveStatus', () => {
  it('allows valid statuses', () => {
    for (const s of ['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete']) {
      assert.equal(WaveStatus.parse(s), s);
    }
  });

  it('rejects invalid status', () => {
    assert.throws(() => WaveStatus.parse('waiting'), { name: 'ZodError' });
  });
});

describe('WaveState', () => {
  it('requires id and defaults status/jobs', () => {
    const wave = WaveState.parse({ id: 'wave-1' });
    assert.equal(wave.id, 'wave-1');
    assert.equal(wave.status, 'pending');
    assert.deepEqual(wave.jobs, []);
  });

  it('accepts nested jobs', () => {
    const wave = WaveState.parse({
      id: 'wave-1',
      status: 'executing',
      jobs: [{ id: 'job-1' }, { id: 'job-2', status: 'complete' }],
    });
    assert.equal(wave.jobs.length, 2);
    assert.equal(wave.jobs[0].status, 'pending');
    assert.equal(wave.jobs[1].status, 'complete');
  });
});

describe('SetStatus', () => {
  it('allows valid statuses', () => {
    for (const s of ['pending', 'planning', 'executing', 'reviewing', 'merging', 'complete']) {
      assert.equal(SetStatus.parse(s), s);
    }
  });

  it('rejects invalid status', () => {
    assert.throws(() => SetStatus.parse('done'), { name: 'ZodError' });
  });
});

describe('SetState', () => {
  it('requires id and defaults status/waves', () => {
    const set = SetState.parse({ id: 'set-1' });
    assert.equal(set.id, 'set-1');
    assert.equal(set.status, 'pending');
    assert.deepEqual(set.waves, []);
  });

  it('accepts nested waves with jobs', () => {
    const set = SetState.parse({
      id: 'set-1',
      status: 'executing',
      waves: [{
        id: 'wave-1',
        jobs: [{ id: 'job-1', status: 'complete' }],
      }],
    });
    assert.equal(set.waves.length, 1);
    assert.equal(set.waves[0].jobs[0].status, 'complete');
  });
});

describe('MilestoneState', () => {
  it('requires id and name, defaults sets', () => {
    const ms = MilestoneState.parse({ id: 'ms-1', name: 'Alpha' });
    assert.equal(ms.id, 'ms-1');
    assert.equal(ms.name, 'Alpha');
    assert.deepEqual(ms.sets, []);
  });

  it('rejects missing name', () => {
    const result = MilestoneState.safeParse({ id: 'ms-1' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('name')));
  });
});

describe('ProjectState', () => {
  const validProject = {
    version: 1,
    projectName: 'TestProject',
    currentMilestone: 'ms-1',
    lastUpdatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('parses valid project with defaults', () => {
    const proj = ProjectState.parse(validProject);
    assert.equal(proj.version, 1);
    assert.equal(proj.projectName, 'TestProject');
    assert.deepEqual(proj.milestones, []);
  });

  it('parses full nested hierarchy', () => {
    const full = ProjectState.parse({
      ...validProject,
      milestones: [{
        id: 'ms-1',
        name: 'Alpha',
        sets: [{
          id: 'set-1',
          waves: [{
            id: 'wave-1',
            jobs: [{ id: 'job-1', status: 'complete' }],
          }],
        }],
      }],
    });
    assert.equal(full.milestones[0].sets[0].waves[0].jobs[0].status, 'complete');
  });

  it('rejects version !== 1', () => {
    const result = ProjectState.safeParse({ ...validProject, version: 2 });
    assert.equal(result.success, false);
  });

  it('rejects missing required fields', () => {
    const result = ProjectState.safeParse({ version: 1 });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.length > 0);
  });

  it('safeParse returns success:false with meaningful paths for invalid data', () => {
    const result = ProjectState.safeParse({
      version: 1,
      projectName: 'P',
      currentMilestone: 'm',
      lastUpdatedAt: 'x',
      createdAt: 'x',
      milestones: [{
        id: 'ms-1',
        name: 'A',
        sets: [{
          id: 's1',
          status: 'INVALID_STATUS',
        }],
      }],
    });
    assert.equal(result.success, false);
    const paths = result.error.issues.map(i => i.path.join('.'));
    assert.ok(paths.some(p => p.includes('status')));
  });

  it('parses without quickTasks field (backward compat)', () => {
    const proj = ProjectState.parse(validProject);
    assert.deepEqual(proj.quickTasks, []);
  });

  it('parses with quickTasks as empty array', () => {
    const proj = ProjectState.parse({ ...validProject, quickTasks: [] });
    assert.deepEqual(proj.quickTasks, []);
  });

  it('parses with populated quickTasks array', () => {
    const proj = ProjectState.parse({
      ...validProject,
      quickTasks: [
        { id: 1, description: 'Fix the bug', date: '2026-03-11' },
        { id: 2, description: 'Add feature', date: '2026-03-12', commitHash: 'abc123', directory: 'my-dir' },
      ],
    });
    assert.equal(proj.quickTasks.length, 2);
    assert.equal(proj.quickTasks[0].id, 1);
    assert.equal(proj.quickTasks[0].description, 'Fix the bug');
    assert.equal(proj.quickTasks[0].commitHash, undefined);
    assert.equal(proj.quickTasks[1].commitHash, 'abc123');
    assert.equal(proj.quickTasks[1].directory, 'my-dir');
  });
});

describe('QuickTask', () => {
  it('parses valid quick task with required fields only', () => {
    const task = QuickTask.parse({ id: 1, description: 'Test task', date: '2026-03-11' });
    assert.equal(task.id, 1);
    assert.equal(task.description, 'Test task');
    assert.equal(task.date, '2026-03-11');
    assert.equal(task.commitHash, undefined);
    assert.equal(task.directory, undefined);
  });

  it('parses valid quick task with all fields', () => {
    const task = QuickTask.parse({
      id: 3,
      description: 'Full task',
      date: '2026-03-11',
      commitHash: 'def456',
      directory: 'task-dir',
    });
    assert.equal(task.commitHash, 'def456');
    assert.equal(task.directory, 'task-dir');
  });

  it('rejects missing required fields', () => {
    const result = QuickTask.safeParse({ id: 1 });
    assert.equal(result.success, false);
  });

  it('rejects non-numeric id', () => {
    const result = QuickTask.safeParse({ id: 'abc', description: 'Test', date: '2026-03-11' });
    assert.equal(result.success, false);
  });
});
