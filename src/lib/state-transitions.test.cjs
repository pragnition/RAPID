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

  it('discussed -> planned or discussed (allows re-discussion)', () => {
    assert.deepEqual(SET_TRANSITIONS.discussed, ['planned', 'discussed']);
  });

  it('planned -> executed only', () => {
    assert.deepEqual(SET_TRANSITIONS.planned, ['executed']);
  });

  it('executed -> complete or executed (allows re-execution)', () => {
    assert.deepEqual(SET_TRANSITIONS.executed, ['complete', 'executed']);
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

  it('executed -> executed succeeds (idempotent re-entry)', () => {
    assert.doesNotThrow(() => validateTransition('executed', 'executed'));
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

  it('has 3 named parameters (currentStatus, nextStatus, transitionMap)', () => {
    assert.equal(validateTransition.length, 3, 'Should have 3 named parameters');
  });
});

describe('export availability', () => {
  it('WAVE_TRANSITIONS IS exported', () => {
    assert.notEqual(transitions.WAVE_TRANSITIONS, undefined);
    assert.equal(typeof transitions.WAVE_TRANSITIONS, 'object');
  });

  it('JOB_TRANSITIONS IS exported', () => {
    assert.notEqual(transitions.JOB_TRANSITIONS, undefined);
    assert.equal(typeof transitions.JOB_TRANSITIONS, 'object');
  });

  it('module exports exactly 4 keys', () => {
    const keys = Object.keys(transitions).sort();
    assert.deepEqual(keys, ['JOB_TRANSITIONS', 'SET_TRANSITIONS', 'WAVE_TRANSITIONS', 'validateTransition']);
  });
});

describe('WAVE_TRANSITIONS map', () => {
  const { WAVE_TRANSITIONS } = transitions;

  it('has exactly 3 keys: pending, executing, complete', () => {
    const keys = Object.keys(WAVE_TRANSITIONS).sort();
    assert.deepEqual(keys, ['complete', 'executing', 'pending']);
  });

  it('pending -> executing only', () => {
    assert.deepEqual(WAVE_TRANSITIONS.pending, ['executing']);
  });

  it('executing -> complete only', () => {
    assert.deepEqual(WAVE_TRANSITIONS.executing, ['complete']);
  });

  it('complete is terminal (empty array)', () => {
    assert.deepEqual(WAVE_TRANSITIONS.complete, []);
  });
});

describe('JOB_TRANSITIONS map', () => {
  const { JOB_TRANSITIONS } = transitions;

  it('has exactly 3 keys: pending, executing, complete', () => {
    const keys = Object.keys(JOB_TRANSITIONS).sort();
    assert.deepEqual(keys, ['complete', 'executing', 'pending']);
  });

  it('pending -> executing only', () => {
    assert.deepEqual(JOB_TRANSITIONS.pending, ['executing']);
  });

  it('executing -> complete only', () => {
    assert.deepEqual(JOB_TRANSITIONS.executing, ['complete']);
  });

  it('complete is terminal (empty array)', () => {
    assert.deepEqual(JOB_TRANSITIONS.complete, []);
  });
});

describe('validateTransition with custom map', () => {
  const { WAVE_TRANSITIONS } = transitions;

  it('succeeds for valid wave transition: pending -> executing', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'executing', WAVE_TRANSITIONS));
  });

  it('throws for invalid wave transition: pending -> discussed', () => {
    assert.throws(
      () => validateTransition('pending', 'discussed', WAVE_TRANSITIONS),
      /Invalid transition/
    );
  });

  it('backward compat: pending -> discussed still succeeds without 3rd arg (uses SET_TRANSITIONS)', () => {
    assert.doesNotThrow(() => validateTransition('pending', 'discussed'));
  });

  it('3rd arg works correctly: executing -> complete with WAVE_TRANSITIONS', () => {
    assert.doesNotThrow(() => validateTransition('executing', 'complete', WAVE_TRANSITIONS));
  });

  it('unknown status in custom map throws with "Unknown status" message', () => {
    assert.throws(
      () => validateTransition('discussed', 'planned', WAVE_TRANSITIONS),
      (err) => {
        assert.ok(err.message.includes('Unknown status'));
        return true;
      }
    );
  });
});
