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
    assert.deepEqual(Object.keys(set).sort(), ['id', 'status']);
  });

  it('strips unknown "waves" key silently', () => {
    const set = SetState.parse({ id: 'auth', status: 'pending', waves: [{ id: 'w1' }] });
    assert.equal(set.id, 'auth');
    assert.equal(set.status, 'pending');
    assert.equal(set.waves, undefined);
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

describe('Removed exports', () => {
  it('JobStatus is NOT exported', () => {
    assert.equal(schemas.JobStatus, undefined);
  });

  it('JobState is NOT exported', () => {
    assert.equal(schemas.JobState, undefined);
  });

  it('WaveStatus is NOT exported', () => {
    assert.equal(schemas.WaveStatus, undefined);
  });

  it('WaveState is NOT exported', () => {
    assert.equal(schemas.WaveState, undefined);
  });

  it('module exports exactly 4 keys', () => {
    const keys = Object.keys(schemas).sort();
    assert.deepEqual(keys, ['MilestoneState', 'ProjectState', 'SetState', 'SetStatus']);
  });
});
