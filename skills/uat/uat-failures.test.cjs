'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Build a UAT-FAILURES.md string from an array of failure objects.
 * This helper encodes the exact format specification. Downstream consumers
 * (bugfix-uat) will use the same regex extraction pattern.
 */
function buildUatFailuresMd(failures) {
  const meta = JSON.stringify({ failures }, null, 2);
  const failuresSections = failures.map(f =>
    `### ${f.id}: ${f.criterion}\n- **Step:** ${f.step}\n- **Severity:** ${f.severity || 'unknown'}\n- **Description:** ${f.description}\n${f.userNotes ? `- **User Notes:** ${f.userNotes}\n` : ''}`
  ).join('\n');
  return [
    '# UAT-FAILURES',
    '',
    '<!-- UAT-FORMAT:v2 -->',
    '',
    `<!-- UAT-FAILURES-META ${meta} -->`,
    '',
    '## Failures',
    '',
    failuresSections || '_No failures recorded._',
    ''
  ].join('\n');
}

/** Extract the JSON metadata from a UAT-FAILURES.md content string. */
function extractMeta(content) {
  const match = content.match(/<!-- UAT-FAILURES-META ([\s\S]*?) -->/);
  if (!match) throw new Error('No UAT-FAILURES-META block found');
  return JSON.parse(match[1]);
}

describe('UAT-FAILURES.md format contract', () => {
  it('round-trip: minimal failure entry', () => {
    const entry = {
      id: 'F-001',
      criterion: 'Login page loads',
      step: 'Open /login and verify form renders',
      description: 'Login form did not render within 3 seconds',
      severity: 'high',
      relevantFiles: ['src/pages/login.tsx']
    };
    const content = buildUatFailuresMd([entry]);
    const parsed = extractMeta(content);

    assert.equal(parsed.failures.length, 1);
    const f = parsed.failures[0];
    assert.equal(f.id, 'F-001');
    assert.equal(f.criterion, 'Login page loads');
    assert.equal(f.step, 'Open /login and verify form renders');
    assert.equal(f.description, 'Login form did not render within 3 seconds');
    assert.equal(f.severity, 'high');
    assert.ok(Array.isArray(f.relevantFiles), 'relevantFiles must be an array');
    assert.deepEqual(f.relevantFiles, ['src/pages/login.tsx']);
  });

  it('round-trip: rich failure entry with extended fields', () => {
    const entry = {
      id: 'F-002',
      criterion: 'Dashboard data loads',
      step: 'Navigate to /dashboard and verify chart renders',
      description: 'Chart component shows loading spinner indefinitely',
      severity: 'medium',
      relevantFiles: ['src/pages/dashboard.tsx', 'src/api/metrics.ts'],
      userNotes: 'Spinner never resolves, no console errors visible',
      expectedBehavior: 'Chart renders within 2 seconds with sample data',
      actualBehavior: 'Loading spinner persists after 30 seconds'
    };
    const content = buildUatFailuresMd([entry]);
    const parsed = extractMeta(content);

    const f = parsed.failures[0];
    assert.equal(f.userNotes, 'Spinner never resolves, no console errors visible');
    assert.equal(f.expectedBehavior, 'Chart renders within 2 seconds with sample data');
    assert.equal(f.actualBehavior, 'Loading spinner persists after 30 seconds');
  });

  it('round-trip: multiple failures', () => {
    const failures = [
      { id: 'F-010', criterion: 'C1', step: 'S1', description: 'D1', severity: 'high', relevantFiles: [] },
      { id: 'F-011', criterion: 'C2', step: 'S2', description: 'D2', severity: 'low', relevantFiles: [] },
      { id: 'F-012', criterion: 'C3', step: 'S3', description: 'D3', severity: 'medium', relevantFiles: [] }
    ];
    const content = buildUatFailuresMd(failures);
    const parsed = extractMeta(content);

    assert.equal(parsed.failures.length, 3);
    const ids = parsed.failures.map(f => f.id);
    assert.deepEqual(ids, ['F-010', 'F-011', 'F-012']);
    // All IDs are unique
    assert.equal(new Set(ids).size, 3, 'Each failure entry must have a unique id');
  });

  it('format: version marker present', () => {
    const content = buildUatFailuresMd([]);
    assert.ok(content.includes('<!-- UAT-FORMAT:v2 -->'), 'Content must include version marker');
  });

  it('format: markdown body mirrors JSON failures', () => {
    const failures = [
      { id: 'F-020', criterion: 'Search works', step: 'Type query', description: 'No results shown', severity: 'high', relevantFiles: [] },
      { id: 'F-021', criterion: 'Filter works', step: 'Apply filter', description: 'Filter ignored', severity: 'low', relevantFiles: [] }
    ];
    const content = buildUatFailuresMd(failures);
    const parsed = extractMeta(content);

    for (const f of parsed.failures) {
      assert.ok(content.includes(f.id), `Markdown body must contain failure id "${f.id}"`);
      assert.ok(content.includes(f.description), `Markdown body must contain failure description "${f.description}"`);
    }
  });

  it('parse: malformed JSON throws', () => {
    const content = [
      '# UAT-FAILURES',
      '',
      '<!-- UAT-FORMAT:v2 -->',
      '',
      '<!-- UAT-FAILURES-META { not valid json,,, } -->',
      '',
      '## Failures',
      ''
    ].join('\n');

    assert.throws(() => extractMeta(content), {
      name: 'SyntaxError'
    }, 'Malformed JSON inside metadata block must throw SyntaxError');
  });

  it('parse: missing required field detected', () => {
    const entry = {
      id: 'F-030',
      criterion: 'Page loads',
      step: 'Open page',
      description: 'Page blank'
      // severity intentionally omitted
    };
    const content = buildUatFailuresMd([entry]);
    const parsed = extractMeta(content);

    assert.equal(parsed.failures[0].severity, undefined, 'Missing severity field must be undefined after parse');
  });

  it('format: empty failures array', () => {
    const content = buildUatFailuresMd([]);
    const parsed = extractMeta(content);

    assert.equal(parsed.failures.length, 0);
    assert.ok(content.includes('_No failures recorded._'), 'Empty failures must show placeholder text');
  });
});
