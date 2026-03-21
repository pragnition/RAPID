'use strict';

const { execSync } = require('child_process');

/**
 * Compare two semver-like version strings.
 * Splits by '.', compares each numeric part left-to-right.
 * Missing components are treated as 0.
 *
 * @param {string} a - First version string
 * @param {string} b - Second version string
 * @returns {number} Negative if a < b, 0 if equal, positive if a > b
 */
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

/**
 * Check a single tool's availability and version.
 *
 * @param {Object} opts
 * @param {string} opts.name - Display name of the tool
 * @param {string} opts.command - Shell command to get version output
 * @param {Function} opts.parseVersion - Function(stdout) => version string or null
 * @param {string} opts.minVersion - Minimum required version
 * @param {boolean} opts.required - Whether the tool is required (fail) or optional (warn)
 * @param {string} opts.reason - Why this tool is needed
 * @returns {Promise<Object>} { name, status, version, minVersion, required, reason, message }
 */
async function checkTool({ name, command, parseVersion, minVersion, required, reason }) {
  const base = { name, minVersion, required, reason };

  let stdout;
  try {
    stdout = execSync(command, {
      stdio: 'pipe',
      timeout: 5000,
      encoding: 'utf-8',
    });
  } catch (err) {
    // Command not found or failed
    const status = required ? 'fail' : 'warn';
    const message = required
      ? `${name} is required but not found (${reason})`
      : `${name} is optional and not found (${reason})`;
    return { ...base, status, version: null, message };
  }

  // Try to parse version from output
  const version = parseVersion(stdout);
  if (version === null || version === undefined) {
    return {
      ...base,
      status: 'error',
      version: null,
      message: `Could not parse version from ${name} output`,
    };
  }

  // Compare with minimum version
  if (compareVersions(version, minVersion) >= 0) {
    return {
      ...base,
      status: 'pass',
      version,
      message: `${name} ${version} >= ${minVersion}`,
    };
  }

  // Version below minimum
  const status = required ? 'fail' : 'warn';
  const message = required
    ? `${name} ${version} < ${minVersion} (required: ${reason})`
    : `${name} ${version} < ${minVersion} (optional: ${reason})`;
  return { ...base, status, version, message };
}

/**
 * Validate all prerequisites: git, Node.js, jq.
 * Always returns ALL results (never short-circuits).
 *
 * @returns {Promise<Array>} Array of 3 result objects
 */
async function validatePrereqs() {
  const checks = [
    checkTool({
      name: 'git',
      command: 'git --version',
      parseVersion: (out) => {
        const m = out.match(/git version (\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '2.30',
      required: true,
      reason: 'needed for worktrees',
    }),
    checkTool({
      name: 'Node.js',
      command: 'node --version',
      parseVersion: (out) => {
        const m = out.match(/v?(\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '18',
      required: true,
      reason: 'runtime requirement',
    }),
    checkTool({
      name: 'jq',
      command: 'jq --version',
      parseVersion: (out) => {
        const m = out.match(/jq-(\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '1.6',
      required: false,
      reason: 'nice-to-have for JSON processing',
    }),
  ];

  // Run all checks concurrently -- never short-circuit
  const results = await Promise.all(checks);
  return results;
}

/**
 * Check if a directory is inside a git repository.
 *
 * @param {string} cwd - Directory to check
 * @returns {{ isRepo: boolean, toplevel: string|null }}
 */
function checkGitRepo(cwd) {
  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      cwd,
      stdio: 'pipe',
      timeout: 5000,
      encoding: 'utf-8',
    }).trim();
    return { isRepo: true, toplevel };
  } catch (err) {
    return { isRepo: false, toplevel: null };
  }
}

/**
 * Format prerequisite results into a markdown summary table.
 *
 * @param {Array} results - Array of checkTool results
 * @returns {{ table: string, hasBlockers: boolean, hasWarnings: boolean }}
 */
function formatPrereqSummary(results) {
  const statusIcons = {
    pass: 'Pass',
    fail: 'FAIL',
    warn: 'Warn',
    error: 'ERROR',
  };

  let hasBlockers = false;
  let hasWarnings = false;

  const rows = results.map((r) => {
    if (r.status === 'fail') hasBlockers = true;
    if (r.status === 'warn') hasWarnings = true;
    if (r.status === 'error') hasBlockers = true;

    const icon = statusIcons[r.status] || r.status;
    const ver = r.version || 'not found';
    const req = r.required ? 'required' : 'optional';
    return `| ${icon} | ${r.name} | ${ver} | ${r.minVersion}+ | ${req} | ${r.reason} |`;
  });

  const table = [
    '| Status | Tool | Version | Required | Type | Reason |',
    '|--------|------|---------|----------|------|--------|',
    ...rows,
  ].join('\n');

  return { table, hasBlockers, hasWarnings };
}

/**
 * Validate web service prerequisites (only when RAPID_WEB=true).
 * Returns check results in the same shape as checkTool() for unified display.
 *
 * @returns {Promise<Array>} Array of 3 result objects (service, database, port), or empty if web disabled
 */
async function validateWebPrereqs() {
  const { isWebEnabled, checkWebService } = require('./web-client.cjs');

  if (!isWebEnabled()) {
    return []; // Return empty array -- no web rows in doctor output
  }

  const checks = await checkWebService();

  const results = [];

  // Service running check
  results.push({
    name: 'Web Service',
    status: checks.service_running ? 'pass' : 'warn',
    version: checks.version || null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control dashboard',
    message: checks.service_running
      ? `Web service running (v${checks.version})`
      : 'Web service not running (start with: systemctl --user start rapid-web)',
  });

  // Database check
  results.push({
    name: 'Web Database',
    status: checks.db_accessible ? 'pass' : 'warn',
    version: null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control data store',
    message: checks.db_accessible
      ? 'Database connected'
      : 'Database not accessible',
  });

  // Port check
  results.push({
    name: 'Port 8998',
    status: checks.port_available ? 'pass' : 'warn',
    version: null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control endpoint',
    message: checks.port_available
      ? 'Port 8998 responding'
      : 'Port 8998 not responding',
  });

  return results;
}

module.exports = {
  compareVersions,
  checkTool,
  validatePrereqs,
  validateWebPrereqs,
  checkGitRepo,
  formatPrereqSummary,
};
