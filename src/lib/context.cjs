'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Directories to skip during source file scanning and directory mapping.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.planning', 'vendor', 'dist', 'build',
  '__pycache__', '.venv', '.next', 'coverage', '.cache',
]);

/**
 * Source file extensions to count during codebase detection.
 */
const SOURCE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.rb',
  '.java', '.kt', '.swift', '.c', '.cpp', '.cs',
]);

/**
 * Extension-to-language mapping for source stats and sample file language tagging.
 */
const EXT_TO_LANGUAGE = {
  '.js': 'javascript',
  '.cjs': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.java': 'java',
  '.kt': 'java',
  '.swift': 'swift',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
};

/**
 * Language manifest files: presence indicates a language/codebase.
 */
const MANIFESTS = [
  { file: 'package.json', language: 'javascript', parse: true },
  { file: 'tsconfig.json', language: 'typescript', parse: true },
  { file: 'go.mod', language: 'go', parse: false },
  { file: 'Cargo.toml', language: 'rust', parse: false },
  { file: 'pyproject.toml', language: 'python', parse: false },
  { file: 'requirements.txt', language: 'python', parse: false },
  { file: 'Gemfile', language: 'ruby', parse: false },
  { file: 'pom.xml', language: 'java', parse: false },
  { file: 'build.gradle', language: 'java', parse: false },
  { file: 'build.gradle.kts', language: 'java', parse: false },
  { file: 'Makefile', language: 'make', parse: false },
  { file: 'CMakeLists.txt', language: 'cmake', parse: false },
];

/**
 * Framework indicators found in package.json dependencies/devDependencies.
 */
const JS_FRAMEWORKS = [
  'react', 'express', 'next', 'vue', 'angular', 'fastify', 'koa', 'nest',
];

/**
 * Framework indicators found in Python dependency files.
 */
const PY_FRAMEWORKS = ['django', 'flask', 'fastapi'];

/**
 * JS test framework indicators found in package.json devDependencies.
 */
const JS_TEST_FRAMEWORKS = [
  { dep: 'jest', framework: 'jest', runner: 'npx jest' },
  { dep: 'vitest', framework: 'vitest', runner: 'npx vitest run' },
  { dep: 'mocha', framework: 'mocha', runner: 'npx mocha' },
];

/**
 * Python test framework indicators found in dependency files.
 */
const PY_TEST_FRAMEWORKS = [
  { dep: 'pytest', framework: 'pytest', runner: 'pytest' },
];

/**
 * Config file patterns mapped to test frameworks.
 */
const TEST_FRAMEWORK_CONFIGS = [
  { prefix: 'jest.config', framework: 'jest', lang: 'javascript', runner: 'npx jest' },
  { prefix: 'vitest.config', framework: 'vitest', lang: 'javascript', runner: 'npx vitest run' },
  { prefix: '.mocharc', framework: 'mocha', lang: 'javascript', runner: 'npx mocha' },
  { exact: 'pytest.ini', framework: 'pytest', lang: 'python', runner: 'pytest' },
  { exact: 'setup.cfg', framework: 'pytest', lang: 'python', runner: 'pytest' },
  { exact: 'tox.ini', framework: 'pytest', lang: 'python', runner: 'pytest' },
];

/**
 * Fallback test frameworks for languages with intrinsic test runners.
 */
const LANG_DEFAULT_TEST_FRAMEWORKS = {
  go: { framework: 'go-test', runner: 'go test ./...' },
  rust: { framework: 'cargo-test', runner: 'cargo test' },
  javascript: { framework: 'node:test', runner: 'node --test' },
  typescript: { framework: 'node:test', runner: 'node --test' },
  python: { framework: 'unittest', runner: 'python -m unittest discover' },
};

/**
 * Walk directory entries up to maxDepth levels, skipping excluded directories.
 * Returns an array of { relativePath, isDirectory, depth } objects.
 *
 * @param {string} baseDir - Root directory to scan
 * @param {number} maxDepth - Maximum depth to recurse (1-based relative to baseDir contents)
 * @returns {Array<{ relativePath: string, isDirectory: boolean, depth: number }>}
 */
function walkDir(baseDir, maxDepth) {
  const results = [];

  function recurse(currentDir, currentDepth) {
    if (currentDepth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      results.push({
        relativePath: relPath,
        isDirectory: entry.isDirectory(),
        depth: currentDepth,
      });

      if (entry.isDirectory() && currentDepth <= maxDepth) {
        recurse(fullPath, currentDepth + 1);
      }
    }
  }

  recurse(baseDir, 0);
  return results;
}

