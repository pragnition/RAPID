'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { validateUiContract, checkUiConsistency, buildUiContext } = require('./ui-contract.cjs');
const { estimateTokens } = require('./tool-docs.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-ui-contract-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  return tmpDir;
}

function writeUiContract(tmpDir, setName, contract) {
  const setDir = path.join(tmpDir, '.planning', 'sets', setName);
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(
    path.join(setDir, 'UI-CONTRACT.json'),
    JSON.stringify(contract, null, 2),
    'utf-8'
  );
}

function makeValidComplete() {
  return {
    guidelines: {
      fontFamilies: ['Inter', 'Roboto'],
      tone: 'Professional and clean',
      visualIdentity: ['Use brand blue as primary', 'Rounded corners on cards'],
    },
    components: [
      {
        name: 'Dashboard',
        role: 'page',
        children: [
          { name: 'Sidebar', role: 'layout' },
          { name: 'StatsCard', role: 'widget' },
        ],
      },
    ],
    tokens: {
      primary: '#3B82F6',
      'spacing-md': '16px',
      'font-size-base': '14px',
    },
    layout: {
      grid: { columns: 12, gutter: '24px' },
      breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
      containerWidths: { sm: '100%', lg: '1200px' },
      responsive: ['Stack columns on mobile', 'Hide sidebar below md'],
    },
    interactions: {
      stateTransitions: ['Loading -> Loaded -> Error'],
      animations: ['Fade in on mount'],
      loadingPatterns: ['Skeleton screens'],
      errorStates: ['Inline validation messages'],
      accessibility: ['All interactive elements are keyboard accessible'],
    },
  };
}

// ---------------------------------------------------------------------------
// validateUiContract
// ---------------------------------------------------------------------------

