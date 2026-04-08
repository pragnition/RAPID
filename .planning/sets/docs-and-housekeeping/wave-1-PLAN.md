# Wave 1 Plan: Version Sweep, Dependency Pin, Behavioral Tests

**Set:** docs-and-housekeeping
**Wave:** 1 of 2
**Scope:** Version-string sweep (both prefixed and bare forms), runtime dependency pinning, `.env.example` documentation, and the two behavioral tests that lock this work in.

---

## Objective

Close out the v6.2.0 milestone's metadata layer. After this wave:

1. Every active non-archive file references `v6.2.0` / `6.2.0` (never `v6.1.0` or bare `6.1.0`), except a small, explicitly documented exclusion list of historical markers.
2. Every runtime dependency in `package.json` is pinned to the exact version currently resolved in `package-lock.json` (no `^`, no `~`).
3. `.env.example` documents the `NO_UPDATE_NOTIFIER` env var introduced by the `update-reminder` set.
4. Two behavioral tests (`no-stale-versions`, `runtime-deps-pinned`) enforce the above invariants going forward. Both live under `src/lib/` so `npm test` picks them up.

Wave 2 (context regeneration) will run after Wave 1 and touches a disjoint file set (`.planning/context/*.md` only).

---

## Why This Wave Exists

The three feature sets of v6.2.0 (`branding-overhaul`, `init-branding-integration`, `update-reminder`) are all merged. This wave is the mechanical sweep that flips version markers, tightens dependency pins, and installs guards so the sweep cannot silently regress.

---

## CRITICAL: Exclusion List (Both Sweep AND Tests)

Every file/path in this list MUST be skipped by the sweep AND by the `no-stale-versions` test. Any grep-based scan MUST use equivalent exclusion semantics.

| Excluded Path | Reason |
|---|---|
| `.planning/archive/**` | Historical snapshots — frozen milestones must stay authentic |
| `node_modules/**` | Third-party code — outside our control |
| `.git/**` | Git internals |
| `.archive/**` | Legacy archive (contains `.archive/mark2-plans/gsd_merge_agent/package-lock.json` with transitive `6.1.0` coincidence) |
| `package-lock.json` | May contain transitive `6.1.0` versions from other npm deps — not our version marker |
| `ROADMAP.md` | User directive — out of scope for this set; contains legitimate historical milestone markers |
| `docs/CHANGELOG.md` | Historical milestone entry `## [v6.1.0] UX & Onboarding (shipped 2026-04-06)` is load-bearing changelog history |
| `.planning/v6.1.0-AUDIT.md` | Filename contains `v6.1.0` — historical audit artifact |
| `.planning/v6.1.0-UX-AUDIT.md` | Filename contains `v6.1.0` — historical UX audit; referenced by `tests/ux-audit.test.cjs:117` |
| `tests/ux-audit.test.cjs` | Line 117 hardcodes the historical path `'.planning/v6.1.0-UX-AUDIT.md'`. Sweeping would break the test. |
| `.planning/sets/docs-and-housekeeping/**` | This set's own `CONTEXT.md`, `SET-OVERVIEW.md`, `CONTRACT.json`, `DEFERRED.md`, and this plan contain load-bearing task strings like `"Bump version strings from v6.1.0 to v6.2.0"`. Sweeping yields nonsense (`"Bump v6.2.0 to v6.2.0"`). |
| `.planning/sets/docs-and-housekeeping/wave-*-PLAN.md` | Covered by the parent directory exclusion above — listed separately for emphasis |
| `.planning/STATE.json` | Line 579 contains `"id": "v6.1.0"` historical milestone object — preserved by Task 1 (which only edits line 3). Excluded from sweep test/gate, NOT from Task 1 edits. |

**One more subtlety** — `.planning/STATE.json` has TWO matches and they must be treated differently:

| STATE.json line | Content | Action |
|---|---|---|
| Line 3 | `"rapidVersion": "6.1.0",` | **BUMP to `"6.2.0"`** — this is the active project version |
| Line 579 | `"id": "v6.1.0",` | **PRESERVE** — this is a historical milestone object ID inside the `milestones[]` array, equivalent to a ROADMAP entry. Bumping it would collide with the existing `v6.2.0` milestone and corrupt state. |

Handle STATE.json with a targeted edit (line 3 only), not a global substitution.

---

## Task List

Tasks are listed in the order an executor should tackle them. Each task is one commit unless noted.

