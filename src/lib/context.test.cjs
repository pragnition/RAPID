'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  detectCodebase,
  detectConfigFiles,
  mapDirectoryStructure,
  buildScanManifest,
} = require('./context.cjs');

// Helper to create a temp directory for each test
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-context-test-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── detectCodebase Tests ──

describe('detectCodebase', () => {
  it('returns hasSourceCode: false for empty directory', () => {
    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, false);
    assert.deepStrictEqual(result.languages, []);
    assert.deepStrictEqual(result.frameworks, []);
    assert.deepStrictEqual(result.configFiles, []);
    assert.deepStrictEqual(result.sourceStats, {});
  });

  it('returns hasSourceCode: false for directory with only .planning/ and .git/', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.git', 'config'), '[core]');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, false);
    assert.deepStrictEqual(result.languages, []);
  });

  it('returns hasSourceCode: true and detects javascript when package.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'console.log("hi")');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('javascript'));
    assert.ok(result.configFiles.includes('package.json'));
  });

  it('returns hasSourceCode: true and detects typescript when tsconfig.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.ts'), 'const x: number = 1;');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('typescript'));
    assert.ok(result.configFiles.includes('tsconfig.json'));
  });

  it('detects go.mod (go)', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\n\ngo 1.21\n');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('go'));
  });

  it('detects Cargo.toml (rust)', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\n');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('rust'));
  });

  it('detects pyproject.toml (python)', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "test"\n');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('python'));
  });

  it('detects requirements.txt (python)', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0\n');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('python'));
  });

  it('detects Gemfile (ruby)', () => {
    fs.writeFileSync(path.join(tmpDir, 'Gemfile'), "source 'https://rubygems.org'\n");

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('ruby'));
  });

  it('detects pom.xml (java)', () => {
    fs.writeFileSync(path.join(tmpDir, 'pom.xml'), '<project></project>');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('java'));
  });

  it('detects build.gradle (java)', () => {
    fs.writeFileSync(path.join(tmpDir, 'build.gradle'), 'plugins { }');

    const result = detectCodebase(tmpDir);
    assert.equal(result.hasSourceCode, true);
    assert.ok(result.languages.includes('java'));
  });

  it('does not duplicate languages when multiple manifests for same language exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "test"\n');
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0\n');

    const result = detectCodebase(tmpDir);
    const pythonCount = result.languages.filter(l => l === 'python').length;
    assert.equal(pythonCount, 1, 'python should appear only once');
  });

  // Framework detection
  it('detects React framework from package.json dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'react-app',
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    }));

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('react'));
  });

  it('detects Express framework from package.json dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'express-app',
      dependencies: { express: '^4.18.0' },
    }));

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('express'));
  });

  it('detects Next.js framework from package.json dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'next-app',
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    }));

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('next'));
  });

  it('detects Vue framework from package.json devDependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'vue-app',
      devDependencies: { vue: '^3.0.0' },
    }));

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('vue'));
  });

  it('detects Django framework from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'Django==4.2\npsycopg2==2.9\n');

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('django'));
  });

  it('detects Django framework from pyproject.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '[project]\nname = "myapp"\ndependencies = ["django>=4.0"]\n');

    const result = detectCodebase(tmpDir);
    assert.ok(result.frameworks.includes('django'));
  });

  // Source stats
  it('populates sourceStats with counts of source files by extension', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// js file');
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils.js'), '// js file 2');
    fs.writeFileSync(path.join(tmpDir, 'src', 'types.ts'), '// ts file');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const result = detectCodebase(tmpDir);
    assert.equal(result.sourceStats['.js'], 2);
    assert.equal(result.sourceStats['.ts'], 1);
  });

  it('skips node_modules when counting source files', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'lodash'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'lodash', 'index.js'), '// lodash');
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '// app');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const result = detectCodebase(tmpDir);
    assert.equal(result.sourceStats['.js'], 1, 'should only count src/app.js, not node_modules');
  });

  it('skips .git, .planning, vendor, dist, build, __pycache__, .venv directories', () => {
    const skipDirs = ['.git', '.planning', 'vendor', 'dist', 'build', '__pycache__', '.venv'];
    for (const dir of skipDirs) {
      fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, dir, 'file.js'), '// skip me');
    }
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'real.js'), '// count me');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const result = detectCodebase(tmpDir);
    assert.equal(result.sourceStats['.js'], 1, 'should only count src/real.js');
  });

  it('limits source file scanning to top 3 directory levels', () => {
    // Level 1: src/
    // Level 2: src/sub/
    // Level 3: src/sub/deep/
    // Level 4: src/sub/deep/tooDeep/ -- should be skipped
    fs.mkdirSync(path.join(tmpDir, 'src', 'sub', 'deep', 'tooDeep'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), '// L1');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sub', 'b.js'), '// L2');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sub', 'deep', 'c.js'), '// L3');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sub', 'deep', 'tooDeep', 'd.js'), '// L4 skip');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const result = detectCodebase(tmpDir);
    assert.equal(result.sourceStats['.js'], 3, 'should only count files at depth 1-3');
  });
});

