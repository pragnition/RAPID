'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../lib/errors.cjs');

/**
 * Handle `ui-contract` CLI subcommands.
 *
 * Subcommands:
 *   validate           -- Validate a set's UI-CONTRACT.json against schema
 *   check-consistency  -- Check cross-set UI consistency
 *   show               -- Show formatted UI contract summary for a set
 *
 * @param {string} cwd - Project root directory
 * @param {string} subcommand - The subcommand to execute
 * @param {string[]} args - Remaining CLI arguments
 */
async function handleUiContract(cwd, subcommand, args) {
  const uiContract = require('../lib/ui-contract.cjs');

  switch (subcommand) {
    case 'validate': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: ui-contract validate <set-name>');
      }

      const contractPath = path.join(cwd, '.planning', 'sets', setName, 'UI-CONTRACT.json');
      if (!fs.existsSync(contractPath)) {
        throw new CliError(`UI-CONTRACT.json not found for set "${setName}"`);
      }

      let contractObj;
      try {
        const raw = fs.readFileSync(contractPath, 'utf-8');
        contractObj = JSON.parse(raw);
      } catch {
        throw new CliError(`UI-CONTRACT.json is not valid JSON for set "${setName}"`);
      }

      const result = uiContract.validateUiContract(contractObj);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'check-consistency': {
      const result = uiContract.checkUiConsistency(cwd, null);
      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    case 'show': {
      const setName = args[0];
      if (!setName) {
        throw new CliError('Usage: ui-contract show <set-name>');
      }

      const contractPath = path.join(cwd, '.planning', 'sets', setName, 'UI-CONTRACT.json');
      if (!fs.existsSync(contractPath)) {
        throw new CliError(`UI-CONTRACT.json not found for set "${setName}"`);
      }

      let contractObj;
      try {
        const raw = fs.readFileSync(contractPath, 'utf-8');
        contractObj = JSON.parse(raw);
      } catch {
        throw new CliError(`UI-CONTRACT.json is not valid JSON for set "${setName}"`);
      }

      const validation = uiContract.validateUiContract(contractObj);
      if (!validation.valid) {
        process.stdout.write(JSON.stringify({ valid: false, errors: validation.errors }) + '\n');
        break;
      }

      const result = {
        set: setName,
        valid: true,
        sections: {},
      };

      // Guidelines
      if (contractObj.guidelines) {
        const g = contractObj.guidelines;
        result.sections.guidelines = {
          present: true,
          tone: g.tone || null,
          fontCount: Array.isArray(g.fontFamilies) ? g.fontFamilies.length : 0,
          ruleCount: Array.isArray(g.visualIdentity) ? g.visualIdentity.length : 0,
        };
      } else {
        result.sections.guidelines = { present: false };
      }

      // Components
      if (Array.isArray(contractObj.components) && contractObj.components.length > 0) {
        result.sections.components = {
          present: true,
          count: countComponents(contractObj.components),
          topLevel: contractObj.components.map((c) => c.name),
        };
      } else {
        result.sections.components = { present: false };
      }

      // Tokens
      if (contractObj.tokens && Object.keys(contractObj.tokens).length > 0) {
        const keys = Object.keys(contractObj.tokens);
        result.sections.tokens = {
          present: true,
          count: keys.length,
          keys,
        };
      } else {
        result.sections.tokens = { present: false };
      }

      // Layout
      if (contractObj.layout) {
        const l = contractObj.layout;
        result.sections.layout = {
          present: true,
          hasGrid: !!(l.grid && (l.grid.columns !== undefined || l.grid.gutter !== undefined)),
          breakpointCount: l.breakpoints ? Object.keys(l.breakpoints).length : 0,
        };
      } else {
        result.sections.layout = { present: false };
      }

      // Interactions
      if (contractObj.interactions) {
        const ix = contractObj.interactions;
        const categories = [];
        for (const key of ['stateTransitions', 'animations', 'loadingPatterns', 'errorStates', 'accessibility']) {
          if (Array.isArray(ix[key]) && ix[key].length > 0) {
            categories.push(key);
          }
        }
        result.sections.interactions = {
          present: true,
          categories,
        };
      } else {
        result.sections.interactions = { present: false };
      }

      process.stdout.write(JSON.stringify(result) + '\n');
      break;
    }

    default:
      throw new CliError(`Unknown ui-contract subcommand: "${subcommand}". Use: validate, check-consistency, show`);
  }
}

/**
 * Recursively count all components in a component tree.
 *
 * @param {Array} components - Array of component objects
 * @returns {number} Total count of components including children
 */
function countComponents(components) {
  let count = 0;
  for (const comp of components) {
    count += 1;
    if (Array.isArray(comp.children)) {
      count += countComponents(comp.children);
    }
  }
  return count;
}

module.exports = { handleUiContract };
