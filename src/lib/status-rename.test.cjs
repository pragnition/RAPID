'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Permanent grep-based verification test.
 *
 * Ensures no old set-status literals ('discussing', 'planning', 'executing')
 * remain as SET STATUS VALUES in .cjs source files.
 *
 * Strategy: grep for patterns that indicate set-status usage, then filter
 * out the small number of known legitimate references (migration code,
 * migration tests, schema rejection tests).
 *
 * We search for these high-signal patterns:
 *   - status: 'oldValue'      -- set status assignments in objects
 *   - .includes('oldValue')   -- status array membership checks
 *   - case 'oldValue':        -- switch cases on status (lowercase only)
 *   - === 'oldValue'          -- equality checks
 *   - oldValue: N             -- sort order map keys (like STATUS_SORT_ORDER)
 *
 * This avoids matching general English prose, comments, variable names,
 * config keys, JSDoc, worktree phase values (capitalized), or directory names.
 */

const SRC_DIR = path.resolve(__dirname, '..');

// Files that legitimately reference old status values
const ALLOWED_FILES = new Set([
  'status-rename.test.cjs',       // this test file itself
  'state-schemas.test.cjs',       // tests that assert old values are REJECTED by schema
  'state-machine.test.cjs',       // migrateState tests + readState migration tests use old values as test input
]);

/**
 * Search for set-status usage patterns of an old status literal.
 * Returns array of matching lines that represent real violations.
 */
function findSetStatusUsage(oldStatus) {
  // Patterns that indicate set-status usage (not general prose)
  const grepPatterns = [
    `status: '${oldStatus}'`,         // object literal assignment
    `status: "${oldStatus}"`,
    `.includes('${oldStatus}')`,      // array membership check
    `.includes("${oldStatus}")`,
    `case '${oldStatus}':`,           // switch case (lowercase = set status)
    `=== '${oldStatus}'`,             // equality check
    `=== "${oldStatus}"`,
    `'${oldStatus}',`,                // array element (e.g. in .includes([...]))
    `"${oldStatus}",`,
  ];

  // Also check for sort-order map keys (like "executing: 0,")
  grepPatterns.push(`${oldStatus}: `);

  const allMatches = [];

  for (const pattern of grepPatterns) {
    let output;
    try {
      // Use grep -F for fixed-string matching (no regex interpretation)
      output = execSync(
        `grep -rn -F "${pattern}" --include="*.cjs" "${SRC_DIR}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err) {
      if (err.status === 1) continue;
      throw err;
    }

    const lines = output.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      allMatches.push(line);
    }
  }

  // Deduplicate (same line may match multiple patterns)
  const unique = [...new Set(allMatches)];

  // Filter out allowed files and known legitimate references
  return unique.filter(line => {
    // Extract filename from the grep output
    const fileMatch = line.match(/([^/]+\.cjs):\d+:/);
    const fileName = fileMatch ? fileMatch[1] : '';

    // Exclude allowed files
    if (ALLOWED_FILES.has(fileName)) return false;

    // Exclude migration code (STATUS_MAP keys in migrateState)
    if (line.includes('STATUS_MAP') || line.includes('migrateState')) return false;
    // The STATUS_MAP object literal in state-machine.cjs: "discussing: 'discussed'"
    if (fileName === 'state-machine.cjs' && line.includes(`: '${oldStatus.replace(/ing$/, 'ed')}'`)) return false;
    // Actually the pattern is "oldStatus: 'newStatus'" -- so the old status is the key
    if (fileName === 'state-machine.cjs' && /^\s+\w+:\s+'[a-z]+'/.test(line.split(':').slice(1).join(':'))) {
      // This catches lines like "    discussing: 'discussed',"
      // More precisely: if the line is inside the STATUS_MAP function
      if (line.includes(`${oldStatus}: '`)) return false;
    }

    // Exclude migration test data (tests that intentionally write old-format state)
    if (line.includes('migrat')) return false;

    // Exclude worktree formatWaveSummary internal code
    // (variable declarations like "let discussing = 0", conditionals, display output)
    if (line.includes('formatWaveSummary')) return false;
    if (line.includes(`let ${oldStatus}`) || line.includes(`${oldStatus} >`) ||
        line.includes(`${oldStatus} =`) || line.includes(`${oldStatus}}`) ||
        line.includes(`${oldStatus} ${oldStatus}`)) return false;
    // formatWaveSummary display output: "N discussing"
    if (/\d+\s+(discussing|planning|executing)/.test(line)) return false;

    // Exclude worktree phase values (capitalized) -- case 'Discussing' etc.
    // The lowercase "case 'discussing'" would be a set-status usage (violation),
    // but capitalized "case 'Discussing'" is a worktree phase value (OK).
    // Our grep patterns already only match lowercase case statements.

    // Exclude PHASE_DISPLAY references
    if (line.includes('PHASE_DISPLAY')) return false;

    // Exclude JSDoc comments listing lifecycle phases (documentation, not status values)
    if (line.includes('lifecycle phases:') || line.includes(' * ')) return false;

    // Exclude .planning directory references
    if (line.includes('.planning') || line.includes('planningDir')) return false;

    // For 'planning': exclude config keys and general English
    if (oldStatus === 'planning') {
      if (line.includes('config.planning') || line.includes('planning:') && line.includes('{')) return false;
      if (line.includes('planning stage') || line.includes('planningStages') ||
          line.includes('replanning') || line.includes('wave planning') ||
          line.includes('wave-planning') || line.includes('Use planning') ||
          line.includes('bisect-planning') || line.includes('plan check-gate') ||
          line.includes('Wave planning') || line.includes('add planning')) return false;
      // init.cjs config object: "planning: {"
      if (line.includes('planning: {')) return false;
      // parsed.planning
      if (line.includes('parsed.planning')) return false;
    }

    // For 'executing': exclude wave/job-level statuses
    if (oldStatus === 'executing') {
      // wave/job status values
      if (line.includes("{ id: 'w") || line.includes("{ id: 'j")) return false;
      if (line.includes('job.status') || line.includes('transition job')) return false;
      // "Continue executing" is prose in the action description, not a status
      if (line.includes('Continue executing')) return false;
    }

    return true;
  });
}

describe('Status rename verification', () => {
  it('no old set status literals (discussing) remain in .cjs files', () => {
    const violations = findSetStatusUsage('discussing');
    if (violations.length > 0) {
      assert.fail(
        `Found ${violations.length} occurrence(s) of old 'discussing' set status literal:\n` +
        violations.map(v => `  ${v}`).join('\n')
      );
    }
  });

  it('no old set status literals (planning-as-status) remain in .cjs files', () => {
    const violations = findSetStatusUsage('planning');
    if (violations.length > 0) {
      assert.fail(
        `Found ${violations.length} occurrence(s) of old 'planning' set status literal:\n` +
        violations.map(v => `  ${v}`).join('\n')
      );
    }
  });

  it('no old set status literals (executing-as-status) remain in .cjs files', () => {
    const violations = findSetStatusUsage('executing');
    if (violations.length > 0) {
      assert.fail(
        `Found ${violations.length} occurrence(s) of old 'executing' set status literal:\n` +
        violations.map(v => `  ${v}`).join('\n')
      );
    }
  });
});
