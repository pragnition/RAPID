'use strict';

const { error } = require('../lib/core.cjs');
const { acquireLock, isLocked } = require('../lib/lock.cjs');

async function handleLock(cwd, subcommand, args) {
  const lockName = args[0];

  if (!lockName) {
    error('Lock name required. Usage: rapid-tools lock <acquire|status|release> <name>');
    process.exit(1);
  }

  switch (subcommand) {
    case 'acquire': {
      const release = await acquireLock(cwd, lockName);
      // For CLI usage, we hold the lock and print confirmation.
      // The lock will be released when the process exits.
      const result = JSON.stringify({ acquired: true, lock: lockName });
      process.stdout.write(result + '\n');
      // Note: In CLI mode, the lock is held until the process exits.
      // For programmatic use, callers should use the library directly.
      break;
    }

    case 'status': {
      const locked = isLocked(cwd, lockName);
      const result = JSON.stringify({ locked, lock: lockName });
      process.stdout.write(result + '\n');
      break;
    }

    case 'release': {
      error('Lock release via CLI is not supported. Locks are released when the acquiring process exits.');
      process.exit(1);
      break;
    }

    default:
      error(`Unknown lock subcommand: ${subcommand}`);
      process.exit(1);
  }
}

module.exports = { handleLock };
