# Wave 1: Source Code Cleanup

## Objective

Remove all deprecated command references from source code files: TOOL_REGISTRY, ROLE_TOOL_MAP, CLI handler, USAGE string, display stage maps, worktree suggested actions, and role markdown documentation. This wave performs the actual deletions; wave 2 updates tests to match.

## Tasks

### Task 1: Remove deprecated entries from TOOL_REGISTRY in tool-docs.cjs

**File:** `src/lib/tool-docs.cjs`

**Actions:**
1. Delete the `// Set init` comment line and the 2 entries below it (`set-init-create`, `set-init-list`) -- lines 61-63
2. Delete the `// Wave planning` comment line and the 4 entries below it (`wave-plan-resolve`, `wave-plan-create-dir`, `wave-plan-validate`, `wave-plan-list-jobs`) -- lines 65-69
3. After deletion, the `// Review` section should directly follow the `// Worktree` section

**Verification:**
```bash
node -e "const t = require('./src/lib/tool-docs.cjs'); const keys = Object.keys(t.TOOL_REGISTRY); console.log('count:', keys.length); const bad = keys.filter(k => k.startsWith('set-init') || k.startsWith('wave-plan')); console.log('deprecated:', bad); if (bad.length > 0) process.exit(1); if (keys.length !== 53) process.exit(1);"
```

**What NOT to do:**
- Do NOT remove entries starting with `execute-` (those are current commands)
- Do NOT remove `plan-create-set`, `plan-load-set`, etc. (those are current planning commands)

---

### Task 2: Clean up ROLE_TOOL_MAP plan-verifier entry in tool-docs.cjs

**File:** `src/lib/tool-docs.cjs`

**Actions:**
1. On line 126, change `'plan-verifier': ['state-get', 'plan-load-set', 'wave-plan-validate']` to `'plan-verifier': ['state-get', 'plan-load-set']`
2. The plan-verifier role STAYS in ROLE_TOOL_MAP -- it is actively used by generated agents. Only the `wave-plan-validate` key is removed.

**Verification:**
```bash
node -e "const t = require('./src/lib/tool-docs.cjs'); const pv = t.ROLE_TOOL_MAP['plan-verifier']; console.log('plan-verifier tools:', pv); if (pv.includes('wave-plan-validate')) { console.error('FAIL: wave-plan-validate still present'); process.exit(1); } if (!pv.includes('state-get') || !pv.includes('plan-load-set')) { console.error('FAIL: missing expected tools'); process.exit(1); } console.log('OK');"
```

---

### Task 3: Remove handleSetInit function and dispatch from rapid-tools.cjs

**File:** `src/bin/rapid-tools.cjs`

**Actions:**
1. Delete the 2 USAGE lines for `set-init` commands (lines 78-79):
   ```
   set-init create <set-name>     Initialize a set: create worktree + scoped CLAUDE.md + register
   set-init list-available        List pending sets without worktrees
   ```
2. Delete the `case 'set-init':` dispatch branch (lines 190-192):
   ```javascript
   case 'set-init':
     await handleSetInit(cwd, subcommand, args.slice(2));
     break;
   ```
3. Delete the entire `handleSetInit` function (lines 1303-1364). This is the async function between `handleWorktree`'s closing brace (line 1301) and `handleReview` (starting at line 1366).

**Verification:**
```bash
grep -n 'set-init' src/bin/rapid-tools.cjs | grep -v 'setInit\|archive\|\.planning' || echo "No set-init references remain (OK)"
grep -n 'handleSetInit' src/bin/rapid-tools.cjs && echo "FAIL: handleSetInit still exists" && exit 1 || echo "OK: handleSetInit removed"
```

**What NOT to do:**
- Do NOT remove any references to `wt.setInit()` -- that is the library function, still used by start-set
- Do NOT modify the `handleExecute` function or its case branch -- only `handleSetInit` / `case 'set-init'` are targets

---

### Task 4: Remove deprecated entries from STAGE_VERBS and STAGE_BG in display.cjs

**File:** `src/lib/display.cjs`

**Actions:**
1. From `STAGE_VERBS` (lines 24-39), remove exactly these 4 entries:
   - `'set-init': 'PREPARING',` (line 26)
   - `'discuss': 'DISCUSSING',` (line 27)
   - `'wave-plan': 'PLANNING',` (line 28)
   - `'execute': 'EXECUTING',` (line 30)
