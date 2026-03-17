'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { estimateTokens } = require('./tool-docs.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEMORY_DIR = 'memory';
const DECISIONS_FILE = 'DECISIONS.jsonl';
const CORRECTIONS_FILE = 'CORRECTIONS.jsonl';
const DEFAULT_TOKEN_BUDGET = 8000;
const DECISION_BUDGET_RATIO = 0.7;

const VALID_CATEGORIES = [
  'architecture',
  'integration',
  'ux',
  'performance',
  'convention',
  'tooling',
  'testing',
  'deployment',
];

const VALID_SOURCES = ['user', 'agent'];

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

/**
 * Return the absolute path to .planning/memory/ within the given project root.
 * @param {string} cwd - Project root directory
 * @returns {string}
 */
function getMemoryDir(cwd) {
  return path.join(cwd, '.planning', MEMORY_DIR);
}

/**
 * Ensure the .planning/memory/ directory exists (lazy init).
 * @param {string} cwd - Project root directory
 */
function ensureMemoryDir(cwd) {
  fs.mkdirSync(getMemoryDir(cwd), { recursive: true });
}

// ---------------------------------------------------------------------------
// Append functions
// ---------------------------------------------------------------------------

/**
 * Append a decision entry to DECISIONS.jsonl.
 * @param {string} cwd - Project root directory
 * @param {object} entry - Decision entry with required fields
 * @returns {object} The created record with generated id and timestamp
 */
function appendDecision(cwd, entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('appendDecision: entry must be an object');
  }
  if (!entry.category || typeof entry.category !== 'string') {
    throw new Error('appendDecision: category is required and must be a non-empty string');
  }
  if (!VALID_CATEGORIES.includes(entry.category)) {
    throw new Error(`appendDecision: invalid category '${entry.category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (!entry.decision || typeof entry.decision !== 'string') {
    throw new Error('appendDecision: decision is required and must be a non-empty string');
  }
  if (!entry.rationale || typeof entry.rationale !== 'string') {
    throw new Error('appendDecision: rationale is required and must be a non-empty string');
  }
  if (!entry.source || typeof entry.source !== 'string') {
    throw new Error('appendDecision: source is required and must be a non-empty string');
  }
  if (!VALID_SOURCES.includes(entry.source)) {
    throw new Error(`appendDecision: invalid source '${entry.source}'. Must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category: entry.category,
    decision: entry.decision,
    rationale: entry.rationale,
    source: entry.source,
    milestone: entry.milestone || null,
    setId: entry.setId || null,
    topic: entry.topic || null,
  };

  ensureMemoryDir(cwd);
  fs.appendFileSync(
    path.join(getMemoryDir(cwd), DECISIONS_FILE),
    JSON.stringify(record) + '\n',
  );

  return record;
}

/**
 * Append a correction entry to CORRECTIONS.jsonl.
 * @param {string} cwd - Project root directory
 * @param {object} entry - Correction entry with required fields
 * @returns {object} The created record with generated id and timestamp
 */
function appendCorrection(cwd, entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('appendCorrection: entry must be an object');
  }
  if (!entry.original || typeof entry.original !== 'string') {
    throw new Error('appendCorrection: original is required and must be a non-empty string');
  }
  if (!entry.correction || typeof entry.correction !== 'string') {
    throw new Error('appendCorrection: correction is required and must be a non-empty string');
  }
  if (!entry.reason || typeof entry.reason !== 'string') {
    throw new Error('appendCorrection: reason is required and must be a non-empty string');
  }

  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    original: entry.original,
    correction: entry.correction,
    reason: entry.reason,
    affectedSets: entry.affectedSets || [],
    setId: entry.setId || null,
    milestone: entry.milestone || null,
  };

  ensureMemoryDir(cwd);
  fs.appendFileSync(
    path.join(getMemoryDir(cwd), CORRECTIONS_FILE),
    JSON.stringify(record) + '\n',
  );

  return record;
}

// ---------------------------------------------------------------------------
// Internal JSONL reader
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSONL file, skipping malformed lines.
 * @param {string} filePath - Absolute path to the JSONL file
 * @returns {object[]}
 */
function readJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  const results = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch (_e) {
      // Skip malformed lines silently
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Query decision entries with optional filters.
 * @param {string} cwd - Project root directory
 * @param {object} [filters] - Optional filters: category, milestone, setId, limit
 * @returns {object[]} Filtered decisions sorted by timestamp descending
 */
function queryDecisions(cwd, filters) {
  const filePath = path.join(getMemoryDir(cwd), DECISIONS_FILE);
  let entries = readJsonlFile(filePath);

  if (filters) {
    if (filters.category) {
      entries = entries.filter((e) => e.category === filters.category);
    }
    if (filters.milestone) {
      entries = entries.filter((e) => e.milestone === filters.milestone);
    }
    if (filters.setId) {
      entries = entries.filter((e) => e.setId === filters.setId);
    }
  }

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (filters && filters.limit) {
    entries = entries.slice(0, filters.limit);
  }

  return entries;
}

/**
 * Query correction entries with optional filters.
 * @param {string} cwd - Project root directory
 * @param {object} [filters] - Optional filters: affectedSet, setId, limit
 * @returns {object[]} Filtered corrections sorted by timestamp descending
 */
function queryCorrections(cwd, filters) {
  const filePath = path.join(getMemoryDir(cwd), CORRECTIONS_FILE);
  let entries = readJsonlFile(filePath);

  if (filters) {
    if (filters.affectedSet) {
      entries = entries.filter(
        (e) => Array.isArray(e.affectedSets) && e.affectedSets.includes(filters.affectedSet),
      );
    }
    if (filters.setId) {
      entries = entries.filter((e) => e.setId === filters.setId);
    }
  }

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (filters && filters.limit) {
    entries = entries.slice(0, filters.limit);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// buildMemoryContext helpers
// ---------------------------------------------------------------------------

/**
 * Deduplicate decisions: latest-wins per category+topic key.
 * Superseded entries are marked with superseded: true.
 * @param {object[]} decisions - Sorted recency-first
 * @returns {object[]} Latest entries first, superseded entries at the end
 */
function deduplicateDecisions(decisions) {
  const seen = new Map();
  const latest = [];
  const superseded = [];

  for (const entry of decisions) {
    const key = `${entry.category}::${entry.topic || ''}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      latest.push(entry);
    } else {
      superseded.push({ ...entry, superseded: true });
    }
  }

  return [...latest, ...superseded];
}

/**
 * Format a decision entry as a human-readable line.
 * @param {object} entry
 * @returns {string}
 */
function formatDecisionEntry(entry) {
  const tag = entry.topic
    ? `[${entry.category}/${entry.topic}]`
    : `[${entry.category}]`;
  const suffix = entry.superseded ? ' [superseded]' : '';
  return `- ${tag} ${entry.decision} (${entry.rationale})${suffix}`;
}

/**
 * Format a correction entry as a human-readable line.
 * @param {object} entry
 * @returns {string}
 */
function formatCorrectionEntry(entry) {
  return `- Original: ${entry.original} -> Correction: ${entry.correction} (${entry.reason})`;
}

// ---------------------------------------------------------------------------
// buildMemoryContext
// ---------------------------------------------------------------------------

/**
 * Build a token-budgeted memory context string for injection into agent prompts.
 * @param {string} cwd - Project root directory
 * @param {string} setName - Current set name (for prioritizing set-specific corrections)
 * @param {number} [tokenBudget] - Max tokens for the output (default 8000)
 * @returns {string} Formatted memory context, or empty string if no memory exists
 */
function buildMemoryContext(cwd, setName, tokenBudget) {
  tokenBudget = tokenBudget || DEFAULT_TOKEN_BUDGET;

  const decisionBudget = Math.floor(tokenBudget * DECISION_BUDGET_RATIO);
  const correctionBudget = tokenBudget - decisionBudget;

  // Query all decisions (recency-first)
  const allDecisions = queryDecisions(cwd);

  // Query set-specific corrections, then global corrections
  const setCorrections = setName
    ? queryCorrections(cwd, { affectedSet: setName })
    : [];
  const globalCorrections = queryCorrections(cwd);

  // Merge correction lists: set-specific first, deduplicate by id
  const seenCorrectionIds = new Set();
  const mergedCorrections = [];
  for (const c of setCorrections) {
    if (!seenCorrectionIds.has(c.id)) {
      seenCorrectionIds.add(c.id);
      mergedCorrections.push(c);
    }
  }
  for (const c of globalCorrections) {
    if (!seenCorrectionIds.has(c.id)) {
      seenCorrectionIds.add(c.id);
      mergedCorrections.push(c);
    }
  }

  // If both are empty, return empty string
  if (allDecisions.length === 0 && mergedCorrections.length === 0) {
    return '';
  }

  // Deduplicate decisions
  const deduped = deduplicateDecisions(allDecisions);

  // Build decisions section with token budgeting
  const decisionLines = [];
  let decisionText = '';
  for (const entry of deduped) {
    const line = formatDecisionEntry(entry);
    const candidate = decisionText ? decisionText + '\n' + line : line;
    if (estimateTokens(candidate) > decisionBudget) {
      break;
    }
    decisionLines.push(line);
    decisionText = candidate;
  }

  // Build corrections section with token budgeting
  const correctionLines = [];
  let correctionText = '';
  for (const entry of mergedCorrections) {
    const line = formatCorrectionEntry(entry);
    const candidate = correctionText ? correctionText + '\n' + line : line;
    if (estimateTokens(candidate) > correctionBudget) {
      break;
    }
    correctionLines.push(line);
    correctionText = candidate;
  }

  // Assemble
  const decisionsSection = decisionLines.length > 0
    ? decisionLines.join('\n')
    : '(no decisions recorded)';
  const correctionsSection = correctionLines.length > 0
    ? correctionLines.join('\n')
    : '(no corrections recorded)';

  return `## Memory Context\n\n### Decisions\n${decisionsSection}\n\n### Corrections\n${correctionsSection}`;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  appendDecision,
  appendCorrection,
  queryDecisions,
  queryCorrections,
  buildMemoryContext,
  VALID_CATEGORIES,
  VALID_SOURCES,
  DEFAULT_TOKEN_BUDGET,
};
