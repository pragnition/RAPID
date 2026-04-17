'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');
const content = fs.readFileSync(SKILL_PATH, 'utf-8');

describe('discuss-set SKILL.md structural assertions', () => {

  // ── Test 1: Step 5 lists exactly 4 options ───────────────────

  it('Step 5 lists exactly 4 options', () => {
    // Extract the Step 5 section (from "## Step 5" up to "## Step 6")
    const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
    assert.ok(step5Match, 'Should find Step 5 section');
    const step5 = step5Match[0];

    // The AskUserQuestion block has numbered options 1-4 in the format:
    // 1. "{Gray area 1 title}" -- ...
    const numberedOptions = step5.match(/^\d+\.\s+"/gm);
    assert.ok(numberedOptions, 'Should find numbered options in Step 5');
    assert.equal(numberedOptions.length, 4, `Expected exactly 4 numbered options, found ${numberedOptions.length}`);
  });

  // ── Test 2: No 5th option in Step 5 ─────────────────────────

  it('Step 5 does NOT contain a 5th option', () => {
    const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
    assert.ok(step5Match, 'Should find Step 5 section');
    const step5 = step5Match[0];

    // Look for a "5." line that would indicate a 5th option
    const fifthOption = step5.match(/^5\.\s+"/m);
    assert.equal(fifthOption, null, 'Step 5 should not contain a 5th numbered option');
  });

  // ── Test 3: Key Principles says "Exactly 4 gray areas" ──────

  it('Key Principles mentions variable gray area count (4n)', () => {
    const principlesMatch = content.match(/## Key Principles[\s\S]*?(?=## Anti-Patterns|$)/);
    assert.ok(principlesMatch, 'Should find Key Principles section');
    assert.ok(
      principlesMatch[0].includes('Variable gray area count (4n)'),
      'Key Principles should contain literal phrase "Variable gray area count (4n)"',
    );
  });

  // ── Test 4: Anti-Patterns says "fewer or more than 4" ───────

  it('Anti-Patterns warns against non-multiple-of-4 gray area counts', () => {
    const antiMatch = content.match(/## Anti-Patterns[\s\S]*$/);
    assert.ok(antiMatch, 'Should find Anti-Patterns section');
    assert.ok(
      antiMatch[0].includes('non-multiple-of-4'),
      'Anti-Patterns should contain literal phrase "non-multiple-of-4"',
    );
  });

  // ── Test 5: Step 5 heading mentions "4 Gray Areas" ──────────

  it('Step 5 heading mentions Gray Areas', () => {
    // Match the ## Step 5 heading line
    const headingMatch = content.match(/^## Step 5:.*$/m);
    assert.ok(headingMatch, 'Should find Step 5 heading');
    assert.ok(
      headingMatch[0].includes('Gray Areas'),
      `Step 5 heading should contain "Gray Areas", got: "${headingMatch[0]}"`,
    );
  });

  // ── Test 6: SKILL.md does not contain plan-check-gate ───────

  it('SKILL.md does not contain plan-check-gate', () => {
    assert.ok(
      !content.includes('plan-check-gate'),
      'SKILL.md should not contain plan-check-gate',
    );
  });

  // ── Test 7: CONTEXT.md output format has required XML sections

  it('CONTEXT.md output format has required XML sections', () => {
    const requiredTags = ['<domain>', '<decisions>', '<specifics>', '<code_context>', '<deferred>'];
    for (const tag of requiredTags) {
      assert.ok(content.includes(tag), `SKILL.md should document ${tag} section`);
    }
  });

  // ── Test 8: --skip flag documented in Step 2 and Step 4 ─────

  it('--skip flag documented in Step 2 and Step 4', () => {
    const step2Match = content.match(/## Step 2[\s\S]*?(?=## Step 3)/);
    assert.ok(step2Match, 'Should find Step 2 section');
    assert.ok(step2Match[0].includes('--skip'), 'Step 2 should document --skip flag');

    const step4Match = content.match(/## Step 4[\s\S]*?(?=## Step 5)/);
    assert.ok(step4Match, 'Should find Step 4 section');
    assert.ok(step4Match[0].includes('--skip'), 'Step 4 should document --skip flag');
  });

  // ── Test 9: State transition uses "discussed" status ─────────

  it('State transition uses "discussed" status', () => {
    const step8Match = content.match(/## Step 8[\s\S]*?(?=## Step 9|$)/);
    assert.ok(step8Match, 'Should find Step 8 section');
    assert.ok(
      step8Match[0].includes('discussed'),
      'Step 8 should contain transition to "discussed" status',
    );
  });

  // ── Test 10: Step 5 UI/UX conditional guidance paragraph exists between criteria list and AskUserQuestion block ──

  it('Step 5 UI/UX conditional guidance paragraph exists between criteria list and AskUserQuestion block', () => {
    const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
    assert.ok(step5Match, 'Should find Step 5 section');
    const step5 = step5Match[0];

    // The guidance paragraph should start with "When the set's context"
    const guidanceIdx = step5.indexOf('When the set\'s context');
    assert.ok(guidanceIdx !== -1, 'Step 5 should contain UI/UX conditional guidance starting with "When the set\'s context"');

    // The last bullet criterion before the guidance (e.g., "UI/UX decisions:")
    const lastCriterionIdx = step5.indexOf('UI/UX decisions:');
    assert.ok(lastCriterionIdx !== -1, 'Step 5 should contain the "UI/UX decisions:" criterion');

    // The AskUserQuestion block reference
    const askUserIdx = step5.indexOf('Presenting Gray Areas');
    assert.ok(askUserIdx !== -1, 'Step 5 should contain "Presenting Gray Areas"');

    // Verify ordering: criteria < guidance < AskUserQuestion
    assert.ok(
      lastCriterionIdx < guidanceIdx,
      'UI/UX conditional guidance should appear AFTER the criteria bullet list',
    );
    assert.ok(
      guidanceIdx < askUserIdx,
      'UI/UX conditional guidance should appear BEFORE "Present gray areas using AskUserQuestion"',
    );
  });

  // ── Test 11: UI/UX guidance mentions non-UI sets should not force UI/UX gray areas ──

  it('UI/UX guidance mentions non-UI sets should not force UI/UX gray areas', () => {
    const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
    assert.ok(step5Match, 'Should find Step 5 section');
    const step5 = step5Match[0];

    // The guidance should mention that sets with no user-facing components should not force UI/UX
    assert.ok(
      step5.includes('no user-facing components'),
      'Step 5 should mention "no user-facing components"',
    );
    assert.ok(
      step5.includes('should not be forced'),
      'Step 5 should state that UI/UX gray areas "should not be forced" for non-UI sets',
    );
  });

  // ── Test 12: Step 5 uses consolidated AskUserQuestion calls for n=2 ──

  it('Step 5 uses consolidated AskUserQuestion calls for n=2', () => {
    const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
    assert.ok(step5Match, 'Should find Step 5 section');
    const step5 = step5Match[0];
    // n=2 should say "One AskUserQuestion call" not "Two AskUserQuestion calls"
    assert.ok(
      step5.includes('One AskUserQuestion call with 2 questions'),
      'n=2 should use one consolidated AskUserQuestion call with 2 questions',
    );
  });

  // ── Test 13: Step 6 Format A uses labeled-block list, not markdown table ──

  it('Step 6 Format A uses labeled-block list, not markdown table', () => {
    const step6Match = content.match(/### Format A[\s\S]*?(?=### Format B)/);
    assert.ok(step6Match, 'Should find Format A section');
    const formatA = step6Match[0];
    // Should NOT contain table syntax
    assert.ok(
      !formatA.includes('| Option | Pros | Cons |'),
      'Format A should not contain markdown table header',
    );
    // Should contain labeled blocks
    assert.ok(
      formatA.includes('**Pros:**'),
      'Format A should use **Pros:** labeled blocks',
    );
    assert.ok(
      formatA.includes('**Cons:**'),
      'Format A should use **Cons:** labeled blocks',
    );
  });

  // ── Test 14: Step 4 names self-interview ─────────────────────

  it('Step 4 names self-interview', () => {
    const step4Match = content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m);
    assert.ok(step4Match, 'Should find Step 4 section');
    const step4 = step4Match[0];
    assert.ok(
      step4.includes('self-interview'),
      'Step 4 should contain the literal string "self-interview"',
    );
  });

  // ── Test 15: Step 4 drops the old stub-generation directives ─

  it('Step 4 drops the old stub-generation directives', () => {
    const step4Match = content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m);
    assert.ok(step4Match, 'Should find Step 4 section');
    const step4 = step4Match[0];
    // The blanket "no user decisions captured" directive must be gone.
    assert.ok(
      !step4.includes('no user decisions captured'),
      'Step 4 must not contain the old "no user decisions captured" directive',
    );
    // The unconditional "No deferred items identified (auto-skip mode)"
    // directive must be gone. Start with strict-zero per plan guidance;
    // relax only if the implementation legitimately needs the phrase as a
    // quoted empty-DEFERRED fallback.
    assert.ok(
      !step4.includes('No deferred items identified (auto-skip mode)'),
      'Step 4 must not contain the unconditional "No deferred items identified (auto-skip mode)" directive',
    );
  });

  // ── Test 16: Step 4 references all 5 CONTEXT.md XML tags ─────

  it('Step 4 references all 5 CONTEXT.md XML tags', () => {
    const step4Match = content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m);
    assert.ok(step4Match, 'Should find Step 4 section');
    const step4 = step4Match[0];
    const requiredTags = ['<domain>', '<decisions>', '<specifics>', '<code_context>', '<deferred>'];
    for (const tag of requiredTags) {
      assert.ok(
        step4.includes(tag),
        `Step 4 should reference the ${tag} XML tag (all 5 CONTEXT.md tags required in --skip agent prompt)`,
      );
    }
  });

  // ── Test 17: Step 4 references the 4n gray-area heuristic ────

  it('Step 4 references the 4n gray-area heuristic', () => {
    const step4Match = content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m);
    assert.ok(step4Match, 'Should find Step 4 section');
    const step4 = step4Match[0];
    // Any of these signals that the 4n routing made it into Step 4.
    const hasContractTasks = /CONTRACT\.json[\s\S]*?definition\.tasks/.test(step4);
    const has4n = step4.includes('4n');
    const hasNEquals = /n=1|n=2|n=3/.test(step4);
    assert.ok(
      hasContractTasks || has4n || hasNEquals,
      'Step 4 should reference the 4n heuristic (via CONTRACT.json definition.tasks, "4n", or "n=1/n=2/n=3")',
    );
  });

  // ── Test 18: Step 4 post-check verifies DEFERRED.md ──────────

  it('Step 4 post-check verifies DEFERRED.md', () => {
    const step4Match = content.match(/^## Step 4[\s\S]*?(?=^## Step 5)/m);
    assert.ok(step4Match, 'Should find Step 4 section');
    const step4 = step4Match[0];
    assert.ok(
      step4.includes('DEFERRED.md'),
      'Step 4 should reference DEFERRED.md (post-check must verify both CONTEXT.md and DEFERRED.md)',
    );
  });

  // ── Test 19: Key Principles bullet updated to --skip self-interview

  it('Key Principles bullet updated to --skip self-interview', () => {
    const principlesMatch = content.match(/## Key Principles[\s\S]*?(?=## Anti-Patterns|$)/);
    assert.ok(principlesMatch, 'Should find Key Principles section');
    const principles = principlesMatch[0];
    assert.ok(
      principles.includes('--skip self-interview'),
      'Key Principles should contain the "--skip self-interview" bullet',
    );
    assert.ok(
      !principles.includes('auto-generate CONTEXT.md and an empty DEFERRED.md'),
      'Key Principles must not contain the old "auto-generate CONTEXT.md and an empty DEFERRED.md" wording',
    );
  });

  // ── Test 20: Anti-Patterns forbids stub CONTEXT.md in --skip ─

  it('Anti-Patterns forbids stub CONTEXT.md in --skip', () => {
    const antiMatch = content.match(/## Anti-Patterns[\s\S]*$/);
    assert.ok(antiMatch, 'Should find Anti-Patterns section');
    assert.ok(
      antiMatch[0].includes('Do NOT emit a stub CONTEXT.md'),
      'Anti-Patterns should contain the "Do NOT emit a stub CONTEXT.md" bullet',
    );
  });
});