// ── detectConfigFiles Tests ──

describe('detectConfigFiles', () => {
  it('returns empty array for empty directory', () => {
    const result = detectConfigFiles(tmpDir);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  it('finds .eslintrc.json and categorizes as linting', () => {
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), JSON.stringify({ rules: {} }));

    const result = detectConfigFiles(tmpDir);
    const eslint = result.find(c => c.file === '.eslintrc.json');
    assert.ok(eslint, 'should find .eslintrc.json');
    assert.equal(eslint.category, 'linting');
    assert.deepStrictEqual(eslint.parsed, { rules: {} });
  });

  it('finds eslint.config.js and categorizes as linting', () => {
    fs.writeFileSync(path.join(tmpDir, 'eslint.config.js'), 'module.exports = [];');

    const result = detectConfigFiles(tmpDir);
    const eslint = result.find(c => c.file === 'eslint.config.js');
    assert.ok(eslint, 'should find eslint.config.js');
    assert.equal(eslint.category, 'linting');
    assert.equal(eslint.parsed, null, 'non-JSON should have null parsed');
  });

  it('finds .prettierrc.json and categorizes as formatting', () => {
    fs.writeFileSync(path.join(tmpDir, '.prettierrc.json'), JSON.stringify({ semi: true }));

    const result = detectConfigFiles(tmpDir);
    const prettier = result.find(c => c.file === '.prettierrc.json');
    assert.ok(prettier, 'should find .prettierrc.json');
    assert.equal(prettier.category, 'formatting');
    assert.deepStrictEqual(prettier.parsed, { semi: true });
  });

  it('finds .prettierrc (no extension) and categorizes as formatting', () => {
    fs.writeFileSync(path.join(tmpDir, '.prettierrc'), '{ "semi": false }');

    const result = detectConfigFiles(tmpDir);
    const prettier = result.find(c => c.file === '.prettierrc');
    assert.ok(prettier, 'should find .prettierrc');
    assert.equal(prettier.category, 'formatting');
  });

  it('finds prettier.config.js and categorizes as formatting', () => {
    fs.writeFileSync(path.join(tmpDir, 'prettier.config.js'), 'module.exports = {};');

    const result = detectConfigFiles(tmpDir);
    const prettier = result.find(c => c.file === 'prettier.config.js');
    assert.ok(prettier, 'should find prettier.config.js');
    assert.equal(prettier.category, 'formatting');
  });

  it('finds tsconfig.json and categorizes as typescript', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

    const result = detectConfigFiles(tmpDir);
    const tsconfig = result.find(c => c.file === 'tsconfig.json');
    assert.ok(tsconfig, 'should find tsconfig.json');
    assert.equal(tsconfig.category, 'typescript');
    assert.deepStrictEqual(tsconfig.parsed, { compilerOptions: { strict: true } });
  });

  it('finds tsconfig.build.json and categorizes as typescript', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.build.json'), JSON.stringify({ extends: './tsconfig.json' }));

    const result = detectConfigFiles(tmpDir);
    const tsconfigBuild = result.find(c => c.file === 'tsconfig.build.json');
    assert.ok(tsconfigBuild, 'should find tsconfig.build.json');
    assert.equal(tsconfigBuild.category, 'typescript');
  });

  it('finds .editorconfig and categorizes as editor', () => {
    fs.writeFileSync(path.join(tmpDir, '.editorconfig'), 'root = true\n[*]\nindent_style = space\n');

    const result = detectConfigFiles(tmpDir);
    const editor = result.find(c => c.file === '.editorconfig');
    assert.ok(editor, 'should find .editorconfig');
    assert.equal(editor.category, 'editor');
  });

  it('finds jest.config.js and categorizes as testing', () => {
    fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {};');

    const result = detectConfigFiles(tmpDir);
    const jest = result.find(c => c.file === 'jest.config.js');
    assert.ok(jest, 'should find jest.config.js');
    assert.equal(jest.category, 'testing');
  });

  it('finds vitest.config.ts and categorizes as testing', () => {
    fs.writeFileSync(path.join(tmpDir, 'vitest.config.ts'), 'export default {};');

    const result = detectConfigFiles(tmpDir);
    const vitest = result.find(c => c.file === 'vitest.config.ts');
    assert.ok(vitest, 'should find vitest.config.ts');
    assert.equal(vitest.category, 'testing');
  });

  it('finds .mocharc.yml and categorizes as testing', () => {
    fs.writeFileSync(path.join(tmpDir, '.mocharc.yml'), 'timeout: 5000\n');

    const result = detectConfigFiles(tmpDir);
    const mocha = result.find(c => c.file === '.mocharc.yml');
    assert.ok(mocha, 'should find .mocharc.yml');
    assert.equal(mocha.category, 'testing');
  });

  it('finds pytest.ini and categorizes as testing', () => {
    fs.writeFileSync(path.join(tmpDir, 'pytest.ini'), '[pytest]\naddopts = -v\n');

    const result = detectConfigFiles(tmpDir);
    const pytest = result.find(c => c.file === 'pytest.ini');
    assert.ok(pytest, 'should find pytest.ini');
    assert.equal(pytest.category, 'testing');
  });

  it('finds .github/workflows/*.yml and categorizes as ci', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\n');

    const result = detectConfigFiles(tmpDir);
    const ci = result.find(c => c.file === '.github/workflows/ci.yml');
    assert.ok(ci, 'should find .github/workflows/ci.yml');
    assert.equal(ci.category, 'ci');
  });

  it('finds .gitlab-ci.yml and categorizes as ci', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitlab-ci.yml'), 'stages:\n  - build\n');

    const result = detectConfigFiles(tmpDir);
    const gitlab = result.find(c => c.file === '.gitlab-ci.yml');
    assert.ok(gitlab, 'should find .gitlab-ci.yml');
    assert.equal(gitlab.category, 'ci');
  });

  it('finds Jenkinsfile and categorizes as ci', () => {
    fs.writeFileSync(path.join(tmpDir, 'Jenkinsfile'), 'pipeline { }');

    const result = detectConfigFiles(tmpDir);
    const jenkins = result.find(c => c.file === 'Jenkinsfile');
    assert.ok(jenkins, 'should find Jenkinsfile');
    assert.equal(jenkins.category, 'ci');
  });

  it('finds .husky/* files and categorizes as git-hooks', () => {
    fs.mkdirSync(path.join(tmpDir, '.husky'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.husky', 'pre-commit'), '#!/bin/sh\nnpm test\n');

    const result = detectConfigFiles(tmpDir);
    const husky = result.find(c => c.file === '.husky/pre-commit');
    assert.ok(husky, 'should find .husky/pre-commit');
    assert.equal(husky.category, 'git-hooks');
  });

  it('finds .pre-commit-config.yaml and categorizes as git-hooks', () => {
    fs.writeFileSync(path.join(tmpDir, '.pre-commit-config.yaml'), 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n');

    const result = detectConfigFiles(tmpDir);
    const precommit = result.find(c => c.file === '.pre-commit-config.yaml');
    assert.ok(precommit, 'should find .pre-commit-config.yaml');
    assert.equal(precommit.category, 'git-hooks');
  });

  it('parses JSON config files and returns parsed content', () => {
    const config = { rules: { 'no-unused-vars': 'error' } };
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), JSON.stringify(config));

    const result = detectConfigFiles(tmpDir);
    const eslint = result.find(c => c.file === '.eslintrc.json');
    assert.deepStrictEqual(eslint.parsed, config);
  });

  it('returns null for parsed on non-JSON configs', () => {
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.yml'), 'rules:\n  no-unused-vars: error\n');

    const result = detectConfigFiles(tmpDir);
    const eslint = result.find(c => c.file === '.eslintrc.yml');
    assert.ok(eslint, 'should find .eslintrc.yml');
    assert.equal(eslint.parsed, null);
  });

  it('returns null for parsed when JSON parsing fails', () => {
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), '{ invalid json }');

    const result = detectConfigFiles(tmpDir);
    const eslint = result.find(c => c.file === '.eslintrc.json');
    assert.ok(eslint, 'should find .eslintrc.json');
    assert.equal(eslint.parsed, null, 'invalid JSON should result in null parsed');
  });

  it('returns objects with file, category, and parsed properties', () => {
    fs.writeFileSync(path.join(tmpDir, '.editorconfig'), 'root = true\n');

    const result = detectConfigFiles(tmpDir);
    assert.ok(result.length > 0);
    const item = result[0];
    assert.ok('file' in item, 'should have file property');
    assert.ok('category' in item, 'should have category property');
    assert.ok('parsed' in item, 'should have parsed property');
  });
});

