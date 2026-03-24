# PLAN: path-resolution-fix / Wave 1

## Objective

Fix all 4 broken `require('${RAPID_TOOLS}/../lib/...')` calls across `skills/init/SKILL.md` and `skills/register-web/SKILL.md`. Node.js treats the `.cjs` filename in the `RAPID_TOOLS` path as a path component, so `../` navigates incorrectly. Replace with `path.dirname()`-based resolution.

## Owned Files

- `skills/init/SKILL.md`
- `skills/register-web/SKILL.md`

## Tasks

### Task 1: Fix require() in skills/init/SKILL.md line 564

**File:** `skills/init/SKILL.md`
**Location:** Line 564, inside a `node -e "..."` bash block

**Current code (line 564):**
```javascript
  const { detectTestFrameworks } = require('${RAPID_TOOLS}/../lib/context.cjs');
```

**Replace with:**
```javascript
  const path=require('path'); const { detectTestFrameworks } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'context.cjs'));
```

**What NOT to do:**
- Do not modify any other lines in this code block (lines 565-567 remain unchanged)
- Do not add newlines -- this is inside a `node -e` string, keep it as a single logical line

**Verification:**
```bash
grep -n "path.dirname.*RAPID_TOOLS.*context.cjs" skills/init/SKILL.md
# Should match line ~564
grep -n "require.*RAPID_TOOLS.*/../lib" skills/init/SKILL.md
# Should return NO matches after all tasks complete
```

---

### Task 2: Fix require() in skills/init/SKILL.md line 1000

**File:** `skills/init/SKILL.md`
**Location:** Line 1000, inside a `node -e "..."` bash block

**Current code (line 1000):**
```javascript
const { isWebEnabled, registerProjectWithWeb } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
```

**Replace with:**
```javascript
const path=require('path'); const { isWebEnabled, registerProjectWithWeb } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'web-client.cjs'));
```

**What NOT to do:**
- Do not modify surrounding lines (the `if (!isWebEnabled())` block, the `registerProjectWithWeb` call, etc.)
- Preserve the exact indentation -- this line has zero leading spaces (unlike Task 1 which has 2)

**Verification:**
```bash
grep -n "path.dirname.*RAPID_TOOLS.*web-client.cjs" skills/init/SKILL.md
# Should match line ~1000
```

---

### Task 3: Fix require() in skills/register-web/SKILL.md line 22

**File:** `skills/register-web/SKILL.md`
**Location:** Line 22, inside a `node -e "..."` bash block

**Current code (line 22):**
```javascript
const { isWebEnabled } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
```

**Replace with:**
```javascript
const path=require('path'); const { isWebEnabled } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'web-client.cjs'));
```

**Verification:**
```bash
grep -n "path.dirname.*RAPID_TOOLS.*web-client.cjs" skills/register-web/SKILL.md
# Should match lines ~22 and ~44 after both tasks complete
```

---

### Task 4: Fix require() in skills/register-web/SKILL.md line 44

**File:** `skills/register-web/SKILL.md`
**Location:** Line 44, inside a `node -e "..."` bash block

**Current code (line 44):**
```javascript
const { registerProjectWithWeb } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
```

**Replace with:**
```javascript
const path=require('path'); const { registerProjectWithWeb } = require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', 'web-client.cjs'));
```

**Verification:**
```bash
grep -n "path.dirname.*RAPID_TOOLS.*web-client.cjs" skills/register-web/SKILL.md
# Should match lines ~22 and ~44
```

---

## Final Verification

After all 4 tasks, run these checks:

```bash
# 1. Zero remaining broken patterns in owned files
grep -rn "require.*RAPID_TOOLS.*/../lib" skills/init/SKILL.md skills/register-web/SKILL.md
# Expected: no output (exit code 1)

# 2. All 4 occurrences use new pattern
grep -cn "path.dirname.*RAPID_TOOLS" skills/init/SKILL.md
# Expected: 2

grep -cn "path.dirname.*RAPID_TOOLS" skills/register-web/SKILL.md
# Expected: 2

# 3. Syntax check -- ensure node can parse the inline JS
node -e "const path=require('path'); const testPath=path.join(path.dirname('/fake/src/bin/rapid-tools.cjs'), '..', 'lib', 'context.cjs'); console.log(testPath);"
# Expected: /fake/src/lib/context.cjs
```

## Success Criteria

1. All 4 `require()` calls use `path.dirname('${RAPID_TOOLS}')` instead of `'${RAPID_TOOLS}/../'`
2. Zero occurrences of the old `${RAPID_TOOLS}/../lib/` pattern remain in owned files
3. The `node -e` syntax check resolves `/fake/src/bin/rapid-tools.cjs` to `/fake/src/lib/context.cjs`
4. No other lines in either file are modified beyond the 4 targeted require statements