2. From `STAGE_BG` (lines 50-65), remove exactly these 4 entries:
   - `'set-init': '\x1b[104m',    // bright blue` (line 52)
   - `'discuss': '\x1b[104m',     // bright blue` (line 53)
   - `'wave-plan': '\x1b[104m',   // bright blue` (line 54)
   - `'execute': '\x1b[102m',     // bright green` (line 56)
3. Update the JSDoc comment above `STAGE_VERBS` (lines 21-23) to remove the "Legacy (8)" list. Replace with:
   ```
   * Active stages (10): init, plan-set, review, merge, start-set, discuss-set, execute-set, new-version, add-set, quick
   ```
4. Update the JSDoc comment above `STAGE_BG` (lines 46-49) to remove deprecated stages from group descriptions:
   - Planning stages: `(init, plan-set, start-set, discuss-set, new-version, add-set)`
   - Execution stages: `(execute-set, quick)`
   - Review stages: `(review, merge)`
5. Update the JSDoc for `renderBanner` function (line 73) to list only the 10 active stages.

**Verification:**
```bash
node -e "const d = require('./src/lib/display.cjs'); const vk = Object.keys(d.STAGE_VERBS); const bk = Object.keys(d.STAGE_BG); console.log('STAGE_VERBS count:', vk.length, vk); console.log('STAGE_BG count:', bk.length, bk); const bad = ['set-init','discuss','wave-plan','execute']; for (const b of bad) { if (vk.includes(b) || bk.includes(b)) { console.error('FAIL: deprecated stage', b, 'still present'); process.exit(1); } } if (vk.length !== 10 || bk.length !== 10) { console.error('FAIL: expected 10 stages'); process.exit(1); } console.log('OK');"
```

**What NOT to do:**
- Do NOT remove `'plan-set'` -- it is actively used by `skills/plan-set/SKILL.md`
- Do NOT remove `'init'` -- it is actively used by `skills/init/SKILL.md`
- Do NOT remove any of the v3.0 stages (start-set, discuss-set, execute-set, new-version, add-set, quick)

---

### Task 5: Replace deprecated action strings in worktree.cjs deriveNextActions

**File:** `src/lib/worktree.cjs`

**Actions:**
1. In the `deriveNextActions` function (around line 782-824), replace the 3 deprecated action strings:
   - Line 792: Change `action: \`/set-init \${set.id}\`` to `action: \`/rapid:start-set \${set.id}\``
   - Line 798: Change `action: \`/discuss \${set.id}\`` to `action: \`/rapid:discuss-set \${set.id}\``
   - Line 806: Change `action: \`/execute \${set.id}\`` to `action: \`/rapid:execute-set \${set.id}\``
2. Update the description strings to match the new action names:
   - Line 794: Keep as-is or update to `Initialize the ${set.id} set for development` (already correct)
   - Line 800: Update to `Start planning discussion for ${set.id}` (already correct)
   - Line 808: Update to `Continue executing ${set.id}` (already correct)

**Verification:**
```bash
grep -n 'set-init\|/discuss \|/execute ' src/lib/worktree.cjs | grep -v '^\s*//' | grep -v 'discuss-set\|execute-set\|execute-prepare\|execute-verify' || echo "No deprecated action strings remain (OK)"
```

---

### Task 6: Update role-roadmapper.md command reference

**File:** `src/modules/roles/role-roadmapper.md`

**Actions:**
1. On line 160, change `/rapid:wave-plan` to `/rapid:plan-set`:
   - Before: `- Detailed planning happens later via /rapid:discuss and /rapid:wave-plan per wave`
   - After: `- Detailed planning happens later via /rapid:discuss-set and /rapid:plan-set per set`

**Verification:**
```bash
grep 'wave-plan' src/modules/roles/role-roadmapper.md && echo "FAIL" && exit 1 || echo "OK: no wave-plan references"
```

---

## Success Criteria

1. TOOL_REGISTRY has exactly 53 entries (down from 59)
2. No `set-init-*` or `wave-plan-*` keys exist in TOOL_REGISTRY
3. `plan-verifier` in ROLE_TOOL_MAP has exactly `['state-get', 'plan-load-set']`
4. `handleSetInit` function and its case branch are fully removed from rapid-tools.cjs
5. USAGE string has no `set-init` help lines
6. STAGE_VERBS and STAGE_BG each have exactly 10 entries (down from 14)
7. No deprecated stage keys (`set-init`, `discuss`, `wave-plan`, `execute`) remain in display maps
8. worktree.cjs suggests `/rapid:start-set`, `/rapid:discuss-set`, `/rapid:execute-set` instead of deprecated commands
9. role-roadmapper.md references `/rapid:plan-set` instead of `/rapid:wave-plan`