/**
 * Detect codebase characteristics: languages, frameworks, config files, source stats.
 *
 * Checks for language-specific manifest files, parses package.json for framework
 * detection, and counts source files by extension (limited to 3 directory levels).
 *
 * @param {string} cwd - Directory to analyze
 * @returns {{ hasSourceCode: boolean, languages: string[], frameworks: string[], configFiles: string[], sourceStats: Object }}
 */
function detectCodebase(cwd) {
  const result = {
    hasSourceCode: false,
    languages: [],
    frameworks: [],
    configFiles: [],
    sourceStats: {},
  };

  const languageSet = new Set();
  const frameworkSet = new Set();

  // Check manifest files
  for (const manifest of MANIFESTS) {
    const fp = path.join(cwd, manifest.file);
    if (fs.existsSync(fp)) {
      result.hasSourceCode = true;
      languageSet.add(manifest.language);
      result.configFiles.push(manifest.file);

      // Parse package.json for JS framework detection
      if (manifest.file === 'package.json' && manifest.parse) {
        try {
          const pkg = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
          };
          for (const fw of JS_FRAMEWORKS) {
            if (allDeps && fw in allDeps) {
              frameworkSet.add(fw);
            }
          }
        } catch {
          // Graceful failure -- continue without framework detection
        }
      }

      // Parse Python files for framework detection
      if (manifest.file === 'requirements.txt') {
        try {
          const content = fs.readFileSync(fp, 'utf-8').toLowerCase();
          for (const fw of PY_FRAMEWORKS) {
            if (content.includes(fw)) {
              frameworkSet.add(fw);
            }
          }
        } catch {
          // Graceful failure
        }
      }

      if (manifest.file === 'pyproject.toml') {
        try {
          const content = fs.readFileSync(fp, 'utf-8').toLowerCase();
          for (const fw of PY_FRAMEWORKS) {
            if (content.includes(fw)) {
              frameworkSet.add(fw);
            }
          }
        } catch {
          // Graceful failure
        }
      }
    }
  }

  // Count source files by extension (limited to 3 levels deep)
  const entries = walkDir(cwd, 3);
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.relativePath);
    if (SOURCE_EXTENSIONS.has(ext)) {
      result.sourceStats[ext] = (result.sourceStats[ext] || 0) + 1;
    }
  }

  result.languages = [...languageSet];
  result.frameworks = [...frameworkSet];

  return result;
}

/**
 * Detect test frameworks in a project directory.
 *
 * Detection priority: config files > dependency declarations > language defaults.
 * Uses a Map keyed by language so the highest-priority signal wins.
 *
 * @param {string} cwd - Directory to analyze
 * @returns {Array<{ lang: string, framework: string, runner: string }>}
 */
function detectTestFrameworks(cwd) {
  const detected = new Map();

  // 1. Config file scan (highest priority)
  let topEntries;
  try {
    topEntries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    topEntries = [];
  }

  for (const entry of topEntries) {
    if (!entry.isFile()) continue;
    for (const cfg of TEST_FRAMEWORK_CONFIGS) {
      let matches = false;
      if (cfg.exact && entry.name === cfg.exact) matches = true;
      if (cfg.prefix && entry.name.startsWith(cfg.prefix)) matches = true;
      if (matches && !detected.has(cfg.lang)) {
        detected.set(cfg.lang, { lang: cfg.lang, framework: cfg.framework, runner: cfg.runner });
      }
    }
  }

  // 2. Dependency scan (JS) -- package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath) && !detected.has('javascript')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const entry of JS_TEST_FRAMEWORKS) {
        if (allDeps && entry.dep in allDeps) {
          detected.set('javascript', { lang: 'javascript', framework: entry.framework, runner: entry.runner });
          break;
        }
      }
    } catch {
      // Graceful failure
    }
  }

  // 3. Dependency scan (Python) -- requirements.txt or pyproject.toml
  if (!detected.has('python')) {
    const pyFiles = ['requirements.txt', 'pyproject.toml'];
    for (const pyFile of pyFiles) {
      const pyPath = path.join(cwd, pyFile);
      if (fs.existsSync(pyPath)) {
        try {
          const content = fs.readFileSync(pyPath, 'utf-8').toLowerCase();
          for (const entry of PY_TEST_FRAMEWORKS) {
            if (content.includes(entry.dep)) {
              detected.set('python', { lang: 'python', framework: entry.framework, runner: entry.runner });
              break;
            }
          }
        } catch {
          // Graceful failure
        }
        if (detected.has('python')) break;
      }
    }
  }

  // 4. Language defaults -- fall back for detected languages not yet covered
  const codebase = detectCodebase(cwd);
  for (const lang of codebase.languages) {
    if (!detected.has(lang) && LANG_DEFAULT_TEST_FRAMEWORKS[lang]) {
      const def = LANG_DEFAULT_TEST_FRAMEWORKS[lang];
      detected.set(lang, { lang, framework: def.framework, runner: def.runner });
    }
  }

  return Array.from(detected.values());
}

