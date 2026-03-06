'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseReturn, generateReturn, validateReturn, validateHandoff, ReturnSchemas } = require('./returns.cjs');

describe('parseReturn', () => {
  it('extracts JSON from valid COMPLETE return', () => {
    const input = `## COMPLETE

| Field | Value |
|-------|-------|
| Status | COMPLETE |

<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file.js"],"tasks_completed":2,"tasks_total":2,"duration_minutes":10,"next_action":"Proceed"} -->`;
    const result = parseReturn(input);
    assert.equal(result.parsed, true);
    assert.equal(result.data.status, 'COMPLETE');
    assert.deepEqual(result.data.artifacts, ['file.js']);
    assert.equal(result.data.tasks_completed, 2);
    assert.equal(result.data.tasks_total, 2);
  });

  it('extracts JSON from valid BLOCKED return', () => {
    const input = `## BLOCKED

<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"DEPENDENCY","blocker":"Missing API key","resolution":"Set ENV_VAR"} -->`;
    const result = parseReturn(input);
    assert.equal(result.parsed, true);
    assert.equal(result.data.status, 'BLOCKED');
    assert.equal(result.data.blocker_category, 'DEPENDENCY');
    assert.equal(result.data.blocker, 'Missing API key');
  });

  it('extracts JSON from valid CHECKPOINT return', () => {
    const input = `## CHECKPOINT

<!-- RAPID:RETURN {"status":"CHECKPOINT","handoff_done":"Tasks 1-3 done","handoff_remaining":"Tasks 4-5 left","handoff_resume":"Start at task 4","decisions":["Chose option A"]} -->`;
    const result = parseReturn(input);
    assert.equal(result.parsed, true);
    assert.equal(result.data.status, 'CHECKPOINT');
    assert.equal(result.data.handoff_done, 'Tasks 1-3 done');
    assert.equal(result.data.handoff_remaining, 'Tasks 4-5 left');
    assert.equal(result.data.handoff_resume, 'Start at task 4');
  });

  it('returns parsed: false when no marker present', () => {
    const input = 'Just some text without any marker';
    const result = parseReturn(input);
    assert.equal(result.parsed, false);
    assert.equal(result.error, 'No RAPID:RETURN marker found');
  });

  it('returns parsed: false with error for malformed JSON', () => {
    const input = '<!-- RAPID:RETURN {bad json here} -->';
    const result = parseReturn(input);
    assert.equal(result.parsed, false);
    assert.ok(result.error.startsWith('Invalid JSON:'));
  });

  it('returns parsed: false for unclosed marker', () => {
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE"} but no closing';
    const result = parseReturn(input);
    assert.equal(result.parsed, false);
    assert.equal(result.error, 'Unclosed RAPID:RETURN marker');
  });
});

describe('generateReturn', () => {
  it('produces correct Markdown table + JSON for COMPLETE status', () => {
    const data = {
      status: 'COMPLETE',
      artifacts: ['src/app.js', 'src/utils.js'],
      tasks_completed: 3,
      tasks_total: 3,
      duration_minutes: 15,
      next_action: 'Proceed to phase 2',
      commits: ['abc1234'],
      notes: 'All tests passing',
    };
    const output = generateReturn(data);
    assert.ok(output.includes('## COMPLETE'));
    assert.ok(output.includes('| Status | COMPLETE |'));
    assert.ok(output.includes('`src/app.js`'));
    assert.ok(output.includes('| Tasks | 3/3 |'));
    assert.ok(output.includes('<!-- RAPID:RETURN'));
    // JSON should be parseable
    const parsed = parseReturn(output);
    assert.equal(parsed.parsed, true);
    assert.equal(parsed.data.status, 'COMPLETE');
  });

  it('produces BLOCKED output with category/blocker/resolution in table', () => {
    const data = {
      status: 'BLOCKED',
      blocker_category: 'PERMISSION',
      blocker: 'Cannot access database',
      resolution: 'Grant DB credentials',
    };
    const output = generateReturn(data);
    assert.ok(output.includes('## BLOCKED'));
    assert.ok(output.includes('| Category | PERMISSION |'));
    assert.ok(output.includes('| Blocker | Cannot access database |'));
    assert.ok(output.includes('| Resolution | Grant DB credentials |'));
  });

  it('produces CHECKPOINT output with handoff fields in table', () => {
    const data = {
      status: 'CHECKPOINT',
      handoff_done: 'Tasks 1-3 complete',
      handoff_remaining: 'Tasks 4-5 remaining',
      handoff_resume: 'Start at task 4',
      decisions: ['Used option A'],
      blockers: ['Awaiting review'],
    };
    const output = generateReturn(data);
    assert.ok(output.includes('## CHECKPOINT'));
    assert.ok(output.includes('| Done | Tasks 1-3 complete |'));
    assert.ok(output.includes('| Remaining | Tasks 4-5 remaining |'));
    assert.ok(output.includes('| Resume | Start at task 4 |'));
  });

  it('throws on invalid data', () => {
    assert.throws(() => generateReturn({ status: 'COMPLETE' }), /validation failed/i);
  });
});

