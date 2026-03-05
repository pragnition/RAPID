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
});
