'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  classifyProjectType,
  scaffold,
  readScaffoldReport,
  generateScaffold,
} = require('./scaffold.cjs');
const { detectCodebase } = require('./context.cjs');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-scaffold-integ-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Test 1: Re-runnability ──

describe('re-runnability', () => {
  it('preserves custom file content on second run and marks reRun true', () => {
    // Create a JavaScript project
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'rerun-test', dependencies: {} }),
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'hello.js'), 'console.log("hi");');

    // First scaffold run
    const report1 = scaffold(tmpDir, {
      projectType: 'api',
      codebaseInfo: {
        hasSourceCode: true,
        languages: ['javascript'],
        frameworks: [],
        configFiles: ['package.json'],
        sourceStats: { '.js': 1 },
      },
    });
    assert.ok(report1.filesCreated.length > 0, 'First run should create files');
    assert.equal(report1.reRun, false, 'First run should not be marked as reRun');

    // Modify one of the created files with custom content
    const modifiedFile = report1.filesCreated[0];
    const modifiedPath = path.join(tmpDir, modifiedFile);
    const customContent = '// CUSTOM CONTENT -- should survive re-run\n';
    fs.writeFileSync(modifiedPath, customContent);

    // Second scaffold run
    const report2 = scaffold(tmpDir, {
      projectType: 'api',
      codebaseInfo: {
        hasSourceCode: true,
        languages: ['javascript'],
        frameworks: [],
        configFiles: ['package.json'],
        sourceStats: { '.js': 1 },
      },
    });

    assert.equal(report2.reRun, true, 'Second run should be marked as reRun');

    // Verify modified file still has custom content
    const actualContent = fs.readFileSync(modifiedPath, 'utf-8');
    assert.equal(actualContent, customContent, 'Custom content should be preserved');

    // Verify the modified file appears in filesSkipped
    const skippedPaths = report2.filesSkipped.map(s => s.path);
    assert.ok(
      skippedPaths.includes(modifiedFile),
      `Modified file ${modifiedFile} should be in filesSkipped, got: ${JSON.stringify(skippedPaths)}`,
    );
  });
});

// ── Test 2: Detect-then-scaffold pipeline ──

describe('detect-then-scaffold pipeline', () => {
  it('auto-detects API project with express and scaffolds accordingly', () => {
    // Create a project with express dependency
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'express-api',
        dependencies: { express: '^4.18.0' },
      }),
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'server.js'), 'const app = require("express")();');

    // Step 1: detectCodebase
    const codebaseInfo = detectCodebase(tmpDir);
    assert.ok(codebaseInfo.hasSourceCode, 'Should detect source code');
    assert.ok(codebaseInfo.languages.includes('javascript'), 'Should detect javascript');

    // Step 2: classifyProjectType
    const classification = classifyProjectType(codebaseInfo, tmpDir);
    assert.equal(classification.type, 'api', 'Should classify as API');

    // Step 3: scaffold with auto-detection (pass codebaseInfo to skip re-detect)
    const report = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });
    assert.equal(report.projectType, 'api');
    assert.equal(report.language, 'javascript');

    // Verify API-specific files were created
    assert.ok(
      report.filesCreated.includes('src/routes/index.js'),
      `Should create src/routes/index.js, got: ${JSON.stringify(report.filesCreated)}`,
    );
  });
});

// ── Test 3: ScaffoldReport persistence ──

describe('ScaffoldReport persistence', () => {
  it('persists report to disk and reads it back with matching fields', () => {
    // Create a minimal project
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'persist-test' }),
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'module.exports = {};');

    // Run scaffold
    const report = scaffold(tmpDir, {
      codebaseInfo: {
        hasSourceCode: true,
        languages: ['javascript'],
        frameworks: [],
        configFiles: ['package.json'],
        sourceStats: { '.js': 1 },
      },
    });

    // Verify .planning/scaffold-report.json exists on disk
    const reportPath = path.join(tmpDir, '.planning', 'scaffold-report.json');
    assert.ok(fs.existsSync(reportPath), 'scaffold-report.json should exist on disk');

    // Read it back
    const readBack = readScaffoldReport(tmpDir);
    assert.ok(readBack !== null, 'readScaffoldReport should return non-null');

    // Verify all fields match
    assert.equal(readBack.projectType, report.projectType);
    assert.equal(readBack.language, report.language);
    assert.deepStrictEqual(readBack.filesCreated, report.filesCreated);
    assert.deepStrictEqual(readBack.filesSkipped, report.filesSkipped);
    assert.equal(readBack.timestamp, report.timestamp);
    assert.deepStrictEqual(readBack.detectedFrameworks, report.detectedFrameworks);
    assert.equal(readBack.reRun, report.reRun);
  });
});

// ── Test 4: Empty project ──

describe('empty project scaffold', () => {
  it('returns projectType unknown and creates no files for empty directory', () => {
    const report = scaffold(tmpDir, {
      codebaseInfo: {
        hasSourceCode: false,
        languages: [],
        frameworks: [],
        configFiles: [],
        sourceStats: {},
      },
    });

    assert.equal(report.projectType, 'unknown', 'Should classify as unknown');
    assert.deepStrictEqual(report.filesCreated, [], 'Should create no files');
  });
});

// ── Test 5: Multiple languages ──

describe('multiple languages scaffold', () => {
  it('uses dominant language (first in languages array) for templates', () => {
    // Create a project with both package.json and requirements.txt
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'multi-lang',
        dependencies: { express: '^4.18.0' },
      }),
    );
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask\n');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;');
    fs.writeFileSync(path.join(tmpDir, 'src', 'util.js'), 'module.exports = {};');

    // Detect codebase -- javascript should be dominant since we have more JS files
    const codebaseInfo = detectCodebase(tmpDir);

    // The dominant language should be first in the array
    const dominantLang = codebaseInfo.languages[0];
    assert.ok(dominantLang, 'Should detect at least one language');

    // Scaffold with API type
    const report = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });

    // Determine what language templates were used
    if (dominantLang === 'javascript' || dominantLang === 'typescript') {
      assert.equal(report.language, 'javascript', 'Should use javascript templates for JS/TS dominant project');
    } else if (dominantLang === 'python') {
      assert.equal(report.language, 'python', 'Should use python templates for Python dominant project');
    } else {
      assert.equal(report.language, 'generic', 'Should use generic templates for other languages');
    }

    // Verify files were actually created
    assert.ok(report.filesCreated.length > 0, 'Should create template files');
  });
});
