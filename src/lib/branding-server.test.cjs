'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const server = require('./branding-server.cjs');

/**
 * Helper: make an HTTP GET request and return { status, headers, body }.
 * @param {number} port
 * @param {string} urlPath
 * @returns {Promise<{ status: number, headers: object, body: string }>}
 */
function _fetch(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

/**
 * Helper: get a free ephemeral port by briefly binding to port 0.
 * @returns {Promise<number>}
 */
function _getFreePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

describe('branding-server.cjs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-branding-test-'));
    const brandingDir = path.join(tmpDir, '.planning', 'branding');
    fs.mkdirSync(brandingDir, { recursive: true });
    fs.writeFileSync(path.join(brandingDir, 'index.html'), '<h1>Test</h1>');
  });

  afterEach(async () => {
    // Always stop any running server to avoid leaks
    try { await server.stop(tmpDir); } catch { /* ignore */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('start()', () => {
    it('starts server and returns pid and port', async () => {
      const freePort = await _getFreePort();
      const result = await server.start(tmpDir, freePort);
      assert.ok(result.pid, 'should have pid');
      assert.equal(typeof result.pid, 'number');
      assert.ok(result.port > 0, 'should have port > 0');
      assert.ok(result.server, 'should have server object');

      // Verify PID file exists and contains correct data
      const pidFilePath = path.join(tmpDir, '.planning', 'branding', '.server.pid');
      assert.ok(fs.existsSync(pidFilePath), 'PID file should exist');
      const pidData = JSON.parse(fs.readFileSync(pidFilePath, 'utf-8'));
      assert.equal(pidData.pid, result.pid);
      assert.equal(pidData.port, result.port);
    });

    it('returns error when branding directory does not exist', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-branding-nodir-'));
      try {
        const freePort = await _getFreePort();
        const result = await server.start(emptyDir, freePort);
        assert.ok(result.error, 'should have error');
        assert.ok(result.error.includes('Branding directory'), 'error should mention Branding directory');
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('returns already_running when server is active', async () => {
      const freePort = await _getFreePort();
      const first = await server.start(tmpDir, freePort);
      assert.ok(first.pid, 'first start should succeed');

      const second = await server.start(tmpDir, freePort);
      assert.equal(second.error, 'already_running');
      assert.equal(second.pid, first.pid);
      assert.equal(second.port, first.port);
    });

    it('returns port_in_use when port is occupied', async () => {
      // Start a dummy server to occupy a port
      const dummy = http.createServer();
      const dummyPort = await new Promise((resolve) => {
        dummy.listen(0, '127.0.0.1', () => {
          resolve(dummy.address().port);
        });
      });

      try {
        const result = await server.start(tmpDir, dummyPort);
        assert.equal(result.error, 'port_in_use');
      } finally {
        await new Promise((resolve) => dummy.close(resolve));
      }
    });
  });

  describe('stop()', () => {
    it('stops running server and removes PID file', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.port;

      const stopResult = await server.stop(tmpDir);
      assert.deepEqual(stopResult, { stopped: true });

      // PID file should be removed
      const pidFilePath = path.join(tmpDir, '.planning', 'branding', '.server.pid');
      assert.ok(!fs.existsSync(pidFilePath), 'PID file should be removed');

      // Connection to old port should fail
      await assert.rejects(
        () => _fetch(port, '/_health'),
        'HTTP request to stopped server should fail'
      );
    });

    it('returns not_running when no server is active', async () => {
      const result = await server.stop(tmpDir);
      assert.deepEqual(result, { error: 'not_running' });
    });
  });

  describe('status()', () => {
    it('returns running state when server is active', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);

      const st = server.status(tmpDir);
      assert.equal(st.running, true);
      assert.equal(st.pid, startResult.pid);
      assert.equal(st.port, startResult.port);
    });

    it('returns not-running when no server', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-branding-status-'));
      try {
        const st = server.status(emptyDir);
        assert.deepEqual(st, { running: false });
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it('cleans up stale PID file', () => {
      // Write a PID file with a non-existent PID
      const pidFilePath = path.join(tmpDir, '.planning', 'branding', '.server.pid');
      const staleData = { pid: 999999, port: 9999, startedAt: new Date().toISOString() };
      fs.writeFileSync(pidFilePath, JSON.stringify(staleData, null, 2) + '\n');

      const st = server.status(tmpDir);
      assert.equal(st.running, false);

      // PID file should have been cleaned up
      assert.ok(!fs.existsSync(pidFilePath), 'Stale PID file should be removed');
    });
  });

  describe('_getMimeType()', () => {
    it('returns correct MIME types', () => {
      const cases = [
        ['foo.html', 'text/html'],
        ['foo.css', 'text/css'],
        ['foo.js', 'application/javascript'],
        ['foo.json', 'application/json'],
        ['foo.md', 'text/plain; charset=utf-8'],
        ['foo.svg', 'image/svg+xml'],
        ['foo.png', 'image/png'],
        ['foo.xyz', 'application/octet-stream'],
      ];

      for (const [input, expected] of cases) {
        assert.equal(server._getMimeType(input), expected, `MIME for ${input}`);
      }
    });
  });

  describe('HTTP serving', () => {
    it('serves files from branding directory', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.server.address().port;
      const resp = await _fetch(port, '/index.html');
      assert.equal(resp.status, 200);
      assert.ok(resp.body.includes('<h1>Test</h1>'), 'should serve test HTML content');
    });

    it('returns hub page at root', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.server.address().port;
      const resp = await _fetch(port, '/');
      assert.equal(resp.status, 200);
      assert.ok(resp.body.includes('RAPID Branding Hub'), 'should contain hub title');
      assert.ok(resp.body.includes('/index.html'), 'should contain link to index.html');
    });

    it('returns 404 for missing files', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.server.address().port;
      const resp = await _fetch(port, '/nonexistent.txt');
      assert.equal(resp.status, 404);
    });

    it('blocks path traversal', async () => {
      // Create a secret file OUTSIDE the branding directory but inside tmpDir
      const secretPath = path.join(tmpDir, 'secret.txt');
      fs.writeFileSync(secretPath, 'TOP_SECRET_DATA');

      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.server.address().port;

      // Attempt traversal: branding dir is <tmpDir>/.planning/branding/
      // so ../../secret.txt would resolve to <tmpDir>/secret.txt if traversal
      // were allowed. Node's URL class normalizes /../ paths, so the
      // traversal is blocked at the URL parsing level (returns 404).
      // Either 403 or 404 is acceptable -- both prevent data leakage.
      const resp = await _fetch(port, '/../../secret.txt');
      assert.ok(
        resp.status === 403 || resp.status === 404,
        `Expected 403 or 404 but got ${resp.status}`
      );
      assert.ok(
        !resp.body.includes('TOP_SECRET_DATA'),
        'Response must NOT contain the secret file contents'
      );
    });

    it('health endpoint returns 200', async () => {
      const freePort = await _getFreePort();
      const startResult = await server.start(tmpDir, freePort);
      const port = startResult.server.address().port;
      const resp = await _fetch(port, '/_health');
      assert.equal(resp.status, 200);
      const body = JSON.parse(resp.body);
      assert.deepEqual(body, { status: 'ok' });
    });
  });

  // -------------------------------------------------------------------------
  // SSE endpoint
  // -------------------------------------------------------------------------

  /**
   * Helper: connect to the SSE endpoint and collect events.
   * Returns { res, events, req } -- caller must destroy req in afterEach.
   */
  function _connectSSE(port) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/_events`, (res) => {
        const events = [];
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep incomplete part
          for (const part of parts) {
            if (part.startsWith(':')) continue; // comment (e.g., ': connected')
            const lines = part.split('\n');
            const event = {};
            for (const line of lines) {
              if (line.startsWith('event: ')) event.type = line.slice(7);
              if (line.startsWith('data: ')) {
                try { event.data = JSON.parse(line.slice(6)); } catch { event.data = line.slice(6); }
              }
            }
            if (event.type || event.data) events.push(event);
          }
        });
        resolve({ res, events, req });
      });
      req.on('error', reject);
    });
  }

  describe('SSE endpoint (/_events)', () => {
    it('connects and receives initial comment', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const { res, req } = await _connectSSE(freePort);
      try {
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'text/event-stream');
      } finally {
        req.destroy();
      }
    });

    it('receives events from notifyClients', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const { events, req } = await _connectSSE(freePort);
      try {
        // Give the connection a moment to register
        await new Promise((r) => setTimeout(r, 50));

        server.notifyClients('artifact-created', { id: 'test-1', type: 'logo' });

        // Wait for event propagation
        await new Promise((r) => setTimeout(r, 50));

        assert.ok(events.length >= 1, `Expected at least 1 event, got ${events.length}`);
        const evt = events.find((e) => e.type === 'artifact-created');
        assert.ok(evt, 'should receive artifact-created event');
        assert.equal(evt.data.id, 'test-1');
        assert.equal(evt.data.type, 'logo');
      } finally {
        req.destroy();
      }
    });

    it('enforces max 10 concurrent connections', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const connections = [];
      try {
        // Open MAX_SSE_CLIENTS connections
        for (let i = 0; i < server.MAX_SSE_CLIENTS; i++) {
          connections.push(await _connectSSE(freePort));
        }
        await new Promise((r) => setTimeout(r, 50));

        // The 11th should get 503
        const resp = await _fetch(freePort, '/_events');
        assert.equal(resp.status, 503);
      } finally {
        for (const c of connections) c.req.destroy();
      }
    });

    it('cleans up connections on client disconnect', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const { req } = await _connectSSE(freePort);
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(server._sseClients.size, 1);

      req.destroy();
      await new Promise((r) => setTimeout(r, 50));

      // Trigger cleanup by notifying -- stale connections are removed
      server.notifyClients('ping', {});
      assert.equal(server._sseClients.size, 0);
    });

    it('stop() closes all SSE connections', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const connections = [];
      connections.push(await _connectSSE(freePort));
      connections.push(await _connectSSE(freePort));
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(server._sseClients.size, 2);

      await server.stop(tmpDir);
      assert.equal(server._sseClients.size, 0);

      // Clean up refs (already destroyed by server.stop)
      for (const c of connections) c.req.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // _escapeHtml
  // -------------------------------------------------------------------------

  describe('_escapeHtml()', () => {
    it('escapes HTML special characters', () => {
      assert.equal(
        server._escapeHtml('<script>alert("xss")</script>'),
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      assert.equal(server._escapeHtml('a & b'), 'a &amp; b');
      assert.equal(server._escapeHtml("it's"), 'it&#39;s');
    });

    it('returns safe strings unchanged', () => {
      assert.equal(server._escapeHtml('hello world'), 'hello world');
    });
  });

  // -------------------------------------------------------------------------
  // fs.watch integration
  // -------------------------------------------------------------------------

  describe('fs.watch integration', () => {
    it('file changes trigger SSE events', async () => {
      const freePort = await _getFreePort();
      await server.start(tmpDir, freePort);

      const { events, req } = await _connectSSE(freePort);
      try {
        await new Promise((r) => setTimeout(r, 50));

        // Write a new file to the branding directory
        const brandingDir = path.join(tmpDir, '.planning', 'branding');
        fs.writeFileSync(path.join(brandingDir, 'new-asset.png'), 'data');

        // Wait for debounce (300ms) + propagation
        await new Promise((r) => setTimeout(r, 600));

        const fileChanged = events.find((e) => e.type === 'file-changed');
        assert.ok(fileChanged, 'should receive file-changed event');
        assert.ok(fileChanged.data.directory, 'event should include directory');
        assert.ok(fileChanged.data.timestamp, 'event should include timestamp');
      } finally {
        req.destroy();
      }
    });
  });
});
