'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Module under test
const worktree = require('./worktree.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a real git repo in a temp dir with an initial commit
// (Matches convention from worktree.test.cjs)
// ────────────────────────────────────────────────────────────────
function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-worktree-test-'));
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

function cleanupRepo(dir) {
  // Remove any worktrees first to prevent git complaints
  try {
    const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const blocks = result.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      if (pathLine) {
        const wtPath = pathLine.replace('worktree ', '');
        if (wtPath !== dir) {
          try {
            execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' });
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  fs.rmSync(dir, { recursive: true, force: true });
}

// ────────────────────────────────────────────────────────────────
// Target 6: formatWaveProgress edge cases
// (Tested indirectly through formatMarkIIStatus since formatWaveProgress
// is not exported -- it is an internal function.)
// ────────────────────────────────────────────────────────────────
describe('Phase 19: formatWaveProgress edge cases (via formatMarkIIStatus)', () => {

  // BEHAVIOR: When all jobs in a wave are complete, the wave progress
  // should say "done", not "pending"
  // GUARDS AGAINST: Misleading dashboard showing completed work as pending,
  // causing users to investigate sets that are actually finished
  it('shows "done" label when all jobs in a wave are complete', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'fully-done', status: 'complete', waves: [
          { id: 'w1', status: 'complete', jobs: [
            { id: 'j1', status: 'complete' },
            { id: 'j2', status: 'complete' },
            { id: 'j3', status: 'complete' },
          ] },
        ] },
      ],
    };
    const registryData = { worktrees: {} };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- should contain "W1: 3/3 done" (not "pending")
    assert.ok(
      table.includes('W1: 3/3 done'),
      `Expected "W1: 3/3 done" in table but got:\n${table}`
    );
  });

  // BEHAVIOR: A wave with an empty jobs array should display "0/0 pending"
  // GUARDS AGAINST: Division-by-zero or undefined access when waves are
  // defined but have no jobs yet (common during initial wave planning)
  it('shows "0/0 pending" for a wave with empty jobs array', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'empty-wave', status: 'planning', waves: [
          { id: 'w1', status: 'pending', jobs: [] },
        ] },
      ],
    };
    const registryData = { worktrees: {} };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- should show "W1: 0/0 pending"
    assert.ok(
      table.includes('W1: 0/0 pending'),
      `Expected "W1: 0/0 pending" in table but got:\n${table}`
    );
  });

  // BEHAVIOR: Multiple waves with mixed completion should display each wave's
  // progress independently, comma-separated
  // GUARDS AGAINST: Wave progress strings being concatenated incorrectly or
  // only showing the first wave's progress
  it('shows multiple waves with mixed completion states', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'multi-wave', status: 'executing', waves: [
          { id: 'w1', status: 'complete', jobs: [
            { id: 'j1', status: 'complete' },
            { id: 'j2', status: 'complete' },
          ] },
          { id: 'w2', status: 'executing', jobs: [
            { id: 'j3', status: 'complete' },
            { id: 'j4', status: 'pending' },
            { id: 'j5', status: 'pending' },
          ] },
          { id: 'w3', status: 'pending', jobs: [
            { id: 'j6', status: 'pending' },
          ] },
        ] },
      ],
    };
    const registryData = { worktrees: {} };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- should show all three waves
    assert.ok(table.includes('W1: 2/2 done'), `Expected "W1: 2/2 done" in:\n${table}`);
    assert.ok(table.includes('W2: 1/3 done'), `Expected "W2: 1/3 done" in:\n${table}`);
    assert.ok(table.includes('W3: 0/1 pending'), `Expected "W3: 0/1 pending" in:\n${table}`);
  });
});