### Task 1 — Bump version fields in structured metadata files

**Files to edit (4):**
- `package.json` — line 3: `"version": "6.1.0"` → `"version": "6.2.0"` (bare form)
- `.claude-plugin/plugin.json` — line 3: `"version": "6.1.0"` → `"version": "6.2.0"` (bare form)
- `.planning/STATE.json` — **line 3 ONLY**: `"rapidVersion": "6.1.0"` → `"rapidVersion": "6.2.0"`. **Do NOT touch line 579** (`"id": "v6.1.0"` inside the `milestones` array — that is a historical milestone record and is already paired with a separate `v6.2.0` milestone entry).
- `.planning/config.json` — line 4: `"version": "6.1.0"` → `"version": "6.2.0"`

**Verify before committing:**
```bash
node -e 'console.log(require("./package.json").version)'           # prints 6.2.0
node -e 'console.log(require("./.claude-plugin/plugin.json").version)'  # prints 6.2.0
node -e 'console.log(require("./.planning/config.json").project.version)'  # prints 6.2.0
node -e 'console.log(require("./.planning/STATE.json").rapidVersion)'  # prints 6.2.0
node -e 'const s=require("./.planning/STATE.json"); const ids=s.milestones.map(m=>m.id); console.log(ids.includes("v6.1.0") && ids.includes("v6.2.0") ? "OK: both milestone ids preserved" : "FAIL: historical milestone ids were damaged")'
```

**Commit:** `chore(docs-and-housekeeping): bump structured version fields to 6.2.0`

---

### Task 2 — Pin all runtime dependencies to exact versions

**File to edit (1):**
- `package.json` `dependencies` block: remove `^` / `~` prefixes and pin to the currently-resolved versions from `package-lock.json`.

**Exact targets** (resolved from `package-lock.json` — do NOT bump):
```json
"dependencies": {
  "ajv": "8.18.0",
  "ajv-formats": "3.0.1",
  "proper-lockfile": "4.1.2",
  "zod": "3.25.76"
}
```

**IMPORTANT — Version pin target note for reviewers:** `package.json` currently declares `"ajv": "^8.17.1"` but `package-lock.json` resolves to `8.18.0` (caret range drift from a prior `npm install`). The pin target is `8.18.0` (what is actually running), not `8.17.1` (what was previously declared). This is explicitly **not** an unauthorized bump — it is a pin-to-current per the user's "pin to what's installed, do not bump" directive.

