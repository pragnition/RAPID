'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const { TOOL_REGISTRY, ROLE_TOOL_MAP } = require('../lib/tool-docs.cjs');

// ---------------------------------------------------------------------------
// Helpers: parse internal maps from build-agents.cjs source
// ---------------------------------------------------------------------------
const BUILD_AGENTS_SRC = fs.readFileSync(path.join(__dirname, 'build-agents.cjs'), 'utf-8');

/**
 * Extract a JS object literal from build-agents.cjs by variable name.
 * Returns the raw text between the opening { and its matching }.
 */
function extractObjectBlock(varName) {
  const pattern = new RegExp(`const ${varName}\\s*=\\s*\\{`);
  const match = pattern.exec(BUILD_AGENTS_SRC);
  if (!match) return null;
  let depth = 1;
  let i = match.index + match[0].length;
  while (i < BUILD_AGENTS_SRC.length && depth > 0) {
    if (BUILD_AGENTS_SRC[i] === '{') depth++;
    if (BUILD_AGENTS_SRC[i] === '}') depth--;
    i++;
  }
  return BUILD_AGENTS_SRC.slice(match.index + match[0].length, i - 1);
}

/**
 * Extract keys from an object block -- handles both quoted ('key':) and
 * unquoted (key:) property names, skipping comments.
 */
function extractKeys(block) {
  if (!block) return [];
  const keys = [];
  // Match either 'quoted-key': or unquotedKey: at line start (after whitespace)
  // Skip lines that are comments
  const re = /^\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z_$][\w$-]*))\s*:/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    // Check this isn't inside a comment
    const lineStart = block.lastIndexOf('\n', m.index) + 1;
    const linePrefix = block.slice(lineStart, m.index).trim();
    if (linePrefix.startsWith('//')) continue;
    keys.push(m[1] || m[2] || m[3]);
  }
  return keys;
}

// Parse internal maps
const roleCoreMapBlock = extractObjectBlock('ROLE_CORE_MAP');
const roleToolsBlock = extractObjectBlock('ROLE_TOOLS');
const roleColorsBlock = extractObjectBlock('ROLE_COLORS');
const roleDescriptionsBlock = extractObjectBlock('ROLE_DESCRIPTIONS');

const roleCoreMapKeys = extractKeys(roleCoreMapBlock);
const roleToolsKeys = extractKeys(roleToolsBlock);
const roleColorsKeys = extractKeys(roleColorsBlock);
const roleDescriptionsKeys = extractKeys(roleDescriptionsBlock);

