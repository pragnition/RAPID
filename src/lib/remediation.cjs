'use strict';

/**
 * remediation.cjs - CRUD operations for remediation artifacts in .planning/pending-sets/.
 *
 * Provides:
 *   - writeRemediationArtifact(cwd, setName, remediation) -- create or overwrite a pending remediation
 *   - readRemediationArtifact(cwd, setName) -- read a pending remediation (null if missing/malformed)
 *   - listPendingRemediations(cwd) -- list all pending set names
 *   - deleteRemediationArtifact(cwd, setName) -- delete a pending remediation
 *
 * This module operates entirely on flat JSON files in .planning/pending-sets/.
 * It does NOT import or mutate STATE.json.
 */

const fs = require('fs');
const path = require('path');

const PENDING_DIR = path.join('.planning', 'pending-sets');

/**
 * Write a remediation artifact to .planning/pending-sets/<setName>.json.
 *
 * Creates the directory lazily if it does not exist. Overwrites any existing
 * artifact with the same set name.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Kebab-case set name, used as filename stem
 * @param {object} remediation - Remediation data
 * @param {string} remediation.scope - Description of the remediation scope
 * @param {string[]} remediation.files - Files involved
 * @param {string[]} remediation.deps - Dependency set names
 * @param {string} remediation.severity - Severity level
 * @param {string} remediation.source - Source of the remediation (e.g. audit, review)
 * @returns {void}
 */
function writeRemediationArtifact(cwd, setName, remediation) {
  const dir = path.join(cwd, PENDING_DIR);
  fs.mkdirSync(dir, { recursive: true });

  const artifact = {
    setName,
    scope: remediation.scope,
    files: remediation.files,
    deps: remediation.deps,
    severity: remediation.severity,
    source: remediation.source,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(dir, setName + '.json'),
    JSON.stringify(artifact, null, 2)
  );
}

/**
 * Read a remediation artifact from .planning/pending-sets/<setName>.json.
 *
 * Returns null if the file does not exist, contains malformed JSON, or is
 * missing required fields (setName, scope, source).
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Kebab-case set name
 * @returns {object|null} Parsed artifact object, or null if not found/invalid
 */
function readRemediationArtifact(cwd, setName) {
  const filePath = path.join(cwd, PENDING_DIR, setName + '.json');

  if (!fs.existsSync(filePath)) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn('[RAPID WARN] Malformed remediation artifact: ' + filePath);
      return null;
    }
    throw err;
  }

  // Validate required fields
  if (parsed.setName == null || parsed.scope == null || parsed.source == null) {
    console.warn('[RAPID WARN] Malformed remediation artifact: ' + filePath);
    return null;
  }

  return parsed;
}

/**
 * List all pending remediation set names.
 *
 * Returns a sorted array of set names derived from .json filenames in
 * .planning/pending-sets/. Returns an empty array if the directory does
 * not exist or contains no JSON files.
 *
 * @param {string} cwd - Project root directory
 * @returns {string[]} Sorted array of set names
 */
function listPendingRemediations(cwd) {
  const dir = path.join(cwd, PENDING_DIR);

  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir);
  const setNames = entries
    .filter(f => f.endsWith('.json'))
    .map(f => f.slice(0, -5))
    .sort();

  return setNames;
}

/**
 * Delete a remediation artifact from .planning/pending-sets/<setName>.json.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Kebab-case set name
 * @returns {boolean} true if the file was deleted, false if it did not exist
 */
function deleteRemediationArtifact(cwd, setName) {
  const filePath = path.join(cwd, PENDING_DIR, setName + '.json');

  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

module.exports = {
  writeRemediationArtifact,
  readRemediationArtifact,
  listPendingRemediations,
  deleteRemediationArtifact,
};
