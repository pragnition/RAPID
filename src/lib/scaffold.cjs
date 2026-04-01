'use strict';

const fs = require('fs');
const path = require('path');
const stub = require('./stub.cjs');

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

// ── Task 6: Group-Aware Stub Orchestration ──

/**
 * Generate stubs for all cross-group dependencies that a given group needs
 * from other groups. This is the group-aware orchestration layer on top of
 * the per-set generateStub() from stub.cjs.
 *
 * @param {string} cwd - Project root directory
 * @param {string} groupId - Target group identifier
 * @param {Record<string, {sets: string[]}>} allGroups - All groups (same format as dag.groups)
 * @param {Record<string, object>|Array<{setId: string, contract: object}>} contracts - Contracts keyed by setId or array of {setId, contract}
 * @returns {Promise<{files: Array<{stub: string, sidecar: string}>, report: string}>}
 */
async function generateGroupStubs(cwd, groupId, allGroups, contracts) {
  // Normalize contracts to Record<string, object>
  let contractMap = contracts;
  if (Array.isArray(contracts)) {
    contractMap = {};
    for (const entry of contracts) {
      contractMap[entry.setId] = entry.contract;
    }
  }

  // Determine which sets belong to the target group
  const targetGroup = allGroups[groupId];
  if (!targetGroup) {
    return { files: [], report: `Group ${groupId}: no such group` };
  }
  const targetSetIds = new Set(targetGroup.sets);

  // Build set-to-group lookup
  const setToGroup = {};
  for (const [gId, gDef] of Object.entries(allGroups)) {
    for (const setId of gDef.sets) {
      setToGroup[setId] = gId;
    }
  }

  // Find cross-group provider sets by examining imports of sets in the target group
  const crossGroupProviders = new Set();
  for (const setId of targetSetIds) {
    const contract = contractMap[setId];
    if (!contract) continue;

    const importsData = contract.imports;
    if (!importsData) continue;

    // Support both import formats
    let importedSets = [];
    if (Array.isArray(importsData.fromSets)) {
      importedSets = importsData.fromSets.map(entry => entry.set);
    } else if (typeof importsData === 'object' && !importsData.fromSets) {
      for (const [, importDef] of Object.entries(importsData)) {
        if (importDef && importDef.fromSet) {
          importedSets.push(importDef.fromSet);
        }
      }
    }

    for (const importedSet of importedSets) {
      // Only include sets that are in a DIFFERENT group
      if (!targetSetIds.has(importedSet) && setToGroup[importedSet] && setToGroup[importedSet] !== groupId) {
        crossGroupProviders.add(importedSet);
      }
    }
  }

  if (crossGroupProviders.size === 0) {
    return { files: [], report: `Group ${groupId}: generated 0 cross-group stubs` };
  }

  // Create stubs directory
  const stubsDir = path.join(cwd, '.rapid-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });

  const files = [];
  const reportLines = [`Group ${groupId}: generated ${crossGroupProviders.size} cross-group stubs`];

  for (const providerSetId of crossGroupProviders) {
    const providerContract = contractMap[providerSetId];
    if (!providerContract) continue;

    const stubContent = stub.generateStub(providerContract, providerSetId);
    const stubFile = path.join(stubsDir, `${providerSetId}-stub.cjs`);
    const sidecarFile = `${stubFile}.rapid-stub`;

    fs.writeFileSync(stubFile, stubContent, 'utf-8');
    fs.writeFileSync(sidecarFile, '', 'utf-8');

    // Count exports for the report
    const exportsData = providerContract.exports || {};
    let exportCount = 0;
    if (Array.isArray(exportsData.functions)) {
      exportCount = exportsData.functions.length;
    } else {
      exportCount = Object.keys(exportsData).length;
    }

    files.push({ stub: stubFile, sidecar: sidecarFile });
    reportLines.push(`  - ${providerSetId} (${exportCount} exports) -> .rapid-stubs/${providerSetId}-stub.cjs`);
  }

  return { files, report: reportLines.join('\n') };
}

// ── Task 7: Foundation Set Creator ──

/**
 * Create a foundational set #0 entry in the planning directory.
 * Creates a normal set definition with foundation: true annotation for DAG consumption.
 *
 * @param {string} cwd - Project root directory
 * @param {{ name?: string, sets: string[], contracts: Record<string, object> }} setConfig
 * @returns {Promise<void>}
 */
async function createFoundationSet(cwd, setConfig) {
  const name = setConfig.name || 'foundation';
  const setDir = path.join(cwd, '.planning', 'sets', name);
  fs.mkdirSync(setDir, { recursive: true });

  // Write DEFINITION.md
  const definitionContent = `# Set: ${name}
## Scope
Foundation set containing shared interfaces and stubs for multi-group parallel development.
This set must not contain feature implementation logic.
## Foundation
true
`;
  fs.writeFileSync(path.join(setDir, 'DEFINITION.md'), definitionContent, 'utf-8');

  // Merge all exports from all provided contracts into a single contract
  const mergedExports = {};
  for (const [setId, contract] of Object.entries(setConfig.contracts)) {
    const exportsData = contract.exports || {};

    if (Array.isArray(exportsData.functions)) {
      // Legacy format -- merge function entries by name
      for (const fn of exportsData.functions) {
        mergedExports[fn.name] = {
          type: 'function',
          signature: `${fn.name}(${fn.params.map(p => `${p.name}: ${p.type}`).join(', ')}): ${fn.returns}`,
          description: fn.description || `From set ${setId}`,
          sourceSet: setId,
        };
      }
    } else {
      // New flat format -- merge by key
      for (const [exportName, exportDef] of Object.entries(exportsData)) {
        mergedExports[exportName] = {
          ...exportDef,
          sourceSet: setId,
        };
      }
    }
  }

  const contractJson = {
    foundation: true,
    definition: {
      scope: 'Foundation set containing shared interfaces and stubs for multi-group parallel development.',
    },
    exports: mergedExports,
  };

  fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), JSON.stringify(contractJson, null, 2), 'utf-8');
}

// ── Task 8: Scaffold Report v2 Extension ──

/**
 * Extend a v1 ScaffoldReport with v2 group-aware fields.
 *
 * All v2 fields are optional -- missing fields default to null/empty.
 * Existing v1 consumers will ignore unknown fields (additive, no migration needed).
 *
 * @param {Object} v1Report - A v1 ScaffoldReport object
 * @param {{ groups?: Record<string, {sets: string[]}>, stubs?: string[], foundationSet?: string }} groupData
 * @returns {Object} Extended report with groups, stubs, and foundationSet fields
 */
function buildScaffoldReportV2(v1Report, groupData) {
  return {
    ...v1Report,
    groups: (groupData && groupData.groups) || null,
    stubs: (groupData && groupData.stubs) || [],
    foundationSet: (groupData && groupData.foundationSet) || null,
  };
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
  generateGroupStubs,
  createFoundationSet,
  buildScaffoldReportV2,
};
