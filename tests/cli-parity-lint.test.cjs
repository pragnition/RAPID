'use strict';

/**
 * CLI-parity lint for the 9 SKILL.md files patched in Wave 3.
 *
 * For every `AskUserQuestion` token in each whitelisted file, walks the
 * surrounding bash if/fi block and asserts:
 *   1. The block is opened by `if [ "${RAPID_RUN_MODE}" = "sdk" ]; then`
 *      (or the unbraced `"$RAPID_RUN_MODE"` variant).
 *   2. An `else` keyword precedes the `AskUserQuestion` line within the block.
 *   3. The if-branch (above the `else`) contains a
 *      `mcp__rapid__webui_ask_user` or `mcp__rapid__ask_free_text` token.
 *   4. The block closes with `fi` within 20 lines below `AskUserQuestion`.
 *
 * Also asserts:
 *   - Each whitelisted file's total `AskUserQuestion` count matches the
 *     expected per-file value from Wave 3.
 *   - No skill OUTSIDE the whitelist contains an `AskUserQuestion` token
 *     (logged-only for known descriptive references — the test is a hard
 *     fail only on the patched 9).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// Wave 3 patched skills with their expected AUQ counts.
const PATCHED_SKILLS = [
  { name: 'scaffold', auq: 3 },
  { name: 'bug-fix', auq: 3 },
  { name: 'quick', auq: 4 },
  { name: 'assumptions', auq: 5 },
  { name: 'add-set', auq: 8 },
  { name: 'discuss-set', auq: 13 },
  { name: 'branding', auq: 19 },
  { name: 'new-version', auq: 25 },
  { name: 'init', auq: 38 },
];

const SDK_IF_RE = /if\s*\[\s*"?\$\{?RAPID_RUN_MODE\}?"?\s*=\s*"sdk"\s*\]\s*;\s*then/;
const ELSE_RE = /^\s*else\s*$/;
const FI_RE = /^\s*fi\s*$/;
const AUQ_RE = /AskUserQuestion/;
const MCP_RE = /mcp__rapid__(webui_ask_user|ask_free_text)/;

function readSkill(name) {
  const p = path.join(SKILLS_DIR, name, 'SKILL.md');
  return { path: p, lines: fs.readFileSync(p, 'utf8').split('\n') };
}

function findEnclosingBlock(lines, idx) {
  // Walk up to find the SDK `if [ ... ]; then` opener (max 60 lines back —
  // some bash blocks in init/new-version are long).
  let openIdx = -1;
  for (let i = idx - 1; i >= Math.max(0, idx - 60); i--) {
    if (SDK_IF_RE.test(lines[i])) {
      openIdx = i;
      break;
    }
    // Stop walking if we hit a `fi` from a prior block.
    if (FI_RE.test(lines[i])) break;
  }
  // Walk down to find the closing `fi` (max 30 lines forward).
  let closeIdx = -1;
  for (let i = idx + 1; i < Math.min(lines.length, idx + 30); i++) {
    if (FI_RE.test(lines[i])) {
      closeIdx = i;
      break;
    }
  }
  // Walk up from AUQ to find the most recent `else`.
  let elseIdx = -1;
  for (let i = idx - 1; i >= Math.max(0, idx - 30); i--) {
    if (ELSE_RE.test(lines[i])) {
      elseIdx = i;
      break;
    }
  }
  return { openIdx, closeIdx, elseIdx };
}

function findAuqLines(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (AUQ_RE.test(lines[i])) out.push(i);
  }
  return out;
}

describe('CLI-parity lint: SDK-vs-built-in if/else trio at every AUQ site', () => {
  for (const { name, auq } of PATCHED_SKILLS) {
    describe(`skills/${name}/SKILL.md`, () => {
      const { path: filePath, lines } = readSkill(name);
      const auqLines = findAuqLines(lines);

      it(`has expected AUQ count = ${auq}`, () => {
        assert.equal(
          auqLines.length,
          auq,
          `${filePath}: expected ${auq} AskUserQuestion tokens, found ${auqLines.length}`
        );
      });

      for (const lineIdx of auqLines) {
        const lineNo = lineIdx + 1;
        it(`AUQ at line ${lineNo} sits in a complete sdk-if/else/fi block`, () => {
          const { openIdx, closeIdx, elseIdx } = findEnclosingBlock(lines, lineIdx);

          assert.notEqual(
            openIdx,
            -1,
            `${filePath}:${lineNo}: no SDK if-opener found above this AskUserQuestion`
          );
          assert.notEqual(
            closeIdx,
            -1,
            `${filePath}:${lineNo}: no closing 'fi' found within 30 lines below`
          );
          assert.notEqual(
            elseIdx,
            -1,
            `${filePath}:${lineNo}: no 'else' keyword found between if-opener and AskUserQuestion`
          );
          assert.ok(
            elseIdx > openIdx && elseIdx < lineIdx && lineIdx < closeIdx,
            `${filePath}:${lineNo}: block ordering broken (open=${openIdx + 1}, else=${elseIdx + 1}, auq=${lineNo}, close=${closeIdx + 1})`
          );

          // The if-branch (between opener and else) must mention an MCP tool.
          const ifBranch = lines.slice(openIdx + 1, elseIdx).join('\n');
          assert.ok(
            MCP_RE.test(ifBranch),
            `${filePath}:${lineNo}: if-branch above 'else' must reference mcp__rapid__webui_ask_user or mcp__rapid__ask_free_text`
          );
        });
      }
    });
  }
});

describe('CLI-parity lint: AUQ tokens in non-patched skills are flagged for review', () => {
  const patchedNames = new Set(PATCHED_SKILLS.map((s) => s.name));

  it('blacklist scan completes and surfaces unexpected AUQ files', () => {
    const allSkills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const offenders = [];
    for (const name of allSkills) {
      if (patchedNames.has(name)) continue;
      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = fs.readFileSync(skillPath, 'utf8');
      const matches = content.match(/AskUserQuestion/g);
      if (matches && matches.length > 0) {
        offenders.push({ name, count: matches.length });
      }
    }
    if (offenders.length > 0) {
      // Log-only per Wave 4 plan Task 8: "If audit-version etc. have AUQ
      // references that are NOT part of the patch scope, allow them — but log
      // their counts to catch accidental-patch drift." Hardening these into
      // the bridge is a separate (deferred) wave.
      // eslint-disable-next-line no-console
      console.warn(
        '[cli-parity-lint] AskUserQuestion tokens in non-patched skills (informational, not a failure):',
        offenders
      );
    }
    // The hard guarantee is the per-file count + structure check on the
    // 9 patched skills above. The blacklist is informational only.
    assert.ok(true);
  });
});
