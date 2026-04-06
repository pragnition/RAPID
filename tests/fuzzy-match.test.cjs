'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { levenshteinDistance, suggestCommands } = require('../src/bin/rapid-tools.cjs');

describe('levenshteinDistance', () => {
  // Identity
  it('returns 0 for identical strings', () => {
    assert.equal(levenshteinDistance('abc', 'abc'), 0);
  });

  it('returns 0 for two empty strings', () => {
    assert.equal(levenshteinDistance('', ''), 0);
  });

  // Single edits
  it('returns 1 for single insertion', () => {
    assert.equal(levenshteinDistance('stat', 'state'), 1);
  });

  it('returns 1 for single deletion', () => {
    assert.equal(levenshteinDistance('state', 'stat'), 1);
  });

  it('returns 1 for single substitution', () => {
    assert.equal(levenshteinDistance('state', 'stave'), 1);
  });

  // Multiple edits
  it('returns 2 for two edits', () => {
    assert.equal(levenshteinDistance('sttae', 'state'), 2);
  });

  it('returns 3 for three edits', () => {
    assert.equal(levenshteinDistance('cat', 'dog'), 3);
  });

  // Edge cases
  it('handles one empty string', () => {
    assert.equal(levenshteinDistance('', 'abc'), 3);
  });

  it('handles other empty string', () => {
    assert.equal(levenshteinDistance('abc', ''), 3);
  });

  it('is symmetric', () => {
    assert.equal(
      levenshteinDistance('kitten', 'sitting'),
      levenshteinDistance('sitting', 'kitten')
    );
  });
});

describe('suggestCommands', () => {
  const commands = ['state', 'lock', 'plan', 'merge', 'review', 'resolve', 'resume', 'scaffold'];

  // Basic matching
  it('returns exact match at distance 0', () => {
    assert.deepStrictEqual(suggestCommands('state', commands), ['state']);
  });

  it('returns single typo suggestion', () => {
    // 'stae' -> 'state' is distance 1; 'plan' is distance 3 (also within default threshold)
    const result = suggestCommands('stae', commands);
    assert.equal(result[0], 'state', 'closest match should be first');
    assert.ok(result.length >= 1, 'should return at least the closest match');
  });

  it('returns multiple suggestions sorted by distance', () => {
    const result = suggestCommands('re', commands);
    // All commands within default maxDistance=3 of 're':
    // 're' -> distances vary; verify sorting by distance then alpha
    for (let i = 1; i < result.length; i++) {
      const prevDist = levenshteinDistance('re', result[i - 1]);
      const currDist = levenshteinDistance('re', result[i]);
      assert.ok(
        prevDist < currDist || (prevDist === currDist && result[i - 1] <= result[i]),
        `results should be sorted by distance then alphabetically: ${result[i - 1]} (${prevDist}) before ${result[i]} (${currDist})`
      );
    }
  });

  // Threshold
  it('returns empty array when no match within threshold', () => {
    assert.deepStrictEqual(suggestCommands('xyzzy', commands), []);
  });

  it('respects custom maxDistance', () => {
    // 'stae' -> 'state' is distance 1, so maxDistance=0 should exclude it
    assert.deepStrictEqual(suggestCommands('stae', commands, 0), []);
  });

  it('respects custom maxSuggestions', () => {
    // Use a broad input that matches many commands, but limit to 1
    const result = suggestCommands('re', commands, 3, 1);
    assert.equal(result.length, 1);
  });

  // Sorting
  it('sorts tied distances alphabetically', () => {
    // 'resolve' and 'resume' are both distance 3 from 'ree' -- wait, let's pick better examples
    // 'resove' -> 'resolve' = 1, 'resume' = 2; use two at same distance
    const tiedCommands = ['bbb', 'aaa', 'ccc'];
    // distance from 'aab' to 'aaa' = 1, 'bbb' = 2, 'ccc' = 3
    // Let's use commands where ties are guaranteed:
    const cmds = ['ab', 'ac', 'ad'];
    // distance from 'aa' to each: 'ab'=1, 'ac'=1, 'ad'=1
    const result = suggestCommands('aa', cmds, 1);
    assert.deepStrictEqual(result, ['ab', 'ac', 'ad']);
  });

  // Edge cases
  it('handles empty input', () => {
    // All commands have length > 3, so distance > maxDistance(3) for most
    const result = suggestCommands('', commands);
    // Only commands with length <= 3 would match: none in our list (shortest is 'lock' at 4)
    assert.deepStrictEqual(result, []);
  });

  it('handles empty command list', () => {
    assert.deepStrictEqual(suggestCommands('state', []), []);
  });
});