/**
 * Config file detection patterns.
 * Each pattern defines: a matching rule, its category, and whether it's in a subdirectory.
 */
const CONFIG_PATTERNS = [
  // Linting
  { prefix: '.eslintrc', category: 'linting', dir: null },
  { exact: 'eslint.config.js', category: 'linting', dir: null },
  { exact: 'eslint.config.mjs', category: 'linting', dir: null },
  { exact: 'eslint.config.cjs', category: 'linting', dir: null },
  { exact: 'eslint.config.ts', category: 'linting', dir: null },
  // Formatting
  { prefix: '.prettierrc', category: 'formatting', dir: null },
  { exact: 'prettier.config.js', category: 'formatting', dir: null },
  { exact: 'prettier.config.mjs', category: 'formatting', dir: null },
  { exact: 'prettier.config.cjs', category: 'formatting', dir: null },
  { exact: 'prettier.config.ts', category: 'formatting', dir: null },
  // TypeScript
  { prefix: 'tsconfig', suffix: '.json', category: 'typescript', dir: null },
  // Editor
  { exact: '.editorconfig', category: 'editor', dir: null },
  // Testing
  { prefix: 'jest.config', category: 'testing', dir: null },
  { prefix: 'vitest.config', category: 'testing', dir: null },
  { prefix: '.mocharc', category: 'testing', dir: null },
  { exact: 'pytest.ini', category: 'testing', dir: null },
  // CI/CD (top-level)
  { exact: '.gitlab-ci.yml', category: 'ci', dir: null },
  { exact: 'Jenkinsfile', category: 'ci', dir: null },
  // Git hooks (top-level)
  { exact: '.pre-commit-config.yaml', category: 'git-hooks', dir: null },
];

/**
 * Check if a filename matches a config pattern.
 *
 * @param {string} filename
 * @param {Object} pattern
 * @returns {boolean}
 */
function matchesConfigPattern(filename, pattern) {
  if (pattern.exact) {
    return filename === pattern.exact;
  }
  if (pattern.prefix) {
    if (!filename.startsWith(pattern.prefix)) return false;
    if (pattern.suffix) {
      return filename.endsWith(pattern.suffix);
    }
    return true;
  }
  return false;
}

/**
 * Try to parse a file as JSON if it has a .json extension.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {string} filename - Filename for extension check
 * @returns {Object|null}
 */
function tryParseJson(filePath, filename) {
  if (!filename.endsWith('.json')) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Detect configuration files in the project directory.
 *
 * Scans top-level files and specific subdirectories (.github/workflows/, .husky/)
 * for known config file patterns. JSON files are parsed; non-JSON files return
 * null for the parsed property.
 *
 * @param {string} cwd - Directory to analyze
 * @returns {Array<{ file: string, category: string, parsed: Object|null }>}
 */
function detectConfigFiles(cwd) {
  const configs = [];

  // Scan top-level files
  let topLevelEntries;
  try {
    topLevelEntries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return configs;
  }

  for (const entry of topLevelEntries) {
    if (!entry.isFile()) continue;

    for (const pattern of CONFIG_PATTERNS) {
      if (pattern.dir !== null) continue;
      if (matchesConfigPattern(entry.name, pattern)) {
        const filePath = path.join(cwd, entry.name);
        configs.push({
          file: entry.name,
          category: pattern.category,
          parsed: tryParseJson(filePath, entry.name),
        });
        break; // Only match first pattern per file
      }
    }
  }

  // Scan .github/workflows/ for CI files
  const workflowsDir = path.join(cwd, '.github', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    try {
      const workflowEntries = fs.readdirSync(workflowsDir, { withFileTypes: true });
      for (const entry of workflowEntries) {
        if (!entry.isFile()) continue;
        if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
          configs.push({
            file: `.github/workflows/${entry.name}`,
            category: 'ci',
            parsed: null,
          });
        }
      }
    } catch {
      // Graceful failure
    }
  }

  // Scan .husky/ for git hook files
  const huskyDir = path.join(cwd, '.husky');
  if (fs.existsSync(huskyDir)) {
    try {
      const huskyEntries = fs.readdirSync(huskyDir, { withFileTypes: true });
      for (const entry of huskyEntries) {
        if (!entry.isFile()) continue;
        // Skip .gitignore and _ prefixed files (husky internals)
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
        configs.push({
          file: `.husky/${entry.name}`,
          category: 'git-hooks',
          parsed: null,
        });
      }
    } catch {
      // Graceful failure
    }
  }

  return configs;
}

