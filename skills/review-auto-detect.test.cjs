'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const SKILLS = {
  'unit-test': {
    path: path.join(ROOT, 'skills', 'unit-test', 'SKILL.md'),
    downstreamArtifact: 'REVIEW-UNIT.md',
  },
  'bug-hunt': {
    path: path.join(ROOT, 'skills', 'bug-hunt', 'SKILL.md'),
    downstreamArtifact: 'REVIEW-BUGS.md',
  },
  uat: {
    path: path.join(ROOT, 'skills', 'uat', 'SKILL.md'),
    downstreamArtifact: 'REVIEW-UAT.md',
  },
};

// Pre-load all skill contents once
const skillContents = {};
for (const [name, info] of Object.entries(SKILLS)) {
  skillContents[name] = fs.readFileSync(info.path, 'utf-8');
}

// ─── Per-skill tests: unit-test ─────────────────────────────────────────────

describe('unit-test SKILL.md auto-detect', () => {
  const content = skillContents['unit-test'];
  const downstream = SKILLS['unit-test'].downstreamArtifact;

  it('Step 1 has auto-detection fallback section', () => {
    // Step 1 should contain "Auto-detect" or the two-path check logic
    assert.match(content, /Auto-detect/i,
      'Step 1 should contain auto-detection fallback language');
    // Verify it mentions checking standard path then post-merge path
    assert.match(content, /standard path/i,
      'Should reference standard path in auto-detection');
    assert.match(content, /post-merge path/i,
      'Should reference post-merge path in auto-detection');
  });

  it('Auto-detect references correct downstream artifact (REVIEW-UNIT.md)', () => {
    // The auto-detect section should mention the downstream artifact name
    // so the agent knows where to write results
    assert.ok(content.includes(downstream),
      `Auto-detect section should reference downstream artifact ${downstream}`);
  });

  it('Step 0b has --post-merge flag detection', () => {
    // Step 0b should document the --post-merge flag
    assert.match(content, /--post-merge/,
      'Step 0b should document --post-merge flag');
    // Verify it's in the 0b section specifically
    const step0bMatch = content.match(/### 0b.*?(?=## Step 1)/s);
    assert.ok(step0bMatch, 'Step 0b section should exist');
    assert.match(step0bMatch[0], /--post-merge/,
      '--post-merge flag detection should be in Step 0b');
  });

  it('Guard check references both standard and post-merge paths', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    assert.match(guard, /\.planning\/sets\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference standard path');
    assert.match(guard, /\.planning\/post-merge\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference post-merge path');
  });

  it('Auto-detect checks standard path before post-merge path', () => {
    // The standard path mention should appear BEFORE the post-merge path mention
    // within the auto-detect logic (Step 1, point 2)
    const step1 = content.match(/## Step 1:.*?(?=## Step 2)/s);
    assert.ok(step1, 'Step 1 section should exist');
    const step1Text = step1[0];

    const standardIdx = step1Text.indexOf('First, try standard path');
    const postMergeIdx = step1Text.indexOf('If not found, try post-merge path');
    assert.ok(standardIdx >= 0, 'Should contain "First, try standard path"');
    assert.ok(postMergeIdx >= 0, 'Should contain "If not found, try post-merge path"');
    assert.ok(standardIdx < postMergeIdx,
      'Standard path check should appear before post-merge path check');
  });

  it('Guard check includes actionable remediation', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    // Should include a remediation action: run /rapid:review first
    assert.match(guard, /\/rapid:review/,
      'Guard check should include actionable remediation referencing /rapid:review');
    assert.match(guard, /first/i,
      'Guard check should instruct the user to run review first');
  });
});

// ─── Per-skill tests: bug-hunt ──────────────────────────────────────────────

describe('bug-hunt SKILL.md auto-detect', () => {
  const content = skillContents['bug-hunt'];
  const downstream = SKILLS['bug-hunt'].downstreamArtifact;

  it('Step 1 has auto-detection fallback section', () => {
    assert.match(content, /Auto-detect/i,
      'Step 1 should contain auto-detection fallback language');
    assert.match(content, /standard path/i,
      'Should reference standard path in auto-detection');
    assert.match(content, /post-merge path/i,
      'Should reference post-merge path in auto-detection');
  });

  it('Auto-detect references correct downstream artifact (REVIEW-BUGS.md)', () => {
    assert.ok(content.includes(downstream),
      `Auto-detect section should reference downstream artifact ${downstream}`);
  });

  it('Step 0b has --post-merge flag detection', () => {
    assert.match(content, /--post-merge/,
      'Step 0b should document --post-merge flag');
    const step0bMatch = content.match(/### 0b.*?(?=## Step 1)/s);
    assert.ok(step0bMatch, 'Step 0b section should exist');
    assert.match(step0bMatch[0], /--post-merge/,
      '--post-merge flag detection should be in Step 0b');
  });

  it('Guard check references both standard and post-merge paths', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    assert.match(guard, /\.planning\/sets\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference standard path');
    assert.match(guard, /\.planning\/post-merge\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference post-merge path');
  });

  it('Auto-detect checks standard path before post-merge path', () => {
    const step1 = content.match(/## Step 1:.*?(?=## Step 2)/s);
    assert.ok(step1, 'Step 1 section should exist');
    const step1Text = step1[0];

    const standardIdx = step1Text.indexOf('First, try standard path');
    const postMergeIdx = step1Text.indexOf('If not found, try post-merge path');
    assert.ok(standardIdx >= 0, 'Should contain "First, try standard path"');
    assert.ok(postMergeIdx >= 0, 'Should contain "If not found, try post-merge path"');
    assert.ok(standardIdx < postMergeIdx,
      'Standard path check should appear before post-merge path check');
  });

  it('Guard check includes actionable remediation', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    assert.match(guard, /\/rapid:review/,
      'Guard check should include actionable remediation referencing /rapid:review');
    assert.match(guard, /first/i,
      'Guard check should instruct the user to run review first');
  });
});

// ─── Per-skill tests: uat ───────────────────────────────────────────────────

describe('uat SKILL.md auto-detect', () => {
  const content = skillContents['uat'];
  const downstream = SKILLS['uat'].downstreamArtifact;

  it('Step 1 has auto-detection fallback section', () => {
    assert.match(content, /Auto-detect/i,
      'Step 1 should contain auto-detection fallback language');
    assert.match(content, /standard path/i,
      'Should reference standard path in auto-detection');
    assert.match(content, /post-merge path/i,
      'Should reference post-merge path in auto-detection');
  });

  it('Auto-detect references correct downstream artifact (REVIEW-UAT.md)', () => {
    assert.ok(content.includes(downstream),
      `Auto-detect section should reference downstream artifact ${downstream}`);
  });

  it('Step 0b has --post-merge flag detection', () => {
    assert.match(content, /--post-merge/,
      'Step 0b should document --post-merge flag');
    const step0bMatch = content.match(/### 0b.*?(?=## Step 1)/s);
    assert.ok(step0bMatch, 'Step 0b section should exist');
    assert.match(step0bMatch[0], /--post-merge/,
      '--post-merge flag detection should be in Step 0b');
  });

  it('Guard check references both standard and post-merge paths', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    assert.match(guard, /\.planning\/sets\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference standard path');
    assert.match(guard, /\.planning\/post-merge\/\{setId\}\/REVIEW-SCOPE\.md/,
      'Guard should reference post-merge path');
  });

  it('Auto-detect checks standard path before post-merge path', () => {
    const step1 = content.match(/## Step 1:.*?(?=## Step 2)/s);
    assert.ok(step1, 'Step 1 section should exist');
    const step1Text = step1[0];

    const standardIdx = step1Text.indexOf('First, try standard path');
    const postMergeIdx = step1Text.indexOf('If not found, try post-merge path');
    assert.ok(standardIdx >= 0, 'Should contain "First, try standard path"');
    assert.ok(postMergeIdx >= 0, 'Should contain "If not found, try post-merge path"');
    assert.ok(standardIdx < postMergeIdx,
      'Standard path check should appear before post-merge path check');
  });

  it('Guard check includes actionable remediation', () => {
    const guardSection = content.match(/Guard check.*?(?=Read the file|## Step 2)/s);
    assert.ok(guardSection, 'Guard check section should exist');
    const guard = guardSection[0];
    assert.match(guard, /\/rapid:review/,
      'Guard check should include actionable remediation referencing /rapid:review');
    assert.match(guard, /first/i,
      'Guard check should instruct the user to run review first');
  });
});

// ─── Cross-cutting integration tests ───────────────────────────────────────

describe('Cross-cutting: auto-detect structure consistency', () => {
  it('All 3 review skills have identical auto-detect structure', () => {
    // Extract the auto-detect block from each skill's Step 1
    const autoDetectBlocks = {};
    for (const [name, content] of Object.entries(skillContents)) {
      const step1 = content.match(/## Step 1:.*?(?=## Step 2)/s);
      assert.ok(step1, `${name}: Step 1 section should exist`);
      const block = step1[0];

      // Extract the auto-detect numbered section (point 2 under Step 1)
      const autoDetect = block.match(
        /If `POST_MERGE` is not set.*?(?=\*\*Guard check)/s
      );
      assert.ok(autoDetect, `${name}: Auto-detect block should exist in Step 1`);
      autoDetectBlocks[name] = autoDetect[0];
    }

    // All three should have the same structural elements:
    // - "First, try standard path"
    // - "If not found, try post-merge path"
    // - "set `POST_MERGE=true` so downstream artifact writes"
    for (const [name, block] of Object.entries(autoDetectBlocks)) {
      assert.match(block, /First, try standard path/,
        `${name}: should have "First, try standard path"`);
      assert.match(block, /If not found, try post-merge path/,
        `${name}: should have "If not found, try post-merge path"`);
      assert.match(block, /set `POST_MERGE=true`/,
        `${name}: should set POST_MERGE=true on fallback`);
    }
  });

  it('All 3 review skills have identical guard check structure', () => {
    const guardBlocks = {};
    for (const [name, content] of Object.entries(skillContents)) {
      const guardMatch = content.match(
        /\*\*Guard check:\*\*.*?```\n\[RAPID ERROR\].*?```/s
      );
      assert.ok(guardMatch, `${name}: Guard check block should exist`);
      guardBlocks[name] = guardMatch[0];
    }

    // All three guard checks should contain identical structural elements
    for (const [name, block] of Object.entries(guardBlocks)) {
      assert.match(block, /\[RAPID ERROR\]/,
        `${name}: Guard should have [RAPID ERROR] prefix`);
      assert.match(block, /REVIEW-SCOPE\.md not found/,
        `${name}: Guard should mention REVIEW-SCOPE.md not found`);
      assert.match(block, /\.planning\/sets\/\{setId\}\/REVIEW-SCOPE\.md/,
        `${name}: Guard should list standard path`);
      assert.match(block, /\.planning\/post-merge\/\{setId\}\/REVIEW-SCOPE\.md/,
        `${name}: Guard should list post-merge path`);
      assert.match(block, /\/rapid:review \{setId\}/,
        `${name}: Guard should reference /rapid:review {setId}`);
    }
  });

  it('Each skill references its own downstream artifact', () => {
    for (const [name, info] of Object.entries(SKILLS)) {
      const content = skillContents[name];
      const step1 = content.match(/## Step 1:.*?(?=## Step 2)/s);
      assert.ok(step1, `${name}: Step 1 should exist`);

      // The auto-detect section should mention the skill's own downstream artifact
      // in the context of "so downstream artifact writes (ARTIFACT, issue logging)"
      assert.ok(
        step1[0].includes(info.downstreamArtifact),
        `${name}: Step 1 auto-detect should reference its own downstream artifact ${info.downstreamArtifact}`
      );

      // Ensure it does NOT reference other skills' artifacts in the auto-detect block
      const otherArtifacts = Object.entries(SKILLS)
        .filter(([n]) => n !== name)
        .map(([, i]) => i.downstreamArtifact);

      const autoDetectBlock = step1[0].match(
        /If `POST_MERGE` is not set.*?(?=\*\*Guard check)/s
      );
      assert.ok(autoDetectBlock, `${name}: Auto-detect block should exist`);

      for (const otherArtifact of otherArtifacts) {
        assert.ok(
          !autoDetectBlock[0].includes(otherArtifact),
          `${name}: Auto-detect should NOT reference another skill's artifact ${otherArtifact}`
        );
      }
    }
  });

  it('All 3 skills retain --post-merge flag in Step 0b', () => {
    for (const [name, content] of Object.entries(skillContents)) {
      const step0b = content.match(/### 0b.*?(?=## Step 1)/s);
      assert.ok(step0b, `${name}: Step 0b should exist`);

      const block = step0b[0];

      // Must have the flag detection section header
      assert.match(block, /Detect `--post-merge` flag/,
        `${name}: Step 0b should have "Detect --post-merge flag" section`);

      // Must document the invocation syntax with --post-merge
      assert.match(block, /--post-merge/,
        `${name}: Step 0b should document --post-merge flag`);

      // Must set POST_MERGE=true when flag is present
      assert.match(block, /POST_MERGE=true/,
        `${name}: Step 0b should set POST_MERGE=true`);

      // Must mention post-merge artifact directory
      assert.match(block, /post-merge/i,
        `${name}: Step 0b should reference post-merge mode`);
    }
  });
});
