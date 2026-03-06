'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SET_TRANSITIONS,
  WAVE_TRANSITIONS,
  JOB_TRANSITIONS,
  validateTransition,
} = require('./state-transitions.cjs');

describe('Transition maps are exported plain objects', () => {
  it('SET_TRANSITIONS is a plain object', () => {
    assert.equal(typeof SET_TRANSITIONS, 'object');
    assert.ok(!Array.isArray(SET_TRANSITIONS));
  });

  it('WAVE_TRANSITIONS is a plain object', () => {
    assert.equal(typeof WAVE_TRANSITIONS, 'object');
    assert.ok(!Array.isArray(WAVE_TRANSITIONS));
  });

  it('JOB_TRANSITIONS is a plain object', () => {
    assert.equal(typeof JOB_TRANSITIONS, 'object');
    assert.ok(!Array.isArray(JOB_TRANSITIONS));
  });
});

describe('validateTransition - Set', () => {
  it('allows pending -> planning', () => {
    assert.doesNotThrow(() => validateTransition('set', 'pending', 'planning'));
  });

  it('rejects pending -> executing (must go through planning)', () => {
    assert.throws(
      () => validateTransition('set', 'pending', 'executing'),
      (err) => {
        assert.ok(err.message.includes('planning'), 'should show valid option "planning"');
        return true;
      },
    );
  });

  it('rejects complete -> planning (terminal state)', () => {
    assert.throws(
      () => validateTransition('set', 'complete', 'planning'),
      (err) => {
        assert.ok(err.message.includes('complete'), 'should mention terminal state');
        return true;
      },
    );
  });

  it('can transition through full chain', () => {
    const chain = ['pending', 'planning', 'executing', 'reviewing', 'merging', 'complete'];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.doesNotThrow(() => validateTransition('set', chain[i], chain[i + 1]));
    }
  });
});

describe('validateTransition - Wave', () => {
  it('allows pending -> discussing', () => {
    assert.doesNotThrow(() => validateTransition('wave', 'pending', 'discussing'));
  });

  it('rejects pending -> executing (must go through discussing)', () => {
    assert.throws(
      () => validateTransition('wave', 'pending', 'executing'),
      (err) => {
        assert.ok(err.message.includes('discussing'), 'should show valid option "discussing"');
        return true;
      },
    );
  });

  it('can transition through full chain', () => {
    const chain = ['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete'];
    for (let i = 0; i < chain.length - 1; i++) {
      assert.doesNotThrow(() => validateTransition('wave', chain[i], chain[i + 1]));
    }
  });
});

describe('validateTransition - Job', () => {
  it('allows failed -> executing (retry)', () => {
    assert.doesNotThrow(() => validateTransition('job', 'failed', 'executing'));
  });

  it('rejects complete -> executing (terminal)', () => {
    assert.throws(
      () => validateTransition('job', 'complete', 'executing'),
      (err) => {
        assert.ok(err.message.includes('complete'));
        return true;
      },
    );
  });

  it('allows pending -> executing', () => {
    assert.doesNotThrow(() => validateTransition('job', 'pending', 'executing'));
  });

  it('allows executing -> complete', () => {
    assert.doesNotThrow(() => validateTransition('job', 'executing', 'complete'));
  });

  it('allows executing -> failed', () => {
    assert.doesNotThrow(() => validateTransition('job', 'executing', 'failed'));
  });
});

describe('validateTransition - Error handling', () => {
  it('throws on unknown entity type', () => {
    assert.throws(
      () => validateTransition('unknown_type', 'pending', 'executing'),
      (err) => {
        assert.ok(err.message.includes('Unknown entity type'));
        assert.ok(err.message.includes('unknown_type'));
        return true;
      },
    );
  });

  it('throws on unknown status (bogus_status)', () => {
    assert.throws(
      () => validateTransition('set', 'bogus_status', 'planning'),
      (err) => {
        assert.ok(err.message.includes('Unknown status'));
        assert.ok(err.message.includes('bogus_status'));
        return true;
      },
    );
  });

  it('error message includes valid transitions from current state', () => {
    try {
      validateTransition('set', 'pending', 'complete');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('planning'), 'error should list valid option "planning"');
      assert.ok(err.message.includes('pending'), 'error should mention current state');
      assert.ok(err.message.includes('complete'), 'error should mention attempted state');
    }
  });
});
