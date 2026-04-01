'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CliError } = require('../lib/errors.cjs');
const { handleScaffold } = require('./scaffold.cjs');

// Helper to capture stdout.write output during a synchronous call
function captureStdout(fn) {
  const chunks = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-scaffold-cmd-test-'));
  // Create .planning/ directory (simulates a RAPID project root)
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Argument Parsing Tests ──

describe('handleScaffold argument parsing', () => {
  it('throws CliError with usage message when no subcommand given', () => {
    assert.throws(
      () => handleScaffold(tmpDir, undefined, []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'), `Expected usage message, got: ${err.message}`);
        return true;
      },
    );
  });

  it('throws CliError with usage message for invalid subcommand', () => {
    assert.throws(
      () => handleScaffold(tmpDir, 'unknown', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'), `Expected usage message, got: ${err.message}`);
        return true;
      },
    );
  });

  it('does not throw for valid run subcommand with --type flag', () => {
    // Create a package.json so detectCodebase finds something
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;');

    // Should not throw -- captures stdout to prevent test output noise
    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'run', ['--type', 'webapp']);
    });

    // Should produce valid JSON output
    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.projectType, 'webapp');
  });
});

// ── Status Subcommand Tests ──

describe('handleScaffold status subcommand', () => {
  it('outputs scaffolded:false when no report exists', () => {
    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'status', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.deepStrictEqual(parsed, { scaffolded: false });
  });

  it('outputs the report JSON when scaffold-report.json exists', () => {
    const report = {
      projectType: 'api',
      language: 'javascript',
      filesCreated: ['src/index.js'],
      filesSkipped: [],
      timestamp: '2025-06-01T00:00:00.000Z',
      detectedFrameworks: ['express'],
      reRun: false,
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'scaffold-report.json'),
      JSON.stringify(report, null, 2),
    );

    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'status', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.deepStrictEqual(parsed, report);
  });
});

// ── Run Subcommand Tests ──

describe('handleScaffold run subcommand', () => {
  it('outputs report with projectType unknown for empty project', () => {
    // No source files at all -- empty project
    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'run', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.projectType, 'unknown');
  });

  it('outputs ScaffoldReport for project with package.json and --type flag', () => {
    // Set up a minimal JS project with express dependency
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-webapp',
        dependencies: { express: '^4.0.0' },
      }),
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'server.js'), 'const app = require("express")();');

    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'run', ['--type', 'webapp']);
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.projectType, 'webapp');
    assert.equal(parsed.language, 'javascript');
    assert.ok(Array.isArray(parsed.filesCreated));
    assert.ok(typeof parsed.timestamp === 'string');
  });
});

// ── Verify-Stubs Subcommand Tests ──

describe('handleScaffold verify-stubs subcommand', () => {
  it('outputs JSON with total:0 when no stubs exist', () => {
    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'verify-stubs', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.deepStrictEqual(parsed, { total: 0, replaced: [], remaining: [] });
  });

  it('reports remaining stubs that still have RAPID-STUB marker', () => {
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });
    fs.writeFileSync(
      path.join(stubsDir, 'my-set-stub.cjs'),
      '// RAPID-STUB\n\'use strict\';\nmodule.exports = {};\n',
    );

    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'verify-stubs', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.total, 1);
    assert.deepStrictEqual(parsed.replaced, []);
    assert.deepStrictEqual(parsed.remaining, ['.rapid-stubs/my-set-stub.cjs']);
  });

  it('reports replaced stubs that no longer have RAPID-STUB marker', () => {
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });
    fs.writeFileSync(
      path.join(stubsDir, 'real-code.cjs'),
      '\'use strict\';\n// real implementation code\nmodule.exports = { foo: 42 };\n',
    );

    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'verify-stubs', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.total, 1);
    assert.deepStrictEqual(parsed.replaced, ['.rapid-stubs/real-code.cjs']);
    assert.deepStrictEqual(parsed.remaining, []);
  });

  it('checks v2 report stubs paths when available', () => {
    // Write a scaffold-report.json with stubs array (v2 field)
    const reportPath = path.join(tmpDir, '.planning', 'scaffold-report.json');
    const report = {
      projectType: 'api',
      language: 'javascript',
      filesCreated: [],
      filesSkipped: [],
      timestamp: '2025-06-01T00:00:00.000Z',
      detectedFrameworks: [],
      reRun: false,
      stubs: ['src/lib/foo.cjs'],
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Create the stub file at the reported path
    fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'lib', 'foo.cjs'),
      '// RAPID-STUB\n\'use strict\';\nmodule.exports = {};\n',
    );

    const output = captureStdout(() => {
      handleScaffold(tmpDir, 'verify-stubs', []);
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.total, 1);
    assert.deepStrictEqual(parsed.remaining, ['src/lib/foo.cjs']);
    assert.deepStrictEqual(parsed.replaced, []);
  });

  it('updates usage message to include verify-stubs', () => {
    assert.throws(
      () => handleScaffold(tmpDir, 'invalid-command', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(
          err.message.includes('verify-stubs'),
          `Expected usage message to include verify-stubs, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});
