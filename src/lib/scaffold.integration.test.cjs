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
  writeScaffoldReport,
  generateScaffold,
  buildScaffoldReportV2,
} = require('./scaffold.cjs');
const { detectCodebase } = require('./context.cjs');
const { generateStub, isRapidStub, cleanupStubSidecars } = require('./stub.cjs');
const { resolveConflicts } = require('./merge.cjs');

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

// ── Test 6: Stub Lifecycle Integration ──

describe('stub lifecycle integration', () => {
  it('full stub lifecycle: generate -> verify -> replace -> verify', () => {
    // Create a contract with 1 exported function that returns a string
    const contract = {
      exports: {
        functions: [
          {
            name: 'getUserName',
            params: [{ name: 'userId', type: 'string' }],
            returns: 'string',
          },
        ],
        types: [],
      },
    };

    // Generate stub content from the contract
    const stubContent = generateStub(contract, 'user-service');

    // Write it to a file in .rapid-stubs/
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });
    const stubFile = path.join(stubsDir, 'user-service-stub.cjs');
    fs.writeFileSync(stubFile, stubContent, 'utf-8');

    // Write a zero-byte .rapid-stub sidecar next to it
    const sidecarFile = `${stubFile}.rapid-stub`;
    fs.writeFileSync(sidecarFile, '', 'utf-8');

    // Verify the generated content is detected as a RAPID stub
    const content1 = fs.readFileSync(stubFile, 'utf-8');
    assert.ok(isRapidStub(content1), 'Generated stub should be detected as RAPID stub');

    // Overwrite with real implementation code (first line is NOT // RAPID-STUB)
    const realCode = "'use strict';\n\nfunction getUserName(userId) {\n  return `User ${userId}`;\n}\n\nmodule.exports = { getUserName };\n";
    fs.writeFileSync(stubFile, realCode, 'utf-8');

    // Verify it is no longer detected as a RAPID stub
    const content2 = fs.readFileSync(stubFile, 'utf-8');
    assert.ok(!isRapidStub(content2), 'Real implementation should NOT be detected as RAPID stub');
  });

  it('sidecar cleanup removes both stub and sidecar files', () => {
    // Create a .rapid-stubs/ dir with stub file + sidecar
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });

    const stubFile = path.join(stubsDir, 'dep-set-stub.cjs');
    const sidecarFile = `${stubFile}.rapid-stub`;
    fs.writeFileSync(stubFile, '// RAPID-STUB\n\'use strict\';\nmodule.exports = {};\n', 'utf-8');
    fs.writeFileSync(sidecarFile, '', 'utf-8');

    // Verify both files exist before cleanup
    assert.ok(fs.existsSync(stubFile), 'Stub file should exist before cleanup');
    assert.ok(fs.existsSync(sidecarFile), 'Sidecar file should exist before cleanup');

    // Call cleanupStubSidecars on the directory
    const result = cleanupStubSidecars(stubsDir);

    // Assert both files are removed
    assert.ok(!fs.existsSync(stubFile), 'Stub file should be removed after cleanup');
    assert.ok(!fs.existsSync(sidecarFile), 'Sidecar file should be removed after cleanup');

    // Assert the function returns the correct count
    assert.equal(result.cleaned, 1, 'Should report 1 cleaned source file');
    assert.ok(result.files.length === 1, 'Should list 1 removed file');
    assert.ok(result.files[0].endsWith('dep-set-stub.cjs'), 'Removed file should be the stub');
  });

  it('scaffold report v2 extends v1 without breaking reads', () => {
    // Create a minimal project for scaffold
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'v2-test' }),
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'module.exports = {};');

    // Write a v1 report manually
    const v1Report = {
      projectType: 'library',
      language: 'javascript',
      filesCreated: ['src/index.js'],
      filesSkipped: [],
      timestamp: '2025-06-01T00:00:00.000Z',
      detectedFrameworks: [],
      reRun: false,
    };
    writeScaffoldReport(tmpDir, v1Report);

    // Read it back -- should work fine
    const readV1 = readScaffoldReport(tmpDir);
    assert.ok(readV1 !== null, 'v1 report should be readable');
    assert.equal(readV1.projectType, 'library');

    // Build a v2 report
    const v2Report = buildScaffoldReportV2(v1Report, {
      groups: { g1: { sets: ['set-a', 'set-b'] } },
      stubs: ['src/lib/stub-x.cjs'],
      foundationSet: 'set-a',
    });

    // Write v2 report
    writeScaffoldReport(tmpDir, v2Report);

    // Read it back -- should include v2 fields
    const readV2 = readScaffoldReport(tmpDir);
    assert.ok(readV2 !== null, 'v2 report should be readable');

    // Assert v1 fields are preserved
    assert.equal(readV2.projectType, 'library');
    assert.equal(readV2.language, 'javascript');
    assert.deepStrictEqual(readV2.filesCreated, ['src/index.js']);
    assert.equal(readV2.reRun, false);

    // Assert v2 fields are present
    assert.deepStrictEqual(readV2.groups, { g1: { sets: ['set-a', 'set-b'] } });
    assert.deepStrictEqual(readV2.stubs, ['src/lib/stub-x.cjs']);
    assert.equal(readV2.foundationSet, 'set-a');
  });

  it('T0 stub resolution integrates with resolveConflicts cascade', () => {
    // Create a conflict where ours is a RAPID-STUB and theirs is real code
    const stubContent = '// RAPID-STUB\n\'use strict\';\nfunction foo() { return \'\'; }\nmodule.exports = { foo };\n';
    const realContent = '\'use strict\';\nfunction foo() { return \'real value\'; }\nmodule.exports = { foo };\n';

    const conflict1 = {
      file: 'src/lib/foo.cjs',
      oursContent: stubContent,
      theirsContent: realContent,
    };

    const results1 = resolveConflicts({ allConflicts: [conflict1] }, {});
    assert.equal(results1.length, 1, 'Should return 1 result');
    assert.equal(results1[0].tier, 0, 'Should be resolved at tier 0');
    assert.equal(results1[0].resolved, true, 'Should be resolved');
    assert.equal(results1[0].preferSide, 'theirs', 'Should prefer theirs (real code)');

    // Create a second conflict where neither side is a stub
    const realContent2 = '\'use strict\';\nfunction bar() { return 1; }\nmodule.exports = { bar };\n';
    const realContent3 = '\'use strict\';\nfunction bar() { return 2; }\nmodule.exports = { bar };\n';

    const conflict2 = {
      file: 'src/lib/bar.cjs',
      oursContent: realContent2,
      theirsContent: realContent3,
    };

    const results2 = resolveConflicts({ allConflicts: [conflict2] }, {});
    assert.equal(results2.length, 1, 'Should return 1 result');
    assert.ok(results2[0].tier !== 0, `Should NOT be resolved at tier 0, got tier ${results2[0].tier}`);
  });
});
