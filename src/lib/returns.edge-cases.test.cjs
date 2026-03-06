'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseReturn,
  generateReturn,
  validateReturn,
  validateHandoff,
  ReturnSchemas,
} = require('./returns.cjs');

// ────────────────────────────────────────────────────────────────
// Test Group 6: Returns - validateHandoff Edge Cases
//
// Success criterion 4 requires "schema validation at every handoff
// point." These tests cover edge cases that agents might actually
// produce in the wild -- extra fields, duplicate markers, null fields,
// and embedded markers. Each guards against a specific failure mode
// in the inter-agent communication pipeline.
// ────────────────────────────────────────────────────────────────
describe('Returns - validateHandoff edge cases', () => {

  // BEHAVIOR: validateHandoff should accept (or gracefully handle) extra fields
  // beyond what the schema defines. Agents may produce additional metadata fields
  // that the orchestrator doesn't need. Zod's default behavior is to strip unknown
  // fields, so this should pass validation without error.
  // GUARDS AGAINST: Agent output being rejected because an agent added a helpful
  // extra field (like 'model' or 'timing') that isn't in the schema, causing the
  // entire handoff to fail and stalling the workflow.
  it('validateHandoff with extra fields beyond schema still passes', () => {
    // Arrange: valid COMPLETE data with extra fields
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file.js"],"tasks_completed":2,"tasks_total":2,"extra_field":"bonus","agent_model":"claude-3"} -->';

    // Act
    const result = validateHandoff(input);

    // Assert: should still validate successfully
    assert.equal(result.valid, true, 'Extra fields should not cause validation failure');
    assert.equal(result.data.status, 'COMPLETE');
    assert.deepEqual(result.data.artifacts, ['file.js']);
    // Note: Zod strips extra fields by default, so they won't be in result.data
  });

  // BEHAVIOR: validateHandoff should accept COMPLETE where tasks_completed > tasks_total.
  // The schema only validates types (number), not business logic constraints like
  // tasks_completed <= tasks_total. This is intentional: agents may count differently
  // or discover additional tasks during execution.
  // GUARDS AGAINST: Over-validating at the schema level and rejecting legitimate
  // agent output where more work was done than originally planned.
  it('validateHandoff with tasks_completed > tasks_total still validates', () => {
    // Arrange: more tasks completed than planned (agent found extra work)
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file.js"],"tasks_completed":5,"tasks_total":3} -->';

    // Act
    const result = validateHandoff(input);

    // Assert: schema validates types, not business logic
    assert.equal(result.valid, true, 'Schema should not enforce tasks_completed <= tasks_total');
    assert.equal(result.data.tasks_completed, 5);
    assert.equal(result.data.tasks_total, 3);
  });

  // BEHAVIOR: parseReturn with multiple RAPID:RETURN markers should extract
  // only the first one. Agents may accidentally produce duplicate markers
  // (e.g., if they show an example and then produce the real one).
  // GUARDS AGAINST: Non-deterministic parsing that picks up the wrong marker,
  // causing the orchestrator to read stale/example data instead of the actual return.
  it('parseReturn with multiple RAPID:RETURN markers extracts the first one', () => {
    // Arrange: two markers in the output
    const input = [
      'Here is an example:',
      '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["first.js"],"tasks_completed":1,"tasks_total":1} -->',
      'And here is the real one:',
      '<!-- RAPID:RETURN {"status":"BLOCKED","blocker_category":"ERROR","blocker":"crash","resolution":"fix"} -->',
    ].join('\n');

    // Act
    const result = parseReturn(input);

    // Assert: should extract the FIRST marker
    assert.equal(result.parsed, true);
    assert.equal(result.data.status, 'COMPLETE', 'Should extract the first marker, not the second');
    assert.deepEqual(result.data.artifacts, ['first.js']);
  });

  // BEHAVIOR: parseReturn should extract the marker even when it appears inside
  // markdown text with surrounding content. The marker detection is substring-based,
  // so it should work regardless of context.
  // GUARDS AGAINST: Marker not being found when agents produce verbose output
  // with the marker buried deep in the response.
  // EDGE CASE: Marker embedded in surrounding prose text.
  it('parseReturn extracts marker embedded in surrounding text', () => {
    // Arrange: marker buried in prose
    const input = [
      '# Task Complete',
      '',
      'I have finished all the work. Here are the results:',
      '',
      '| Field | Value |',
      '|-------|-------|',
      '| Status | COMPLETE |',
      '',
      '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["deep.js"],"tasks_completed":3,"tasks_total":3} -->',
      '',
      'Let me know if you need anything else!',
    ].join('\n');

    // Act
    const result = parseReturn(input);

    // Assert
    assert.equal(result.parsed, true);
    assert.equal(result.data.status, 'COMPLETE');
    assert.deepEqual(result.data.artifacts, ['deep.js']);
    assert.equal(result.data.tasks_completed, 3);
  });

  // BEHAVIOR: validateHandoff with null data fields (e.g., artifacts: null instead
  // of artifacts: [...]) should return valid:false with a clear error path.
  // GUARDS AGAINST: null values slipping through validation and causing downstream
  // null-reference errors when the orchestrator tries to iterate over artifacts.
  it('validateHandoff with null required array field returns valid:false', () => {
    // Arrange: artifacts is null instead of an array
    const input = '<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":null,"tasks_completed":1,"tasks_total":1} -->';

    // Act
    const result = validateHandoff(input);

    // Assert
    assert.equal(result.valid, false, 'null artifacts should fail validation');
    assert.ok(result.error.includes('artifacts'), 'Error should mention the problematic field');
  });

  // BEHAVIOR: The full pipeline generateReturn -> parseReturn -> validateHandoff
  // should work end-to-end for each status type (COMPLETE, CHECKPOINT, BLOCKED).
  // GUARDS AGAINST: Subtle incompatibilities between the generator and validator,
  // e.g., generator producing valid markdown but invalid JSON, or field names
  // not matching between generation and validation schemas.
  it('generateReturn -> parseReturn -> validateHandoff pipeline for COMPLETE', () => {
    // Arrange
    const data = {
      status: 'COMPLETE',
      artifacts: ['src/main.js', 'src/utils.js'],
      tasks_completed: 5,
      tasks_total: 5,
      duration_minutes: 30,
      next_action: 'Deploy to staging',
    };

    // Act: full pipeline
    const markdown = generateReturn(data);
    const parsed = parseReturn(markdown);
    const validated = validateHandoff(markdown);

    // Assert: each step succeeds
    assert.equal(parsed.parsed, true, 'parseReturn should succeed');
    assert.equal(validated.valid, true, 'validateHandoff should succeed');
    assert.equal(validated.data.status, 'COMPLETE');
    assert.deepEqual(validated.data.artifacts, data.artifacts);
    assert.equal(validated.data.tasks_completed, data.tasks_completed);
  });

  // BEHAVIOR: Full pipeline for CHECKPOINT status.
  // GUARDS AGAINST: Same as above -- pipeline incompatibility for CHECKPOINT type.
  it('generateReturn -> parseReturn -> validateHandoff pipeline for CHECKPOINT', () => {
    // Arrange
    const data = {
      status: 'CHECKPOINT',
      handoff_done: 'Implemented auth module and database schema',
      handoff_remaining: 'API endpoints and integration tests',
      handoff_resume: 'Start with src/routes/api.js, implement GET /users',
      decisions: ['Chose JWT over session tokens', 'Using PostgreSQL'],
      blockers: ['Waiting on design review for dashboard'],
    };

    // Act
    const markdown = generateReturn(data);
    const validated = validateHandoff(markdown);

    // Assert
    assert.equal(validated.valid, true, 'CHECKPOINT pipeline should succeed');
    assert.equal(validated.data.status, 'CHECKPOINT');
    assert.equal(validated.data.handoff_done, data.handoff_done);
    assert.equal(validated.data.handoff_resume, data.handoff_resume);
  });

  // BEHAVIOR: Full pipeline for BLOCKED status.
  // GUARDS AGAINST: Same as above -- pipeline incompatibility for BLOCKED type.
  it('generateReturn -> parseReturn -> validateHandoff pipeline for BLOCKED', () => {
    // Arrange
    const data = {
      status: 'BLOCKED',
      blocker_category: 'DEPENDENCY',
      blocker: 'Redis server not running on localhost:6379',
      resolution: 'Start Redis with docker-compose up -d redis',
    };

    // Act
    const markdown = generateReturn(data);
    const validated = validateHandoff(markdown);

    // Assert
    assert.equal(validated.valid, true, 'BLOCKED pipeline should succeed');
    assert.equal(validated.data.status, 'BLOCKED');
    assert.equal(validated.data.blocker_category, 'DEPENDENCY');
    assert.equal(validated.data.blocker, data.blocker);
    assert.equal(validated.data.resolution, data.resolution);
  });
});
