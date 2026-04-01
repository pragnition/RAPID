'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  classifyProjectType,
  getTemplates,
  TEMPLATES,
  generateScaffold,
  writeScaffoldReport,
  readScaffoldReport,
  scaffold,
  generateGroupStubs,
  createFoundationSet,
  buildScaffoldReportV2,
} = require('./scaffold.cjs');

const { tryStubAutoResolve } = require('./merge.cjs');
const { isRapidStub } = require('./stub.cjs');

// Helper to create a temp directory for each test
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-scaffold-test-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── classifyProjectType Tests ──

describe('classifyProjectType', () => {
  it('returns type webapp when frameworks includes react', () => {
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: ['react'], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'webapp');
    assert.equal(result.confidence, 'high');
  });

  it('returns type webapp when frameworks includes next (not api)', () => {
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: ['next'], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'webapp');
    assert.equal(result.confidence, 'high');
  });

  it('returns type api when frameworks includes express', () => {
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: ['express'], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'api');
    assert.equal(result.confidence, 'high');
  });

  it('returns type api when frameworks includes fastapi', () => {
    const info = { hasSourceCode: true, languages: ['python'], frameworks: ['fastapi'], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'api');
    assert.equal(result.confidence, 'high');
  });

  it('returns type cli when package.json has bin field', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'mycli',
      bin: { mycli: './src/cli.js' },
    }));
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: [], configFiles: ['package.json'], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'cli');
    assert.equal(result.confidence, 'high');
  });

  it('returns type cli when package.json bin is a string', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'mycli',
      bin: './src/cli.js',
    }));
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: [], configFiles: ['package.json'], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'cli');
    assert.equal(result.confidence, 'high');
  });

  it('returns type library as fallback when hasSourceCode is true but no signals', () => {
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: [], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'library');
    assert.equal(result.confidence, 'medium');
  });

  it('returns type null when hasSourceCode is false', () => {
    const info = { hasSourceCode: false, languages: [], frameworks: [], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, null);
    assert.equal(result.confidence, 'low');
  });

  it('sets ambiguous true when both webapp and api frameworks detected', () => {
    const info = { hasSourceCode: true, languages: ['javascript'], frameworks: ['react', 'express'], configFiles: [], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.ambiguous, true);
    assert.equal(result.type, 'webapp'); // first match by rule order
    assert.ok(result.candidates.includes('webapp'));
    assert.ok(result.candidates.includes('api'));
  });

  it('detects cli via pyproject.toml console_scripts', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), `[project]
name = "mycli"

[project.scripts]
mycli = "mycli.cli:main"
`);
    const info = { hasSourceCode: true, languages: ['python'], frameworks: [], configFiles: ['pyproject.toml'], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'cli');
  });

  it('detects cli via main.go', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.go'), 'package main\n');
    const info = { hasSourceCode: true, languages: ['go'], frameworks: [], configFiles: ['go.mod'], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'cli');
  });

  it('detects cli via src/main.rs', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.rs'), 'fn main() {}\n');
    const info = { hasSourceCode: true, languages: ['rust'], frameworks: [], configFiles: ['Cargo.toml'], sourceStats: {} };
    const result = classifyProjectType(info, tmpDir);
    assert.equal(result.type, 'cli');
  });
});

// ── getTemplates Tests ──

describe('getTemplates', () => {
  it('returns non-empty array for webapp javascript', () => {
    const templates = getTemplates('webapp', 'javascript');
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length > 0);
  });

  it('returns non-empty array for api python', () => {
    const templates = getTemplates('api', 'python');
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length > 0);
  });

  it('every template has path and content properties', () => {
    const templates = getTemplates('library', 'javascript');
    for (const t of templates) {
      assert.ok(typeof t.path === 'string', `template missing path: ${JSON.stringify(t)}`);
      assert.ok(typeof t.content === 'string', `template missing content: ${JSON.stringify(t)}`);
    }
  });

  it('returns generic fallback for unknown language', () => {
    const templates = getTemplates('webapp', 'haskell');
    assert.ok(Array.isArray(templates));
    assert.ok(templates.length > 0);
    // Generic templates contain .gitignore and README.md
    const paths = templates.map(t => t.path);
    assert.ok(paths.includes('.gitignore'));
    assert.ok(paths.includes('README.md'));
  });

  it('returns empty array for unknown project type', () => {
    const templates = getTemplates('nonexistent', 'javascript');
    assert.deepStrictEqual(templates, []);
  });

  it('returns correct count for each defined template set', () => {
    assert.equal(getTemplates('webapp', 'javascript').length, 5);
    assert.equal(getTemplates('api', 'javascript').length, 5);
    assert.equal(getTemplates('library', 'javascript').length, 4);
    assert.equal(getTemplates('cli', 'javascript').length, 4);
    assert.equal(getTemplates('webapp', 'python').length, 5);
    assert.equal(getTemplates('api', 'python').length, 5);
    assert.equal(getTemplates('library', 'python').length, 5);
    assert.equal(getTemplates('cli', 'python').length, 4);
  });
});