// ── mapDirectoryStructure Tests ──

describe('mapDirectoryStructure', () => {
  it('returns tree limited to specified depth (default 3)', () => {
    fs.mkdirSync(path.join(tmpDir, 'a', 'b', 'c', 'd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'c', 'd', 'deep.txt'), 'too deep');
    fs.writeFileSync(path.join(tmpDir, 'a', 'file.txt'), 'level 1');

    const result = mapDirectoryStructure(tmpDir);
    // Root should have 'a' directory
    const aDir = result.children.find(c => c.name === 'a');
    assert.ok(aDir, 'should have directory a');
    assert.equal(aDir.type, 'directory');

    // a/b should exist
    const bDir = aDir.children.find(c => c.name === 'b');
    assert.ok(bDir, 'should have directory b');

    // a/b/c should exist (depth 3)
    const cDir = bDir.children.find(c => c.name === 'c');
    assert.ok(cDir, 'should have directory c at depth 3');

    // a/b/c/d should NOT have children (depth 4 exceeds limit)
    if (cDir.children) {
      const dDir = cDir.children.find(c => c.name === 'd');
      // At depth 3, the directory 'd' might appear but should not be expanded
      if (dDir) {
        assert.ok(!dDir.children || dDir.children.length === 0,
          'directory d at depth 4 should not be expanded');
      }
    }
  });

  it('respects custom maxDepth parameter', () => {
    fs.mkdirSync(path.join(tmpDir, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'a', 'file.txt'), 'level 1');
    fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'deep.txt'), 'level 2');

    const result = mapDirectoryStructure(tmpDir, 1);
    const aDir = result.children.find(c => c.name === 'a');
    assert.ok(aDir, 'should have directory a');
    // At depth 1, a/ should not be expanded further
    assert.ok(!aDir.children || aDir.children.length === 0,
      'directory a should not be expanded at maxDepth 1');
  });

  it('skips node_modules, .git, .planning, vendor, dist, build, __pycache__, .venv', () => {
    const skipDirs = ['node_modules', '.git', '.planning', 'vendor', 'dist', 'build', '__pycache__', '.venv'];
    for (const dir of skipDirs) {
      fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, dir, 'file.txt'), 'skip');
    }
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// real');

    const result = mapDirectoryStructure(tmpDir);
    const childNames = result.children.map(c => c.name);

    for (const dir of skipDirs) {
      assert.ok(!childNames.includes(dir), `should skip ${dir}`);
    }
    assert.ok(childNames.includes('src'), 'should include src');
  });

  it('returns objects with name, type, and optional children structure', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// code');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Readme');

    const result = mapDirectoryStructure(tmpDir);
    assert.ok(result.name, 'root should have name');
    assert.equal(result.type, 'directory');
    assert.ok(Array.isArray(result.children));

    const readme = result.children.find(c => c.name === 'README.md');
    assert.ok(readme, 'should find README.md');
    assert.equal(readme.type, 'file');

    const src = result.children.find(c => c.name === 'src');
    assert.ok(src, 'should find src');
    assert.equal(src.type, 'directory');
    assert.ok(Array.isArray(src.children));
  });

  it('includes files at root level', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Hi');

    const result = mapDirectoryStructure(tmpDir);
    const names = result.children.map(c => c.name);
    assert.ok(names.includes('package.json'));
    assert.ok(names.includes('README.md'));
  });
});

