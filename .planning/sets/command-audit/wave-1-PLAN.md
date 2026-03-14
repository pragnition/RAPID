# WAVE 1 PLAN: Registry Cleanup and Consistency Test

**Set:** command-audit
**Wave:** 1
**Objective:** Remove 4 phantom `wave-plan-*` entries from TOOL_REGISTRY, update ROLE_TOOL_MAP to drop references to removed keys, update the roadmapper prose reference, and add a phantom-command consistency test.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/tool-docs.cjs` | Modify |
| `src/lib/tool-docs.test.cjs` | Modify |
| `src/modules/roles/role-roadmapper.md` | Modify |

## Tasks

### Task 1: Remove phantom entries from TOOL_REGISTRY

**File:** `src/lib/tool-docs.cjs`
**Action:** Delete lines 66-69 (the `// Wave planning` comment and the 4 entries below it):

Remove these 4 entries from the TOOL_REGISTRY object:
- `'wave-plan-resolve'`
- `'wave-plan-create-dir'`
- `'wave-plan-validate'`
- `'wave-plan-list-jobs'`

Also remove the `// Wave planning` comment on line 65.

**What NOT to do:**
- Do NOT remove any other entries from TOOL_REGISTRY
- Do NOT touch display.cjs -- `wave-plan` is a valid display stage name there, not a CLI subcommand
- Do NOT modify the `resolve-set` or `resolve-wave` entries (those are valid commands)

**Verification:**
```bash
node -e "const t = require('./src/lib/tool-docs.cjs'); const keys = Object.keys(t.TOOL_REGISTRY); const phantoms = keys.filter(k => k.startsWith('wave-plan-')); if (phantoms.length > 0) { console.error('FAIL: phantom entries still present:', phantoms); process.exit(1); } console.log('PASS: no wave-plan-* entries in TOOL_REGISTRY');"
```

### Task 2: Update ROLE_TOOL_MAP plan-verifier entry

**File:** `src/lib/tool-docs.cjs`
**Action:** On line 126, change the `plan-verifier` entry in ROLE_TOOL_MAP from:
```js
'plan-verifier':    ['state-get', 'plan-load-set', 'wave-plan-validate'],
```
to:
```js
'plan-verifier':    ['state-get', 'plan-load-set'],
```

Remove `'wave-plan-validate'` from the array. Do not add any replacement -- the plan-verifier validates by reading files directly (Read/Glob), not via a CLI subcommand.

**Verification:**
```bash
node -e "const t = require('./src/lib/tool-docs.cjs'); const pv = t.ROLE_TOOL_MAP['plan-verifier']; if (pv.includes('wave-plan-validate')) { console.error('FAIL: plan-verifier still references wave-plan-validate'); process.exit(1); } console.log('PASS: plan-verifier clean');"
```

### Task 3: Verify getToolDocsForRole does not throw for any role

**File:** (no file change -- verification only)
**Action:** After Tasks 1-2, verify that `getToolDocsForRole` works for all roles in ROLE_TOOL_MAP without throwing.

**Verification:**
```bash
node -e "const t = require('./src/lib/tool-docs.cjs'); for (const role of Object.keys(t.ROLE_TOOL_MAP)) { try { t.getToolDocsForRole(role); } catch (e) { console.error('FAIL:', e.message); process.exit(1); } } console.log('PASS: getToolDocsForRole works for all roles');"
```

### Task 4: Update roadmapper prose reference

**File:** `src/modules/roles/role-roadmapper.md`
**Action:** On line 160, change:
```
- Detailed planning happens later via /rapid:discuss and /rapid:wave-plan per wave
```
to:
```
- Detailed planning happens later via /rapid:discuss-set and /rapid:plan-set per set
```

This updates the deprecated `/rapid:wave-plan` skill reference to the current `/rapid:plan-set` skill name, and also updates `/rapid:discuss` to `/rapid:discuss-set` for consistency.

**What NOT to do:**
- Do NOT modify any other lines in this file
- Do NOT change "per wave" to something else in a way that alters meaning -- the replacement "per set" reflects the v3 set-level planning model

