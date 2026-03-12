const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const lock = require('./lock.cjs');

describe('lock.cjs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-lock-test-'));
    // Create .planning/ directory so locks dir can be created inside it
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('ensureLocksDir()', () => {
    it('creates .planning/.locks/ directory', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');
      assert.ok(fs.existsSync(locksPath), '.locks directory should exist');
    });

    it('creates .gitignore inside .locks/', () => {
      lock.ensureLocksDir(tmpDir);
      const gitignorePath = path.join(tmpDir, '.planning', '.locks', '.gitignore');
      assert.ok(fs.existsSync(gitignorePath), '.gitignore should exist');
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      assert.ok(content.includes('*'), 'Should ignore all files');
      assert.ok(content.includes('!.gitignore'), 'Should not ignore .gitignore itself');
    });

    it('is idempotent (calling twice does not error)', () => {
      lock.ensureLocksDir(tmpDir);
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');
      assert.ok(fs.existsSync(locksPath), '.locks directory should still exist');
    });
  });

  describe('acquireLock() and release', () => {
    it('acquires and releases a lock successfully', async () => {
      const release = await lock.acquireLock(tmpDir, 'state');
      assert.ok(typeof release === 'function', 'Should return a release function');
      // Lock should be held
      assert.equal(lock.isLocked(tmpDir, 'state'), true, 'Should be locked');
      // Release
      await release();
      assert.equal(lock.isLocked(tmpDir, 'state'), false, 'Should be unlocked after release');
    });

    it('second concurrent acquire waits then succeeds after release', async () => {
      const release1 = await lock.acquireLock(tmpDir, 'state');

      // Start second acquire (will wait)
      let release2Resolved = false;
      const acquire2Promise = lock.acquireLock(tmpDir, 'state').then((rel) => {
        release2Resolved = true;
        return rel;
      });

      // Give a small window for it to be waiting
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Second should still be waiting
      assert.equal(release2Resolved, false, 'Second acquire should be waiting');

      // Release first lock
      await release1();

      // Second should now succeed
      const release2 = await acquire2Promise;
      assert.equal(release2Resolved, true, 'Second acquire should have resolved');
      assert.ok(typeof release2 === 'function', 'Should return release function');

      await release2();
    });
  });

  describe('isLocked()', () => {
    it('returns false when no lock exists', () => {
      assert.equal(lock.isLocked(tmpDir, 'nonexistent'), false, 'Should be false for non-existent lock');
    });

    it('returns true when lock is held', async () => {
      const release = await lock.acquireLock(tmpDir, 'testlock');
      assert.equal(lock.isLocked(tmpDir, 'testlock'), true, 'Should be true when locked');
      await release();
    });

    it('returns false after lock is released', async () => {
      const release = await lock.acquireLock(tmpDir, 'testlock');
      await release();
      assert.equal(lock.isLocked(tmpDir, 'testlock'), false, 'Should be false after release');
    });
  });

  describe('stale lock recovery', () => {
    it('acquires lock when existing lock is stale (old mtime)', async () => {
      // Manually create a stale lock target
      lock.ensureLocksDir(tmpDir);
      const lockTarget = path.join(tmpDir, '.planning', '.locks', 'staletest.target');
      fs.writeFileSync(lockTarget, JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
      }));

      // Create the .lock directory manually to simulate a held lock
      const lockDir = lockTarget + '.lock';
      fs.mkdirSync(lockDir, { recursive: true });

      // Set the mtime of the .lock directory to be well past the stale threshold
      // proper-lockfile uses mtime to detect staleness
      const staleTime = new Date(Date.now() - 400000); // 400 seconds ago (past 300s threshold)
      fs.utimesSync(lockDir, staleTime, staleTime);

      // acquireLock should succeed because the lock is stale (mtime too old)
      const release = await lock.acquireLock(tmpDir, 'staletest');
      assert.ok(typeof release === 'function', 'Should acquire stale lock');

      await release();
    });
  });

  describe('cleanStaleLocks()', () => {
    it('removes lock artifacts when owning PID is dead', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      // Create a target file with a PID that almost certainly does not exist
      const deadPid = 99999999;
      const targetPath = path.join(locksPath, 'dead.target');
      fs.writeFileSync(targetPath, JSON.stringify({ pid: deadPid, timestamp: Date.now() }));

      // Create matching .lock directory
      const lockDir = targetPath + '.lock';
      fs.mkdirSync(lockDir, { recursive: true });

      // Both artifacts exist
      assert.ok(fs.existsSync(targetPath), 'Target file should exist before cleanup');
      assert.ok(fs.existsSync(lockDir), 'Lock dir should exist before cleanup');

      // Clean stale locks
      lock.cleanStaleLocks(tmpDir);

      // Both should be removed
      assert.ok(!fs.existsSync(targetPath), 'Target file should be removed after cleanup');
      assert.ok(!fs.existsSync(lockDir), 'Lock dir should be removed after cleanup');
    });

    it('leaves lock artifacts alone when owning PID is alive', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      // Create a target file with the CURRENT process PID (alive)
      const targetPath = path.join(locksPath, 'alive.target');
      fs.writeFileSync(targetPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

      // Create matching .lock directory
      const lockDir = targetPath + '.lock';
      fs.mkdirSync(lockDir, { recursive: true });

      // Clean stale locks
      lock.cleanStaleLocks(tmpDir);

      // Both should still exist (process is alive)
      assert.ok(fs.existsSync(targetPath), 'Target file should remain when PID is alive');
      assert.ok(fs.existsSync(lockDir), 'Lock dir should remain when PID is alive');
    });

    it('handles missing locks dir gracefully (no throw)', () => {
      // tmpDir has .planning/ but no .locks/ yet
      assert.doesNotThrow(() => lock.cleanStaleLocks(tmpDir));
    });

    it('handles unparseable target files gracefully (skip, no throw)', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      // Create a target file with invalid JSON
      const targetPath = path.join(locksPath, 'bad.target');
      fs.writeFileSync(targetPath, 'NOT VALID JSON');

      // Should not throw
      assert.doesNotThrow(() => lock.cleanStaleLocks(tmpDir));

      // File should still exist (skipped, not removed)
      assert.ok(fs.existsSync(targetPath), 'Unparseable target file should remain');
    });

    it('removes target file even when .lock directory does not exist', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      // Create a target file with dead PID but NO matching .lock directory
      const deadPid = 99999999;
      const targetPath = path.join(locksPath, 'orphan.target');
      fs.writeFileSync(targetPath, JSON.stringify({ pid: deadPid, timestamp: Date.now() }));

      lock.cleanStaleLocks(tmpDir);

      assert.ok(!fs.existsSync(targetPath), 'Orphaned target file should be removed');
    });
  });

  describe('isProcessAlive (via cleanStaleLocks behavior)', () => {
    it('current process PID is alive (verified via lock preservation)', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      const targetPath = path.join(locksPath, 'self.target');
      fs.writeFileSync(targetPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));

      lock.cleanStaleLocks(tmpDir);

      // Current process PID should be alive, so target remains
      assert.ok(fs.existsSync(targetPath), 'Current PID target should survive cleanup');
    });

    it('non-existent PID is dead (verified via lock removal)', () => {
      lock.ensureLocksDir(tmpDir);
      const locksPath = path.join(tmpDir, '.planning', '.locks');

      const targetPath = path.join(locksPath, 'nonexistent.target');
      fs.writeFileSync(targetPath, JSON.stringify({ pid: 99999999, timestamp: Date.now() }));

      lock.cleanStaleLocks(tmpDir);

      // Non-existent PID should be dead, so target is removed
      assert.ok(!fs.existsSync(targetPath), 'Dead PID target should be removed');
    });
  });

  describe('Module exports', () => {
    it('exports acquireLock', () => {
      assert.equal(typeof lock.acquireLock, 'function');
    });

    it('exports isLocked', () => {
      assert.equal(typeof lock.isLocked, 'function');
    });

    it('exports ensureLocksDir', () => {
      assert.equal(typeof lock.ensureLocksDir, 'function');
    });

    it('exports cleanStaleLocks', () => {
      assert.equal(typeof lock.cleanStaleLocks, 'function');
    });

    it('exports exactly 4 keys', () => {
      const keys = Object.keys(lock).sort();
      assert.deepEqual(keys, ['acquireLock', 'cleanStaleLocks', 'ensureLocksDir', 'isLocked']);
    });
  });
});