/**
 * Map the directory structure as a tree, limited to maxDepth levels.
 *
 * Produces a recursive tree of { name, type: 'file'|'directory', children? }
 * objects. Skips excluded directories (node_modules, .git, etc.).
 *
 * @param {string} cwd - Root directory to map
 * @param {number} [maxDepth=3] - Maximum depth to recurse
 * @returns {{ name: string, type: 'directory', children: Array }}
 */
function mapDirectoryStructure(cwd, maxDepth = 3) {
  function buildTree(dirPath, depth) {
    const node = {
      name: path.basename(dirPath),
      type: 'directory',
      children: [],
    };

    if (depth > maxDepth) return node;

    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return node;
    }

    // Sort: directories first, then files, alphabetically within each group
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;

        if (depth <= maxDepth) {
          node.children.push(buildTree(path.join(dirPath, entry.name), depth + 1));
        }
        // Beyond maxDepth, directory is omitted entirely
      } else {
        node.children.push({
          name: entry.name,
          type: 'file',
        });
      }
    }

    return node;
  }

  return buildTree(cwd, 1);
}

/**
 * Determine the priority of a source file for sample selection.
 *
 * @param {string} filename - Base filename
 * @returns {'entry'|'test'|'source'}
 */
function getFilePriority(filename) {
  const base = filename.toLowerCase();

  // Entry points
  if (base.startsWith('index.') || base.startsWith('main.') ||
      base.startsWith('app.') || base.startsWith('server.')) {
    // But not test files named app.test.js etc.
    if (base.includes('.test.') || base.includes('.spec.')) {
      return 'test';
    }
    return 'entry';
  }

  // Test files
  if (base.includes('.test.') || base.includes('.spec.')) {
    return 'test';
  }

  return 'source';
}

/**
 * Build a scan manifest for a subagent to consume.
 *
 * Orchestrates detectCodebase, detectConfigFiles, and mapDirectoryStructure,
 * then selects up to 10 sample source files per language, prioritizing entry
 * points, config files, and test files.
 *
 * @param {string} cwd - Directory to analyze
 * @returns {{ codebase: Object, configFiles: Array, structure: Object, sampleFiles: Array<{ path: string, language: string, priority: string }> }}
 */
function buildScanManifest(cwd) {
  const codebase = detectCodebase(cwd);
  const configFiles = detectConfigFiles(cwd);
  const structure = mapDirectoryStructure(cwd);

  const sampleFiles = [];

  if (!codebase.hasSourceCode) {
    return { codebase, configFiles, structure, sampleFiles };
  }

  // Collect source files from walkDir (depth 3)
  const entries = walkDir(cwd, 3);
  const filesByLanguage = {};

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.relativePath);
    const lang = EXT_TO_LANGUAGE[ext];
    if (!lang) continue;

    // Only include languages that were detected
    if (!codebase.languages.includes(lang)) continue;

    const filename = path.basename(entry.relativePath);
    const priority = getFilePriority(filename);

    if (!filesByLanguage[lang]) {
      filesByLanguage[lang] = [];
    }

    filesByLanguage[lang].push({
      path: entry.relativePath,
      language: lang,
      priority,
    });
  }

  // Select up to 10 per language, prioritizing entry > test > source
  const priorityOrder = { entry: 0, test: 1, source: 2 };

  for (const lang of Object.keys(filesByLanguage)) {
    const files = filesByLanguage[lang];
    files.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      return pa - pb;
    });
    sampleFiles.push(...files.slice(0, 10));
  }

  return { codebase, configFiles, structure, sampleFiles };
}

module.exports = {
  detectCodebase,
  detectTestFrameworks,
  detectConfigFiles,
  mapDirectoryStructure,
  buildScanManifest,
};
