'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = require('./branding-artifacts.cjs');

const DEFAULT_PORT = 3141;
const PID_FILE_NAME = '.server.pid';
const BRANDING_DIR_NAME = path.join('.planning', 'branding');
const HEALTH_PROBE_TIMEOUT = 1000;

/** @type {import('node:http').Server|null} */
let _activeServer = null;

/** @type {Set<import('node:http').ServerResponse>} */
let _sseClients = new Set();
const MAX_SSE_CLIENTS = 10;

/** @type {import('node:fs').FSWatcher|null} */
let _fsWatcher = null;

/** @type {NodeJS.Timeout|null} */
let _debounceTimer = null;
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns absolute path to the branding directory, or null if it does not exist.
 * @param {string} projectRoot
 * @returns {string|null}
 */
function _getBrandingDir(projectRoot) {
  const dir = path.join(projectRoot, BRANDING_DIR_NAME);
  try {
    const stat = fs.statSync(dir);
    return stat.isDirectory() ? dir : null;
  } catch {
    return null;
  }
}

/**
 * Returns absolute path to the PID file.
 * @param {string} projectRoot
 * @returns {string}
 */
function _getPidFilePath(projectRoot) {
  return path.join(projectRoot, BRANDING_DIR_NAME, PID_FILE_NAME);
}

/**
 * Reads and parses the PID file. Returns null if missing or malformed.
 * @param {string} projectRoot
 * @returns {{ pid: number, port: number, startedAt: string }|null}
 */