// ────────────────────────────────────────────────────────────────
// Target 7: relativeTime edge cases (via formatStatusTable)
// ────────────────────────────────────────────────────────────────
describe('Phase 19: relativeTime edge cases (via formatStatusTable)', () => {

  // BEHAVIOR: A timestamp from 30 seconds ago should display as "just now"
  // GUARDS AGAINST: Sub-minute timestamps showing as "0 min ago" which
  // is confusing and looks like a bug
  it('shows "just now" for a timestamp from 30 seconds ago', () => {
    // Arrange
    const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
    const entries = [
      { setName: 'recent-set', phase: 'Executing', status: 'active', updatedAt: thirtySecsAgo },
    ];

    // Act
    const table = worktree.formatStatusTable(entries);

    // Assert
    assert.ok(
      table.includes('just now'),
      `Expected "just now" for 30-second-old timestamp but got:\n${table}`
    );
  });

  // BEHAVIOR: A timestamp from exactly 60 seconds ago should show "1 min ago"
  // (boundary between "just now" and minutes display)
  // GUARDS AGAINST: Off-by-one at the 60-second boundary showing either
  // "just now" when it should show minutes, or "60 min ago" due to unit confusion
  // EDGE CASE: Exact boundary -- 60 seconds is the transition point
  it('shows "1 min ago" for a timestamp from exactly 60 seconds ago', () => {
    // Arrange -- use 61 seconds to avoid race conditions at the exact boundary
    const sixtySecsAgo = new Date(Date.now() - 61000).toISOString();
    const entries = [
      { setName: 'min-set', phase: 'Executing', status: 'active', updatedAt: sixtySecsAgo },
    ];

    // Act
    const table = worktree.formatStatusTable(entries);

    // Assert
    assert.ok(
      table.includes('1 min ago'),
      `Expected "1 min ago" for 61-second-old timestamp but got:\n${table}`
    );
  });

  // BEHAVIOR: A timestamp from exactly 60 minutes ago should show "1 hr ago"
  // (boundary between minutes and hours display)
  // GUARDS AGAINST: Showing "60 min ago" instead of transitioning to hours,
  // which makes the dashboard harder to scan
  // EDGE CASE: 60 minutes = 1 hour boundary
  it('shows "1 hr ago" for a timestamp from exactly 60 minutes ago', () => {
    // Arrange -- use 61 minutes to avoid boundary race
    const sixtyMinsAgo = new Date(Date.now() - 61 * 60000).toISOString();
    const entries = [
      { setName: 'hr-set', phase: 'Executing', status: 'active', updatedAt: sixtyMinsAgo },
    ];

    // Act
    const table = worktree.formatStatusTable(entries);

    // Assert
    assert.ok(
      table.includes('1 hr ago'),
      `Expected "1 hr ago" for 61-minute-old timestamp but got:\n${table}`
    );
  });

  // BEHAVIOR: A timestamp from exactly 24 hours ago should show "1 days ago"
  // (boundary between hours and days display)
  // GUARDS AGAINST: Showing "24 hr ago" instead of transitioning to days
  // EDGE CASE: 24 hours = 1 day boundary
  it('shows "1 days ago" for a timestamp from exactly 24 hours ago', () => {
    // Arrange -- use 25 hours to avoid boundary race
    const twentyFiveHrsAgo = new Date(Date.now() - 25 * 3600000).toISOString();
    const entries = [
      { setName: 'day-set', phase: 'Executing', status: 'active', updatedAt: twentyFiveHrsAgo },
    ];

    // Act
    const table = worktree.formatStatusTable(entries);

    // Assert
    assert.ok(
      table.includes('1 days ago'),
      `Expected "1 days ago" for 25-hour-old timestamp but got:\n${table}`
    );
  });

  // BEHAVIOR: A null/undefined updatedAt should show "-" in the LAST ACTIVITY column
  // GUARDS AGAINST: "NaN min ago" or "undefined" appearing in the dashboard
  // when entries don't have timestamps (e.g., just-created entries)
  it('shows "-" for null/undefined updatedAt', () => {
    // Arrange
    const entries = [
      { setName: 'no-time', phase: 'Executing', status: 'active', updatedAt: null },
    ];

    // Act
    const table = worktree.formatStatusTable(entries);

    // Assert -- the data row should contain "-" in the LAST ACTIVITY position
    const lines = table.split('\n');
    const dataRow = lines[2]; // header, separator, data
    assert.ok(dataRow, 'should have a data row');
    // The last column should be "-"
    const lastCol = dataRow.trim().split(/\s{2,}/).pop();
    assert.equal(lastCol, '-', `Expected "-" for null updatedAt but got "${lastCol}"`);
  });
});