describe('validateReturn', () => {
  it('returns valid: true for complete COMPLETE data', () => {
    const data = {
      status: 'COMPLETE',
      artifacts: ['file.js'],
      tasks_completed: 1,
      tasks_total: 1,
    };
    const result = validateReturn(data);
    assert.equal(result.valid, true);
  });

  it('returns errors for COMPLETE with missing artifacts', () => {
    const data = {
      status: 'COMPLETE',
      tasks_completed: 1,
      tasks_total: 1,
    };
    const result = validateReturn(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('artifacts')));
  });

  it('returns valid: true for complete BLOCKED data', () => {
    const data = {
      status: 'BLOCKED',
      blocker_category: 'DEPENDENCY',
      blocker: 'Missing library',
      resolution: 'Install it',
    };
    const result = validateReturn(data);
    assert.equal(result.valid, true);
  });

  it('returns errors for BLOCKED with invalid category', () => {
    const data = {
      status: 'BLOCKED',
      blocker_category: 'INVALID',
      blocker: 'Something',
      resolution: 'Fix it',
    };
    const result = validateReturn(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('blocker_category')));
  });

  it('returns valid: true for complete CHECKPOINT data', () => {
    const data = {
      status: 'CHECKPOINT',
      handoff_done: 'Done stuff',
      handoff_remaining: 'Remaining stuff',
      handoff_resume: 'Start here',
    };
    const result = validateReturn(data);
    assert.equal(result.valid, true);
  });

  it('returns errors for CHECKPOINT with missing handoff_resume', () => {
    const data = {
      status: 'CHECKPOINT',
      handoff_done: 'Done stuff',
      handoff_remaining: 'Remaining stuff',
    };
    const result = validateReturn(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('handoff_resume')));
  });

  it('returns errors for missing status', () => {
    const result = validateReturn({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('status')));
  });

  it('returns errors for invalid status value', () => {
    const result = validateReturn({ status: 'UNKNOWN' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('status')));
  });
});

describe('Round-trip consistency', () => {
  it('parse(generate(data)) deep-equals data for COMPLETE', () => {
    const data = {
      status: 'COMPLETE',
      artifacts: ['a.js', 'b.js'],
      tasks_completed: 2,
      tasks_total: 3,
      duration_minutes: 10,
      next_action: 'Next step',
      commits: ['abc1234'],
      notes: 'All good',
    };
    const output = generateReturn(data);
    const parsed = parseReturn(output);
    assert.equal(parsed.parsed, true);
    assert.deepEqual(parsed.data, data);
  });

  it('parse(generate(data)) deep-equals data for BLOCKED', () => {
    const data = {
      status: 'BLOCKED',
      blocker_category: 'CLARIFICATION',
      blocker: 'Need spec clarification',
      resolution: 'Ask product team',
    };
    const output = generateReturn(data);
    const parsed = parseReturn(output);
    assert.equal(parsed.parsed, true);
    assert.deepEqual(parsed.data, data);
  });

  it('parse(generate(data)) deep-equals data for CHECKPOINT', () => {
    const data = {
      status: 'CHECKPOINT',
      handoff_done: 'First half',
      handoff_remaining: 'Second half',
      handoff_resume: 'Continue from task 3',
      decisions: ['Option B chosen'],
      blockers: ['Needs approval'],
    };
    const output = generateReturn(data);
    const parsed = parseReturn(output);
    assert.equal(parsed.parsed, true);
    assert.deepEqual(parsed.data, data);
  });
});