// ── generateScaffold Tests ──

describe('generateScaffold', () => {
  it('creates all template files in empty directory', () => {
    const report = generateScaffold(tmpDir, 'webapp', 'javascript');
    assert.ok(report.filesCreated.length > 0);
    assert.equal(report.filesSkipped.length, 0);

    // Verify files actually exist on disk
    for (const relPath of report.filesCreated) {
      const absPath = path.join(tmpDir, relPath);
      assert.ok(fs.existsSync(absPath), `File should exist: ${relPath}`);
    }
  });

  it('skips files that already exist', () => {
    // Create one file beforehand
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'existing content');

    const report = generateScaffold(tmpDir, 'webapp', 'javascript');
    assert.ok(report.filesSkipped.some(s => s.path === 'src/index.js'));
    assert.ok(report.filesSkipped.some(s => s.reason === 'already exists'));
  });

  it('returns ScaffoldReport with correct shape', () => {
    const report = generateScaffold(tmpDir, 'api', 'python');
    assert.equal(report.projectType, 'api');
    assert.equal(report.language, 'python');
    assert.ok(Array.isArray(report.filesCreated));
    assert.ok(Array.isArray(report.filesSkipped));
    assert.ok(typeof report.timestamp === 'string');
    assert.ok(Array.isArray(report.detectedFrameworks));
    assert.equal(typeof report.reRun, 'boolean');
  });

  it('sets reRun true when any files are skipped due to existing', () => {
    // Create .gitignore first
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'custom content');
    const report = generateScaffold(tmpDir, 'library', 'javascript');
    assert.equal(report.reRun, true);
  });

  it('creates nested directories like src/routes/', () => {
    const report = generateScaffold(tmpDir, 'api', 'javascript');
    const routesPath = path.join(tmpDir, 'src', 'routes', 'index.js');
    assert.ok(fs.existsSync(routesPath), 'Nested route file should exist');
    assert.ok(report.filesCreated.includes('src/routes/index.js'));
  });

  it('does not overwrite existing file content', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    const customContent = '// my custom code\n';
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), customContent);

    generateScaffold(tmpDir, 'webapp', 'javascript');

    const actual = fs.readFileSync(path.join(tmpDir, 'src', 'index.js'), 'utf-8');
    assert.equal(actual, customContent, 'Existing file content should be preserved');
  });

  it('sets reRun false when no files are skipped', () => {
    const report = generateScaffold(tmpDir, 'cli', 'python');
    assert.equal(report.reRun, false);
    assert.equal(report.filesSkipped.length, 0);
  });
});

// ── writeScaffoldReport / readScaffoldReport Tests ──

describe('writeScaffoldReport / readScaffoldReport', () => {
  it('writes and reads back identical report', () => {
    const report = {
      projectType: 'api',
      language: 'javascript',
      filesCreated: ['src/index.js'],
      filesSkipped: [],
      timestamp: '2025-01-01T00:00:00.000Z',
      detectedFrameworks: ['express'],
      reRun: false,
    };

    writeScaffoldReport(tmpDir, report);
    const readBack = readScaffoldReport(tmpDir);
    assert.deepStrictEqual(readBack, report);
  });

  it('readScaffoldReport returns null for non-existent file', () => {
    const result = readScaffoldReport(tmpDir);
    assert.equal(result, null);
  });

  it('creates .planning/ directory if missing', () => {
    const report = { projectType: 'webapp', filesCreated: [] };
    writeScaffoldReport(tmpDir, report);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'scaffold-report.json')));
  });

  it('readScaffoldReport returns null on invalid JSON', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'scaffold-report.json'), 'not json{{{');
    const result = readScaffoldReport(tmpDir);
    assert.equal(result, null);
  });
});

