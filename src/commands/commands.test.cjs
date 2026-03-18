'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CliError } = require('../lib/errors.cjs');

// Handlers under test
const { handleLock } = require('./lock.cjs');
const { handleState } = require('./state.cjs');
const { handlePlan } = require('./plan.cjs');
const { handleResolve } = require('./resolve.cjs');
const { handleInit } = require('./init.cjs');
const { handleDisplay } = require('./display.cjs');
const { handleExecute } = require('./execute.cjs');
const { handleMerge } = require('./merge.cjs');
const { handleReview } = require('./review.cjs');
const { handleWorktree } = require('./worktree.cjs');
const { handleSetInit } = require('./set-init.cjs');
const { handleAssumptions, handleParseReturn, handleVerifyArtifacts, handleContext } = require('./misc.cjs');
const { handleQuick } = require('./quick.cjs');

describe('handler CliError throw behavior', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-cli-err-'));
    // Create minimal .planning structure
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json'),
      JSON.stringify({ worktrees: {} }),
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handleLock throws CliError when lock name is missing', async () => {
    await assert.rejects(
      async () => handleLock(tmpDir, 'acquire', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Lock name required'), `Expected message about lock name, got: ${err.message}`);
        return true;
      },
    );
  });

  it('handleLock throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleLock(tmpDir, 'bogus', ['test-lock']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown lock subcommand'));
        return true;
      },
    );
  });

  it('handleLock throws CliError for release subcommand', async () => {
    await assert.rejects(
      async () => handleLock(tmpDir, 'release', ['test-lock']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Lock release via CLI is not supported'));
        return true;
      },
    );
  });

  it('handleState throws CliError when get has no target', async () => {
    await assert.rejects(
      async () => handleState(tmpDir, 'get', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleState throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleState(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown state subcommand'));
        return true;
      },
    );
  });

  it('handlePlan throws CliError when load-set has no set name', () => {
    assert.throws(
      () => handlePlan(tmpDir, 'load-set', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handlePlan throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handlePlan(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown plan subcommand'));
        return true;
      },
    );
  });

  it('handleResolve throws CliError when set has no input', async () => {
    await assert.rejects(
      async () => handleResolve(tmpDir, 'set', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleResolve throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleResolve(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleInit throws CliError when subcommand is missing', () => {
    assert.throws(
      () => handleInit([]),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleInit throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handleInit(['bogus']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown init subcommand'));
        return true;
      },
    );
  });

  it('handleDisplay throws CliError when stage is missing', () => {
    assert.throws(
      () => handleDisplay('banner', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleDisplay throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handleDisplay('bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown display subcommand'));
        return true;
      },
    );
  });

  it('handleExecute throws CliError when prepare-context has no set name', async () => {
    await assert.rejects(
      async () => handleExecute(tmpDir, 'prepare-context', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleExecute throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleExecute(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown execute subcommand'));
        return true;
      },
    );
  });

  it('handleMerge throws CliError when review has no set name', async () => {
    await assert.rejects(
      async () => handleMerge(tmpDir, 'review', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleMerge throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleMerge(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown merge subcommand'));
        return true;
      },
    );
  });

  it('handleReview throws CliError when scope has no set-id', async () => {
    await assert.rejects(
      async () => handleReview(tmpDir, 'scope', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleReview throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleReview(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown review subcommand'));
        return true;
      },
    );
  });

  it('handleWorktree throws CliError when create has no set name', async () => {
    await assert.rejects(
      async () => handleWorktree(tmpDir, 'create', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleWorktree throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleWorktree(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown worktree subcommand'));
        return true;
      },
    );
  });

  it('handleSetInit throws CliError when create has no set name', async () => {
    await assert.rejects(
      async () => handleSetInit(tmpDir, 'create', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleSetInit throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleSetInit(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown set-init subcommand'));
        return true;
      },
    );
  });

  it('handleParseReturn throws CliError when file is missing', () => {
    assert.throws(
      () => handleParseReturn([]),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleParseReturn throws CliError when file does not exist', () => {
    assert.throws(
      () => handleParseReturn(['/nonexistent/file.txt']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Cannot read file'));
        return true;
      },
    );
  });

  it('handleVerifyArtifacts throws CliError when no files provided', () => {
    assert.throws(
      () => handleVerifyArtifacts([]),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleContext throws CliError when subcommand is missing', () => {
    assert.throws(
      () => handleContext([]),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('handleContext throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handleContext(['bogus']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown context subcommand'));
        return true;
      },
    );
  });

  it('handleQuick throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleQuick(tmpDir, 'bogus', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage: quick <subcommand>'));
        return true;
      },
    );
  });

  it('handleQuick throws CliError when log is missing required flags', async () => {
    await assert.rejects(
      async () => handleQuick(tmpDir, 'log', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage: quick log'));
        return true;
      },
    );
  });

  it('handleQuick throws CliError when show has no ID', async () => {
    await assert.rejects(
      async () => handleQuick(tmpDir, 'show', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage: quick show <id>'));
        return true;
      },
    );
  });

  it('handleState add-set throws CliError when missing required flags', async () => {
    await assert.rejects(
      async () => handleState(tmpDir, 'add-set', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage: state add-set'));
        return true;
      },
    );
  });
});
