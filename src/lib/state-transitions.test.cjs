'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const transitions = require('./state-transitions.cjs');
const { SET_TRANSITIONS, validateTransition } = transitions;

describe('SET_TRANSITIONS map', () => {
  it('has exactly 6 keys matching SetStatus values', () => {
    const keys = Object.keys(SET_TRANSITIONS).sort();
    assert.deepEqual(keys, ['complete', 'discussing', 'executing', 'merged', 'pending', 'planning']);
  });

  it('pending has two targets: discussing and planning (branch point)', () => {
    assert.deepEqual(SET_TRANSITIONS.pending, ['discussing', 'planning']);
  });

  it('discussing -> planning only', () => {
    assert.deepEqual(SET_TRANSITIONS.discussing, ['planning']);
  });

  it('planning -> executing only', () => {
    assert.deepEqual(SET_TRANSITIONS.planning, ['executing']);
  });

  it('executing -> complete only', () => {
    assert.deepEqual(SET_TRANSITIONS.executing, ['complete']);
  });

  it('complete -> merged only', () => {
    assert.deepEqual(SET_TRANSITIONS.complete, ['merged']);
  });

  it('merged is terminal (empty array)', () => {
    assert.deepEqual(SET_TRANSITIONS.merged, []);
  });
});

describe('validateTransition - valid transitions', () => {
  it('pending -> discussing succeeds', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'discussing'));
  });

  it('pending -> planning succeeds (branch/skip path)', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'planning'));
  });

  it('discussing -> planning succeeds', () => {
    assert.doesNotThrow(() => validateTransition('discussing', 'planning'));
  });

  it('planning -> executing succeeds', () => {
    assert.doesNotThrow(() => validateTransition('planning', 'executing'));
  });

  it('executing -> complete succeeds', () => {
    assert.doesNotThrow(() => validateTransition('executing', 'complete'));
  });

  it('complete -> merged succeeds', () => {
    assert.doesNotThrow(() => validateTransition('complete', 'merged'));
  });

  it('full chain: pending -> discussing -> planning -> executing -> complete -> merged', () => {
    const chain = ['pending', 'discussing', 'planning', 'executing', 'complete', 'merged'];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.doesNotThrow(() => validateTransition(chain[i], chain[i + 1]));
    }
  });

  it('skip chain: pending -> planning -> executing -> complete -> merged', () => {
    const chain = ['pending', 'planning', 'executing', 'complete', 'merged'];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.doesNotThrow(() => validateTransition(chain[i], chain[i + 1]));
    }
  });
});

describe('validateTransition - invalid transitions', () => {
  it('merged -> anything throws with "terminal" message', () => {
    assert.throws(
      () => validateTransition('merged', 'pending'),
      (err) => {
        assert.ok(err.message.includes('terminal'), 'Should mention terminal state');
        return true;
      },
    );
  });

  it('pending -> executing throws with "Valid" message (skip not allowed)', () => {
    assert.throws(
      () => validateTransition('pending', 'executing'),
      (err) => {
        assert.ok(err.message.includes('Valid'), 'Should list valid transitions');
        return true;
      },
    );
  });

  it('discussing -> pending throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('discussing', 'pending'));
  });

  it('complete -> executing throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('complete', 'executing'));
  });

  it('planning -> pending throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('planning', 'pending'));
  });

  it('executing -> planning throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('executing', 'planning'));
  });

  it('discussing -> executing throws (cannot skip planning)', () => {
    assert.throws(() => validateTransition('discussing', 'executing'));
  });

  it('planning -> complete throws (cannot skip executing)', () => {
    assert.throws(() => validateTransition('planning', 'complete'));
  });
});

describe('validateTransition - error handling', () => {
  it('unknown status throws with "Unknown status" message', () => {
    assert.throws(
      () => validateTransition('bogus', 'planning'),
      (err) => {
        assert.ok(err.message.includes('Unknown status'), 'Should say Unknown status');
        assert.ok(err.message.includes('bogus'), 'Should include the bad status');
        return true;
      },
    );
  });

  it('takes exactly 2 args (currentStatus, nextStatus) -- no entityType', () => {
    assert.equal(validateTransition.length, 2, 'Should have 2 parameters');
  });
});

describe('Removed exports', () => {
  it('WAVE_TRANSITIONS is NOT exported', () => {
    assert.equal(transitions.WAVE_TRANSITIONS, undefined);
  });

  it('JOB_TRANSITIONS is NOT exported', () => {
    assert.equal(transitions.JOB_TRANSITIONS, undefined);
  });

  it('module exports exactly 2 keys', () => {
    const keys = Object.keys(transitions).sort();
    assert.deepEqual(keys, ['SET_TRANSITIONS', 'validateTransition']);
  });
});