// ────────────────────────────────────────────────────────────────
// Target 8: deriveNextActions -- edge cases not covered
// ────────────────────────────────────────────────────────────────
describe('Phase 19: deriveNextActions -- uncovered edge cases', () => {

  // BEHAVIOR: A complete set WITHOUT a worktree should NOT suggest cleanup
  // GUARDS AGAINST: The cleanup skill being invoked for a set whose worktree
  // was already removed (or was never created), causing a confusing error
  // EDGE CASE: Set can be marked complete in STATE.json without having a worktree
  // (e.g., worktree was cleaned up before state transition, or external merge)
  it('does NOT suggest cleanup for a complete set without a worktree', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'done-no-wt', status: 'complete', waves: [] },
      ],
    };
    const registryData = { worktrees: {} }; // no worktree registered

    // Act
    const actions = worktree.deriveNextActions(stateData, registryData);

    // Assert -- should be empty because there's nothing actionable
    const cleanupAction = actions.find(a => a.action.includes('/cleanup'));
    assert.equal(
      cleanupAction,
      undefined,
      'should NOT suggest /cleanup for complete set without worktree'
    );
  });

  // BEHAVIOR: An unknown status (not in the switch cases) should not crash
  // deriveNextActions -- it should just skip that set
  // GUARDS AGAINST: Unhandled statuses (like future "blocked" or "error")
  // causing the entire status command to crash, preventing the user from
  // seeing any dashboard at all
  it('does not crash on unknown status values', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'error-set', status: 'error', waves: [] },
        { id: 'blocked-set', status: 'blocked', waves: [] },
        { id: 'ok-set', status: 'executing', waves: [] },
      ],
    };
    const registryData = {
      worktrees: {
        'ok-set': { path: '/tmp/wt/ok-set' },
      },
    };

    // Act -- should NOT throw
    const actions = worktree.deriveNextActions(stateData, registryData);

    // Assert -- should still produce action for the known-status set
    assert.ok(Array.isArray(actions), 'should return an array');
    const execAction = actions.find(a => a.setName === 'ok-set');
    assert.ok(execAction, 'should still produce action for the valid set');
    // Unknown statuses should not generate actions
    const errorAction = actions.find(a => a.setName === 'error-set');
    assert.equal(errorAction, undefined, 'should NOT produce action for unknown status "error"');
  });

  // BEHAVIOR: Empty sets array should return empty actions array
  // GUARDS AGAINST: Crash on iteration over empty array, or returning
  // stale/cached actions from a previous call
  it('returns empty actions for empty sets array', () => {
    // Arrange
    const stateData = { milestone: 'v2.0', sets: [] };
    const registryData = { worktrees: {} };

    // Act
    const actions = worktree.deriveNextActions(stateData, registryData);

    // Assert
    assert.ok(Array.isArray(actions), 'should return an array');
    assert.equal(actions.length, 0, 'should return 0 actions for empty sets');
  });

  // BEHAVIOR: Sets with undefined status should not crash
  // GUARDS AGAINST: Missing status field on a set (e.g., partial STATE.json
  // migration) causing a TypeError when accessing switch(set.status)
  it('does not crash on sets with undefined status field', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'no-status', waves: [] },
        { id: 'ok', status: 'pending', waves: [] },
      ],
    };
    const registryData = { worktrees: {} };

    // Act -- should NOT throw
    const actions = worktree.deriveNextActions(stateData, registryData);

    // Assert -- should still produce action for the valid set
    assert.ok(Array.isArray(actions), 'should return an array');
    const initAction = actions.find(a => a.setName === 'ok');
    assert.ok(initAction, 'should produce action for the set with valid status');
  });
});