**Verification:**
```bash
grep -n 'wave-plan' src/modules/roles/role-roadmapper.md && echo "FAIL: wave-plan reference still present" && exit 1 || echo "PASS: no wave-plan references in role-roadmapper.md"
```

### Task 5: Add phantom-command consistency test

**File:** `src/lib/tool-docs.test.cjs`
**Action:** Add a new `describe` block at the end of the file (before the closing of the module, after the `module exports` describe block). This test enforces that no skill or agent markdown file references a `wave-plan` CLI subcommand (as opposed to display stage names or prose).

Add this test block:

```js
// ---------------------------------------------------------------------------
// Phantom command guard: no skill/agent .md references wave-plan CLI calls
// ---------------------------------------------------------------------------
describe('phantom command guard', () => {
  it('no skill SKILL.md files contain wave-plan CLI invocations', () => {
    const skillsDir = path.join(__dirname, '..', '..', 'skills');
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of skillDirs) {
      const skillFile = path.join(skillsDir, dir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const content = fs.readFileSync(skillFile, 'utf-8');
      // Match CLI invocations: node "$RAPID_TOOLS" wave-plan or node "${RAPID_TOOLS}" wave-plan
      const cliPattern = /node\s+["']?\$\{?RAPID_TOOLS\}?["']?\s+wave-plan/g;
      const matches = content.match(cliPattern);
      assert.ok(
        !matches,
        `skills/${dir}/SKILL.md contains phantom wave-plan CLI call(s): ${matches ? matches.join(', ') : ''}`
      );
    }
  });

  it('no agent .md files reference wave-plan-* tool keys in <tools> sections', () => {
    const agentsDir = path.join(__dirname, '..', '..', 'agents');
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const file of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      // Extract <tools> section if present
      const toolsMatch = content.match(/<tools>([\s\S]*?)<\/tools>/);
      if (!toolsMatch) continue;
      const toolsSection = toolsMatch[1];
      const phantomPattern = /wave-plan-/g;
      const matches = toolsSection.match(phantomPattern);
      assert.ok(
        !matches,
        `agents/${file} <tools> section references phantom wave-plan-* key(s)`
      );
    }
  });
});
```

This requires adding `path` and `fs` imports at the top of the test file. Check if they already exist -- if not, add:
```js
const fs = require('fs');
const path = require('path');
```

**What NOT to do:**
- Do NOT flag `wave-plan` references in `display.cjs` or `display.test.cjs` -- those are valid display stage names
- Do NOT flag `wave-plan` in prose/comments -- only CLI invocations (`node ... wave-plan`) and tool key references (`wave-plan-*`) in `<tools>` sections
- Do NOT modify existing tests -- only add new ones

**Verification:**
```bash
node --test src/lib/tool-docs.test.cjs 2>&1 | tail -5
```
All tests (existing + new) should pass. The new phantom guard tests should pass only AFTER Wave 2 completes (which removes the actual phantom references from skills and agents). To pass in Wave 1, the skill files must still contain the phantom references -- so this test will initially FAIL as expected. The executor should run Wave 2 to make them pass.

**Important note for the executor:** This test is intentionally written to fail at the end of Wave 1 (before Wave 2 cleans up skills/agents). This is by design -- the test enforces the invariant that Wave 2 must fix. Run `node --test src/lib/tool-docs.test.cjs` after Wave 2 to confirm all tests pass. During Wave 1, verify only the ROLE_TOOL_MAP consistency test (which already exists at line 95) passes, and that the existing `getToolDocsForRole` test at line 158 passes.

## Success Criteria

1. TOOL_REGISTRY has zero entries with keys starting with `wave-plan-`
2. ROLE_TOOL_MAP `plan-verifier` entry does not reference `wave-plan-validate`
3. `getToolDocsForRole(role)` does not throw for any role in ROLE_TOOL_MAP
4. Existing tool-docs.test.cjs tests all pass (25 existing tests)
5. role-roadmapper.md no longer references `/rapid:wave-plan`
6. New phantom-command guard tests are added (will pass after Wave 2)
