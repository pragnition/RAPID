'use strict';

const { CliError } = require('../lib/errors.cjs');

function handlePlan(cwd, subcommand, args) {
  const fs = require('fs');
  const plan = require('../lib/plan.cjs');

  switch (subcommand) {
    case 'create-set': {
      // Reads set definition from stdin (JSON)
      // Usage: echo '{"name":"auth",...}' | rapid-tools plan create-set
      const input = fs.readFileSync(0, 'utf-8');
      const setDef = JSON.parse(input);
      const result = plan.createSet(cwd, setDef);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'decompose': {
      // Reads array of set definitions from stdin (JSON)
      // Usage: echo '[{...}, {...}]' | rapid-tools plan decompose
      const input = fs.readFileSync(0, 'utf-8');
      const setDefs = JSON.parse(input);
      const result = plan.decomposeIntoSets(cwd, setDefs);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'write-dag': {
      // Reads DAG object from stdin
      const input = fs.readFileSync(0, 'utf-8');
      const dagObj = JSON.parse(input);
      plan.writeDAG(cwd, dagObj);
      process.stdout.write(JSON.stringify({ written: true, path: '.planning/sets/DAG.json' }) + '\n');
      break;
    }

    case 'list-sets': {
      const sets = plan.listSets(cwd);
      process.stdout.write(JSON.stringify({ sets }) + '\n');
      break;
    }

    case 'load-set': {
      // Usage: rapid-tools plan load-set <set-name>
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: rapid-tools plan load-set <set-name>');
      }
      const set = plan.loadSet(cwd, setName);
      process.stdout.write(JSON.stringify(set) + '\n');
      break;
    }

    default:
      throw new CliError(`Unknown plan subcommand: ${subcommand}. Use: create-set, decompose, write-dag, check-gate, update-gate, list-sets, load-set`);
  }
}

module.exports = { handlePlan };
