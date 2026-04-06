# PLAN: audit-handoff -- Wave 3 (Version Sync)

## Objective

Synchronize the Node.js minimum version from the current inconsistent state (>=20 in package.json, v18+ in setup.sh, 20+ in README badge, '20' in prereqs.cjs) to a uniform >=22 across all locations. Node.js 22 is the current LTS release.

## Owned Files

| File | Action |
|------|--------|
| `package.json` | **Modify** |
| `setup.sh` | **Modify** |
| `README.md` | **Modify** |
| `src/lib/prereqs.cjs` | **Modify** |

## Dependencies

- None. This wave is independent of Waves 1 and 2. It can execute in parallel with Wave 2 if desired, since there is no file overlap.

---

## Task 1: Update `package.json` engines field

### What to Change

Change the `engines.node` field from `">=20"` to `">=22"`.

### Exact Edit

In `package.json`, line 7:

- Old: `"node": ">=20"`
- New: `"node": ">=22"`

### What NOT to Do

- Do NOT change the version field, dependencies, or any other field.
- Do NOT reformat the JSON or change indentation.

### Verification

```bash
node -e "const pkg = require('./package.json'); console.log(pkg.engines.node);"
# Expected: >=22
```

---

## Task 2: Update `setup.sh` Node.js version check (3 locations)

### What to Change

Update the three Node.js version references in setup.sh.

### Exact Edits

**Edit 1** -- Line 35, the comment/display text:

- Old: `echo "  ERROR: Node.js is required (v18+). Install from https://nodejs.org"`
- New: `echo "  ERROR: Node.js is required (v22+). Install from https://nodejs.org"`

**Edit 2** -- Line 39, the numeric comparison:

- Old: `if [[ "$NODE_VERSION" -lt 18 ]]; then`
- New: `if [[ "$NODE_VERSION" -lt 22 ]]; then`

**Edit 3** -- Line 40, the error message:

- Old: `echo "  ERROR: Node.js 18+ required, found $(node -v)"`
- New: `echo "  ERROR: Node.js 22+ required, found $(node -v)"`

### What NOT to Do

- Do NOT change any other part of setup.sh (steps, uv check, npm check, etc.).
- Do NOT change the shebang, set flags, or helper functions.

### Verification

```bash
grep -n 'v22+\|22+\|-lt 22' setup.sh | wc -l
# Expected: 3 (all three locations updated)
grep -n 'v18+\|18+\|-lt 18' setup.sh | wc -l
# Expected: 0 (no old references remain)
```

---

## Task 3: Update `README.md` badge

### What to Change

Update the Node.js badge from `20%2B` (URL-encoded "20+") to `22%2B` ("22+").

### Exact Edit

In `README.md`, line 9:

- Old: `https://img.shields.io/badge/Node.js-20%2B-a7c080?style=flat-square&labelColor=2d353b`
- New: `https://img.shields.io/badge/Node.js-22%2B-a7c080?style=flat-square&labelColor=2d353b`

### What NOT to Do

- Do NOT change any other badges or content in README.md.
- Do NOT change the badge style, colors, or label.

### Verification

```bash
grep -q '22%2B' README.md && echo "PASS: README badge updated" || echo "FAIL: README badge not updated"
grep -q '20%2B' README.md && echo "FAIL: old badge still present" || echo "PASS: old badge removed"
```

---

## Task 4: Update `src/lib/prereqs.cjs` runtime check

### What to Change

Update the Node.js minimum version in the `validatePrereqs()` function from `'20'` to `'22'`. This is the runtime check that actually validates the Node.js version when RAPID runs.

### Exact Edit

In `src/lib/prereqs.cjs`, inside the `checkTool` call for Node.js (around line 115):

- Old: `minVersion: '20',`
- New: `minVersion: '22',`

### What NOT to Do

- Do NOT change the git or jq version checks.
- Do NOT change the `compareVersions` function or any other logic.
- Do NOT change the `parseVersion` function for Node.js.

### Verification

```bash
node -e "
const { validatePrereqs } = require('./src/lib/prereqs.cjs');
validatePrereqs().then(results => {
  const nodeCheck = results.find(r => r.name === 'Node.js');
  console.log('minVersion:', nodeCheck.minVersion);
  console.log('status:', nodeCheck.status);
});
"
# Expected: minVersion: 22, status: pass (assuming running Node 22+)
```

Also verify no old references remain:

```bash
grep -rn "minVersion.*'20'" src/lib/prereqs.cjs | wc -l
# Expected: 0
```

---

## Success Criteria

1. `package.json` has `"node": ">=22"` in engines
2. `setup.sh` references v22+ in all three locations (comment, comparison, error message)
3. `README.md` badge shows `22%2B`
4. `src/lib/prereqs.cjs` has `minVersion: '22'` for the Node.js check
5. No residual references to Node 18 or Node 20 as minimum versions in any of the four files
6. `node --test src/lib/prereqs.test.cjs` still passes (existing tests should handle the version bump)
