'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// Repo-level invariant: after the v6.2.0 docs-and-housekeeping set, no active
// (non-archive, non-historical-marker) file should contain the literal
// `v6.1.0` or the bare `6.1.0`. This guards against a future `npm install`
// or a copy-paste regression reintroducing stale milestone markers.
//
// The exclusion list matches the set's CONTRACT.json and wave-1-PLAN.md.
// Keep them in lockstep -- any change here must be reflected in the plan.

const REPO_ROOT = path.resolve(__dirname, '../..');

// Paths listed here are compared with exact string equality against the
// git-ls-files relative path (forward slashes on all platforms).
const EXCLUDED_FILES = new Set([
  // NOTE: the top-level roadmap lives at `.planning/ROADMAP.md` in this repo,
  // not at the repo root. Both path spellings are excluded for safety against
  // a future relocation.
  'ROADMAP.md',
  '.planning/ROADMAP.md',
  'docs/CHANGELOG.md',
  '.planning/v6.1.0-AUDIT.md',
  '.planning/v6.1.0-UX-AUDIT.md',
  'tests/ux-audit.test.cjs',
  'package-lock.json',
  // This test file itself contains the literal strings it's searching for.
  'src/lib/housekeeping.test.cjs',
  // STATE.json line 579 contains a historical milestone "id": "v6.1.0" inside
  // the milestones[] array -- paired with a separate v6.2.0 milestone entry.
  // Line 3 (rapidVersion) IS bumped to 6.2.0; line 579 is preserved by design.
  '.planning/STATE.json',
]);

// Directory prefixes (with trailing slash) that are fully excluded.
const EXCLUDED_DIR_PREFIXES = [
  '.planning/archive/',
  '.archive/',
  '.planning/sets/docs-and-housekeeping/',
  'node_modules/',
  '.git/',
];

function isExcluded(relPath) {
  if (EXCLUDED_FILES.has(relPath)) return true;
  for (const prefix of EXCLUDED_DIR_PREFIXES) {
    if (relPath.startsWith(prefix)) return true;
  }
  return false;
}

function listTrackedFiles() {
  const out = execFileSync('git', ['ls-files'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out.split('\n').filter(Boolean);
}

// Text patterns we refuse to allow in active files:
// 1. `v6.1.0` (prefixed form)
// 2. `6.1.0` as a standalone semver token -- matched via negative lookaround to
//    avoid false-positives like `16.1.0` or `6.1.01` (which would be a different
//    version number, not the one we're sweeping).
const PATTERNS = [
  /v6\.1\.0/,
  /(?<![\d.])6\.1\.0(?![\d.])/,
];

describe('no-stale-versions invariant', () => {
  it('no active file contains v6.1.0 or bare 6.1.0 outside the exclusion list', () => {
    const files = listTrackedFiles().filter(f => !isExcluded(f));
    const offenders = [];

    for (const rel of files) {
      const full = path.join(REPO_ROOT, rel);
      let content;
      try {
        content = fs.readFileSync(full, 'utf-8');
      } catch (_err) {
        // Binary or unreadable files -- skip silently.
        continue;
      }
      for (const pat of PATTERNS) {
        if (pat.test(content)) {
          offenders.push(`${rel}  (pattern: ${pat})`);
          break;
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Stale v6.1.0/6.1.0 references found in active files:\n  - ${offenders.join('\n  - ')}`
    );
  });

  it('exclusion list is not empty (sanity check)', () => {
    assert.ok(EXCLUDED_FILES.size > 0);
    assert.ok(EXCLUDED_DIR_PREFIXES.length > 0);
  });
});