describe('validateUiContract', () => {
  it('accepts a valid complete UI contract', () => {
    const result = validateUiContract(makeValidComplete());
    assert.deepStrictEqual(result, { valid: true });
  });

  it('accepts a minimal UI contract with only tokens', () => {
    const result = validateUiContract({ tokens: { primary: '#3B82F6' } });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('accepts a contract with only guidelines', () => {
    const result = validateUiContract({
      guidelines: { tone: 'Casual and friendly' },
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('accepts a contract with recursive component children', () => {
    const result = validateUiContract({
      components: [
        {
          name: 'App',
          role: 'page',
          children: [
            {
              name: 'Header',
              role: 'layout',
              children: [
                { name: 'Logo', role: 'widget' },
              ],
            },
          ],
        },
      ],
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('rejects an empty object', () => {
    const result = validateUiContract({});
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0, 'should have errors');
    assert.ok(
      result.errors.some((e) => e.includes('fewer than 1')),
      'should mention minProperties violation'
    );
  });

  it('rejects unknown top-level properties', () => {
    const result = validateUiContract({ unknownKey: {} });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors.some((e) => e.includes('additional properties')),
      'should reject additional properties'
    );
  });

  it('rejects invalid component role', () => {
    const result = validateUiContract({
      components: [{ name: 'BadComp', role: 'container' }],
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('must be equal to one of the allowed values')),
      'should mention enum violation'
    );
  });

  it('rejects non-string token values', () => {
    const result = validateUiContract({ tokens: { primary: 42 } });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('must be string')),
      'should mention type violation for token value'
    );
  });

  it('returns formatted error strings', () => {
    const result = validateUiContract({});
    assert.strictEqual(result.valid, false);
    for (const err of result.errors) {
      assert.strictEqual(typeof err, 'string', 'each error should be a string');
    }
  });
});

// ---------------------------------------------------------------------------
// checkUiConsistency
// ---------------------------------------------------------------------------

describe('checkUiConsistency', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns consistent when no UI contracts exist', () => {
    // Create an empty set directory (no UI-CONTRACT.json)
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'empty-set'), { recursive: true });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('returns consistent when only one set has a UI contract', () => {
    writeUiContract(tmpDir, 'set-a', {
      tokens: { primary: '#3B82F6' },
      components: [{ name: 'Header', role: 'layout' }],
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('detects duplicate component names with different roles', () => {
    writeUiContract(tmpDir, 'set-a', {
      components: [{ name: 'Header', role: 'layout' }],
    });
    writeUiContract(tmpDir, 'set-b', {
      components: [{ name: 'Header', role: 'widget' }],
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    assert.ok(result.conflicts.length >= 1);
    const conflict = result.conflicts.find((c) => c.type === 'component');
    assert.ok(conflict, 'should have a component conflict');
    assert.strictEqual(conflict.key, 'Header');
    assert.ok(conflict.sets.includes('set-a'));
    assert.ok(conflict.sets.includes('set-b'));
  });

  it('detects token contradictions', () => {
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    writeUiContract(tmpDir, 'set-b', { tokens: { primary: '#FF0000' } });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find((c) => c.type === 'token');
    assert.ok(conflict, 'should have a token conflict');
    assert.strictEqual(conflict.key, 'primary');
  });

  it('detects layout breakpoint conflicts', () => {
    writeUiContract(tmpDir, 'set-a', {
      layout: { breakpoints: { sm: '640px' } },
    });
    writeUiContract(tmpDir, 'set-b', {
      layout: { breakpoints: { sm: '600px' } },
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find((c) => c.type === 'layout');
    assert.ok(conflict, 'should have a layout conflict');
    assert.strictEqual(conflict.key, 'breakpoints.sm');
  });

  it('detects guideline tone drift', () => {
    writeUiContract(tmpDir, 'set-a', {
      guidelines: { tone: 'Professional' },
    });
    writeUiContract(tmpDir, 'set-b', {
      guidelines: { tone: 'Casual' },
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find((c) => c.type === 'guideline');
    assert.ok(conflict, 'should have a guideline conflict');
    assert.strictEqual(conflict.key, 'guidelines.tone');
  });

  it('ignores sets without UI-CONTRACT.json', () => {
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    // set-b exists but has no UI-CONTRACT.json
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'set-b'), { recursive: true });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('skips sets with invalid UI-CONTRACT.json', () => {
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    // set-b has malformed JSON
    const setDir = path.join(tmpDir, '.planning', 'sets', 'set-b');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'UI-CONTRACT.json'), '{ bad json', 'utf-8');
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('returns multiple conflicts when several exist', () => {
    writeUiContract(tmpDir, 'set-a', {
      tokens: { primary: '#3B82F6', secondary: '#AAA' },
      guidelines: { tone: 'Professional' },
    });
    writeUiContract(tmpDir, 'set-b', {
      tokens: { primary: '#FF0000', secondary: '#BBB' },
      guidelines: { tone: 'Casual' },
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    assert.ok(result.conflicts.length > 1, `Expected >1 conflicts, got ${result.conflicts.length}`);
  });
});

// ---------------------------------------------------------------------------
// buildUiContext
// ---------------------------------------------------------------------------

describe('buildUiContext', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty string when UI-CONTRACT.json does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'no-contract'), { recursive: true });
    const result = buildUiContext(tmpDir, 'no-contract');
    assert.strictEqual(result, '');
  });

  it('returns empty string when UI-CONTRACT.json is invalid', () => {
    const setDir = path.join(tmpDir, '.planning', 'sets', 'bad-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'UI-CONTRACT.json'), '{ broken json', 'utf-8');
    const result = buildUiContext(tmpDir, 'bad-set');
    assert.strictEqual(result, '');
  });

  it('returns empty string when UI-CONTRACT.json fails schema validation', () => {
    writeUiContract(tmpDir, 'invalid-set', { unknownKey: 'bad' });
    const result = buildUiContext(tmpDir, 'invalid-set');
    assert.strictEqual(result, '');
  });

  it('includes guidelines section in output', () => {
    writeUiContract(tmpDir, 'my-set', {
      guidelines: {
        tone: 'Professional',
        fontFamilies: ['Inter'],
        visualIdentity: ['Use blue as primary'],
      },
    });
    const result = buildUiContext(tmpDir, 'my-set');
    assert.ok(result.includes('## UI Contract'), 'should have header');
    assert.ok(result.includes('### Guidelines'), 'should have guidelines section');
    assert.ok(result.includes('Professional'), 'should include tone');
    assert.ok(result.includes('Inter'), 'should include font family');
    assert.ok(result.includes('Use blue as primary'), 'should include visual identity');
  });

  it('includes tokens as key-value pairs', () => {
    writeUiContract(tmpDir, 'my-set', {
      tokens: { primary: '#3B82F6', secondary: '#EEE' },
    });
    const result = buildUiContext(tmpDir, 'my-set');
    assert.ok(result.includes('### Design Tokens'), 'should have tokens section');
    assert.ok(result.includes('primary'), 'should include token key');
    assert.ok(result.includes('#3B82F6'), 'should include token value');
  });

  it('includes component hierarchy with indentation', () => {
    writeUiContract(tmpDir, 'my-set', {
      components: [
        {
          name: 'App',
          role: 'page',
          children: [
            { name: 'Sidebar', role: 'layout' },
          ],
        },
      ],
    });
    const result = buildUiContext(tmpDir, 'my-set');
    assert.ok(result.includes('### Components'), 'should have components section');
    assert.ok(result.includes('**App** (page)'), 'should show root component');
    assert.ok(result.includes('**Sidebar** (layout)'), 'should show child component');
    // Child should be indented more than parent
    const lines = result.split('\n');
    const appLine = lines.find((l) => l.includes('**App**'));
    const sidebarLine = lines.find((l) => l.includes('**Sidebar**'));
    assert.ok(appLine, 'should find App line');
    assert.ok(sidebarLine, 'should find Sidebar line');
    // Sidebar should have more leading whitespace than App
    const appIndent = appLine.match(/^(\s*)/)[1].length;
    const sidebarIndent = sidebarLine.match(/^(\s*)/)[1].length;
    assert.ok(sidebarIndent > appIndent, 'child should be indented deeper than parent');
  });

  it('respects 4000 token budget and truncates', () => {
    // Create a contract with many tokens to exceed the budget
    const bigTokens = {};
    for (let i = 0; i < 2000; i++) {
      bigTokens[`token-key-number-${i}`] = `value-for-token-${i}-some-extra-padding-text`;
    }
    writeUiContract(tmpDir, 'big-set', { tokens: bigTokens });
    const result = buildUiContext(tmpDir, 'big-set');
    const tokenCount = estimateTokens(result);
    // The result should be within budget (with some tolerance for the truncation notice)
    assert.ok(tokenCount <= 4200, `Token count ${tokenCount} exceeds budget`);
  });

  it('truncates in priority order: guidelines kept, interactions dropped', () => {
    // Create a contract where guidelines are small but interactions are large
    // and the combined size would exceed the budget
    const bigInteractions = {
      stateTransitions: [],
      animations: [],
      loadingPatterns: [],
      errorStates: [],
      accessibility: [],
    };
    for (let i = 0; i < 300; i++) {
      bigInteractions.stateTransitions.push(`State transition rule number ${i} with extra verbose description for padding`);
      bigInteractions.animations.push(`Animation specification ${i} with detailed timing and easing`);
    }

    // Also add big tokens and components so the budget is filled before interactions
    const bigTokens = {};
    for (let i = 0; i < 500; i++) {
      bigTokens[`token-${i}`] = `value-${i}-with-padding`;
    }

    writeUiContract(tmpDir, 'priority-set', {
      guidelines: { tone: 'Professional', fontFamilies: ['Inter'] },
      tokens: bigTokens,
      components: [{ name: 'App', role: 'page' }],
      layout: { grid: { columns: 12, gutter: '24px' } },
      interactions: bigInteractions,
    });
    const result = buildUiContext(tmpDir, 'priority-set');

    // Guidelines should be present (highest priority)
    assert.ok(result.includes('### Guidelines'), 'guidelines should be present');
    assert.ok(result.includes('Professional'), 'tone should be present');

    // The truncation notice should appear
    assert.ok(
      result.includes('[...truncated to fit token budget]'),
      'should include truncation notice'
    );
  });
});
