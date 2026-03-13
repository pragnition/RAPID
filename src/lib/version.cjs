'use strict';

const path = require('path');
const { compareVersions } = require('./prereqs.cjs');

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

module.exports = {
  getVersion,
  versionCheck,
};
