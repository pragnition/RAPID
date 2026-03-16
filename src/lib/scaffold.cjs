'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──

const PROJECT_TYPES = ['webapp', 'api', 'library', 'cli'];

// ── Task 1: Project Type Classifier ──

/**
 * Classify a project type from detectCodebase() output.
 *
 * Rules applied in order (first high-confidence match wins):
 *   1. webapp -- react, vue, angular, next
 *   2. api    -- express, fastify, koa, nest, django, flask, fastapi
 *   3. cli    -- package.json bin field, pyproject.toml console_scripts, main.go, src/main.rs
 *   4. library -- hasSourceCode but no other signals
 *   5. null   -- no source code at all
 *
 * @param {Object} codebaseInfo - Output of detectCodebase()
 * @param {string} cwd - Working directory for file system lookups
 * @returns {{ type: string|null, confidence: string, ambiguous: boolean, candidates: string[] }}
 */
function classifyProjectType(codebaseInfo, cwd) {
  const result = {
    type: null,
    confidence: 'low',
    ambiguous: false,
    candidates: [],
  };

  if (!codebaseInfo.hasSourceCode) {
    return result;
  }

  const frameworks = (codebaseInfo.frameworks || []).map(f => f.toLowerCase());
  const candidates = [];

  // Check webapp signals
  const webappFrameworks = ['react', 'vue', 'angular', 'next'];
  if (webappFrameworks.some(fw => frameworks.includes(fw))) {
    candidates.push('webapp');
  }

  // Check api signals
  const apiFrameworks = ['express', 'fastify', 'koa', 'nest', 'django', 'flask', 'fastapi'];
  if (apiFrameworks.some(fw => frameworks.includes(fw))) {
    candidates.push('api');
  }

  // Check cli signals
  if (_detectCli(cwd)) {
    candidates.push('cli');
  }

  // Determine result from candidates
  if (candidates.length === 0) {
    // Fallback: library if source code exists
    result.type = 'library';
    result.confidence = 'medium';
    result.candidates = ['library'];
  } else if (candidates.length === 1) {
    result.type = candidates[0];
    result.confidence = 'high';
    result.candidates = candidates;
  } else {
    // Multiple matches -- ambiguous
    result.type = candidates[0]; // first match by rule order
    result.confidence = 'medium';
    result.ambiguous = true;
    result.candidates = candidates;
  }

  return result;
}

/**
 * Detect CLI project signals by checking package.json bin, pyproject.toml
 * console_scripts, main.go, or src/main.rs.
 *
 * @param {string} cwd - Working directory
 * @returns {boolean}
 */
function _detectCli(cwd) {
  // Check package.json for bin field
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.bin && Object.keys(pkg.bin).length > 0) {
        return true;
      }
      // bin can also be a string
      if (typeof pkg.bin === 'string' && pkg.bin.length > 0) {
        return true;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Check pyproject.toml for console_scripts
  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf-8');
      if (content.includes('[project.scripts]') || content.includes('console_scripts')) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  // Check Go CLI entry point
  if (fs.existsSync(path.join(cwd, 'main.go'))) {
    return true;
  }

  // Check Rust CLI entry point
  if (fs.existsSync(path.join(cwd, 'src', 'main.rs'))) {
    return true;
  }

  return false;
}

// ── Task 2: Template Definitions ──

