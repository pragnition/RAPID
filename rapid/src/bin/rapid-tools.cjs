#!/usr/bin/env node
'use strict';

const { output, error, findProjectRoot } = require('../lib/core.cjs');
const { acquireLock, isLocked } = require('../lib/lock.cjs');

const USAGE = `Usage: rapid-tools <command> [subcommand] [args...]

Commands:
  lock acquire <name>    Acquire a named lock
  lock status <name>     Check if a named lock is held
  lock release <name>    Release a named lock (not typically used directly)
  state get [field]      Read a field from STATE.md (or full content with --all)
  state update <field> <value>  Update a field in STATE.md

Options:
  --help, -h             Show this help message
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(USAGE);
    if (args.length === 0) process.exit(1);
    return;
  }

  const command = args[0];
  const subcommand = args[1];

  let cwd;
  try {
    cwd = findProjectRoot();
  } catch (err) {
    error(`Cannot find project root: ${err.message}`);
    process.exit(1);
  }

  switch (command) {
    case 'lock':
      await handleLock(cwd, subcommand, args.slice(2));
      break;

    case 'state':
      await handleState(cwd, subcommand, args.slice(2));
      break;

    default:
      error(`Unknown command: ${command}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

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
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

async function handleState(cwd, subcommand, args) {
  // State subcommands will be wired in Task 2
  let stateModule;
  try {
    stateModule = require('../lib/state.cjs');
  } catch (err) {
    error('State module not yet available. It will be added in a subsequent task.');
    process.exit(1);
  }

  switch (subcommand) {
    case 'get': {
      const field = args[0];
      const useAll = args.includes('--all');
      if (!field || useAll) {
        const content = stateModule.stateGet(cwd);
        process.stdout.write(content + '\n');
      } else {
        const value = stateModule.stateGet(cwd, field);
        const result = JSON.stringify({ field, value });
        process.stdout.write(result + '\n');
      }
      break;
    }

    case 'update': {
      const field = args[0];
      const value = args.slice(1).join(' ');
      if (!field || !value) {
        error('Usage: rapid-tools state update <field> <value>');
        process.exit(1);
      }
      const result = await stateModule.stateUpdate(cwd, field, value);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      error(`Unknown state subcommand: ${subcommand}`);
      process.stdout.write(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
