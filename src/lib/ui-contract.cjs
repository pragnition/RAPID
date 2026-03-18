'use strict';

/**
 * ui-contract.cjs - UI design contract management for RAPID sets.
 *
 * Provides JSON Schema validation of UI-CONTRACT.json files, cross-set
 * consistency checking for design conflicts, and context string building
 * for agent consumption.
 *
 * Ajv CommonJS import: `require('ajv').default` is the correct CJS
 * import path for Ajv v8 (which ships ESM-first but includes CJS compat).
 */

const Ajv = require('ajv').default;
const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./tool-docs.cjs');
const { resolveProjectRoot, listSets } = require('./plan.cjs');

// ────────────────────────────────────────────────────────────────
// Schema Validation
// ────────────────────────────────────────────────────────────────

// Load and compile the schema once at module level (cached validator)
const UI_CONTRACT_SCHEMA = require('../schemas/ui-contract-schema.json');
const schemaAjv = new Ajv({ allErrors: true });
const schemaValidate = schemaAjv.compile(UI_CONTRACT_SCHEMA);

/**
 * Validate a UI-CONTRACT.json object against the UI contract schema.
 *
 * @param {Object} contract - The UI contract object to validate
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
function validateUiContract(contract) {
  const isValid = schemaValidate(contract);

  if (isValid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: schemaValidate.errors.map((e) => {
      const p = e.instancePath || '';
      return `${p} ${e.message}`.trim();
    }),
  };
}

// ────────────────────────────────────────────────────────────────
// Consistency Checking
// ────────────────────────────────────────────────────────────────

/**
 * Recursively collect all component names and their roles from a components array.
 *
 * @param {Array} components - Array of component objects
 * @returns {Array<{name: string, role: string}>} Flat list of {name, role}
 */
function collectComponents(components) {
  const result = [];
  for (const comp of components) {
    result.push({ name: comp.name, role: comp.role });
    if (Array.isArray(comp.children)) {
      result.push(...collectComponents(comp.children));
    }
  }
  return result;
}

/**
 * Check UI contract consistency across all sets in the project.
 *
 * Reads UI-CONTRACT.json from each set, validates it, and checks for
 * cross-set conflicts in components, tokens, layout, and guidelines.
 *
 * @param {string} cwd - Working directory (used to resolve project root)
 * @param {string} [milestoneId] - Reserved for future milestone scoping (currently unused)
 * @returns {{ consistent: boolean, conflicts: Array<{type: string, sets: string[], key: string, details: string}> }}
 */