const TEMPLATES = {
  webapp: {
    javascript: [
      {
        path: 'src/index.js',
        content: `'use strict';

console.log('App started');
`,
      },
      {
        path: 'src/App.js',
        content: `'use strict';

/**
 * Placeholder application component / page.
 */
function App() {
  return { name: 'App' };
}

module.exports = App;
`,
      },
      {
        path: 'public/index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
coverage/
.env
`,
      },
      {
        path: 'jest.config.js',
        content: `'use strict';

module.exports = {
  testMatch: ['**/*.test.js'],
};
`,
      },
    ],
    python: [
      {
        path: 'app/__init__.py',
        content: '',
      },
      {
        path: 'app/main.py',
        content: `"""Minimal webapp entry point."""


def create_app():
    """Create and return the application instance."""
    return None
`,
      },
      {
        path: 'app/templates/base.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
</head>
<body>
  {% block content %}{% endblock %}
</body>
</html>
`,
      },
      {
        path: '.gitignore',
        content: `__pycache__/
.venv/
*.pyc
dist/
.env
`,
      },
      {
        path: 'pytest.ini',
        content: `[pytest]
testpaths = tests
`,
      },
    ],
  },
  api: {
    javascript: [
      {
        path: 'src/index.js',
        content: `'use strict';

const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(PORT, () => {
  console.log(\`Server listening on port \${PORT}\`);
});
`,
      },
      {
        path: 'src/routes/index.js',
        content: `'use strict';

/**
 * Placeholder route definitions.
 */
module.exports = function registerRoutes(app) {
  // Add routes here
};
`,
      },
      {
        path: 'src/middleware/index.js',
        content: `'use strict';

/**
 * Placeholder middleware.
 */
module.exports = function applyMiddleware(app) {
  // Add middleware here
};
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
coverage/
.env
`,
      },
      {
        path: 'jest.config.js',
        content: `'use strict';

module.exports = {
  testMatch: ['**/*.test.js'],
};
`,
      },
    ],
    python: [
      {
        path: 'app/__init__.py',
        content: '',
      },
      {
        path: 'app/main.py',
        content: `"""Minimal API entry point."""


def create_api():
    """Create and return the API application instance."""
    return None
`,
      },
      {
        path: 'app/routes/__init__.py',
        content: '',
      },
      {
        path: '.gitignore',
        content: `__pycache__/
.venv/
*.pyc
dist/
.env
`,
      },
      {
        path: 'pytest.ini',
        content: `[pytest]
testpaths = tests
`,
      },
    ],
  },
  library: {
    javascript: [
      {
        path: 'src/index.js',
        content: `'use strict';

/**
 * Library entry point.
 */
module.exports = {};
`,
      },
      {
        path: 'src/lib/index.js',
        content: `'use strict';

/**
 * Placeholder library barrel export.
 */
module.exports = {};
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
coverage/
`,
      },
      {
        path: 'jest.config.js',
        content: `'use strict';

module.exports = {
  testMatch: ['**/*.test.js'],
};
`,
      },
    ],
    python: [
      {
        path: 'src/__init__.py',
        content: '',
      },
      {
        path: 'src/core.py',
        content: `"""Core library module."""


def placeholder():
    """Placeholder function."""
    return None
`,
      },
      {
        path: 'tests/__init__.py',
        content: '',
      },
      {
        path: '.gitignore',
        content: `__pycache__/
.venv/
*.pyc
dist/
`,
      },
      {
        path: 'pytest.ini',
        content: `[pytest]
testpaths = tests
`,
      },
    ],
  },
  cli: {
    javascript: [
      {
        path: 'src/bin/cli.js',
        content: `#!/usr/bin/env node
'use strict';

/**
 * CLI entry point.
 */
const args = process.argv.slice(2);
console.log('CLI invoked with:', args);
`,
      },
      {
        path: 'src/commands/index.js',
        content: `'use strict';

/**
 * Command registry placeholder.
 */
const commands = {};

module.exports = commands;
`,
      },
      {
        path: 'src/lib/index.js',
        content: `'use strict';

/**
 * Placeholder library module.
 */
module.exports = {};
`,
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
coverage/
`,
      },
    ],
    python: [
      {
        path: 'src/__init__.py',
        content: '',
      },
      {
        path: 'src/cli.py',
        content: `"""CLI entry point."""

import argparse


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='CLI application')
    parser.add_argument('command', nargs='?', help='Command to run')
    args = parser.parse_args()
    print(f'CLI invoked with: {args.command}')


if __name__ == '__main__':
    main()
`,
      },
      {
        path: 'src/commands/__init__.py',
        content: '',
      },
      {
        path: '.gitignore',
        content: `__pycache__/
.venv/
*.pyc
dist/
`,
      },
    ],
  },
};

// Generic fallback templates for unsupported languages
const GENERIC_TEMPLATES = {
  webapp: [
    { path: '.gitignore', content: 'dist/\n.env\n' },
    { path: 'README.md', content: '# Web Application\n\nProject scaffolded by RAPID.\n' },
  ],
  api: [
    { path: '.gitignore', content: 'dist/\n.env\n' },
    { path: 'README.md', content: '# API\n\nProject scaffolded by RAPID.\n' },
  ],
  library: [
    { path: '.gitignore', content: 'dist/\n' },
    { path: 'README.md', content: '# Library\n\nProject scaffolded by RAPID.\n' },
  ],
  cli: [
    { path: '.gitignore', content: 'dist/\n' },
    { path: 'README.md', content: '# CLI Tool\n\nProject scaffolded by RAPID.\n' },
  ],
};

/**
 * Get template file descriptors for a given project type and language.
 * Falls back to generic templates if no language-specific templates exist.
 *
 * @param {string} projectType - One of: webapp, api, library, cli
 * @param {string} language - Template language key (javascript, python, etc.)
 * @returns {Array<{ path: string, content: string }>}
 */
function getTemplates(projectType, language) {
  const typeTemplates = TEMPLATES[projectType];
  if (typeTemplates && typeTemplates[language]) {
    return typeTemplates[language];
  }

  // Fallback to generic templates
  if (GENERIC_TEMPLATES[projectType]) {
    return GENERIC_TEMPLATES[projectType];
  }

  return [];
}

// ── Task 3: Scaffold Engine ──

/**
 * Generate scaffold files additively (skip if exists).
 *
 * @param {string} cwd - Target directory for scaffolding
 * @param {string} projectType - Project archetype
 * @param {string} language - Template language key
 * @returns {{ projectType: string, language: string, filesCreated: string[], filesSkipped: Array<{ path: string, reason: string }>, timestamp: string, detectedFrameworks: string[], reRun: boolean }}
 */
function generateScaffold(cwd, projectType, language) {
  const templates = getTemplates(projectType, language);
  const filesCreated = [];
  const filesSkipped = [];

  for (const template of templates) {
    const absPath = path.join(cwd, template.path);

    if (fs.existsSync(absPath)) {
      filesSkipped.push({ path: template.path, reason: 'already exists' });
      continue;
    }

    try {
      const dir = path.dirname(absPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absPath, template.content);
      filesCreated.push(template.path);
    } catch (err) {
      filesSkipped.push({ path: template.path, reason: `write error: ${err.message}` });
    }
  }

  return {
    projectType,
    language,
    filesCreated,
    filesSkipped,
    timestamp: new Date().toISOString(),
    detectedFrameworks: [],
    reRun: filesSkipped.some(s => s.reason === 'already exists'),
  };
}

// ── Task 4: ScaffoldReport Persistence ──

const REPORT_FILENAME = 'scaffold-report.json';

/**
 * Write a ScaffoldReport to .planning/scaffold-report.json.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} report - The ScaffoldReport object
 * @returns {string} Absolute path of the written report file
 */
function writeScaffoldReport(cwd, report) {
  const planningDir = path.join(cwd, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const reportPath = path.join(planningDir, REPORT_FILENAME);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

/**
 * Read a ScaffoldReport from .planning/scaffold-report.json.
 *
 * @param {string} cwd - Project root directory
 * @returns {Object|null} Parsed report, or null if not found / parse error
 */
function readScaffoldReport(cwd) {
  const reportPath = path.join(cwd, '.planning', REPORT_FILENAME);
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Task 5: Top-Level Orchestrator ──

/**
 * Main scaffold entry point. Orchestrates classification, template generation,
 * and report persistence.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} [options={}]
 * @param {string} [options.projectType] - Override classified project type
 * @param {Object} [options.codebaseInfo] - Pre-computed codebase info (skips detectCodebase)
 * @returns {Object} ScaffoldReport or { needsUserInput, candidates, classification }
 */
function scaffold(cwd, options = {}) {
  let codebaseInfo = options.codebaseInfo;

  if (!codebaseInfo) {
    // Lazy require to avoid circular dependency at module load time
    const { detectCodebase } = require('./context.cjs');
    codebaseInfo = detectCodebase(cwd);
  }

  const classification = classifyProjectType(codebaseInfo, cwd);

  // Determine effective project type
  let projectType = options.projectType || classification.type;

  // No source code and no override
  if (projectType === null) {
    const report = {
      projectType: 'unknown',
      language: 'unknown',
      filesCreated: [],
      filesSkipped: [{ path: 'N/A', reason: 'no source code detected and no project type specified' }],
      timestamp: new Date().toISOString(),
      detectedFrameworks: codebaseInfo.frameworks || [],
      reRun: false,
    };
    writeScaffoldReport(cwd, report);
    return report;
  }

  // Ambiguous classification without user override
  if (classification.ambiguous && !options.projectType) {
    return {
      needsUserInput: true,
      candidates: classification.candidates,
      classification,
    };
  }

  // Determine dominant language
  const rawLang = (codebaseInfo.languages && codebaseInfo.languages[0]) || 'generic';
  let language;
  if (rawLang === 'javascript' || rawLang === 'typescript') {
    language = 'javascript';
  } else if (rawLang === 'python') {
    language = 'python';
  } else {
    language = 'generic';
  }

  const report = generateScaffold(cwd, projectType, language);
  report.detectedFrameworks = codebaseInfo.frameworks || [];
  writeScaffoldReport(cwd, report);
  return report;
}

// ── Exports ──

module.exports = {
  PROJECT_TYPES,
  classifyProjectType,
  getTemplates,
  TEMPLATES,
  generateScaffold,
  writeScaffoldReport,
  readScaffoldReport,
  scaffold,
};
