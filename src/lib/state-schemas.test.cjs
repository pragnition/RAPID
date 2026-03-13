'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Import only the expected exports
const schemas = require('./state-schemas.cjs');
const {
  SetStatus,
  SetState,
  MilestoneState,
  ProjectState,
} = schemas;

describe('SetStatus', () => {
  it('accepts "discussing"', () => {
    assert.equal(SetStatus.parse('discussing'), 'discussing');
  });

  it('accepts "merged"', () => {
    assert.equal(SetStatus.parse('merged'), 'merged');
  });

  it('accepts all 6 valid statuses', () => {
    const validStatuses = ['pending', 'discussing', 'planning', 'executing', 'complete', 'merged'];
    for (const s of validStatuses) {
      assert.equal(SetStatus.parse(s), s);
    }
  });

  it('rejects "reviewing" (removed in v3)', () => {
    assert.throws(() => SetStatus.parse('reviewing'), { name: 'ZodError' });
  });

  it('rejects "merging" (removed in v3)', () => {
    assert.throws(() => SetStatus.parse('merging'), { name: 'ZodError' });
  });

  it('rejects "failed" (no failed state)', () => {
    assert.throws(() => SetStatus.parse('failed'), { name: 'ZodError' });
  });
});

describe('SetState', () => {
  it('parses { id, status } successfully', () => {
    const set = SetState.parse({ id: 'auth', status: 'pending' });
    assert.equal(set.id, 'auth');
    assert.equal(set.status, 'pending');
  });

  it('has no extra fields on parsed result', () => {
    const set = SetState.parse({ id: 'auth', status: 'pending' });
    assert.deepEqual(Object.keys(set).sort(), ['id', 'status', 'waves']);
  });

  it('parses waves array when provided', () => {
    const set = SetState.parse({ id: 'auth', status: 'pending', waves: [{ id: 'w1' }] });
    assert.equal(set.id, 'auth');
    assert.equal(set.status, 'pending');
    assert.equal(set.waves.length, 1);
    assert.equal(set.waves[0].id, 'w1');
    assert.equal(set.waves[0].status, 'pending');
  });

  it('defaults status to "pending" when omitted', () => {
    const set = SetState.parse({ id: 'auth' });
    assert.equal(set.status, 'pending');
  });

  it('rejects missing id', () => {
    const result = SetState.safeParse({ status: 'pending' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('id')));
  });

  it('rejects invalid status', () => {
    const result = SetState.safeParse({ id: 'auth', status: 'bogus' });
    assert.equal(result.success, false);
  });
});