// ────────────────────────────────────────────────────────────────
// ReturnSchemas
// ────────────────────────────────────────────────────────────────
describe('ReturnSchemas', () => {
  it('exports Complete, Checkpoint, Blocked, and Any schemas', () => {
    assert.ok(ReturnSchemas.Complete);
    assert.ok(ReturnSchemas.Checkpoint);
    assert.ok(ReturnSchemas.Blocked);
    assert.ok(ReturnSchemas.Any);
  });

  it('Complete schema validates valid COMPLETE data', () => {
    const result = ReturnSchemas.Complete.safeParse({
      status: 'COMPLETE',
      artifacts: ['file.js'],
      tasks_completed: 2,
      tasks_total: 3,
    });
    assert.equal(result.success, true);
  });

  it('Complete schema rejects missing artifacts', () => {
    const result = ReturnSchemas.Complete.safeParse({
      status: 'COMPLETE',
      tasks_completed: 2,
      tasks_total: 3,
    });
    assert.equal(result.success, false);
  });

  it('Complete schema accepts optional fields', () => {
    const result = ReturnSchemas.Complete.safeParse({
      status: 'COMPLETE',
      artifacts: ['file.js'],
      tasks_completed: 2,
      tasks_total: 3,
      commits: ['abc123'],
      duration_minutes: 15,
      next_action: 'Proceed',
      warnings: ['Watch out'],
      notes: 'All good',
    });
    assert.equal(result.success, true);
  });

  it('Checkpoint schema validates valid CHECKPOINT data', () => {
    const result = ReturnSchemas.Checkpoint.safeParse({
      status: 'CHECKPOINT',
      handoff_done: 'Tasks 1-3',
      handoff_remaining: 'Tasks 4-5',
      handoff_resume: 'Start at 4',
    });
    assert.equal(result.success, true);
  });

  it('Checkpoint schema rejects missing handoff_resume', () => {
    const result = ReturnSchemas.Checkpoint.safeParse({
      status: 'CHECKPOINT',
      handoff_done: 'Tasks 1-3',
      handoff_remaining: 'Tasks 4-5',
    });
    assert.equal(result.success, false);
  });

  it('Checkpoint schema accepts optional fields', () => {
    const result = ReturnSchemas.Checkpoint.safeParse({
      status: 'CHECKPOINT',
      handoff_done: 'Done',
      handoff_remaining: 'Remaining',
      handoff_resume: 'Resume',
      artifacts: ['a.js'],
      tasks_completed: 2,
      tasks_total: 5,
      duration_minutes: 10,
      decisions: ['Chose A'],
      blockers: ['Needs review'],
    });
    assert.equal(result.success, true);
  });

  it('Blocked schema validates valid BLOCKED data', () => {
    const result = ReturnSchemas.Blocked.safeParse({
      status: 'BLOCKED',
      blocker_category: 'DEPENDENCY',
      blocker: 'Missing library',
      resolution: 'Install it',
    });
    assert.equal(result.success, true);
  });

  it('Blocked schema rejects invalid blocker_category', () => {
    const result = ReturnSchemas.Blocked.safeParse({
      status: 'BLOCKED',
      blocker_category: 'INVALID',
      blocker: 'Something',
      resolution: 'Fix it',
    });
    assert.equal(result.success, false);
  });

  it('Blocked schema accepts optional fields', () => {
    const result = ReturnSchemas.Blocked.safeParse({
      status: 'BLOCKED',
      blocker_category: 'ERROR',
      blocker: 'Crash',
      resolution: 'Debug',
      artifacts: ['log.txt'],
      tasks_completed: 1,
      tasks_total: 3,
    });
    assert.equal(result.success, true);
  });

  it('Any schema discriminates on status field', () => {
    const complete = ReturnSchemas.Any.safeParse({
      status: 'COMPLETE',
      artifacts: ['a.js'],
      tasks_completed: 1,
      tasks_total: 1,
    });
    assert.equal(complete.success, true);

    const blocked = ReturnSchemas.Any.safeParse({
      status: 'BLOCKED',
      blocker_category: 'PERMISSION',
      blocker: 'No access',
      resolution: 'Grant access',
    });
    assert.equal(blocked.success, true);

    const invalid = ReturnSchemas.Any.safeParse({
      status: 'UNKNOWN',
    });
    assert.equal(invalid.success, false);
  });
});

// ────────────────────────────────────────────────────────────────
// validateHandoff
// ────────────────────────────────────────────────────────────────
describe('validateHandoff', () => {
  it('returns { valid: true, data } for valid COMPLETE agent output', () => {
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file.js"],"tasks_completed":2,"tasks_total":2} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, true);
    assert.equal(result.data.status, 'COMPLETE');
    assert.deepStrictEqual(result.data.artifacts, ['file.js']);
  });

  it('returns { valid: true, data } for valid CHECKPOINT agent output', () => {
    const input = '<!-- RAPID:RETURN {"status":"CHECKPOINT","handoff_done":"Done","handoff_remaining":"Remaining","handoff_resume":"Resume"} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, true);
    assert.equal(result.data.status, 'CHECKPOINT');
  });

  it('returns { valid: true, data } for valid BLOCKED agent output', () => {
    const input = '<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"ERROR","blocker":"Crash","resolution":"Fix"} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, true);
    assert.equal(result.data.status, 'BLOCKED');
  });

  it('returns { valid: false, error } for missing RAPID:RETURN marker', () => {
    const result = validateHandoff('No marker here');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('marker'));
  });

  it('returns { valid: false, error } for invalid JSON', () => {
    const result = validateHandoff('<!-- RAPID:RETURN {bad json} -->');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('JSON'));
  });

  it('returns { valid: false, error } with Zod field paths for schema violations', () => {
    // Valid JSON but missing required fields for COMPLETE
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","tasks_completed":"not-a-number","tasks_total":2} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, false);
    // Should include field path info
    assert.ok(result.error.length > 0);
  });

  it('returns { valid: false, error } for COMPLETE missing artifacts', () => {
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","tasks_completed":1,"tasks_total":1} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('artifacts'));
  });

  it('returns { valid: false, error } for BLOCKED with invalid category', () => {
    const input = '<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"INVALID","blocker":"x","resolution":"y"} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, false);
  });

  it('returns Zod-level error paths for invalid fields', () => {
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":"not-an-array","tasks_completed":1,"tasks_total":1} -->';
    const result = validateHandoff(input);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('artifacts'), 'Error should mention the invalid field path');
  });
});