function checkUiConsistency(cwd, milestoneId) {
  const projectRoot = resolveProjectRoot(cwd);
  const setNames = listSets(cwd);
  const conflicts = [];

  // Collect valid UI contracts from all sets
  const validContracts = []; // { setName, contract }

  for (const setName of setNames) {
    const contractPath = path.join(
      projectRoot, '.planning', 'sets', setName, 'UI-CONTRACT.json'
    );

    if (!fs.existsSync(contractPath)) {
      continue; // No UI contract for this set -- skip
    }

    let contract;
    try {
      const raw = fs.readFileSync(contractPath, 'utf-8');
      contract = JSON.parse(raw);
    } catch {
      continue; // Malformed JSON -- skip (not a conflict)
    }

    const result = validateUiContract(contract);
    if (!result.valid) {
      continue; // Invalid schema -- skip (not a conflict)
    }

    validContracts.push({ setName, contract });
  }

  // 1. Duplicate component names with different roles
  // Map: componentName -> [{ setName, role }]
  const componentMap = new Map();
  for (const { setName, contract } of validContracts) {
    if (!Array.isArray(contract.components)) continue;
    const comps = collectComponents(contract.components);
    for (const { name, role } of comps) {
      if (!componentMap.has(name)) {
        componentMap.set(name, []);
      }
      componentMap.get(name).push({ setName, role });
    }
  }
  for (const [name, entries] of componentMap) {
    // Check for same name but different roles across different sets
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].setName !== entries[j].setName && entries[i].role !== entries[j].role) {
          conflicts.push({
            type: 'component',
            sets: [entries[i].setName, entries[j].setName],
            key: name,
            details: `Component "${name}" has role "${entries[i].role}" in ${entries[i].setName} but "${entries[j].role}" in ${entries[j].setName}`,
          });
        }
      }
    }
  }

  // 2. Token contradictions
  // Map: tokenKey -> [{ setName, value }]
  const tokenMap = new Map();
  for (const { setName, contract } of validContracts) {
    if (!contract.tokens || typeof contract.tokens !== 'object') continue;
    for (const [key, value] of Object.entries(contract.tokens)) {
      if (!tokenMap.has(key)) {
        tokenMap.set(key, []);
      }
      tokenMap.get(key).push({ setName, value });
    }
  }
  for (const [key, entries] of tokenMap) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].setName !== entries[j].setName && entries[i].value !== entries[j].value) {
          conflicts.push({
            type: 'token',
            sets: [entries[i].setName, entries[j].setName],
            key,
            details: `Token "${key}" is "${entries[i].value}" in ${entries[i].setName} but "${entries[j].value}" in ${entries[j].setName}`,
          });
        }
      }
    }
  }

  // 3. Layout incompatibility (breakpoints, grid.columns, grid.gutter)
  const breakpointMap = new Map(); // bpName -> [{ setName, value }]
  const gridColumns = []; // [{ setName, value }]
  const gridGutters = []; // [{ setName, value }]

  for (const { setName, contract } of validContracts) {
    if (!contract.layout || typeof contract.layout !== 'object') continue;

    // Breakpoints
    if (contract.layout.breakpoints && typeof contract.layout.breakpoints === 'object') {
      for (const [bpName, bpValue] of Object.entries(contract.layout.breakpoints)) {
        if (!breakpointMap.has(bpName)) {
          breakpointMap.set(bpName, []);
        }
        breakpointMap.get(bpName).push({ setName, value: bpValue });
      }
    }

    // Grid columns and gutter
    if (contract.layout.grid && typeof contract.layout.grid === 'object') {
      if (contract.layout.grid.columns !== undefined) {
        gridColumns.push({ setName, value: contract.layout.grid.columns });
      }
      if (contract.layout.grid.gutter !== undefined) {
        gridGutters.push({ setName, value: contract.layout.grid.gutter });
      }
    }
  }

  for (const [bpName, entries] of breakpointMap) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].setName !== entries[j].setName && entries[i].value !== entries[j].value) {
          conflicts.push({
            type: 'layout',
            sets: [entries[i].setName, entries[j].setName],
            key: `breakpoints.${bpName}`,
            details: `Breakpoint "${bpName}" is "${entries[i].value}" in ${entries[i].setName} but "${entries[j].value}" in ${entries[j].setName}`,
          });
        }
      }
    }
  }

  for (let i = 0; i < gridColumns.length; i++) {
    for (let j = i + 1; j < gridColumns.length; j++) {
      if (gridColumns[i].setName !== gridColumns[j].setName && gridColumns[i].value !== gridColumns[j].value) {
        conflicts.push({
          type: 'layout',
          sets: [gridColumns[i].setName, gridColumns[j].setName],
          key: 'grid.columns',
          details: `Grid columns is ${gridColumns[i].value} in ${gridColumns[i].setName} but ${gridColumns[j].value} in ${gridColumns[j].setName}`,
        });
      }
    }
  }

  for (let i = 0; i < gridGutters.length; i++) {
    for (let j = i + 1; j < gridGutters.length; j++) {
      if (gridGutters[i].setName !== gridGutters[j].setName && gridGutters[i].value !== gridGutters[j].value) {
        conflicts.push({
          type: 'layout',
          sets: [gridGutters[i].setName, gridGutters[j].setName],
          key: 'grid.gutter',
          details: `Grid gutter is "${gridGutters[i].value}" in ${gridGutters[i].setName} but "${gridGutters[j].value}" in ${gridGutters[j].setName}`,
        });
      }
    }
  }

  // 4. Guideline drift (tone comparison, case-insensitive)
  const toneEntries = []; // [{ setName, tone }]
  for (const { setName, contract } of validContracts) {
    if (!contract.guidelines || typeof contract.guidelines !== 'object') continue;
    if (typeof contract.guidelines.tone === 'string') {
      toneEntries.push({ setName, tone: contract.guidelines.tone });
    }
  }

  for (let i = 0; i < toneEntries.length; i++) {
    for (let j = i + 1; j < toneEntries.length; j++) {
      if (
        toneEntries[i].setName !== toneEntries[j].setName &&
        toneEntries[i].tone.toLowerCase() !== toneEntries[j].tone.toLowerCase()
      ) {
        conflicts.push({
          type: 'guideline',
          sets: [toneEntries[i].setName, toneEntries[j].setName],
          key: 'guidelines.tone',
          details: `Tone is "${toneEntries[i].tone}" in ${toneEntries[i].setName} but "${toneEntries[j].tone}" in ${toneEntries[j].setName}`,
        });
      }
    }
  }

  return {
    consistent: conflicts.length === 0,
    conflicts,
  };
}

// ────────────────────────────────────────────────────────────────
// Context Building
// ────────────────────────────────────────────────────────────────

/**
 * Build a markdown-formatted UI context string for agent consumption.
 *
 * Reads the set's UI-CONTRACT.json and formats it into sections with
 * a 4000-token budget. Sections are added in priority order and truncated
 * when the budget is exceeded.
 *
 * @param {string} cwd - Working directory (used to resolve project root)
 * @param {string} setName - Name of the set to build context for
 * @returns {string} Markdown context string, or '' if no valid contract
 */