function _readPidFile(projectRoot) {
  try {
    const raw = fs.readFileSync(_getPidFilePath(projectRoot), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Writes the PID file with current process info.
 * @param {string} projectRoot
 * @param {number} pid
 * @param {number} port
 */
function _writePidFile(projectRoot, pid, port) {
  const data = { pid, port, startedAt: new Date().toISOString() };
  fs.writeFileSync(_getPidFilePath(projectRoot), JSON.stringify(data, null, 2) + '\n');
}

/**
 * Removes the PID file if it exists. Never throws.
 * @param {string} projectRoot
 */
function _removePidFile(projectRoot) {
  try {
    fs.unlinkSync(_getPidFilePath(projectRoot));
  } catch {
    // Ignore -- file may not exist
  }
}

/**
 * Check whether a process is alive using signal 0.
 * @param {number} pid
 * @returns {boolean}
 */
function _isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * HTTP health probe against localhost:{port}/_health with timeout.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function _httpHealthProbe(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/_health`,
      { timeout: HEALTH_PROBE_TIMEOUT },
      (res) => {
        // Consume response data to free up memory
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Returns true if the PID data is stale (process dead OR health probe fails).
 * @param {{ pid: number, port: number }} pidData
 * @returns {Promise<boolean>}
 */
async function _isStale(pidData) {
  if (!_isProcessAlive(pidData.pid)) return true;
  const healthy = await _httpHealthProbe(pidData.port);
  return !healthy;
}

/**
 * Returns MIME type for a file extension.
 * @param {string} filePath
 * @returns {string}
 */
function _getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.md': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Generates a styled hub page listing branding directory contents.
 * @param {string} brandingDir
 * @returns {string}
 */
function _generateHubPage(brandingDir) {
  let entries;
  try {
    entries = fs.readdirSync(brandingDir);
  } catch {
    entries = [];
  }

  // Filter out the PID file
  const files = entries.filter((e) => {
    if (e === PID_FILE_NAME) return false;
    try {
      return fs.statSync(path.join(brandingDir, e)).isFile();
    } catch {
      return false;
    }
  });

  const hasIndex = files.includes('index.html');
  const otherFiles = files.filter((f) => f !== 'index.html');

  const fileLinks = otherFiles
    .map((f) => `        <li><a href="/${f}">${f}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAPID Branding Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1rem;
    }
    h1 { color: #58a6ff; margin-bottom: 2rem; font-size: 1.8rem; }
    .preview-link {
      display: inline-block;
      background: #58a6ff;
      color: #0d1117;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 2rem;
      transition: opacity 0.2s;
    }
    .preview-link:hover { opacity: 0.85; }
    h2 { color: #8b949e; font-size: 1rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    ul { list-style: none; }
    li { margin-bottom: 0.5rem; }
    li a {
      color: #58a6ff;
      text-decoration: none;
      padding: 0.25rem 0;
      display: inline-block;
    }
    li a:hover { text-decoration: underline; }
    .footer {
      margin-top: auto;
      padding-top: 2rem;
      color: #484f58;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <h1>RAPID Branding Hub</h1>
${hasIndex ? '  <a class="preview-link" href="/index.html">Visual Preview</a>\n' : ''}  <div>
${otherFiles.length > 0 ? `    <h2>Files</h2>\n    <ul>\n${fileLinks}\n    </ul>` : ''}
  </div>
  <div class="footer">Served by RAPID branding-server on port ${DEFAULT_PORT}</div>
</body>
</html>`;
}

/**
 * Read and parse a JSON request body with a 64KB size limit.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<*>}
 */
function _readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const MAX_BODY_SIZE = 64 * 1024; // 64KB
    const chunks = [];
    let totalSize = 0;

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

// ---------------------------------------------------------------------------
// SSE infrastructure
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send an SSE event to all connected clients.
 * Stale connections are removed automatically.
 * @param {string} event - Event type name
 * @param {*} data - JSON-serializable data payload
 */
function notifyClients(event, data) {
  for (const res of _sseClients) {
    if (res.writableEnded) {
      _sseClients.delete(res);
      continue;
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Handle an incoming SSE connection request.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function _handleSSE(req, res) {
  if (_sseClients.size >= MAX_SSE_CLIENTS) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many SSE connections' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');

  _sseClients.add(res);

  req.on('close', () => {
    _sseClients.delete(res);
  });
}

/**
 * Start watching the branding directory for file changes.
 * Debounces events and notifies SSE clients.
 * @param {string} brandingDir - Absolute path to the branding directory
 */
function _startFileWatcher(brandingDir) {
  try {
    _fsWatcher = fs.watch(brandingDir, { recursive: false }, () => {
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        notifyClients('file-changed', {
          directory: brandingDir,
          timestamp: new Date().toISOString(),
        });
      }, DEBOUNCE_MS);
    });
  } catch {
    // Directory may not exist or watcher may fail -- non-fatal
    _fsWatcher = null;
  }
}

/**
 * Stop the file watcher if active.
 */
function _stopFileWatcher() {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  if (_fsWatcher) {
    _fsWatcher.close();
    _fsWatcher = null;
  }
}

/**
 * Close all active SSE client connections.
 */
function _closeAllSSEClients() {
  for (const res of _sseClients) {
    if (!res.writableEnded) {
      res.end();
    }
  }
  _sseClients.clear();
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

/**
 * HTTP request handler for the branding server.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} brandingDir
 * @param {string} projectRoot
 */
function _handleRequest(req, res, brandingDir, projectRoot) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  // Health endpoint
  if (req.method === 'GET' && pathname === '/_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }

  // SSE endpoint
  if (req.method === 'GET' && pathname === '/_events') {
    _handleSSE(req, res);
    return;
  }

  // Artifact CRUD endpoints
  if (req.method === 'POST' && pathname === '/_artifacts') {
    _readRequestBody(req)
      .then((body) => {
        const { type, filename, description } = body || {};
        if (!type || !filename || !description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields: type, filename, description' }));
          return;
        }
        const entry = artifacts.createArtifact(projectRoot, { type, filename, description });
        notifyClients('artifact-created', entry);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entry));
      })
      .catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  if (req.method === 'GET' && pathname === '/_artifacts') {
    try {
      const list = artifacts.listArtifacts(projectRoot);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'DELETE' && pathname === '/_artifacts') {
    const id = url.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required query parameter: id' }));
      return;
    }
    try {
      const result = artifacts.deleteArtifact(projectRoot, id);
      if (result.deleted) {
        notifyClients('artifact-deleted', { id, ...result.entry });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Artifact not found', id }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Hub page
  if (req.method === 'GET' && pathname === '/') {
    const html = _generateHubPage(brandingDir, projectRoot);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Static file serving
  if (req.method === 'GET') {
    // Strip leading slash to get relative file path
    const relPath = pathname.replace(/^\/+/, '');
    if (!relPath) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem"><h1>404 Not Found</h1></body></html>');
      return;
    }

    const resolved = path.resolve(brandingDir, relPath);

    // Path traversal prevention
    if (!resolved.startsWith(brandingDir + path.sep) && resolved !== brandingDir) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem"><h1>403 Forbidden</h1></body></html>');
      return;
    }

    // Only serve files, not directories
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem"><h1>404 Not Found</h1></body></html>');
        return;
      }
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem"><h1>404 Not Found</h1></body></html>');
      return;
    }

    const mimeType = _getMimeType(resolved);
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  // Method not allowed
  res.writeHead(405, { 'Content-Type': 'text/html' });
  res.end('<html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem"><h1>405 Method Not Allowed</h1></body></html>');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the branding server on the given port.
 * @param {string} projectRoot - Absolute path to project root
 * @param {number} [port] - Port to listen on (default: 3141)
 * @returns {Promise<{ pid?: number, port?: number, server?: import('node:http').Server, error?: string }>}
 */
async function start(projectRoot, port) {
  port = port || DEFAULT_PORT;

  const brandingDir = _getBrandingDir(projectRoot);
  if (!brandingDir) {
    return { error: 'Branding directory does not exist. Run /rapid:branding first.' };
  }

  const pidData = _readPidFile(projectRoot);
  if (pidData) {
    const stale = await _isStale(pidData);
    if (!stale) {
      return { error: 'already_running', pid: pidData.pid, port: pidData.port };
    }
    _removePidFile(projectRoot);
  }

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => _handleRequest(req, res, brandingDir, projectRoot));

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ error: 'port_in_use', port });
      } else {
        resolve({ error: err.message });
      }
    });

    server.listen(port, '127.0.0.1', () => {
      _writePidFile(projectRoot, process.pid, port);
      _activeServer = server;
      _startFileWatcher(brandingDir);
      resolve({ pid: process.pid, port, server });
    });
  });
}

/**
 * Stop the branding server.
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Promise<{ stopped?: boolean, error?: string }>}
 */
async function stop(projectRoot) {
  const pidData = _readPidFile(projectRoot);
  if (!pidData) {
    return { error: 'not_running' };
  }

  if (_activeServer) {
    _closeAllSSEClients();
    _stopFileWatcher();
    await new Promise((resolve) => {
      _activeServer.close(resolve);
    });
    _activeServer = null;
  }

  _removePidFile(projectRoot);
  return { stopped: true };
}

/**
 * Check server status (synchronous -- uses only PID signal check).
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ running: boolean, pid?: number, port?: number }}
 */
function status(projectRoot) {
  const pidData = _readPidFile(projectRoot);
  if (!pidData) {
    return { running: false };
  }

  if (_isProcessAlive(pidData.pid)) {
    return { running: true, pid: pidData.pid, port: pidData.port };
  }

  // Stale PID file -- clean up
  _removePidFile(projectRoot);
  return { running: false };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  start,
  stop,
  status,
  DEFAULT_PORT,
  // Export internals for testing (prefixed)
  _isProcessAlive,
  _httpHealthProbe,
  _getMimeType,
  _generateHubPage,
  _readPidFile,
  _writePidFile,
  _removePidFile,
  // SSE infrastructure
  notifyClients,
  _escapeHtml,
  get _sseClients() { return _sseClients; },
  MAX_SSE_CLIENTS,
};