// ── buildScanManifest Tests ──

describe('buildScanManifest', () => {
  it('calls all detection functions and returns combined result', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      dependencies: { express: '^4.18.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), JSON.stringify({ rules: {} }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'const app = require("express")();');

    const result = buildScanManifest(tmpDir);

    assert.ok(result.codebase, 'should have codebase');
    assert.ok(result.configFiles, 'should have configFiles');
    assert.ok(result.structure, 'should have structure');
    assert.ok(result.sampleFiles, 'should have sampleFiles');
  });

  it('codebase comes from detectCodebase', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '// app');

    const result = buildScanManifest(tmpDir);
    assert.equal(result.codebase.hasSourceCode, true);
    assert.ok(result.codebase.languages.includes('javascript'));
  });

  it('configFiles comes from detectConfigFiles', () => {
    fs.writeFileSync(path.join(tmpDir, '.eslintrc.json'), JSON.stringify({ rules: {} }));

    const result = buildScanManifest(tmpDir);
    assert.ok(Array.isArray(result.configFiles));
    const eslint = result.configFiles.find(c => c.file === '.eslintrc.json');
    assert.ok(eslint);
  });

  it('structure comes from mapDirectoryStructure', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// code');

    const result = buildScanManifest(tmpDir);
    assert.equal(result.structure.type, 'directory');
    assert.ok(Array.isArray(result.structure.children));
  });

  it('selects up to 10 sample source files per language', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    // Create 15 JS files
    for (let i = 0; i < 15; i++) {
      fs.writeFileSync(path.join(tmpDir, 'src', `file${i}.js`), `// file ${i}`);
    }

    const result = buildScanManifest(tmpDir);
    const jsFiles = result.sampleFiles.filter(f => f.language === 'javascript');
    assert.ok(jsFiles.length <= 10, `should have at most 10 JS sample files, got ${jsFiles.length}`);
  });

  it('prioritizes entry points (index.*, main.*, app.*)', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// entry');
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), '// entry');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '// entry');
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils.js'), '// util');
    fs.writeFileSync(path.join(tmpDir, 'src', 'helper.js'), '// helper');

    const result = buildScanManifest(tmpDir);
    const entryFiles = result.sampleFiles.filter(f => f.priority === 'entry');
    assert.ok(entryFiles.length >= 3, 'should have at least 3 entry point files');
  });

  it('includes test files in samples', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '// app');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.test.js'), '// test');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.spec.js'), '// spec');

    const result = buildScanManifest(tmpDir);
    const testFiles = result.sampleFiles.filter(f => f.priority === 'test');
    assert.ok(testFiles.length >= 1, 'should include test files in samples');
  });

  it('returns sampleFiles as array of { path, language, priority } objects', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// code');

    const result = buildScanManifest(tmpDir);
    assert.ok(result.sampleFiles.length > 0, 'should have sample files');
    const sample = result.sampleFiles[0];
    assert.ok('path' in sample, 'should have path');
    assert.ok('language' in sample, 'should have language');
    assert.ok('priority' in sample, 'should have priority');
  });

  it('returns empty sampleFiles for greenfield project', () => {
    const result = buildScanManifest(tmpDir);
    assert.deepStrictEqual(result.sampleFiles, []);
  });
});