// ────────────────────────────────────────────────────────────────
// Target 9: formatMarkIIStatus -- edge cases not covered
// ────────────────────────────────────────────────────────────────
describe('Phase 19: formatMarkIIStatus -- uncovered edge cases', () => {

  // BEHAVIOR: Set IDs longer than 20 characters should be truncated to 20
  // GUARDS AGAINST: Long set names breaking table alignment, making the
  // dashboard unreadable when multiple columns get pushed off-screen
  it('truncates set IDs longer than 20 characters', () => {
    // Arrange
    const longId = 'this-is-a-very-long-set-name-that-exceeds-20-chars';
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: longId, status: 'pending', waves: [] },
      ],
    };
    const registryData = { worktrees: {} };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- the data row should contain only the first 20 chars of the ID
    const truncated = longId.slice(0, 20);
    const lines = table.split('\n');
    const dataRow = lines[2];
    assert.ok(
      dataRow.includes(truncated),
      `Expected truncated ID "${truncated}" in data row but got:\n${dataRow}`
    );
    assert.ok(
      !dataRow.includes(longId),
      `Full ID should NOT appear in data row but found it:\n${dataRow}`
    );
  });

  // BEHAVIOR: Sets with unknown statuses (not in STATUS_SORT_ORDER) should
  // sort to the default position (4, same as pending) instead of crashing
  // GUARDS AGAINST: Future status values like "blocked" or "error" causing
  // a sort crash that prevents the dashboard from rendering
  it('sorts unknown status to default position (same as pending)', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'complete-set', status: 'complete', waves: [] },  // sort: 5
        { id: 'unknown-set', status: 'someNewStatus', waves: [] }, // sort: 4 (default)
        { id: 'exec-set', status: 'executing', waves: [] },       // sort: 0
      ],
    };
    const registryData = { worktrees: {} };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- executing(0) should be before unknown(4) which should be before complete(5)
    const lines = table.split('\n');
    const dataLines = lines.slice(2);
    assert.ok(dataLines[0].includes('exec-set'), 'executing should sort first');
    assert.ok(dataLines[1].includes('unknown-set'), 'unknown status should sort at default position');
    assert.ok(dataLines[2].includes('complete-set'), 'complete should sort last');
  });

  // BEHAVIOR: Registry entries with null updatedAt AND missing updatedAt
  // should both show "-" in the UPDATED column
  // GUARDS AGAINST: One of these cases showing "Invalid Date" or "NaN"
  // while the other correctly shows "-"
  it('shows "-" in UPDATED column for both null and missing updatedAt', () => {
    // Arrange
    const stateData = {
      milestone: 'v2.0',
      sets: [
        { id: 'null-time', status: 'executing', waves: [] },
        { id: 'missing-time', status: 'executing', waves: [] },
      ],
    };
    const registryData = {
      worktrees: {
        'null-time': { path: '/tmp/wt/null', updatedAt: null },
        'missing-time': { path: '/tmp/wt/missing' }, // updatedAt not present
      },
    };

    // Act
    const table = worktree.formatMarkIIStatus(stateData, registryData);

    // Assert -- both rows should have "-" in the UPDATED column
    const lines = table.split('\n');
    const dataLines = lines.slice(2);
    for (const row of dataLines) {
      // The UPDATED column is the last column; extract it
      const cols = row.trim().split(/\s{2,}/);
      const updatedCol = cols[cols.length - 1];
      assert.equal(
        updatedCol,
        '-',
        `Expected "-" in UPDATED column but got "${updatedCol}" in row: ${row}`
      );
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Target 10: setInit -- claudeMdGenerated=false graceful degradation
// ────────────────────────────────────────────────────────────────
describe('Phase 19: setInit -- claudeMdGenerated graceful degradation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    // Create minimal .planning structure WITHOUT CONTRACT.json
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'no-contract-set'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
    // Write DEFINITION.md only (no CONTRACT.json)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'no-contract-set', 'DEFINITION.md'),
      '# Set: no-contract-set\n\n## Scope\nA set without a contract\n',
      'utf-8'
    );
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: When CONTRACT.json is missing, setInit should still create
  // the worktree and register it, but return claudeMdGenerated: false
  // GUARDS AGAINST: setInit throwing an unhandled error when CLAUDE.md
  // generation fails, leaving the worktree partially created and unregistered.
  // In real workflows, users run set-init before all artifacts are complete.
  it('creates worktree and registers it even when CONTRACT.json is missing', async () => {
    // Arrange -- CONTRACT.json intentionally NOT created (see beforeEach)

    // Act
    const result = await worktree.setInit(tmpDir, 'no-contract-set');

    // Assert -- worktree should be created and registered
    assert.equal(result.created, true, 'should report created: true');
    assert.equal(result.branch, 'rapid/no-contract-set', 'should have correct branch name');
    assert.equal(result.claudeMdGenerated, false, 'claudeMdGenerated should be false');
    assert.ok(fs.existsSync(result.worktreePath), 'worktree directory should exist on disk');

    // Registry should contain the entry
    const registry = worktree.loadRegistry(tmpDir);
    assert.ok(registry.worktrees['no-contract-set'], 'registry should contain the entry');
    assert.equal(registry.worktrees['no-contract-set'].phase, 'Created');
  });

  // BEHAVIOR: When BOTH DEFINITION.md and CONTRACT.json are missing,
  // setInit should still create the worktree (claudeMdGenerated=false)
  // GUARDS AGAINST: Different failure mode when DEFINITION.md is also missing
  // (plan.loadSet throws before generateScopedClaudeMd even gets to CONTRACT.json)
  it('creates worktree when both DEFINITION.md and CONTRACT.json are missing', async () => {
    // Arrange -- remove DEFINITION.md too
    fs.unlinkSync(path.join(tmpDir, '.planning', 'sets', 'no-contract-set', 'DEFINITION.md'));

    // Act
    const result = await worktree.setInit(tmpDir, 'no-contract-set');

    // Assert -- worktree should still be created
    assert.equal(result.created, true, 'should report created: true');
    assert.equal(result.claudeMdGenerated, false, 'claudeMdGenerated should be false when both missing');
    assert.ok(fs.existsSync(result.worktreePath), 'worktree directory should exist');
  });
});

// ────────────────────────────────────────────────────────────────
// Target 11: deleteBranch -- additional input validation edge cases
// ────────────────────────────────────────────────────────────────
describe('Phase 19: deleteBranch -- additional input validation edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: Passing null, undefined, or numeric values as branch name
  // should throw "Invalid branch name"
  // GUARDS AGAINST: The cleanup skill constructing branch names from
  // undefined/null set names (e.g., when registry entry is malformed),
  // which would pass a garbage argument to `git branch -d` and produce
  // confusing git errors instead of a clear validation message
  it('throws on null, undefined, and numeric branch names', () => {
    // Arrange/Act/Assert -- null
    assert.throws(
      () => worktree.deleteBranch(tmpDir, null),
      /Invalid branch name/,
      'should throw for null branch name'
    );

    // undefined
    assert.throws(
      () => worktree.deleteBranch(tmpDir, undefined),
      /Invalid branch name/,
      'should throw for undefined branch name'
    );

    // numeric (non-string type)
    assert.throws(
      () => worktree.deleteBranch(tmpDir, 42),
      /Invalid branch name/,
      'should throw for numeric branch name'
    );
  });

  // BEHAVIOR: Whitespace-only strings should be rejected as invalid
  // GUARDS AGAINST: A branch name that passes the falsy check (non-empty
  // string) but consists only of whitespace, which would cause git to
  // interpret it as "delete current branch" or produce cryptic errors
  it('throws on whitespace-only branch names', () => {
    // Arrange/Act/Assert
    assert.throws(
      () => worktree.deleteBranch(tmpDir, '   '),
      /Invalid branch name/,
      'should throw for whitespace-only branch name'
    );

    assert.throws(
      () => worktree.deleteBranch(tmpDir, '\t\n'),
      /Invalid branch name/,
      'should throw for tab/newline-only branch name'
    );
  });
});
