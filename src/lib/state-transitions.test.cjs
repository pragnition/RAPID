'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const transitions = require('./state-transitions.cjs');
const { SET_TRANSITIONS, validateTransition } = transitions;

describe('SET_TRANSITIONS map', () => {
  it('has exactly 6 keys matching SetStatus values', () => {
    const keys = Object.keys(SET_TRANSITIONS).sort();
    assert.deepEqual(keys, ['complete', 'discussed', 'executed', 'merged', 'pending', 'planned']);
  });

  it('pending has two targets: discussed and planned (branch point)', () => {
    assert.deepEqual(SET_TRANSITIONS.pending, ['discussed', 'planned']);
  });

  it('discussed -> planned only', () => {
    assert.deepEqual(SET_TRANSITIONS.discussed, ['planned']);
  });

  it('planned -> executed only', () => {
    assert.deepEqual(SET_TRANSITIONS.planned, ['executed']);
  });

  it('executed -> complete only', () => {
    assert.deepEqual(SET_TRANSITIONS.executed, ['complete']);
  });

  it('complete -> merged only', () => {
    assert.deepEqual(SET_TRANSITIONS.complete, ['merged']);
  });

  it('merged is terminal (empty array)', () => {
    assert.deepEqual(SET_TRANSITIONS.merged, []);
  });
});

describe('validateTransition - valid transitions', () => {
  it('pending -> discussed succeeds', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'discussed'));
  });

  it('pending -> planned succeeds (branch/skip path)', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'planned'));
  });

  it('discussed -> planned succeeds', () => {
    assert.doesNotThrow(() => validateTransition('discussed', 'planned'));
  });

  it('planned -> executed succeeds', () => {
    assert.doesNotThrow(() => validateTransition('planned', 'executed'));
  });

  it('executed -> complete succeeds', () => {
    assert.doesNotThrow(() => validateTransition('executed', 'complete'));
  });

  it('complete -> merged succeeds', () => {
    assert.doesNotThrow(() => validateTransition('complete', 'merged'));
  });

  it('full chain: pending -> discussed -> planned -> executed -> complete -> merged', () => {
    const chain = ['pending', 'discussed', 'planned', 'executed', 'complete', 'merged'];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.doesNotThrow(() => validateTransition(chain[i], chain[i + 1]));
    }
  });

  it('skip chain: pending -> planned -> executed -> complete -> merged', () => {
    const chain = ['pending', 'planned', 'executed', 'complete', 'merged'];
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

  it('pending -> executed throws with "Valid" message (skip not allowed)', () => {
    assert.throws(
      () => validateTransition('pending', 'executed'),
      (err) => {
        assert.ok(err.message.includes('Valid'), 'Should list valid transitions');
        return true;
      },
    );
  });

  it('discussed -> pending throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('discussed', 'pending'));
  });

  it('complete -> executed throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('complete', 'executed'));
  });

  it('planned -> pending throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('planned', 'pending'));
  });

  it('executed -> planned throws (no back-transitions)', () => {
    assert.throws(() => validateTransition('executed', 'planned'));
  });

  it('discussed -> executed throws (cannot skip planned)', () => {
    assert.throws(() => validateTransition('discussed', 'executed'));
  });

  it('planned -> complete throws (cannot skip executed)', () => {
    assert.throws(() => validateTransition('planned', 'complete'));
  });
});

describe('validateTransition - error handling', () => {
  it('unknown status throws with "Unknown status" message', () => {
    assert.throws(
      () => validateTransition('bogus', 'planned'),
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