// ---------------------------------------------------------------------------
// Test 8: ROLE_CORE_MAP covers exactly 27 roles
// ---------------------------------------------------------------------------
describe('ROLE_CORE_MAP', () => {
  it('covers exactly 27 roles', () => {
    assert.equal(
      roleCoreMapKeys.length, 27,
      `Expected 27 roles in ROLE_CORE_MAP, got ${roleCoreMapKeys.length}: ${roleCoreMapKeys.join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 9: ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS have same keys as ROLE_CORE_MAP
// ---------------------------------------------------------------------------
describe('role map key consistency', () => {
  it('ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS all have same keys as ROLE_CORE_MAP', () => {
    const coreSet = new Set(roleCoreMapKeys);
    const toolsSet = new Set(roleToolsKeys);
    const colorsSet = new Set(roleColorsKeys);
    const descsSet = new Set(roleDescriptionsKeys);

    // ROLE_TOOLS should match ROLE_CORE_MAP
    for (const key of coreSet) {
      assert.ok(toolsSet.has(key), `ROLE_TOOLS missing key "${key}" from ROLE_CORE_MAP`);
    }
    for (const key of toolsSet) {
      assert.ok(coreSet.has(key), `ROLE_TOOLS has extra key "${key}" not in ROLE_CORE_MAP`);
    }

    // ROLE_COLORS should match ROLE_CORE_MAP
    for (const key of coreSet) {
      assert.ok(colorsSet.has(key), `ROLE_COLORS missing key "${key}" from ROLE_CORE_MAP`);
    }
    for (const key of colorsSet) {
      assert.ok(coreSet.has(key), `ROLE_COLORS has extra key "${key}" not in ROLE_CORE_MAP`);
    }

    // ROLE_DESCRIPTIONS should match ROLE_CORE_MAP
    for (const key of coreSet) {
      assert.ok(descsSet.has(key), `ROLE_DESCRIPTIONS missing key "${key}" from ROLE_CORE_MAP`);
    }
    for (const key of descsSet) {
      assert.ok(coreSet.has(key), `ROLE_DESCRIPTIONS has extra key "${key}" not in ROLE_CORE_MAP`);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests 10-11: SKIP_GENERATION
// ---------------------------------------------------------------------------
describe('SKIP_GENERATION', () => {
  let skipRoles;

  before(() => {
    const match = BUILD_AGENTS_SRC.match(/SKIP_GENERATION\s*=\s*\[([^\]]+)\]/);
    assert.ok(match, 'Could not find SKIP_GENERATION in build-agents.cjs');
    skipRoles = match[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
  });

  it('contains exactly 4 entries: planner, executor, merger, reviewer', () => {
    assert.equal(skipRoles.length, 4, `Expected 4 entries, got ${skipRoles.length}`);
    assert.deepStrictEqual(
      skipRoles.sort(),
      ['executor', 'merger', 'planner', 'reviewer']
    );
  });

  it('SKIP_GENERATION roles are all in ROLE_CORE_MAP', () => {
    const coreSet = new Set(roleCoreMapKeys);
    for (const role of skipRoles) {
      assert.ok(coreSet.has(role), `SKIP_GENERATION role "${role}" not found in ROLE_CORE_MAP`);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 12: generateFrontmatter produces valid YAML frontmatter
// ---------------------------------------------------------------------------
describe('generateFrontmatter (source inspection)', () => {
  it('produces valid YAML frontmatter structure', () => {
    // Read a generated agent file to verify frontmatter
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    assert.ok(files.length > 0, 'No agent files found');

    // Pick a generated file (not hand-written)
    const generated = files.find(f => {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
      return content.startsWith('<!-- GENERATED by build-agents');
    });
    assert.ok(generated, 'No GENERATED agent files found');

    const content = fs.readFileSync(path.join(agentsDir, generated), 'utf-8');
    // Strip the GENERATED comment line to find frontmatter
    const afterComment = content.replace(/^<!-- [^>]+ -->\n/, '');
    assert.ok(afterComment.startsWith('---\n'), 'Frontmatter does not start with ---');

    const endIdx = afterComment.indexOf('---', 4);
    assert.ok(endIdx > 0, 'Frontmatter does not have closing ---');

    const frontmatter = afterComment.slice(4, endIdx);
    assert.ok(frontmatter.includes('name:'), 'Frontmatter missing name field');
    assert.ok(frontmatter.includes('description:'), 'Frontmatter missing description field');
    assert.ok(frontmatter.includes('tools:'), 'Frontmatter missing tools field');
    assert.ok(frontmatter.includes('model:'), 'Frontmatter missing model field');
    assert.ok(frontmatter.includes('color:'), 'Frontmatter missing color field');
  });
});

// ---------------------------------------------------------------------------
// Tests 13-17: assembleAgentPrompt section ordering
// ---------------------------------------------------------------------------
describe('assembleAgentPrompt section ordering', () => {
  let generatedContent;

  before(() => {
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    // Find a generated agent with <tools> section (i.e., a CLI role)
    for (const f of files) {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
      if (content.startsWith('<!-- GENERATED by build-agents') && content.includes('<tools>')) {
        generatedContent = content;
        break;
      }
    }
    assert.ok(generatedContent, 'No generated agent with <tools> section found');
  });

  it('has all required sections in order: <identity> before <role> before <returns>', () => {
    const identityIdx = generatedContent.indexOf('<identity>');
    const roleIdx = generatedContent.indexOf('<role>');
    const returnsIdx = generatedContent.indexOf('<returns>');

    assert.ok(identityIdx >= 0, 'Missing <identity> section');
    assert.ok(roleIdx >= 0, 'Missing <role> section');
    assert.ok(returnsIdx >= 0, 'Missing <returns> section');
    assert.ok(identityIdx < roleIdx, '<identity> must come before <role>');
    assert.ok(roleIdx < returnsIdx, '<role> must come before <returns>');
  });

  it('defers returns to after role', () => {
    const roleEndIdx = generatedContent.indexOf('</role>');
    const returnsIdx = generatedContent.indexOf('<returns>');
    assert.ok(roleEndIdx >= 0, 'Missing </role> closing tag');
    assert.ok(returnsIdx >= 0, 'Missing <returns> section');
    assert.ok(returnsIdx > roleEndIdx, '<returns> must come after </role>');
  });

  it('injects tools between identity and role for CLI roles', () => {
    const identityEndIdx = generatedContent.indexOf('</identity>');
    const toolsIdx = generatedContent.indexOf('<tools>');
    const roleIdx = generatedContent.indexOf('<role>');
    assert.ok(toolsIdx >= 0, 'Missing <tools> section in CLI role agent');
    assert.ok(toolsIdx > identityEndIdx, '<tools> must come after </identity>');
    assert.ok(toolsIdx < roleIdx, '<tools> must come before <role>');
  });

  it('omits tools for no-CLI roles', () => {
    // research-stack has no CLI commands -- find its generated agent file
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const researchFile = path.join(agentsDir, 'rapid-research-stack.md');
    assert.ok(fs.existsSync(researchFile), 'rapid-research-stack.md not found');
    const content = fs.readFileSync(researchFile, 'utf-8');
    assert.ok(!content.includes('<tools>'), 'research-stack should NOT have <tools> section');
  });

  it('includes conventions only when specified in ROLE_CORE_MAP', () => {
    const agentsDir = path.join(__dirname, '..', '..', 'agents');

    // Roles that should have conventions (from ROLE_CORE_MAP source)
    const rolesWithConventions = roleCoreMapKeys.filter(role => {
      const block = roleCoreMapBlock;
      // Find the entry for this role and check if it includes core-conventions.md
      const entryRe = new RegExp(`'${role}'\\s*:\\s*\\[([^\\]]+)\\]`);
      const m = entryRe.exec(block);
      return m && m[1].includes('core-conventions.md');
    });

    // Check generated agents (non-SKIP_GENERATION)
    const skipSet = new Set(['planner', 'executor', 'merger', 'reviewer']);

    for (const role of roleCoreMapKeys) {
      if (skipSet.has(role)) continue; // Skip hand-written agents
      const filePath = path.join(agentsDir, `rapid-${role}.md`);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');

      if (rolesWithConventions.includes(role)) {
        assert.ok(
          content.includes('<conventions>'),
          `rapid-${role}.md should have <conventions> section (core-conventions.md in ROLE_CORE_MAP)`
        );
      } else {
        assert.ok(
          !content.includes('<conventions>'),
          `rapid-${role}.md should NOT have <conventions> section`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test 18: build-agents produces 23 generated + 4 skipped
// ---------------------------------------------------------------------------
describe('build-agents output', () => {
  it('produces 23 generated + 4 skipped agent files', () => {
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.startsWith('rapid-') && f.endsWith('.md'));

    let generated = 0;
    let handWritten = 0;
    for (const f of files) {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
      if (content.startsWith('<!-- GENERATED by build-agents')) {
        generated++;
      } else if (content.startsWith('<!-- CORE:') || content.startsWith('<!-- STUB:')) {
        handWritten++;
      }
    }

    assert.equal(generated, 23, `Expected 23 generated agents, got ${generated}`);
    assert.ok(handWritten >= 4, `Expected at least 4 hand-written/stub agents, got ${handWritten}`);
  });
});

// ---------------------------------------------------------------------------
// Test 19: no agent tools section references unknown TOOL_REGISTRY key
// ---------------------------------------------------------------------------
describe('agent tool reference integrity', () => {
  it('no agent tools section references unknown TOOL_REGISTRY key', () => {
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const f of files) {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
      const toolsMatch = content.match(/<tools>([\s\S]*?)<\/tools>/);
      if (!toolsMatch) continue;

      const toolsSection = toolsMatch[1];
      // Extract keys from "  key: ..." lines
      const keyPattern = /^\s{2}(\S+):/gm;
      let m;
      while ((m = keyPattern.exec(toolsSection)) !== null) {
        const key = m[1];
        if (key === '#') continue; // Skip header comment
        assert.ok(
          key in TOOL_REGISTRY,
          `agents/${f} <tools> section references unknown key "${key}" not in TOOL_REGISTRY`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test 20: handleBuildAgents runs end-to-end without errors
// ---------------------------------------------------------------------------
describe('handleBuildAgents end-to-end', () => {
  it('runs without errors and agent files exist afterwards', () => {
    const { handleBuildAgents } = require('./build-agents.cjs');
    // Capture output by temporarily replacing process stdout
    const messages = [];
    const origStdoutWrite = process.stdout.write;
    process.stdout.write = function(chunk) {
      messages.push(chunk.toString());
      return true;
    };

    try {
      assert.doesNotThrow(() => handleBuildAgents(process.cwd(), []));
    } finally {
      process.stdout.write = origStdoutWrite;
    }

    // Verify some agent files exist
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    assert.ok(fs.existsSync(path.join(agentsDir, 'rapid-verifier.md')), 'rapid-verifier.md missing');
    assert.ok(fs.existsSync(path.join(agentsDir, 'rapid-bugfix.md')), 'rapid-bugfix.md missing');
    assert.ok(fs.existsSync(path.join(agentsDir, 'rapid-executor.md')), 'rapid-executor.md missing');

    // Check that output mentioned building agents
    const outputStr = messages.join('');
    assert.ok(outputStr.includes('Built'), `Expected "Built" in output, got: ${outputStr}`);
  });
});

// ---------------------------------------------------------------------------
// Tests 21-24: Structural assertions on agent .md files
// ---------------------------------------------------------------------------
describe('rapid-executor.md structural assertions', () => {
  const filePath = path.join(__dirname, '..', '..', 'agents', 'rapid-executor.md');

  it('<tools> section lists exactly 7 commands matching ROLE_TOOL_MAP', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const toolsMatch = content.match(/<tools>([\s\S]*?)<\/tools>/);
    assert.ok(toolsMatch, 'rapid-executor.md missing <tools> section');

    const toolsSection = toolsMatch[1];
    const keys = [];
    const keyPattern = /^\s{2}(\S+):/gm;
    let m;
    while ((m = keyPattern.exec(toolsSection)) !== null) {
      if (m[1] === '#') continue;
      keys.push(m[1]);
    }

    assert.equal(keys.length, 7, `Expected 7 tool keys, got ${keys.length}: ${keys.join(', ')}`);

    const expected = ROLE_TOOL_MAP['executor'];
    assert.deepStrictEqual(keys.sort(), expected.slice().sort());
  });

  it('is not overwritten by build-agents (starts with CORE comment)', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(
      content.startsWith('<!-- CORE:'),
      `rapid-executor.md should start with "<!-- CORE:" but starts with: "${content.slice(0, 40)}"`
    );
    assert.ok(
      !content.startsWith('<!-- GENERATED by build-agents'),
      'rapid-executor.md should NOT start with GENERATED comment'
    );
  });
});

describe('rapid-planner.md structural assertions', () => {
  const filePath = path.join(__dirname, '..', '..', 'agents', 'rapid-planner.md');

  it('<tools> section lists exactly 11 commands matching ROLE_TOOL_MAP', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const toolsMatch = content.match(/<tools>([\s\S]*?)<\/tools>/);
    assert.ok(toolsMatch, 'rapid-planner.md missing <tools> section');

    const toolsSection = toolsMatch[1];
    const keys = [];
    const keyPattern = /^\s{2}(\S+):/gm;
    let m;
    while ((m = keyPattern.exec(toolsSection)) !== null) {
      if (m[1] === '#') continue;
      keys.push(m[1]);
    }

    assert.equal(keys.length, 11, `Expected 11 tool keys, got ${keys.length}: ${keys.join(', ')}`);

    const expected = ROLE_TOOL_MAP['planner'];
    assert.deepStrictEqual(keys.sort(), expected.slice().sort());
  });

  it('is not overwritten by build-agents (starts with CORE comment)', () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(
      content.startsWith('<!-- CORE:'),
      `rapid-planner.md should start with "<!-- CORE:" but starts with: "${content.slice(0, 40)}"`
    );
    assert.ok(
      !content.startsWith('<!-- GENERATED by build-agents'),
      'rapid-planner.md should NOT start with GENERATED comment'
    );
  });
});
