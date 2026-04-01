'use strict';

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const PRINCIPLES_SUBPATH = '.planning/PRINCIPLES.md';

const PREDEFINED_CATEGORIES = [
  'architecture', 'code style', 'testing', 'security',
  'UX', 'performance', 'data handling', 'documentation'
];

/** Max lines for the compact CLAUDE.md summary section. */
const CLAUDE_MD_LINE_BUDGET = 45;

// ────────────────────────────────────────────────────────────────
// generatePrinciplesMd
// ────────────────────────────────────────────────────────────────

/**
 * Generate a complete PRINCIPLES.md Markdown document from structured data.
 *
 * @param {Array<{category: string, statement: string, rationale: string}>} principlesData
 * @returns {string} Full Markdown document
 * @throws {TypeError} If principlesData is not an array
 */
function generatePrinciplesMd(principlesData) {
  if (!Array.isArray(principlesData)) {
    throw new TypeError('principlesData must be an array');
  }

  const isoDate = new Date().toISOString().split('T')[0];

  if (principlesData.length === 0) {
    return [
      '# Project Principles',
      '',
      `> Generated: ${isoDate}`,
      '> Categories: none',
      '>',
      '> These principles guide development decisions. Edit freely -- this file is the source of truth.',
      '> Run `/rapid:init` to regenerate from scratch, or edit manually.',
      '',
      'No principles captured yet.',
      '',
    ].join('\n');
  }

  // Group by category
  const groups = new Map();
  for (const p of principlesData) {
    const cat = p.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }

  // Stable ordering: predefined categories first (in order), then custom alphabetically
  const orderedCategories = sortCategories([...groups.keys()]);

  const categoriesSummary = orderedCategories.join(', ');

  const lines = [
    '# Project Principles',
    '',
    `> Generated: ${isoDate}`,
    `> Categories: ${categoriesSummary}`,
    '>',
    '> These principles guide development decisions. Edit freely -- this file is the source of truth.',
    '> Run `/rapid:init` to regenerate from scratch, or edit manually.',
    '',
  ];

  for (const cat of orderedCategories) {
    // Capitalize first letter of each word for display
    const displayCat = capitalizeCategory(cat);
    lines.push(`## ${displayCat}`);
    lines.push('');
    for (const p of groups.get(cat)) {
      if (p.rationale) {
        lines.push(`- **${p.statement}** -- ${p.rationale}`);
      } else {
        lines.push(`- **${p.statement}**`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// generateClaudeMdSection
// ────────────────────────────────────────────────────────────────

/**
 * Generate a compact principles summary suitable for worktree-scoped CLAUDE.md.
 * Budget: max 45 lines total including header and pointer.
 *
 * @param {Array<{category: string, statement: string}>} principlesData
 * @returns {string} Compact Markdown section, or empty string if no principles
 */
function generateClaudeMdSection(principlesData) {
  if (!Array.isArray(principlesData) || principlesData.length === 0) {
    return '';
  }

  // Group by category
  const groups = new Map();
  for (const p of principlesData) {
    const cat = p.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }

  const orderedCategories = sortCategories([...groups.keys()]);

  const header = [
    '## Project Principles',
    '',
    'Key principles guiding this project (see `.planning/PRINCIPLES.md` for full details):',
    '',
  ];

  const pointer = [
    '',
    '> Full principles with rationale: `.planning/PRINCIPLES.md`',
  ];

  // Lines available for category content = budget - header - pointer
  const budgetForContent = CLAUDE_MD_LINE_BUDGET - header.length - pointer.length;

  // Build category lines
  const categoryLines = [];
  for (const cat of orderedCategories) {
    const displayCat = capitalizeCategory(cat);
    const statements = groups.get(cat).map(p => p.statement).join('; ');
    categoryLines.push(`**${displayCat}:** ${statements}`);
  }

  if (categoryLines.length <= budgetForContent) {
    // Everything fits
    return [...header, ...categoryLines, ...pointer].join('\n') + '\n';
  }

  // Truncate: fit as many category lines as possible, then add truncation notice
  const truncBudget = budgetForContent - 1; // reserve 1 line for the truncation message
  const included = categoryLines.slice(0, truncBudget);

  // Count remaining principles and categories
  const includedCats = new Set(orderedCategories.slice(0, truncBudget));
  let remainingPrinciples = 0;
  const remainingCats = new Set();
  for (const cat of orderedCategories) {
    if (!includedCats.has(cat)) {
      remainingPrinciples += groups.get(cat).length;
      remainingCats.add(cat);
    }
  }

  const truncLine = `... and ${remainingPrinciples} more principles across ${remainingCats.size} categories`;

  return [...header, ...included, truncLine, ...pointer].join('\n') + '\n';
}

// ────────────────────────────────────────────────────────────────
// loadPrinciples
// ────────────────────────────────────────────────────────────────

/**
 * Load and parse a PRINCIPLES.md file from the given project root.
 * Follows the graceful-null pattern: returns null on ENOENT, re-throws others.
 *
 * @param {string} cwd - Project root directory
 * @returns {Array<{category: string, statement: string, rationale: string}>|null}
 *   Parsed principles array, or null if the file does not exist.
 * @throws {Error} If the file cannot be read for reasons other than ENOENT
 */
function loadPrinciples(cwd) {
  const filePath = path.join(cwd, PRINCIPLES_SUBPATH);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }

  const principles = [];
  let currentCategory = null;

  // Regex for ## Category headers
  const categoryRe = /^##\s+(.+)$/;
  // Regex for - **Statement** -- Rationale  or  - **Statement**
  const bulletRe = /^-\s+\*\*(.+?)\*\*(?:\s+--\s+(.*))?$/;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    const catMatch = trimmed.match(categoryRe);
    if (catMatch) {
      currentCategory = catMatch[1].trim().toLowerCase();
      continue;
    }

    if (currentCategory === null) continue;

    const bulletMatch = trimmed.match(bulletRe);
    if (bulletMatch) {
      principles.push({
        category: currentCategory,
        statement: bulletMatch[1].trim(),
        rationale: (bulletMatch[2] || '').trim(),
      });
    }
    // Non-matching lines are silently skipped
  }

  return principles;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Sort categories: predefined first (in PREDEFINED_CATEGORIES order),
 * then custom categories in alphabetical order.
 */
function sortCategories(categories) {
  const predefined = [];
  const custom = [];

  for (const cat of categories) {
    if (PREDEFINED_CATEGORIES.includes(cat.toLowerCase())) {
      predefined.push(cat);
    } else {
      custom.push(cat);
    }
  }

  // Sort predefined by their index in the canonical list
  predefined.sort((a, b) =>
    PREDEFINED_CATEGORIES.indexOf(a.toLowerCase()) -
    PREDEFINED_CATEGORIES.indexOf(b.toLowerCase())
  );

  // Sort custom alphabetically
  custom.sort((a, b) => a.localeCompare(b));

  return [...predefined, ...custom];
}

/**
 * Capitalize each word in a category name for display.
 * "code style" -> "Code Style", "UX" -> "UX"
 */
function capitalizeCategory(cat) {
  // Special case: fully uppercase short terms stay uppercase
  if (cat === cat.toUpperCase() && cat.length <= 3) return cat;
  return cat.replace(/\b\w/g, c => c.toUpperCase());
}

// ────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────

module.exports = {
  generatePrinciplesMd,
  generateClaudeMdSection,
  loadPrinciples,
  PREDEFINED_CATEGORIES,
  PRINCIPLES_SUBPATH,
};
