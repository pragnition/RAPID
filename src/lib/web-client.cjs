'use strict';

/**
 * Web client module for RAPID CLI <-> Python web backend integration.
 *
 * Provides HTTP helpers gated by RAPID_WEB=true, with 2-second timeouts
 * and graceful failure. All functions never throw -- they return error
 * states instead, letting callers decide how to handle failures.
 *
 * @module web-client
 */

const path = require('path');
const fs = require('fs');
const net = require('net');

// --- Internal Helpers ---

/**
 * Parse a .env file and return key-value pairs.
 * Handles lines like KEY=value, KEY="value", and comments.
 *
 * @param {string} filePath - Absolute path to .env file
 * @returns {Object<string, string>} Parsed key-value pairs
 */
function _parseEnvFile(filePath) {
  const entries = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      entries[key] = value;
    }
  } catch {
    // File not found or unreadable -- return empty
  }
  return entries;
}

/**
 * Resolve the RAPID plugin root directory from the RAPID_TOOLS env var.
 *
 * @returns {string|null} Absolute path to plugin root, or null if undetermined
 */
function _getPluginRoot() {
  const rapidTools = process.env.RAPID_TOOLS;
  if (!rapidTools) return null;
  try {
    // RAPID_TOOLS points to src/bin/rapid-tools.cjs
    // Plugin root is two levels up: src/bin/rapid-tools.cjs -> src/bin -> src -> root
    return path.resolve(path.dirname(rapidTools), '../..');
  } catch {
    return null;
  }
}

// --- Public API ---

/**
 * Check whether web integration is enabled.
 *
 * Checks process.env.RAPID_WEB first. If not set, falls back to reading
 * the .env file at the RAPID plugin root (derived from RAPID_TOOLS).
 *
 * @returns {boolean} true if RAPID_WEB is set to 'true' (case-insensitive)
 */
function isWebEnabled() {
  try {
    // Check environment variable first
    const envVal = process.env.RAPID_WEB;
    if (envVal !== undefined && envVal !== '') {
      return envVal.toLowerCase() === 'true';
    }

    // Fall back to .env file at plugin root
    const pluginRoot = _getPluginRoot();
    if (!pluginRoot) return false;

    const envFilePath = path.join(pluginRoot, '.env');
    const envVars = _parseEnvFile(envFilePath);
    const fileVal = envVars.RAPID_WEB;
    if (fileVal !== undefined && fileVal !== '') {
      return fileVal.toLowerCase() === 'true';
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the base URL for the web backend service.
 *
 * @returns {string} Base URL like http://127.0.0.1:8998
 */
function getWebBaseUrl() {
  const host = process.env.RAPID_WEB_HOST || '127.0.0.1';
  const port = process.env.RAPID_WEB_PORT || '8998';
  return `http://${host}:${port}`;
}

/**
 * Register a project with the web backend.
 *
 * Makes a POST to /api/projects with the project path and name.
 * Uses a 2-second timeout. Never throws.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function registerProjectWithWeb(projectRoot) {
  if (!isWebEnabled()) {
    return { success: false, error: 'RAPID_WEB not enabled' };
  }

  try {
    const projectName = path.basename(projectRoot);
    const url = `${getWebBaseUrl()}/api/projects`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot, name: projectName }),
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check the health and availability of the web backend service.
 *
 * Runs three concurrent checks:
 * 1. GET /api/health -- service running and version
 * 2. GET /api/ready -- database accessibility
 * 3. TCP connect to port -- port availability
 *
 * Never throws. Returns partial results when some checks fail.
 *
 * @returns {Promise<{service_running: boolean, version?: string, db_accessible: boolean, port_available: boolean}>}
 */
async function checkWebService() {
  if (!isWebEnabled()) {
    return { service_running: false, db_accessible: false, port_available: false };
  }

  const baseUrl = getWebBaseUrl();

  // Parse host and port for TCP check
  let tcpHost = '127.0.0.1';
  let tcpPort = 8998;
  try {
    const urlObj = new URL(baseUrl);
    tcpHost = urlObj.hostname;
    tcpPort = parseInt(urlObj.port, 10) || 8998;
  } catch {
    // Use defaults
  }

  const result = {
    service_running: false,
    db_accessible: false,
    port_available: false,
  };

  // Health check
  const healthCheck = async () => {
    try {
      const resp = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'ok') {
          result.service_running = true;
          if (data.version) {
            result.version = data.version;
          }
        }
      }
    } catch {
      // Service not running or unreachable
    }
  };

  // Ready/DB check
  const readyCheck = async () => {
    try {
      const resp = await fetch(`${baseUrl}/api/ready`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.database === 'connected') {
          result.db_accessible = true;
        }
      }
    } catch {
      // DB not accessible
    }
  };

  // Port/TCP check
  const portCheck = () => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.on('connect', () => {
        result.port_available = true;
        socket.destroy();
        resolve();
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        resolve();
      });

      socket.connect(tcpPort, tcpHost);
    });
  };

  await Promise.allSettled([healthCheck(), readyCheck(), portCheck()]);

  return result;
}

// --- Exports ---

module.exports = {
  isWebEnabled,
  registerProjectWithWeb,
  checkWebService,
};
