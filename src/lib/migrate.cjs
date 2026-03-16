'use strict';

const fs = require('fs');
const path = require('path');
const { getVersion } = require('./version.cjs');
const { compareVersions } = require('./prereqs.cjs');

// --- Internal helpers ---

/**
 * Recursively count files (not directories) in a directory tree.
 *
 * @param {string} dir - Directory to count files in
 * @returns {number} Total file count
 */
function _countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += _countFiles(fullPath);
    } else {
      count += 1;
    }
  }
  return count;
}

// --- Version Detection ---

/** @type {string[]} */
const PAST_TENSE_STATUSES = ['discussed', 'planned', 'executed', 'reviewed', 'merged'];
/** @type {string[]} */
const PRESENT_TENSE_STATUSES = ['discussing', 'planning', 'executing', 'reviewing', 'merging'];

/**
 * Examine a .planning/ directory and infer which RAPID version created it.
 *
 * @param {string} cwd - Project root directory path
 * @returns {{ detected: string|null, confidence: 'high'|'medium'|'low', signals: string[] }}
 */
function detectVersion(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const stateJsonPath = path.join(planningDir, 'STATE.json');
  const stateMdPath = path.join(planningDir, 'STATE.md');

  // Check if .planning/ exists at all
  if (!fs.existsSync(planningDir)) {
    return { detected: null, confidence: 'low', signals: ['No .planning/ directory found'] };
  }

  // 1. Check STATE.json
  if (fs.existsSync(stateJsonPath)) {
    let state;
    try {
      state = JSON.parse(fs.readFileSync(stateJsonPath, 'utf-8'));
    } catch {
      return { detected: null, confidence: 'low', signals: ['STATE.json exists but is not valid JSON'] };
    }

    // If rapidVersion field is present, return immediately with high confidence
    if (state.rapidVersion) {
      return {
        detected: state.rapidVersion,
        confidence: 'high',
        signals: ['rapidVersion field present'],
      };
    }

    // 2. No rapidVersion -- analyze STATE.json structure
    const signals = [];

    // Check milestone ID formats
    const milestones = state.milestones || {};
    const milestoneIds = Object.keys(milestones);
    const hasNumericPrefixIds = milestoneIds.some((id) => /^\d{2}-/.test(id));
    const hasStringIds = milestoneIds.some((id) => /^[a-z]/.test(id) && !/^\d/.test(id));

    if (hasNumericPrefixIds) signals.push('Numeric-prefix milestone IDs detected');
    if (hasStringIds) signals.push('String milestone IDs detected');

    // Check currentMilestone format
    const currentMilestone = state.currentMilestone || '';
    const hasVersionPrefixedMilestone = /^v\d+\.\d+\.\d+/.test(currentMilestone);
    if (hasVersionPrefixedMilestone) signals.push('Version-prefixed currentMilestone detected');

    // Check set status values across all milestones
    let hasPastTense = false;
    let hasPresentTense = false;

    for (const msId of milestoneIds) {
      const ms = milestones[msId];
      const sets = ms.sets || {};
      for (const setId of Object.keys(sets)) {
        const setStatus = sets[setId].status;
        if (PAST_TENSE_STATUSES.includes(setStatus)) hasPastTense = true;
        if (PRESENT_TENSE_STATUSES.includes(setStatus)) hasPresentTense = true;
      }
    }

    if (hasPastTense) signals.push('Past-tense set statuses detected');
    if (hasPresentTense) signals.push('Present-tense set statuses detected');

    // Check for CONTRACT.json files in sets
    const setsDir = path.join(planningDir, 'sets');
    let hasContracts = false;
    if (fs.existsSync(setsDir)) {
      try {
        const setDirs = fs.readdirSync(setsDir, { withFileTypes: true });
        for (const d of setDirs) {
          if (d.isDirectory()) {
            const contractPath = path.join(setsDir, d.name, 'CONTRACT.json');
            if (fs.existsSync(contractPath)) {
              hasContracts = true;
              break;
            }
          }
        }
      } catch {
        // ignore read errors
      }
    }
    if (hasContracts) signals.push('CONTRACT.json files found in sets');

    // Determine version from signals
    if (hasPastTense && hasVersionPrefixedMilestone) {
      return { detected: '3.2.0', confidence: 'medium', signals };
    }
    if (hasPastTense) {
      return { detected: '3.1.0', confidence: 'medium', signals };
    }
    if (hasPresentTense) {
      return { detected: '3.0.0', confidence: 'medium', signals };
    }
    if (hasNumericPrefixIds) {
      return { detected: '2.0.0', confidence: 'low', signals };
    }

    // STATE.json exists but no recognizable signals
    return { detected: null, confidence: 'low', signals: [...signals, 'STATE.json present but no version signals recognized'] };
  }

  // 3. No STATE.json, check for STATE.md (pre-JSON era)
  if (fs.existsSync(stateMdPath)) {
    return { detected: '1.0.0', confidence: 'medium', signals: ['STATE.md present (pre-JSON era)'] };
  }

  // 4. No state files at all
  return { detected: null, confidence: 'low', signals: ['No state files found'] };
}