describe('MilestoneState', () => {
  it('parses valid milestone with sets', () => {
    const ms = MilestoneState.parse({
      id: 'm1',
      name: 'M1',
      sets: [{ id: 's1', status: 'discussing' }],
    });
    assert.equal(ms.id, 'm1');
    assert.equal(ms.name, 'M1');
    assert.equal(ms.sets.length, 1);
    assert.equal(ms.sets[0].status, 'discussing');
  });

  it('defaults sets to empty array', () => {
    const ms = MilestoneState.parse({ id: 'm1', name: 'M1' });
    assert.deepEqual(ms.sets, []);
  });

  it('rejects missing name', () => {
    const result = MilestoneState.safeParse({ id: 'm1' });
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

  it('round-trip: parse(stringify(parse(input))) equals parse(input)', () => {
    const input = {
      ...validProject,
      milestones: [{
        id: 'ms-1',
        name: 'Alpha',
        sets: [{ id: 's1', status: 'discussing' }],
      }],
    };
    const first = ProjectState.parse(input);
    const roundTripped = ProjectState.parse(JSON.parse(JSON.stringify(first)));
    assert.deepEqual(roundTripped, first);
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

  it('safeParse returns meaningful error for invalid set status', () => {
    const result = ProjectState.safeParse({
      ...validProject,
      milestones: [{
        id: 'ms-1',
        name: 'A',
        sets: [{ id: 's1', status: 'INVALID_STATUS' }],
      }],
    });
    assert.equal(result.success, false);
    const paths = result.error.issues.map(i => i.path.join('.'));
    assert.ok(paths.some(p => p.includes('status')));
  });
});

describe('export availability', () => {
  it('JobStatus IS exported as a Zod schema', () => {
    assert.notEqual(schemas.JobStatus, undefined);
    assert.equal(typeof schemas.JobStatus.parse, 'function');
  });

  it('JobState IS exported as a Zod schema', () => {
    assert.notEqual(schemas.JobState, undefined);
    assert.equal(typeof schemas.JobState.parse, 'function');
  });

  it('WaveStatus IS exported as a Zod schema', () => {
    assert.notEqual(schemas.WaveStatus, undefined);
    assert.equal(typeof schemas.WaveStatus.parse, 'function');
  });

  it('WaveState IS exported as a Zod schema', () => {
    assert.notEqual(schemas.WaveState, undefined);
    assert.equal(typeof schemas.WaveState.parse, 'function');
  });

  it('module exports exactly 8 keys', () => {
    const keys = Object.keys(schemas).sort();
    assert.deepEqual(keys, ['JobState', 'JobStatus', 'MilestoneState', 'ProjectState', 'SetState', 'SetStatus', 'WaveState', 'WaveStatus']);
  });
});

describe('WaveStatus', () => {
  const { WaveStatus } = schemas;

  it('accepts pending, executing, complete', () => {
    for (const s of ['pending', 'executing', 'complete']) {
      assert.equal(WaveStatus.parse(s), s);
    }
  });

  it('rejects set-level statuses: discussed, planned, executed', () => {
    for (const s of ['discussed', 'planned', 'executed']) {
      assert.throws(() => WaveStatus.parse(s), { name: 'ZodError' });
    }
  });

  it('rejects arbitrary strings', () => {
    assert.throws(() => WaveStatus.parse('bogus'), { name: 'ZodError' });
  });
});

describe('JobStatus', () => {
  const { JobStatus } = schemas;

  it('accepts pending, executing, complete', () => {
    for (const s of ['pending', 'executing', 'complete']) {
      assert.equal(JobStatus.parse(s), s);
    }
  });

  it('rejects set-level statuses: discussed, planned, executed', () => {
    for (const s of ['discussed', 'planned', 'executed']) {
      assert.throws(() => JobStatus.parse(s), { name: 'ZodError' });
    }
  });

  it('rejects arbitrary strings', () => {
    assert.throws(() => JobStatus.parse('bogus'), { name: 'ZodError' });
  });
});

describe('WaveState', () => {
  const { WaveState } = schemas;

  it('parses {id: "w1"} with defaults (status=pending, jobs=[])', () => {
    const w = WaveState.parse({ id: 'w1' });
    assert.equal(w.id, 'w1');
    assert.equal(w.status, 'pending');
    assert.deepEqual(w.jobs, []);
  });

  it('parses with explicit status and jobs array', () => {
    const w = WaveState.parse({
      id: 'w1',
      status: 'executing',
      jobs: [{ id: 'j1', status: 'complete' }],
    });
    assert.equal(w.status, 'executing');
    assert.equal(w.jobs.length, 1);
    assert.equal(w.jobs[0].status, 'complete');
  });

  it('rejects missing id', () => {
    const result = WaveState.safeParse({ status: 'pending' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('id')));
  });

  it('rejects invalid status', () => {
    const result = WaveState.safeParse({ id: 'w1', status: 'discussed' });
    assert.equal(result.success, false);
  });
});

describe('JobState', () => {
  const { JobState } = schemas;

  it('parses {id: "j1"} with defaults (status=pending)', () => {
    const j = JobState.parse({ id: 'j1' });
    assert.equal(j.id, 'j1');
    assert.equal(j.status, 'pending');
  });

  it('rejects missing id', () => {
    const result = JobState.safeParse({ status: 'pending' });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some(i => i.path.includes('id')));
  });

  it('rejects invalid status', () => {
    const result = JobState.safeParse({ id: 'j1', status: 'discussed' });
    assert.equal(result.success, false);
  });
});

describe('SetState backward compatibility with waves', () => {
  it('SetState.parse({id, status: pending}) produces waves: []', () => {
    const set = SetState.parse({ id: 'test', status: 'pending' });
    assert.deepEqual(set.waves, []);
  });

  it('SetState.parse with waves array succeeds with wave parsed', () => {
    const set = SetState.parse({ id: 'test', status: 'pending', waves: [{ id: 'w1' }] });
    assert.equal(set.waves.length, 1);
    assert.equal(set.waves[0].id, 'w1');
    assert.equal(set.waves[0].status, 'pending');
    assert.deepEqual(set.waves[0].jobs, []);
  });

  it('round-trip JSON.parse(JSON.stringify(parsed)) preserves waves', () => {
    const original = SetState.parse({
      id: 'test',
      status: 'pending',
      waves: [{ id: 'w1', status: 'executing', jobs: [{ id: 'j1', status: 'complete' }] }],
    });
    const roundTripped = SetState.parse(JSON.parse(JSON.stringify(original)));
    assert.deepEqual(roundTripped, original);
  });
});