**What NOT to do:**
- Do NOT run `npm install` or `npm update` — that may re-resolve versions. Just edit `package.json` by hand.
- Do NOT touch `devDependencies` (there aren't any today, but do not add any).
- Do NOT modify `package-lock.json` manually.

**Verify before committing:**
```bash
node -e 'const p=require("./package.json").dependencies; const bad=Object.entries(p).filter(([k,v])=>!/^\d+\.\d+\.\d+$/.test(v)); if(bad.length){console.error("UNPINNED:",bad);process.exit(1)}else{console.log("all pinned:",p)}'
```
Expected output:
```
all pinned: { ajv: '8.18.0', 'ajv-formats': '3.0.1', 'proper-lockfile': '4.1.2', zod: '3.25.76' }
```

**Commit:** `chore(docs-and-housekeeping): pin runtime deps to exact versions`

---

### Task 3 — Add NO_UPDATE_NOTIFIER block to .env.example

**File to edit (1):**
- `.env.example`

**Current content (3 lines):**
```
# RAPID plugin environment
# Set by setup.sh -- path to rapid-tools.cjs CLI
RAPID_TOOLS=/path/to/your/rapid/src/bin/rapid-tools.cjs
```

**Append this block (preserving existing lines verbatim):**
```

# Set to any non-empty value to suppress the deferred update-reminder banner
# (matches the update-notifier npm convention; NO_UPDATE_NOTIFIER=1 is conventional)
# Suppression fires when the variable is defined AND non-empty -- even '0' or 'false' will suppress.
NO_UPDATE_NOTIFIER=
```

**Style notes:**
- Leave a blank line between the existing `RAPID_TOOLS=...` line and the new comment block (matches existing section-break feel).
- Use `#` single-line comments (matches existing style).
- Do NOT document `RAPID_UPDATE_THRESHOLD_DAYS` — it's related but explicitly out of scope per CONTEXT.md gray-area call.
- The `NO_UPDATE_NOTIFIER=` line (with empty value) is intentional — users who want suppression will set a value; absence means "show the banner".

**Verify:** `grep -c 'NO_UPDATE_NOTIFIER' .env.example` prints at least `1`.

**Commit:** `docs(docs-and-housekeeping): document NO_UPDATE_NOTIFIER in .env.example`

---

### Task 4 — Sweep prefixed `v6.1.0` across README.md, DOCS.md, technical_documentation.md

**Files to edit (3):**
- `README.md` — 2 version matches (lines 6, 142) + 1 command-count drift (line 45)
- `DOCS.md` — 2 version matches (lines 5, 479) + 1 command-count drift (line 447)
- `technical_documentation.md` — 3 matches (lines 3, 73, 96)

**Substitution rules:**

**`README.md` line 6** (badge URL):
```
<img src="https://img.shields.io/badge/version-6.1.0-d3c6aa?...
```
→
```
<img src="https://img.shields.io/badge/version-6.2.0-d3c6aa?...
```

**`README.md` line 142** (changelog reference — SURGICAL REWRITE, not substitution):
Current:
```
See [CHANGELOG](docs/CHANGELOG.md) for full history. Latest: **v6.1.0 UX & Onboarding** (2026-04-06) -- unified footer guidance, audit-to-set handoff, README rewrite, UX audit, backlog capture, version housekeeping.
```
Replacement:
```
See [CHANGELOG](docs/CHANGELOG.md) for full history. Latest: **v6.2.0 DX Refinements** (2026-04-08) -- branding server with SSE auto-reload, opt-in init branding step, deferred update-reminder banner, runtime dependency pinning, context-file refresh.
```
Rationale: a literal `v6.1.0` → `v6.2.0` substitution would leave `"UX & Onboarding"` wording attached to the wrong milestone. The replacement rewrites the whole sentence to describe v6.2.0's actual scope (see `.planning/research/v6.2.0-synthesis.md` for the milestone theme).

**`README.md` lines 138 and 146** (count drift — "29 commands" → "30 commands"):
The skill count is now 30 (verified by `ls skills/ | wc -l`). Update both occurrences. The nearby `/rapid:*` command table only shows the most common 10 commands, so the "all 29" / "all 30" counts in the surrounding prose are the only numbers to bump; do not modify the table itself.

**`DOCS.md` line 5** (bare-ish form with `**Version:**` label):
```
**Version:** 6.1.0
```
→
```
**Version:** 6.2.0
```
(This is the bare-form match — reachable by both the `v6.1.0` and bare `6.1.0` patterns.)

**`DOCS.md` line 479:**
```
RAPID v6.1.0 structures parallel work around **sets** ...
```
→
```
RAPID v6.2.0 structures parallel work around **sets** ...
```

**`technical_documentation.md` lines 3, 73, 96:** direct `v6.1.0` → `v6.2.0` substitution. Read the surrounding sentences first — they describe RAPID's current state, so the substitution is meaning-preserving.

**`README.md` line 45** (command-count drift — GAP-01):
Current:
```
17 of 29 commands show this footer. Informational commands like `/rapid:status` and `/rapid:help` do not -- they consume minimal context and produce no artifacts.
```
Replacement:
```
18 of 30 commands show this footer. Informational commands like `/rapid:status` and `/rapid:help` do not -- they consume minimal context and produce no artifacts.
```
(Rationale: v6.2.0 ships one additional skill and one additional footer-emitting skill. The "17 of 29" → "18 of 30" bump keeps the ratio honest.)

**`DOCS.md` line 447** (command-count drift — GAP-02):
Current:
```
Displays a static command reference with the full workflow diagram, all 29 commands organized by category, and usage guidance. No project analysis or state checking -- purely informational.
```
Replacement:
```
Displays a static command reference with the full workflow diagram, all 30 commands organized by category, and usage guidance. No project analysis or state checking -- purely informational.
```

**Verify after edits:**
```bash
grep -n 'v6\.1\.0' README.md DOCS.md technical_documentation.md   # zero matches
grep -n '\b6\.1\.0' README.md DOCS.md technical_documentation.md  # zero matches
```

**Commit:** `docs(docs-and-housekeeping): sweep v6.1.0 to v6.2.0 in README/DOCS/technical_documentation`

---

### Task 5 — Sweep prefixed `v6.1.0` across skills/{install,status,help}/SKILL.md

**Files to edit (3):**

**`skills/install/SKILL.md`** — 7 matches (lines 2, 7, 9, 28, 92, 319, 331). All are user-facing skill prose describing the installer flow ("Install and configure RAPID v6.1.0..."). Direct substitution is safe and meaning-preserving.

**`skills/status/SKILL.md`** — 5 matches (lines 6, 8, 184, 225, 261). All skill prose. Direct substitution.

**`skills/help/SKILL.md`** — 2 matches (lines 20, 135). **ALSO**: line 135 says `RAPID v6.1.0 | 29 commands | ...`. The skill count is 30, not 29. Do both corrections in the same edit: `v6.1.0` → `v6.2.0` AND `29 commands` → `30 commands`. Line 20 is inside a prose description — substitution only.

**Verify after edits:**
```bash
grep -n 'v6\.1\.0' skills/install/SKILL.md skills/status/SKILL.md skills/help/SKILL.md   # zero matches
grep -n '29 commands' skills/help/SKILL.md  # zero matches
```

**Note on other skills/ files:** the grep sweep only found three skill files with `v6.1.0`. Do NOT speculatively edit other skill files.

**Commit:** `docs(docs-and-housekeeping): sweep v6.1.0 in install/status/help skills`

---

### Task 6 — Sweep `.github/ISSUE_TEMPLATE/*.yml` placeholders

**Files to edit (2):**
- `.github/ISSUE_TEMPLATE/bug-report.yml` — line 9: `placeholder: "e.g., v6.1.0"` → `placeholder: "e.g., v6.2.0"`
- `.github/ISSUE_TEMPLATE/feature-request.yml` — line 9: same pattern

These are placeholder example strings in GitHub issue form fields. Direct substitution.

**Verify:** `grep -n 'v6\.1\.0' .github/ISSUE_TEMPLATE/*.yml` returns zero matches.

**Commit:** `chore(docs-and-housekeeping): bump v6.1.0 placeholders in GitHub issue templates`

---

### Task 7 — Sweep historical v6.2.0 research and update-reminder artifacts

**Files to edit (5):**

**`.planning/research/v6.2.0-synthesis.md`** — lines 102, 217. These contain phrases like "the current v6.1.0 architecture is a mature modular monolith" that describe the pre-v6.2.0 starting point of the research. Direct substitution turns these into "the current v6.2.0 architecture is a mature modular monolith" — still coherent since the research describes the baseline that v6.2.0 extends. Substitution is accepted per CONTEXT.md's gray-area call.

**`.planning/research/v6.2.0-research-architecture.md`** — line 5. Direct substitution.

**`.planning/research/v6.2.0-research-oversights.md`** — line 77. Direct substitution.

**`.planning/sets/update-reminder/CONTEXT.md`** — contains quoted skill output strings like `"RAPID v6.1.0 is ready"` as examples of install-banner text. After the sweep of `skills/install/SKILL.md` in Task 5, these examples would be stale. Direct substitution keeps them as valid quoted examples of the post-sweep banner text.

**`.planning/sets/update-reminder/wave-3-PLAN.md`** — same quoted-example pattern. Direct substitution.

**Verify:** `grep -rn 'v6\.1\.0' .planning/research/ .planning/sets/update-reminder/` returns zero matches.

**Note:** `.planning/sets/docs-and-housekeeping/` is EXCLUDED — do not touch it.

**Commit:** `docs(docs-and-housekeeping): sweep v6.1.0 in research and update-reminder artifacts`

---

### Task 8 — Add the `runtime-deps-pinned` behavioral test

**File to extend (1):**
- `src/lib/version.test.cjs`

**Rationale for colocation:** `version.test.cjs` already has a `describe('version sync', ...)` block that reads and asserts against `package.json` and `.claude-plugin/plugin.json`. Adding a new `describe('runtime dependency pins', ...)` block next to it keeps the metadata-invariant tests together, matches the strong precedent, and avoids creating a new file for a tiny test.

**Append this block to `src/lib/version.test.cjs`** (after the existing `describe('version sync', ...)` block, before `describe('install timestamp primitives', ...)`):

```javascript
// --- runtime dependency pins ---

describe('runtime dependency pins', () => {
  const pkgPath = path.resolve(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = pkg.dependencies || {};
  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('package.json has a dependencies block', () => {
    assert.ok(Object.keys(deps).length > 0, 'expected at least one runtime dependency');
  });

  it('every runtime dependency is an exact semver (no ^ or ~)', () => {
    const unpinned = Object.entries(deps).filter(([, v]) => !EXACT_SEMVER.test(v));
    assert.deepEqual(
      unpinned,
      [],
      `unpinned runtime dependencies found: ${JSON.stringify(unpinned)}`
    );
  });

  it('pins zod to the exact resolved version (3.25.76)', () => {
    assert.equal(deps.zod, '3.25.76');
  });

  it('pins ajv to the exact resolved version (8.18.0)', () => {
    assert.equal(deps.ajv, '8.18.0');
  });

  it('pins ajv-formats to the exact resolved version (3.0.1)', () => {
    assert.equal(deps['ajv-formats'], '3.0.1');
  });

  it('pins proper-lockfile to the exact resolved version (4.1.2)', () => {
    assert.equal(deps['proper-lockfile'], '4.1.2');
  });
});
```

**Note:** `path` and `fs` are already imported at the top of the file — do not re-import. Do not add a duplicate `require('./version.cjs')` either.

**Verify:** `node --test src/lib/version.test.cjs` — all tests pass, new describe block runs 6 assertions.

**Commit:** `test(docs-and-housekeeping): assert runtime dep pins in version.test.cjs`

---

### Task 9 — Add the `no-stale-versions` behavioral test

**File to create (1):**
- `src/lib/housekeeping.test.cjs`

**Why a new file:** This test is not about version numbers per se — it's a repo-level invariant check ("no stale milestone markers outside the exclusion list"). Mixing it with `version.test.cjs` would conflate two different concerns (file-level metadata invariants vs repo-level content invariants). A dedicated file also gives future repo-level hygiene checks an obvious home.

**File content:**

```javascript
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
  'ROADMAP.md',
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
```

**Design notes for the executor (READ BEFORE EDITING):**

1. **Bare `6.1.0` regex needs negative lookarounds.** A naive `/6\.1\.0/` would match `16.1.0` (a future react/node version, for example). The `(?<![\d.])6\.1\.0(?![\d.])` form prevents this. Node's regex engine supports lookbehinds since Node 10.
2. **Use `git ls-files`** rather than walking the filesystem. This automatically respects `.gitignore`, excludes `node_modules/` without a special case, and matches what the sweep actually touches.
3. **Skip binary files with a try/catch.** `fs.readFileSync(..., 'utf-8')` will still read binary files as strings on Linux (no throw), but the regex patterns won't match any real binary content. The try/catch is belt-and-suspenders — leave it in.
4. **Self-exclusion.** `src/lib/housekeeping.test.cjs` contains the literal strings `v6.1.0` and `6.1.0` in its comments and patterns. It MUST exclude itself from the scan or the test will always fail.
5. **The test file lives at `src/lib/housekeeping.test.cjs`** (not `tests/`) because `package.json`'s test script is `node --test 'src/**/*.test.cjs'`. The `tests/` directory is NOT run by `npm test`.
6. **`.planning/STATE.json` exclusion is intentional.** STATE.json line 3 IS bumped to `6.2.0` (Wave 1 Task 1), but line 579 contains the historical milestone object `"id": "v6.1.0"` inside the `milestones[]` array -- it must be preserved (paired with a separate v6.2.0 milestone). The whole file is excluded from the test rather than line-filtering, because the test is a coarse content check.

**Verify:**
```bash
node --test src/lib/housekeeping.test.cjs   # both tests pass; zero offenders
npm test                                     # full suite still green
```

**Commit:** `test(docs-and-housekeeping): add no-stale-versions repo invariant test`

---

### Task 10 — Final sweep verification gate

**No file edits — verification only.**

Run these commands from the repo root. All three must return EXIT CODE 0 and print no matches (or print a success message). If any offends, fix it and re-run.

```bash
# Gate 1: prefixed form
git grep -n 'v6\.1\.0' -- \
  ':!.planning/archive' \
  ':!.archive' \
  ':!node_modules' \
  ':!ROADMAP.md' \
  ':!docs/CHANGELOG.md' \
  ':!.planning/v6.1.0-AUDIT.md' \
  ':!.planning/v6.1.0-UX-AUDIT.md' \
  ':!tests/ux-audit.test.cjs' \
  ':!.planning/sets/docs-and-housekeeping' \
  ':!.planning/STATE.json' \
  ':!src/lib/housekeeping.test.cjs' \
  && { echo "FAIL: v6.1.0 still present"; exit 1; } || echo "OK: no v6.1.0"

# Gate 2: bare form (word-boundary aware)
git grep -nP '(?<![\d.])6\.1\.0(?![\d.])' -- \
  ':!.planning/archive' \
  ':!.archive' \
  ':!node_modules' \
  ':!package-lock.json' \
  ':!ROADMAP.md' \
  ':!docs/CHANGELOG.md' \
  ':!.planning/v6.1.0-AUDIT.md' \
  ':!.planning/v6.1.0-UX-AUDIT.md' \
  ':!tests/ux-audit.test.cjs' \
  ':!.planning/sets/docs-and-housekeeping' \
  ':!.planning/STATE.json' \
  ':!src/lib/housekeeping.test.cjs' \
  && { echo "FAIL: bare 6.1.0 still present"; exit 1; } || echo "OK: no bare 6.1.0"

# Gate 3: full test suite
npm test
```

If any gate fails, do NOT proceed to Wave 2. Fix the leak and re-run all three gates.

**No commit.** This task is a gate, not a change.

---

## Success Criteria (Wave 1)

- [ ] `package.json`, `.claude-plugin/plugin.json`, `.planning/STATE.json` (line 3 only), `.planning/config.json` all show `6.2.0`
- [ ] `.planning/STATE.json` still contains the historical milestone entry with `"id": "v6.1.0"` around line 579 (preserved)
- [ ] `package.json` dependencies block: `ajv=8.18.0`, `ajv-formats=3.0.1`, `proper-lockfile=4.1.2`, `zod=3.25.76` — zero `^` or `~`
- [ ] `.env.example` contains a `NO_UPDATE_NOTIFIER=` block with the conventional-usage comment
- [ ] `README.md`, `DOCS.md`, `technical_documentation.md`, `skills/{install,status,help}/SKILL.md`, `.github/ISSUE_TEMPLATE/*.yml`, `.planning/research/v6.2.0-*.md`, `.planning/sets/update-reminder/{CONTEXT,wave-3-PLAN}.md` all free of `v6.1.0`
- [ ] `skills/help/SKILL.md` says `30 commands` (not 29)
- [ ] `src/lib/version.test.cjs` contains the new `runtime dependency pins` describe block (6 assertions)
- [ ] `src/lib/housekeeping.test.cjs` exists and has the `no-stale-versions invariant` describe block (2 assertions)
- [ ] `npm test` passes end-to-end
- [ ] Both sweep gate commands in Task 10 print "OK"

---

## File Ownership (Wave 1 only)

Exclusive — no overlap with Wave 2.

- `package.json`
- `.claude-plugin/plugin.json`
- `.planning/STATE.json`
- `.planning/config.json`
- `.env.example`
- `README.md`
- `DOCS.md`
- `technical_documentation.md`
- `skills/install/SKILL.md`
- `skills/status/SKILL.md`
- `skills/help/SKILL.md`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/feature-request.yml`
- `.planning/research/v6.2.0-synthesis.md`
- `.planning/research/v6.2.0-research-architecture.md`
- `.planning/research/v6.2.0-research-oversights.md`
- `.planning/sets/update-reminder/CONTEXT.md`
- `.planning/sets/update-reminder/wave-3-PLAN.md`
- `src/lib/version.test.cjs`
- `src/lib/housekeeping.test.cjs` (new)

**Wave 2 owns `.planning/context/*.md` — disjoint.**

---

## Expected Commits (Wave 1)

1. `chore(docs-and-housekeeping): bump structured version fields to 6.2.0`
2. `chore(docs-and-housekeeping): pin runtime deps to exact versions`
3. `docs(docs-and-housekeeping): document NO_UPDATE_NOTIFIER in .env.example`
4. `docs(docs-and-housekeeping): sweep v6.1.0 to v6.2.0 in README/DOCS/technical_documentation`
5. `docs(docs-and-housekeeping): sweep v6.1.0 in install/status/help skills`
6. `chore(docs-and-housekeeping): bump v6.1.0 placeholders in GitHub issue templates`
7. `docs(docs-and-housekeeping): sweep v6.1.0 in research and update-reminder artifacts`
8. `test(docs-and-housekeeping): assert runtime dep pins in version.test.cjs`
9. `test(docs-and-housekeeping): add no-stale-versions repo invariant test`

9 commits. Task 10 (verification gate) produces no commit.