// ── scaffold (orchestrator) Tests ──

describe('scaffold', () => {
  it('full flow: creates files and returns report for a JS project', () => {
    // Set up a minimal JS project
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj' }));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;');

    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['javascript'],
      frameworks: [],
      configFiles: ['package.json'],
      sourceStats: { '.js': 1 },
    };

    const report = scaffold(tmpDir, { codebaseInfo });
    assert.equal(report.projectType, 'library'); // no framework signals = library fallback
    assert.equal(report.language, 'javascript');
    assert.ok(report.filesCreated.length > 0);

    // Verify report was persisted
    const persisted = readScaffoldReport(tmpDir);
    assert.ok(persisted !== null);
    assert.equal(persisted.projectType, 'library');
  });

  it('returns needsUserInput for ambiguous projects', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['javascript'],
      frameworks: ['react', 'express'],
      configFiles: ['package.json'],
      sourceStats: { '.js': 10 },
    };

    const result = scaffold(tmpDir, { codebaseInfo });
    assert.equal(result.needsUserInput, true);
    assert.ok(result.candidates.includes('webapp'));
    assert.ok(result.candidates.includes('api'));
  });

  it('returns report with projectType unknown for empty projects', () => {
    const codebaseInfo = {
      hasSourceCode: false,
      languages: [],
      frameworks: [],
      configFiles: [],
      sourceStats: {},
    };

    const report = scaffold(tmpDir, { codebaseInfo });
    assert.equal(report.projectType, 'unknown');
    assert.equal(report.filesCreated.length, 0);
    assert.ok(report.filesSkipped.length > 0);
  });

  it('respects options.projectType override', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['javascript'],
      frameworks: ['react', 'express'], // would be ambiguous
      configFiles: ['package.json'],
      sourceStats: { '.js': 5 },
    };

    const report = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });
    // Should not return needsUserInput because override was given
    assert.equal(report.projectType, 'api');
    assert.ok(report.filesCreated.length > 0);
  });

  it('re-run produces reRun true and skips existing files', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['python'],
      frameworks: ['flask'],
      configFiles: [],
      sourceStats: {},
    };

    // First run
    const report1 = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });
    assert.equal(report1.reRun, false);
    assert.ok(report1.filesCreated.length > 0);

    // Second run -- should skip all existing files
    const report2 = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });
    assert.equal(report2.reRun, true);
    assert.equal(report2.filesCreated.length, 0);
    assert.ok(report2.filesSkipped.length > 0);
  });

  it('maps typescript language to javascript templates', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['typescript'],
      frameworks: [],
      configFiles: ['tsconfig.json'],
      sourceStats: { '.ts': 3 },
    };

    const report = scaffold(tmpDir, { codebaseInfo });
    assert.equal(report.language, 'javascript');
    assert.equal(report.projectType, 'library');
    assert.ok(report.filesCreated.length > 0);
  });

  it('uses generic templates for unsupported languages', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['go'],
      frameworks: [],
      configFiles: ['go.mod'],
      sourceStats: {},
    };

    const report = scaffold(tmpDir, { codebaseInfo });
    assert.equal(report.language, 'generic');
    assert.ok(report.filesCreated.includes('.gitignore'));
    assert.ok(report.filesCreated.includes('README.md'));
  });

  it('populates detectedFrameworks from codebaseInfo', () => {
    const codebaseInfo = {
      hasSourceCode: true,
      languages: ['javascript'],
      frameworks: ['express'],
      configFiles: [],
      sourceStats: {},
    };

    const report = scaffold(tmpDir, { codebaseInfo, projectType: 'api' });
    assert.deepStrictEqual(report.detectedFrameworks, ['express']);
  });
});

// ── generateGroupStubs Tests (Wave 2) ──

