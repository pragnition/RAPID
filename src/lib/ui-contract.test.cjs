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

  // --- NEW TESTS (1-10) ---

  it('accepts contract with only layout section', () => {
    const result = validateUiContract({
      layout: { grid: { columns: 12, gutter: '16px' } },
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('accepts contract with only interactions section', () => {
    const result = validateUiContract({
      interactions: { stateTransitions: ['idle -> loading'] },
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('accepts contract with only components section', () => {
    const result = validateUiContract({
      components: [{ name: 'Widget', role: 'widget' }],
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('rejects component missing required name field', () => {
    const result = validateUiContract({
      components: [{ role: 'page' }],
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('name')),
      'should mention missing name property'
    );
  });

  it('rejects component missing required role field', () => {
    const result = validateUiContract({
      components: [{ name: 'Orphan' }],
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('role')),
      'should mention missing role property'
    );
  });

  it('accepts empty components array', () => {
    const result = validateUiContract({
      tokens: { primary: '#000' },
      components: [],
    });
    assert.deepStrictEqual(result, { valid: true });
  });

  it('rejects non-object input (null)', () => {
    const result = validateUiContract(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0, 'should have validation errors');
  });

  it('rejects non-object input (array)', () => {
    const result = validateUiContract([{ tokens: {} }]);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0, 'should have validation errors');
  });

  it('rejects interactions with unknown properties', () => {
    const result = validateUiContract({
      interactions: { stateTransitions: ['a -> b'], customField: true },
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('additional properties')),
      'should reject additional properties in interactions'
    );
  });

  it('rejects layout with unknown properties', () => {
    const result = validateUiContract({
      layout: { grid: { columns: 12 }, unknownProp: 'bad' },
    });
    assert.strictEqual(result.valid, false);
    assert.ok(
      result.errors.some((e) => e.includes('additional properties')),
      'should reject additional properties in layout'
    );
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

  // --- NEW TESTS (11-19) ---

  it('skips schema-invalid contracts (valid JSON, bad schema)', () => {
    // set-a has a valid contract, set-b has valid JSON but fails schema
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    writeUiContract(tmpDir, 'set-b', { unknownKey: 'not-in-schema' });
    const result = checkUiConsistency(tmpDir);
    // set-b is skipped due to schema failure, so no conflicts
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('detects grid.columns conflicts across sets', () => {
    writeUiContract(tmpDir, 'set-a', {
      layout: { grid: { columns: 12 } },
    });
    writeUiContract(tmpDir, 'set-b', {
      layout: { grid: { columns: 16 } },
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find((c) => c.key === 'grid.columns');
    assert.ok(conflict, 'should have a grid.columns conflict');
    assert.strictEqual(conflict.type, 'layout');
    assert.ok(conflict.sets.includes('set-a'));
    assert.ok(conflict.sets.includes('set-b'));
  });

  it('detects grid.gutter conflicts across sets', () => {
    writeUiContract(tmpDir, 'set-a', {
      layout: { grid: { gutter: '24px' } },
    });
    writeUiContract(tmpDir, 'set-b', {
      layout: { grid: { gutter: '16px' } },
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find((c) => c.key === 'grid.gutter');
    assert.ok(conflict, 'should have a grid.gutter conflict');
    assert.strictEqual(conflict.type, 'layout');
  });

  it('no conflict when same component name has same role across sets', () => {
    writeUiContract(tmpDir, 'set-a', {
      components: [{ name: 'Header', role: 'layout' }],
    });
    writeUiContract(tmpDir, 'set-b', {
      components: [{ name: 'Header', role: 'layout' }],
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('no conflict when same token has same value across sets', () => {
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    writeUiContract(tmpDir, 'set-b', { tokens: { primary: '#3B82F6' } });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('no conflict when tone matches case-insensitively across sets', () => {
    writeUiContract(tmpDir, 'set-a', {
      guidelines: { tone: 'Professional' },
    });
    writeUiContract(tmpDir, 'set-b', {
      guidelines: { tone: 'professional' },
    });
    const result = checkUiConsistency(tmpDir);
    // Tone comparison is case-insensitive, so these should not conflict
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
  });

  it('detects nested child component role conflicts across sets', () => {
    // set-a has "Sidebar" as a child of Dashboard with role "layout"
    writeUiContract(tmpDir, 'set-a', {
      components: [
        {
          name: 'Dashboard',
          role: 'page',
          children: [{ name: 'Sidebar', role: 'layout' }],
        },
      ],
    });
    // set-b has "Sidebar" at top level with role "widget"
    writeUiContract(tmpDir, 'set-b', {
      components: [{ name: 'Sidebar', role: 'widget' }],
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    const conflict = result.conflicts.find(
      (c) => c.type === 'component' && c.key === 'Sidebar'
    );
    assert.ok(conflict, 'should detect child vs top-level component conflict');
    assert.ok(conflict.details.includes('layout'), 'should mention layout role');
    assert.ok(conflict.details.includes('widget'), 'should mention widget role');
  });

  it('handles three sets with pairwise conflicts', () => {
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#AAA' } });
    writeUiContract(tmpDir, 'set-b', { tokens: { primary: '#BBB' } });
    writeUiContract(tmpDir, 'set-c', { tokens: { primary: '#CCC' } });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, false);
    // Three sets with different values -> 3 pairwise conflicts (a-b, a-c, b-c)
    const tokenConflicts = result.conflicts.filter((c) => c.type === 'token');
    assert.strictEqual(tokenConflicts.length, 3, 'should have 3 pairwise token conflicts');
  });

  it('handles contracts with missing optional sections gracefully', () => {
    // set-a has only tokens, set-b has only components -- no overlapping sections
    writeUiContract(tmpDir, 'set-a', { tokens: { primary: '#3B82F6' } });
    writeUiContract(tmpDir, 'set-b', {
      components: [{ name: 'Widget', role: 'widget' }],
    });
    const result = checkUiConsistency(tmpDir);
    assert.strictEqual(result.consistent, true);
    assert.deepStrictEqual(result.conflicts, []);
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

  // --- NEW TESTS (20-24) ---

  it('includes layout section with grid, breakpoints, containerWidths, responsive', () => {
    writeUiContract(tmpDir, 'layout-set', {
      layout: {
        grid: { columns: 12, gutter: '24px' },
        breakpoints: { sm: '640px', md: '768px', lg: '1024px' },
        containerWidths: { sm: '100%', lg: '1200px' },
        responsive: ['Stack columns on mobile', 'Hide sidebar below md'],
      },
    });
    const result = buildUiContext(tmpDir, 'layout-set');
    assert.ok(result.includes('### Layout'), 'should have layout section');
    assert.ok(result.includes('**Grid Columns:** 12'), 'should include grid columns');
    assert.ok(result.includes('**Grid Gutter:** 24px'), 'should include grid gutter');
    assert.ok(result.includes('**Breakpoints:**'), 'should include breakpoints heading');
    assert.ok(result.includes('sm: 640px'), 'should include sm breakpoint');
    assert.ok(result.includes('md: 768px'), 'should include md breakpoint');
    assert.ok(result.includes('lg: 1024px'), 'should include lg breakpoint');
    assert.ok(result.includes('**Container Widths:**'), 'should include container widths heading');
    assert.ok(result.includes('sm: 100%'), 'should include sm container width');
    assert.ok(result.includes('lg: 1200px'), 'should include lg container width');
    assert.ok(result.includes('**Responsive Rules:**'), 'should include responsive heading');
    assert.ok(result.includes('Stack columns on mobile'), 'should include first responsive rule');
    assert.ok(result.includes('Hide sidebar below md'), 'should include second responsive rule');
  });

  it('includes interactions section with all sub-fields', () => {
    writeUiContract(tmpDir, 'ix-set', {
      interactions: {
        stateTransitions: ['idle -> loading -> done'],
        animations: ['fade-in 200ms ease'],
        loadingPatterns: ['skeleton screens'],
        errorStates: ['inline error below input'],
        accessibility: ['aria-live for dynamic content'],
      },
    });
    const result = buildUiContext(tmpDir, 'ix-set');
    assert.ok(result.includes('### Interactions'), 'should have interactions section');
    assert.ok(result.includes('**State Transitions:**'), 'should have state transitions');
    assert.ok(result.includes('idle -> loading -> done'), 'should include transition text');
    assert.ok(result.includes('**Animations:**'), 'should have animations');
    assert.ok(result.includes('fade-in 200ms ease'), 'should include animation text');
    assert.ok(result.includes('**Loading Patterns:**'), 'should have loading patterns');
    assert.ok(result.includes('skeleton screens'), 'should include loading pattern text');
    assert.ok(result.includes('**Error States:**'), 'should have error states');
    assert.ok(result.includes('inline error below input'), 'should include error state text');
    assert.ok(result.includes('**Accessibility:**'), 'should have accessibility');
    assert.ok(result.includes('aria-live for dynamic content'), 'should include accessibility text');
  });

  it('handles guidelines with empty fontFamilies and visualIdentity arrays', () => {
    writeUiContract(tmpDir, 'empty-arr-set', {
      guidelines: {
        tone: 'Minimal',
        fontFamilies: [],
        visualIdentity: [],
      },
    });
    const result = buildUiContext(tmpDir, 'empty-arr-set');
    assert.ok(result.includes('### Guidelines'), 'should have guidelines section');
    assert.ok(result.includes('**Tone:** Minimal'), 'should include tone');
    // Empty arrays should not produce Font Families or list items
    assert.ok(!result.includes('**Font Families:**'), 'should not include font families when array is empty');
    // No visual identity items
    const lines = result.split('\n');
    const guidelinesIdx = lines.findIndex((l) => l.includes('### Guidelines'));
    // Only the tone line should appear after the guidelines header (before next section or end)
    const guidelineLines = [];
    for (let i = guidelinesIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('###') || lines[i].startsWith('## ')) break;
      if (lines[i].trim()) guidelineLines.push(lines[i]);
    }
    assert.strictEqual(guidelineLines.length, 1, 'should only have the tone line in guidelines');
  });

  it('renders full contract with all sections in correct priority order', () => {
    writeUiContract(tmpDir, 'full-set', makeValidComplete());
    const result = buildUiContext(tmpDir, 'full-set');
    // Check all sections exist
    assert.ok(result.includes('### Guidelines'), 'should have guidelines');
    assert.ok(result.includes('### Design Tokens'), 'should have tokens');
    assert.ok(result.includes('### Components'), 'should have components');
    assert.ok(result.includes('### Layout'), 'should have layout');
    assert.ok(result.includes('### Interactions'), 'should have interactions');
    // Verify priority order: Guidelines > Tokens > Components > Layout > Interactions
    const gIdx = result.indexOf('### Guidelines');
    const tIdx = result.indexOf('### Design Tokens');
    const cIdx = result.indexOf('### Components');
    const lIdx = result.indexOf('### Layout');
    const iIdx = result.indexOf('### Interactions');
    assert.ok(gIdx < tIdx, 'Guidelines should come before Tokens');
    assert.ok(tIdx < cIdx, 'Tokens should come before Components');
    assert.ok(cIdx < lIdx, 'Components should come before Layout');
    assert.ok(lIdx < iIdx, 'Layout should come before Interactions');
  });

  it('formats deeply nested component tree (3+ levels) with increasing indentation', () => {
    writeUiContract(tmpDir, 'deep-set', {
      components: [
        {
          name: 'App',
          role: 'page',
          children: [
            {
              name: 'MainLayout',
              role: 'layout',
              children: [
                {
                  name: 'ContentArea',
                  role: 'layout',
                  children: [
                    { name: 'Card', role: 'widget' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const result = buildUiContext(tmpDir, 'deep-set');
    const lines = result.split('\n');

    const appLine = lines.find((l) => l.includes('**App**'));
    const mainLayoutLine = lines.find((l) => l.includes('**MainLayout**'));
    const contentAreaLine = lines.find((l) => l.includes('**ContentArea**'));
    const cardLine = lines.find((l) => l.includes('**Card**'));

    assert.ok(appLine, 'should find App line');
    assert.ok(mainLayoutLine, 'should find MainLayout line');
    assert.ok(contentAreaLine, 'should find ContentArea line');
    assert.ok(cardLine, 'should find Card line');

    const appIndent = appLine.match(/^(\s*)/)[1].length;
    const mainLayoutIndent = mainLayoutLine.match(/^(\s*)/)[1].length;
    const contentAreaIndent = contentAreaLine.match(/^(\s*)/)[1].length;
    const cardIndent = cardLine.match(/^(\s*)/)[1].length;

    assert.ok(mainLayoutIndent > appIndent, 'MainLayout should be indented more than App');
    assert.ok(contentAreaIndent > mainLayoutIndent, 'ContentArea should be indented more than MainLayout');
    assert.ok(cardIndent > contentAreaIndent, 'Card should be indented more than ContentArea');
  });
});
