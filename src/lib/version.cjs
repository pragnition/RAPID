'use strict';

const path = require('path');
const fs = require('fs');
const { compareVersions } = require('./prereqs.cjs');

const META_FILENAME = '.rapid-install-meta.json';
const DEFAULT_THRESHOLD_DAYS = 7;

/**
 * Get the current RAPID version from package.json.
 *
 * @returns {string} The version string (e.g., '3.0.0')
 */
function getVersion() {
  const pkgPath = path.resolve(__dirname, '../../package.json');
  const pkg = require(pkgPath);
  return pkg.version;
}

/**
 * Check whether an installed version needs updating relative to the current version.
 *
 * Uses compareVersions from prereqs.cjs for semver comparison.
 *
 * @param {string} installed - The installed version string
 * @param {string} current - The current (latest) version string
 * @returns {{ needsUpdate: boolean, installed: string, current: string }}
 */
function versionCheck(installed, current) {
  const needsUpdate = compareVersions(installed, current) < 0;
  return { needsUpdate, installed, current };
}

/**
 * Write the current ISO 8601 install timestamp to .rapid-install-meta.json
 * at the given plugin root. Overwrites any existing file. Throws on I/O failure
 * -- callers (e.g. setup.sh) are responsible for guarding.
 *
 * @param {string} pluginRoot - Absolute path to plugin root (parent of src/)
 * @returns {void}
 */
function writeInstallTimestamp(pluginRoot) {
  const metaPath = path.join(pluginRoot, META_FILENAME);
  const payload = JSON.stringify({ installedAt: new Date().toISOString() });
  fs.writeFileSync(metaPath, payload);
}

/**
 * Read the install timestamp from .rapid-install-meta.json at the given plugin
 * root. Returns null on missing file, parse error, or missing field. Never
 * throws -- this is a fail-safe read.
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @returns {string | null} ISO 8601 timestamp or null
 */
function readInstallTimestamp(pluginRoot) {
  try {
    const metaPath = path.join(pluginRoot, META_FILENAME);
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.installedAt === 'string' ? parsed.installedAt : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Determine whether the recorded install is older than the staleness threshold.
 * Resolution order for the threshold:
 *   1. Explicit `thresholdDays` argument (if defined)
 *   2. RAPID_UPDATE_THRESHOLD_DAYS env var (if parseable as positive integer)
 *   3. DEFAULT_THRESHOLD_DAYS (7)
 *
 * Returns false when no timestamp is recorded (fail-safe -- a missing meta
 * file should never produce a staleness banner).
 *
 * @param {string} pluginRoot - Absolute path to plugin root
 * @param {number} [thresholdDays] - Optional explicit threshold in days
 * @returns {boolean} true if install is older than threshold
 */
function isUpdateStale(pluginRoot, thresholdDays) {
  const timestamp = readInstallTimestamp(pluginRoot);
  if (timestamp === null) return false;

  let threshold;
  if (thresholdDays !== undefined) {
    threshold = thresholdDays;
  } else {
    const envValue = parseInt(process.env.RAPID_UPDATE_THRESHOLD_DAYS, 10);
    threshold = Number.isFinite(envValue) && envValue > 0 ? envValue : DEFAULT_THRESHOLD_DAYS;
  }

  const installedAt = new Date(timestamp).getTime();
  if (Number.isNaN(installedAt)) return false;
  const ageDays = (Date.now() - installedAt) / 86400000;
  return ageDays > threshold;
}

module.exports = {
  getVersion,
  versionCheck,
  writeInstallTimestamp,
  readInstallTimestamp,
  isUpdateStale,
};