describe('generateGroupStubs', () => {
  it('generates stubs for cross-group dependencies', async () => {
    const allGroups = {
      'group-a': { sets: ['set-a1'] },
      'group-b': { sets: ['set-b1'] },
    };
    const contracts = {
      'set-a1': {
        imports: { fromSets: [{ set: 'set-b1', functions: ['doStuff'] }] },
        exports: {},
      },
      'set-b1': {
        exports: {
          functions: [
            { name: 'doStuff', params: [{ name: 'x', type: 'string' }], returns: 'boolean' },
          ],
        },
      },
    };

    const result = await generateGroupStubs(tmpDir, 'group-a', allGroups, contracts);
    assert.equal(result.files.length, 1);

    // Verify stub file exists and contains RAPID-STUB marker
    assert.ok(fs.existsSync(result.files[0].stub));
    const stubContent = fs.readFileSync(result.files[0].stub, 'utf-8');
    assert.ok(isRapidStub(stubContent), 'Stub should start with // RAPID-STUB');

    // Verify sidecar exists and is zero-byte
    assert.ok(fs.existsSync(result.files[0].sidecar));
    const sidecarStat = fs.statSync(result.files[0].sidecar);
    assert.equal(sidecarStat.size, 0);
  });

  it('returns empty files array when group has no cross-group deps', async () => {
    const allGroups = {
      'group-a': { sets: ['set-a1', 'set-a2'] },
    };
    const contracts = {
      'set-a1': {
        imports: { fromSets: [{ set: 'set-a2', functions: ['helper'] }] },
        exports: {},
      },
      'set-a2': {
        exports: {
          functions: [
            { name: 'helper', params: [], returns: 'void' },
          ],
        },
      },
    };

    const result = await generateGroupStubs(tmpDir, 'group-a', allGroups, contracts);
    assert.deepStrictEqual(result.files, []);
  });

  it('report string summarizes generated stubs', async () => {
    const allGroups = {
      'group-a': { sets: ['set-a1'] },
      'group-b': { sets: ['set-b1'] },
    };
    const contracts = {
      'set-a1': {
        imports: { fromSets: [{ set: 'set-b1', functions: ['fn1'] }] },
        exports: {},
      },
      'set-b1': {
        exports: {
          functions: [
            { name: 'fn1', params: [], returns: 'string' },
            { name: 'fn2', params: [], returns: 'number' },
          ],
        },
      },
    };

    const result = await generateGroupStubs(tmpDir, 'group-a', allGroups, contracts);
    assert.ok(result.report.includes('group-a'));
    assert.ok(result.report.includes('set-b1'));
    assert.ok(result.report.includes('2 exports'));
  });
});

// ── createFoundationSet Tests (Wave 2) ──

