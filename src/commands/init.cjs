'use strict';

const { CliError } = require('../lib/errors.cjs');

function handleInit(args) {
  const { scaffoldProject, detectExisting } = require('../lib/init.cjs');

  const subcommand = args[0];

  if (!subcommand) {
    throw new CliError('Usage: rapid-tools init <detect|scaffold> [options]');
  }

  if (subcommand === 'detect') {
    const result = detectExisting(process.cwd());
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (subcommand === 'scaffold') {
    // Parse named arguments
    let name = null;
    let desc = null;
    let teamSize = null;
    let mode = 'fresh';

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--name':
          name = args[++i];
          break;
        case '--desc':
          desc = args[++i];
          break;
        case '--team-size':
          teamSize = parseInt(args[++i], 10);
          break;
        case '--mode':
          mode = args[++i];
          break;
      }
    }

    // Cancel mode doesn't require other args
    if (mode === 'cancel') {
      const result = scaffoldProject(process.cwd(), {}, mode);
      process.stdout.write(JSON.stringify(result) + '\n');
      return;
    }

    if (!name || !desc || !teamSize) {
      throw new CliError('Usage: rapid-tools init scaffold --name <name> --desc <description> --team-size <N> [--mode fresh|reinitialize|upgrade|cancel]');
    }

    const result = scaffoldProject(process.cwd(), { name, description: desc, teamSize }, mode);
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }

  if (subcommand === 'research-dir') {
    const fs = require('fs');
    const path = require('path');
    const researchDir = path.join(process.cwd(), '.planning', 'research');
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }
    process.stdout.write(JSON.stringify({ researchDir, ready: true }) + '\n');
    return;
  }

  if (subcommand === 'write-config') {
    const fs = require('fs');
    const path = require('path');
    const { generateConfigJson } = require('../lib/init.cjs');
    let model = null;
    let teamSize = null;
    let name = null;
    let solo = undefined;

    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--model':
          model = args[++i];
          break;
        case '--team-size':
          teamSize = parseInt(args[++i], 10);
          break;
        case '--name':
          name = args[++i];
          break;
        case '--solo':
          solo = true;
          break;
      }
    }

    const opts = {};
    if (model) opts.model = model;
    if (teamSize) opts.teamSize = teamSize;
    if (name) opts.name = name;
    if (solo !== undefined) opts.solo = solo;

    const configContent = generateConfigJson(opts);
    const configPath = path.join(process.cwd(), '.planning', 'config.json');

    // Ensure .planning/ exists
    const planningDir = path.join(process.cwd(), '.planning');
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    fs.writeFileSync(configPath, configContent);
    process.stdout.write(JSON.stringify({ written: true, configPath }) + '\n');
    return;
  }

  throw new CliError(`Unknown init subcommand: ${subcommand}. Use 'detect', 'scaffold', 'research-dir', or 'write-config'.`);
}

module.exports = { handleInit };
