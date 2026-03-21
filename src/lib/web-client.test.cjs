'use strict';

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');

const {
  isWebEnabled,
  registerProjectWithWeb,
  checkWebService,
} = require('./web-client.cjs');

// --- isWebEnabled ---

describe('isWebEnabled()', () => {
  let savedRapidWeb;
  let savedRapidTools;

  beforeEach(() => {
    savedRapidWeb = process.env.RAPID_WEB;
    savedRapidTools = process.env.RAPID_TOOLS;
    delete process.env.RAPID_WEB;
    delete process.env.RAPID_TOOLS;
  });

  afterEach(() => {
    if (savedRapidWeb !== undefined) {
      process.env.RAPID_WEB = savedRapidWeb;
    } else {
      delete process.env.RAPID_WEB;
    }
    if (savedRapidTools !== undefined) {
      process.env.RAPID_TOOLS = savedRapidTools;
    } else {
      delete process.env.RAPID_TOOLS;
    }
  });

  it('returns true when RAPID_WEB is "true"', () => {
    process.env.RAPID_WEB = 'true';
    assert.strictEqual(isWebEnabled(), true);
  });

  it('returns true when RAPID_WEB is "TRUE" (case-insensitive)', () => {
    process.env.RAPID_WEB = 'TRUE';
    assert.strictEqual(isWebEnabled(), true);
  });

  it('returns true when RAPID_WEB is "True" (mixed case)', () => {
    process.env.RAPID_WEB = 'True';
    assert.strictEqual(isWebEnabled(), true);
  });

  it('returns false when RAPID_WEB is "false"', () => {
    process.env.RAPID_WEB = 'false';
    assert.strictEqual(isWebEnabled(), false);
  });

  it('returns false when RAPID_WEB is empty string', () => {
    process.env.RAPID_WEB = '';
    assert.strictEqual(isWebEnabled(), false);
  });

  it('returns false when RAPID_WEB is unset and RAPID_TOOLS is not set', () => {
    assert.strictEqual(isWebEnabled(), false);
  });

  it('returns false when RAPID_WEB is unset and .env does not contain RAPID_WEB', () => {
    // Create a temp dir simulating plugin root with a .env that lacks RAPID_WEB
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    const binDir = path.join(tmpDir, 'src', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SOME_OTHER_VAR=hello\n');
    process.env.RAPID_TOOLS = path.join(binDir, 'rapid-tools.cjs');

    try {
      assert.strictEqual(isWebEnabled(), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns true when env var is unset but .env file contains RAPID_WEB=true', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    const binDir = path.join(tmpDir, 'src', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.env'), 'RAPID_WEB=true\nOTHER=val\n');
    process.env.RAPID_TOOLS = path.join(binDir, 'rapid-tools.cjs');

    try {
      assert.strictEqual(isWebEnabled(), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns true when .env file has RAPID_WEB="true" (quoted)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    const binDir = path.join(tmpDir, 'src', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.env'), 'RAPID_WEB="true"\n');
    process.env.RAPID_TOOLS = path.join(binDir, 'rapid-tools.cjs');

    try {
      assert.strictEqual(isWebEnabled(), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('never throws when RAPID_TOOLS points to nonexistent path', () => {
    process.env.RAPID_TOOLS = '/nonexistent/path/src/bin/rapid-tools.cjs';
    assert.doesNotThrow(() => {
      const result = isWebEnabled();
      assert.strictEqual(result, false);
    });
  });

  it('never throws when .env file is unreadable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    const binDir = path.join(tmpDir, 'src', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    // No .env file at all
    process.env.RAPID_TOOLS = path.join(binDir, 'rapid-tools.cjs');

    try {
      assert.doesNotThrow(() => {
        const result = isWebEnabled();
        assert.strictEqual(result, false);
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- registerProjectWithWeb ---

describe('registerProjectWithWeb()', () => {
  let savedRapidWeb;
  let savedFetch;

  beforeEach(() => {
    savedRapidWeb = process.env.RAPID_WEB;
    savedFetch = global.fetch;
    delete process.env.RAPID_WEB;
  });

  afterEach(() => {
    if (savedRapidWeb !== undefined) {
      process.env.RAPID_WEB = savedRapidWeb;
    } else {
      delete process.env.RAPID_WEB;
    }
    global.fetch = savedFetch;
  });

  it('returns {success: false} when RAPID_WEB is not enabled', async () => {
    const result = await registerProjectWithWeb('/home/user/myproject');
    assert.deepStrictEqual(result, {
      success: false,
      error: 'RAPID_WEB not enabled',
    });
  });

  it('does not call fetch when RAPID_WEB is not enabled', async () => {
    const mockFetch = mock.fn();
    global.fetch = mockFetch;

    await registerProjectWithWeb('/home/user/myproject');
    assert.strictEqual(mockFetch.mock.callCount(), 0);
  });

  it('returns {success: true} when fetch succeeds with 2xx', async () => {
    process.env.RAPID_WEB = 'true';
    global.fetch = mock.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'abc', status: 'active' }),
      })
    );

    const result = await registerProjectWithWeb('/home/user/myproject');
    assert.deepStrictEqual(result, { success: true });
  });

  it('returns {success: false} when fetch returns non-2xx', async () => {
    process.env.RAPID_WEB = 'true';
    global.fetch = mock.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    const result = await registerProjectWithWeb('/home/user/myproject');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('500'));
  });

  it('returns {success: false} when fetch rejects with network error', async () => {
    process.env.RAPID_WEB = 'true';
    global.fetch = mock.fn(() =>
      Promise.reject(new Error('fetch failed'))
    );

    const result = await registerProjectWithWeb('/home/user/myproject');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('fetch failed'));
  });

  it('calls fetch with correct URL and body', async () => {
    process.env.RAPID_WEB = 'true';
    const mockFetch = mock.fn(() =>
      Promise.resolve({ ok: true, status: 200 })
    );
    global.fetch = mockFetch;

    await registerProjectWithWeb('/home/user/myproject');

    assert.strictEqual(mockFetch.mock.callCount(), 1);
    const call = mockFetch.mock.calls[0];
    const [url, options] = call.arguments;

    assert.strictEqual(url, 'http://127.0.0.1:8998/api/projects');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/json');

    const body = JSON.parse(options.body);
    assert.strictEqual(body.path, '/home/user/myproject');
    assert.strictEqual(body.name, 'myproject');
  });

  it('uses AbortSignal.timeout(2000) in fetch options', async () => {
    process.env.RAPID_WEB = 'true';
    const mockFetch = mock.fn(() =>
      Promise.resolve({ ok: true, status: 200 })
    );
    global.fetch = mockFetch;

    await registerProjectWithWeb('/home/user/myproject');

    const call = mockFetch.mock.calls[0];
    const [, options] = call.arguments;
    assert.ok(options.signal, 'fetch should be called with a signal');
    // AbortSignal.timeout creates an AbortSignal instance
    assert.ok(options.signal instanceof AbortSignal, 'signal should be an AbortSignal');
  });

  it('never throws on any error', async () => {
    process.env.RAPID_WEB = 'true';
    global.fetch = mock.fn(() => {
      throw new Error('synchronous throw');
    });

    const result = await registerProjectWithWeb('/home/user/myproject');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('synchronous throw'));
  });
});

// --- checkWebService ---

describe('checkWebService()', () => {
  let savedRapidWeb;
  let savedFetch;

  beforeEach(() => {
    savedRapidWeb = process.env.RAPID_WEB;
    savedFetch = global.fetch;
    delete process.env.RAPID_WEB;
  });

  afterEach(() => {
    if (savedRapidWeb !== undefined) {
      process.env.RAPID_WEB = savedRapidWeb;
    } else {
      delete process.env.RAPID_WEB;
    }
    global.fetch = savedFetch;
  });

  it('returns all-false when RAPID_WEB is not enabled', async () => {
    const result = await checkWebService();
    assert.deepStrictEqual(result, {
      service_running: false,
      db_accessible: false,
      port_available: false,
    });
  });

  it('does not call fetch when RAPID_WEB is not enabled', async () => {
    const mockFetch = mock.fn();
    global.fetch = mockFetch;

    await checkWebService();
    assert.strictEqual(mockFetch.mock.callCount(), 0);
  });

  it('returns service_running=true with version when health check passes', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', version: '1.2.3' }),
        });
      }
      if (url.includes('/api/ready')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ database: 'disconnected' }),
        });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.service_running, true);
    assert.strictEqual(result.version, '1.2.3');
  });

  it('returns db_accessible=true when ready check passes', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', version: '1.0.0' }),
        });
      }
      if (url.includes('/api/ready')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ database: 'connected' }),
        });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.db_accessible, true);
  });

  it('returns partial results when health passes but ready fails', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', version: '2.0.0' }),
        });
      }
      if (url.includes('/api/ready')) {
        return Promise.reject(new Error('connection refused'));
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.service_running, true);
    assert.strictEqual(result.version, '2.0.0');
    assert.strictEqual(result.db_accessible, false);
  });

  it('returns partial results when ready passes but health fails', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.reject(new Error('connection refused'));
      }
      if (url.includes('/api/ready')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ database: 'connected' }),
        });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.service_running, false);
    assert.strictEqual(result.version, undefined);
    assert.strictEqual(result.db_accessible, true);
  });

  it('never throws even when all checks fail simultaneously', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn(() =>
      Promise.reject(new Error('everything is broken'))
    );

    let result;
    await assert.doesNotReject(async () => {
      result = await checkWebService();
    });
    assert.strictEqual(result.service_running, false);
    assert.strictEqual(result.db_accessible, false);
    // port_available depends on actual port state -- just verify it's boolean
    assert.strictEqual(typeof result.port_available, 'boolean');
  });

  it('returns service_running=false when health returns non-ok status', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'degraded', version: '1.0.0' }),
        });
      }
      if (url.includes('/api/ready')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ database: 'connected' }),
        });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.service_running, false);
    assert.strictEqual(result.version, undefined);
  });

  it('returns service_running=false when health returns non-2xx', async () => {
    process.env.RAPID_WEB = 'true';

    global.fetch = mock.fn((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        });
      }
      if (url.includes('/api/ready')) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.reject(new Error('unexpected url'));
    });

    const result = await checkWebService();
    assert.strictEqual(result.service_running, false);
    assert.strictEqual(result.db_accessible, false);
  });
});
