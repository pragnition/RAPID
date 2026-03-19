const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const STATE_PATH = path.join(process.cwd(), '.planning', 'STATE.json');

describe('STATE.json validation for planning-refinement', () => {
  let raw;
  let state;

  it('STATE.json is valid JSON - parses without error', () => {
    raw = fs.readFileSync(STATE_PATH, 'utf-8');
    // JSON.parse will throw if invalid
    state = JSON.parse(raw);
    assert.ok(state, 'STATE.json should parse to a truthy value');
    assert.equal(typeof state, 'object', 'STATE.json should parse to an object');
  });

  it('STATE.json has planning-refinement set with status "merged" in v3.5.0 milestone', () => {
    // Re-parse in case test ordering is not guaranteed
    if (!state) {
      state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }

    const milestone = state.milestones.find(m => m.id === 'v3.5.0');
    assert.ok(milestone, 'v3.5.0 milestone should exist in STATE.json');

    const set = milestone.sets.find(s => s.id === 'planning-refinement');
    assert.ok(set, 'planning-refinement set should exist in v3.5.0 milestone');
    assert.equal(set.status, 'merged', 'planning-refinement set status should be "merged"');
  });

  it('STATE.json currentMilestone is v3.5.0', () => {
    if (!state) {
      state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }

    assert.equal(state.currentMilestone, 'v3.5.0', 'currentMilestone should be v3.5.0');
  });
});
