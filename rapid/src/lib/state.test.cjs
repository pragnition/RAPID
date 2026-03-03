const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const state = require('./state.cjs');

const SAMPLE_STATE = `# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Multiple developers can work simultaneously
**Current focus:** Phase 1: Agent Framework

## Current Position

Phase: 1 of 9 (Agent Framework and State Management)
Plan: 0 of 3 in current phase
**Status:** Ready to plan
**Last activity:** 2026-03-03 -- Roadmap created

Progress: [----------] 0%

## Accumulated Context

### Decisions

- [Roadmap]: 9-phase dependency-ordered structure

## Session Continuity

**Last session:** 2026-03-03
**Stopped at:** Roadmap creation complete
`;

describe('state.cjs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-state-test-'));
    // Create .planning/ with STATE.md
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), SAMPLE_STATE);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('stateGet()', () => {
    it('returns full STATE.md content when no field specified', () => {
      const content = state.stateGet(tmpDir);
      assert.ok(content.includes('# Project State'), 'Should contain header');
      assert.ok(content.includes('**Status:**'), 'Should contain Status field');
      assert.ok(content.length > 100, 'Should return full content');
    });

    it('extracts value from **Field:** value pattern', () => {
      const value = state.stateGet(tmpDir, 'Status');
      assert.equal(value, 'Ready to plan');
    });

    it('extracts value for Last activity field', () => {
      const value = state.stateGet(tmpDir, 'Last activity');
      assert.equal(value, '2026-03-03 -- Roadmap created');
    });

    it('extracts value for Last session field', () => {
      const value = state.stateGet(tmpDir, 'Last session');
      assert.equal(value, '2026-03-03');
    });

    it('returns null for missing fields', () => {
      const value = state.stateGet(tmpDir, 'nonexistent');
      assert.equal(value, null, 'Should return null for missing field');
    });

    it('is case-insensitive for field matching', () => {
      const value = state.stateGet(tmpDir, 'status');
      assert.equal(value, 'Ready to plan');
    });
  });

  describe('stateUpdate()', () => {
    it('updates field value and persists to disk', async () => {
      const result = await state.stateUpdate(tmpDir, 'Status', 'Executing');
      assert.deepEqual(result, { updated: true, field: 'Status', value: 'Executing' });

      // Verify on disk
      const onDisk = state.stateGet(tmpDir, 'Status');
      assert.equal(onDisk, 'Executing', 'Value should be persisted');
    });

    it('returns updated false for missing field', async () => {
      const result = await state.stateUpdate(tmpDir, 'nonexistent', 'value');
      assert.equal(result.updated, false);
      assert.ok(result.reason.includes('nonexistent'), 'Should mention the field name');
    });

    it('preserves other fields when updating one', async () => {
      await state.stateUpdate(tmpDir, 'Status', 'Executing');
      const lastSession = state.stateGet(tmpDir, 'Last session');
      assert.equal(lastSession, '2026-03-03', 'Other fields should be preserved');
    });

    it('handles concurrent updates without corruption', async () => {
      // Update two different fields simultaneously
      const [result1, result2] = await Promise.all([
        state.stateUpdate(tmpDir, 'Status', 'Executing'),
        state.stateUpdate(tmpDir, 'Last session', '2026-03-04'),
      ]);

      assert.equal(result1.updated, true, 'First update should succeed');
      assert.equal(result2.updated, true, 'Second update should succeed');

      // Both values should be present
      const content = fs.readFileSync(
        path.join(tmpDir, '.planning', 'STATE.md'),
        'utf-8'
      );
      assert.ok(content.includes('Executing'), 'Status should be updated');
      assert.ok(content.includes('2026-03-04'), 'Last session should be updated');
    });
  });
});