/**
 * Check if the detected version is at or beyond the current RAPID version.
 *
 * @param {string} detectedVersion - Detected version string
 * @returns {boolean} True if detectedVersion >= current RAPID version
 */
function isLatestVersion(detectedVersion) {
  return compareVersions(detectedVersion, getVersion()) >= 0;
}

// --- Backup / Restore / Cleanup ---

/**
 * Create a backup of the .planning/ directory before migration.
 *
 * @param {string} cwd - Project root directory path
 * @returns {{ backupPath: string, fileCount: number }}
 */
function createBackup(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const backupPath = path.join(planningDir, '.pre-migrate-backup');

  if (fs.existsSync(backupPath)) {
    throw new Error(`Pre-migration backup already exists at ${backupPath}. Remove it manually or run cleanup first.`);
  }

  fs.mkdirSync(backupPath, { recursive: true });

  // Copy each entry individually to avoid "cannot copy to subdirectory of self" error
  const entries = fs.readdirSync(planningDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.pre-migrate-backup') continue;
    if (entry.name === '.locks') continue;
    const src = path.join(planningDir, entry.name);
    const dest = path.join(backupPath, entry.name);
    fs.cpSync(src, dest, { recursive: true });
  }

  const fileCount = _countFiles(backupPath);
  return { backupPath, fileCount };
}

/**
 * Restore a pre-migration backup, reverting .planning/ to its pre-migration state.
 *
 * @param {string} cwd - Project root directory path
 * @returns {{ restored: boolean, fileCount: number }}
 */
function restoreBackup(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const backupPath = path.join(planningDir, '.pre-migrate-backup');

  if (!fs.existsSync(backupPath)) {
    return { restored: false, fileCount: 0 };
  }

  const fileCount = _countFiles(backupPath);

  // Remove all contents of .planning/ EXCEPT .pre-migrate-backup/
  const entries = fs.readdirSync(planningDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.pre-migrate-backup') continue;
    const fullPath = path.join(planningDir, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }

  // Copy backup contents back into .planning/
  const backupEntries = fs.readdirSync(backupPath, { withFileTypes: true });
  for (const entry of backupEntries) {
    const src = path.join(backupPath, entry.name);
    const dest = path.join(planningDir, entry.name);
    fs.cpSync(src, dest, { recursive: true });
  }

  // Remove the backup directory
  fs.rmSync(backupPath, { recursive: true, force: true });

  return { restored: true, fileCount };
}

/**
 * Remove the pre-migration backup directory after a successful migration.
 *
 * @param {string} cwd - Project root directory path
 * @returns {{ cleaned: boolean }}
 */
function cleanupBackup(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const backupPath = path.join(planningDir, '.pre-migrate-backup');

  if (!fs.existsSync(backupPath)) {
    return { cleaned: false };
  }

  fs.rmSync(backupPath, { recursive: true, force: true });
  return { cleaned: true };
}

module.exports = {
  detectVersion,
  isLatestVersion,
  createBackup,
  restoreBackup,
  cleanupBackup,
  _countFiles,
};