describe('createFoundationSet', () => {
  it('creates set directory with DEFINITION.md and CONTRACT.json', async () => {
    const setConfig = {
      name: 'my-foundation',
      sets: ['set-a', 'set-b'],
      contracts: {
        'set-a': {
          exports: {
            functions: [
              { name: 'funcA', params: [{ name: 'x', type: 'number' }], returns: 'string', description: 'A function' },
            ],
          },
        },
        'set-b': {
          exports: {
            doThing: { type: 'function', signature: 'doThing(): void', description: 'Does a thing' },
          },
        },
      },
    };

    await createFoundationSet(tmpDir, setConfig);

    const setDir = path.join(tmpDir, '.planning', 'sets', 'my-foundation');
    assert.ok(fs.existsSync(path.join(setDir, 'DEFINITION.md')));
    assert.ok(fs.existsSync(path.join(setDir, 'CONTRACT.json')));

    const definition = fs.readFileSync(path.join(setDir, 'DEFINITION.md'), 'utf-8');
    assert.ok(definition.includes('# Set: my-foundation'));
    assert.ok(definition.includes('Foundation'));
  });

  it('marks CONTRACT.json with foundation:true', async () => {
    const setConfig = {
      name: 'foundation-test',
      sets: ['s1'],
      contracts: {
        's1': {
          exports: {
            hello: { type: 'function', signature: 'hello(): string', description: 'Greet' },
          },
        },
      },
    };

    await createFoundationSet(tmpDir, setConfig);

    const contractPath = path.join(tmpDir, '.planning', 'sets', 'foundation-test', 'CONTRACT.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
    assert.equal(contract.foundation, true);
  });

  it('defaults name to foundation when not specified', async () => {
    const setConfig = {
      sets: ['s1'],
      contracts: {
        's1': {
          exports: {},
        },
      },
    };

    await createFoundationSet(tmpDir, setConfig);

    const setDir = path.join(tmpDir, '.planning', 'sets', 'foundation');
    assert.ok(fs.existsSync(setDir), 'Should create directory named "foundation"');
    assert.ok(fs.existsSync(path.join(setDir, 'DEFINITION.md')));
  });
});

// ── buildScaffoldReportV2 Tests (Wave 2) ──

describe('buildScaffoldReportV2', () => {
  const v1Report = {
    projectType: 'api',
    language: 'javascript',
    filesCreated: ['src/index.js'],
    filesSkipped: [],
    timestamp: '2025-01-01T00:00:00.000Z',
    detectedFrameworks: ['express'],
    reRun: false,
  };

  it('extends v1 report with groups, stubs, foundationSet', () => {
    const groupData = {
      groups: { 'group-a': { sets: ['set-a1'] } },
      stubs: ['set-b1-stub.cjs'],
      foundationSet: 'foundation',
    };

    const v2 = buildScaffoldReportV2(v1Report, groupData);
    assert.deepStrictEqual(v2.groups, groupData.groups);
    assert.deepStrictEqual(v2.stubs, groupData.stubs);
    assert.equal(v2.foundationSet, 'foundation');
  });

  it('defaults missing v2 fields to null/empty', () => {
    const v2 = buildScaffoldReportV2(v1Report, {});
    assert.equal(v2.groups, null);
    assert.deepStrictEqual(v2.stubs, []);
    assert.equal(v2.foundationSet, null);
  });

  it('preserves all v1 fields unchanged', () => {
    const v2 = buildScaffoldReportV2(v1Report, { groups: null });
    assert.equal(v2.projectType, 'api');
    assert.equal(v2.language, 'javascript');
    assert.deepStrictEqual(v2.filesCreated, ['src/index.js']);
    assert.deepStrictEqual(v2.filesSkipped, []);
    assert.equal(v2.timestamp, '2025-01-01T00:00:00.000Z');
    assert.deepStrictEqual(v2.detectedFrameworks, ['express']);
    assert.equal(v2.reRun, false);
  });
});

// ── RAPID-STUB T0 merge resolution Tests (Wave 2) ──

describe('RAPID-STUB T0 merge resolution', () => {
  const stubContent = '// RAPID-STUB\n// Generated stub\n\'use strict\';\nfunction foo() { return null; }\nmodule.exports = { foo };\n';
  const realContent = '\'use strict\';\nfunction foo() { return computeResult(); }\nmodule.exports = { foo };\n';

  it('resolves stub-vs-real in favor of real (ours=stub, theirs=real)', () => {
    const result = tryStubAutoResolve({
      oursContent: stubContent,
      theirsContent: realContent,
    });
    assert.equal(result.resolved, true);
    assert.equal(result.confidence, 1.0);
    assert.equal(result.preferSide, 'theirs');
    assert.ok(result.resolution.includes('theirs is real implementation'));
  });

  it('resolves stub-vs-real in favor of real (ours=real, theirs=stub)', () => {
    const result = tryStubAutoResolve({
      oursContent: realContent,
      theirsContent: stubContent,
    });
    assert.equal(result.resolved, true);
    assert.equal(result.confidence, 1.0);
    assert.equal(result.preferSide, 'ours');
    assert.ok(result.resolution.includes('ours is real implementation'));
  });

  it('resolves both-stubs by keeping ours', () => {
    const result = tryStubAutoResolve({
      oursContent: stubContent,
      theirsContent: stubContent,
    });
    assert.equal(result.resolved, true);
    assert.equal(result.confidence, 1.0);
    assert.equal(result.preferSide, 'ours');
    assert.ok(result.resolution.includes('both sides are RAPID-STUBs'));
  });

  it('returns unresolved when neither side is a stub', () => {
    const result = tryStubAutoResolve({
      oursContent: realContent,
      theirsContent: realContent,
    });
    assert.equal(result.resolved, false);
    assert.equal(result.confidence, 0);
  });

  it('returns unresolved when content is missing', () => {
    const result = tryStubAutoResolve({});
    assert.equal(result.resolved, false);
    assert.equal(result.confidence, 0);
  });
});
