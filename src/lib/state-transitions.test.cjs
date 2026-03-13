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

  it('has 3 named parameters (currentStatus, nextStatus, transitionMap)', () => {
    // Note: JS function.length counts all named params before the first default,
    // but since transitionMap has a default that is applied inside the body (not
    // in the signature via =), .length reports 3. The 3rd arg is optional by convention.
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