function buildUiContext(cwd, setName) {
  const projectRoot = resolveProjectRoot(cwd);
  const contractPath = path.join(
    projectRoot, '.planning', 'sets', setName, 'UI-CONTRACT.json'
  );

  if (!fs.existsSync(contractPath)) {
    return '';
  }

  let contract;
  try {
    const raw = fs.readFileSync(contractPath, 'utf-8');
    contract = JSON.parse(raw);
  } catch {
    return '';
  }

  const result = validateUiContract(contract);
  if (!result.valid) {
    return '';
  }

  const TOKEN_BUDGET = 4000;
  const TRUNCATION_NOTICE = '\n\n[...truncated to fit token budget]';
  const sections = [];

  // Header is always included
  const header = '## UI Contract\n';
  sections.push(header);

  // Build sections in priority order
  const pendingSections = [];

  // 1. Guidelines
  if (contract.guidelines) {
    let s = '### Guidelines\n';
    const g = contract.guidelines;
    if (g.tone) {
      s += `- **Tone:** ${g.tone}\n`;
    }
    if (Array.isArray(g.fontFamilies) && g.fontFamilies.length > 0) {
      s += `- **Font Families:** ${g.fontFamilies.join(', ')}\n`;
    }
    if (Array.isArray(g.visualIdentity) && g.visualIdentity.length > 0) {
      for (const vi of g.visualIdentity) {
        s += `- ${vi}\n`;
      }
    }
    pendingSections.push(s);
  }

  // 2. Design Tokens
  if (contract.tokens && Object.keys(contract.tokens).length > 0) {
    let s = '### Design Tokens\n';
    s += '| Token | Value |\n';
    s += '|-------|-------|\n';
    for (const [key, value] of Object.entries(contract.tokens)) {
      s += `| ${key} | ${value} |\n`;
    }
    pendingSections.push(s);
  }

  // 3. Components
  if (Array.isArray(contract.components) && contract.components.length > 0) {
    let s = '### Components\n';
    s += formatComponentTree(contract.components, 0);
    pendingSections.push(s);
  }

  // 4. Layout
  if (contract.layout) {
    let s = '### Layout\n';
    const l = contract.layout;
    if (l.grid) {
      if (l.grid.columns !== undefined) {
        s += `- **Grid Columns:** ${l.grid.columns}\n`;
      }
      if (l.grid.gutter) {
        s += `- **Grid Gutter:** ${l.grid.gutter}\n`;
      }
    }
    if (l.breakpoints && Object.keys(l.breakpoints).length > 0) {
      s += '- **Breakpoints:**\n';
      for (const [name, value] of Object.entries(l.breakpoints)) {
        s += `  - ${name}: ${value}\n`;
      }
    }
    if (l.containerWidths && Object.keys(l.containerWidths).length > 0) {
      s += '- **Container Widths:**\n';
      for (const [name, value] of Object.entries(l.containerWidths)) {
        s += `  - ${name}: ${value}\n`;
      }
    }
    if (Array.isArray(l.responsive) && l.responsive.length > 0) {
      s += '- **Responsive Rules:**\n';
      for (const rule of l.responsive) {
        s += `  - ${rule}\n`;
      }
    }
    pendingSections.push(s);
  }

  // 5. Interactions
  if (contract.interactions) {
    let s = '### Interactions\n';
    const ix = contract.interactions;
    const interactionFields = [
      { key: 'stateTransitions', label: 'State Transitions' },
      { key: 'animations', label: 'Animations' },
      { key: 'loadingPatterns', label: 'Loading Patterns' },
      { key: 'errorStates', label: 'Error States' },
      { key: 'accessibility', label: 'Accessibility' },
    ];
    for (const { key, label } of interactionFields) {
      if (Array.isArray(ix[key]) && ix[key].length > 0) {
        s += `- **${label}:**\n`;
        for (const item of ix[key]) {
          s += `  - ${item}\n`;
        }
      }
    }
    pendingSections.push(s);
  }

  // Assemble within token budget
  let assembled = header;
  for (const section of pendingSections) {
    const candidate = assembled + '\n' + section;
    if (estimateTokens(candidate) > TOKEN_BUDGET) {
      assembled += TRUNCATION_NOTICE;
      return assembled;
    }
    assembled = candidate;
  }

  return assembled;
}

/**
 * Format a component tree as indented markdown lines.
 *
 * @param {Array} components - Array of component objects
 * @param {number} depth - Current indentation depth
 * @returns {string} Formatted lines
 */
function formatComponentTree(components, depth) {
  let result = '';
  const indent = '  '.repeat(depth);
  for (const comp of components) {
    result += `${indent}- **${comp.name}** (${comp.role})\n`;
    if (Array.isArray(comp.children) && comp.children.length > 0) {
      result += formatComponentTree(comp.children, depth + 1);
    }
  }
  return result;
}

module.exports = { validateUiContract, checkUiConsistency, buildUiContext };
