# PLAN: agent-prompts / Wave 1

## Objective

Fix all source-of-truth files that feed into the agent build pipeline: remove the phantom `plan-check-gate` command from TOOL_REGISTRY, update stale hand-written agent `<tools>` sections to match ROLE_TOOL_MAP, fix discuss-set SKILL.md to enforce exactly 4 gray areas, and add regression tests that prevent future drift.

## Tasks

### Task 1: Remove `plan-check-gate` from TOOL_REGISTRY

**File:** `src/lib/tool-docs.cjs`

**Action:** Delete line 29 (`'plan-check-gate': 'plan check-gate <wave:str> -- Check planning gate for wave',`) from the `TOOL_REGISTRY` object.

**Why:** `plan-check-gate` has no implementation in `src/commands/plan.cjs` (no `case 'check-gate'` block) and is not listed in the USAGE string in `rapid-tools.cjs`. It is a phantom entry that could cause agents to hallucinate a nonexistent command.

**Also update:** `src/commands/plan.cjs` line 57 -- the error message string references `check-gate` in its list of valid subcommands. Remove `check-gate` from that error message.

**Verification:**
```bash
node -e "const {TOOL_REGISTRY} = require('./src/lib/tool-docs.cjs'); if ('plan-check-gate' in TOOL_REGISTRY) { process.exit(1); } console.log('OK: plan-check-gate removed');"
grep -c 'check-gate' src/lib/tool-docs.cjs && echo 'FAIL: check-gate still present' || echo 'OK: no check-gate references'
grep -c 'check-gate' src/commands/plan.cjs && echo 'FAIL: check-gate in plan.cjs error msg' || echo 'OK: plan.cjs clean'
```

---

### Task 2: Update hand-written executor agent `<tools>` section

**File:** `agents/rapid-executor.md`

**Action:** Replace the current `<tools>` section (lines 101-106) which has only 3 commands:
```
<tools>
# rapid-tools.cjs commands
  state-get: state get <entity:milestone|set> <id:str> -- Read entity
  state-transition-set: state transition set <milestoneId:str> <setId:str> <status:str> -- Transition set status
  verify-light: verify-artifacts <files:str...> -- Verify files exist
</tools>
```

With the full ROLE_TOOL_MAP['executor'] set (7 commands):
```
<tools>
# rapid-tools.cjs commands
  state-get: state get <entity:milestone|set> <id:str> -- Read entity
  state-transition-set: state transition set <milestoneId:str> <setId:str> <status:str> -- Transition set status
  verify-light: verify-artifacts <files:str...> -- Verify files exist
  memory-log-decision: memory log-decision --category <c:str> --decision <d:str> --rationale <r:str> --source <s:str> -- Log decision
  memory-log-correction: memory log-correction --original <o:str> --correction <c:str> --reason <r:str> -- Log correction
  hooks-run: hooks run [--dry-run] -- Run post-task verification hooks
  hooks-list: hooks list -- List verification checks and status
</tools>
```

**Why:** ROLE_TOOL_MAP specifies 7 commands for executor but the hand-written agent only has 3. The missing 4 commands (memory-log-decision, memory-log-correction, hooks-run, hooks-list) are tools the executor should know about.

**Verification:**
```bash
node -e "
const {ROLE_TOOL_MAP, TOOL_REGISTRY} = require('./src/lib/tool-docs.cjs');
const fs = require('fs');
const content = fs.readFileSync('agents/rapid-executor.md', 'utf-8');
const match = content.match(/<tools>([\s\S]*?)<\/tools>/);
if (!match) { console.error('No <tools> section'); process.exit(1); }
const keys = ROLE_TOOL_MAP['executor'];
for (const k of keys) {
  if (!match[1].includes(k + ':')) { console.error('Missing: ' + k); process.exit(1); }
}
console.log('OK: executor has all ' + keys.length + ' commands');
"
```

---

### Task 3: Update hand-written planner agent `<tools>` section

**File:** `agents/rapid-planner.md`

**Action:** Replace the current `<tools>` section (lines 101-112) which has 9 commands with the full ROLE_TOOL_MAP['planner'] set (11 commands). The missing commands are `memory-query` and `memory-context`. Add them after the existing entries:
```
  memory-query: memory query [--category <c:str>] [--type <t:str>] [--limit <n:int>] -- Query memory
  memory-context: memory context <set:str> [--budget <n:int>] -- Build memory context
```

**Why:** ROLE_TOOL_MAP specifies 11 commands for planner but the hand-written agent only has 9.

**Verification:**
```bash
node -e "
const {ROLE_TOOL_MAP, TOOL_REGISTRY} = require('./src/lib/tool-docs.cjs');
const fs = require('fs');
const content = fs.readFileSync('agents/rapid-planner.md', 'utf-8');
const match = content.match(/<tools>([\s\S]*?)<\/tools>/);
if (!match) { console.error('No <tools> section'); process.exit(1); }
const keys = ROLE_TOOL_MAP['planner'];
for (const k of keys) {
  if (!match[1].includes(k + ':')) { console.error('Missing: ' + k); process.exit(1); }
}
console.log('OK: planner has all ' + keys.length + ' commands');
"
```

---

### Task 4: Fix discuss-set SKILL.md -- enforce exactly 4 gray areas

**File:** `skills/discuss-set/SKILL.md`

**Three edits required:**

**(a) Remove option 5 from Step 5 template (line 170-171):**

Delete:
```
5. "{Gray area 5 title}" -- "{1-sentence description}"
```

The template should list exactly 4 numbered options (1-4), matching AskUserQuestion's 4-option constraint.

**(b) Update Key Principles (line 328):**

Change:
```
- **2-5 gray areas, more is better than less:** Identify 2-5 gray areas. The goal is to capture the user's FULL vision. It is better to ask more than ask less.
```
To:
```
- **Exactly 4 gray areas:** Always identify exactly 4 gray areas. This matches AskUserQuestion's 4-option constraint and ensures consistent coverage.
```

**(c) Update Anti-Patterns (line 345):**

Change:
```
- Do NOT ask about less than 2 gray areas.
```
To:
```
- Do NOT ask about fewer or more than 4 gray areas -- always present exactly 4.
```

**Verification:**
```bash
# Check no 5th option in template
grep -n 'Gray area 5' skills/discuss-set/SKILL.md && echo 'FAIL: option 5 still present' || echo 'OK: no 5th option'
# Check Key Principles says "exactly 4"
grep -c 'Exactly 4 gray areas' skills/discuss-set/SKILL.md | grep -q '1' && echo 'OK: key principle updated' || echo 'FAIL: key principle not updated'
# Check anti-pattern updated
grep -c 'fewer or more than 4' skills/discuss-set/SKILL.md | grep -q '1' && echo 'OK: anti-pattern updated' || echo 'FAIL: anti-pattern not updated'
```

---

### Task 5: Add TOOL_REGISTRY drift test

**File:** `src/lib/tool-docs.test.cjs`

**Action:** Add a new `describe('TOOL_REGISTRY CLI drift guard')` block after the existing `phantom command guard` section. This test verifies the **forward direction**: every key in TOOL_REGISTRY maps to a real CLI subcommand in rapid-tools.cjs USAGE.

The test should:
1. Read `src/bin/rapid-tools.cjs`, extract the USAGE string (everything between `` const USAGE = ` `` and the closing `` `; ``)
2. For each key in TOOL_REGISTRY, derive the CLI subcommand from the value string (the part before ` -- `)
3. Normalize it to match USAGE format (e.g., `state get`, `plan create-set`, `merge detect`)
4. Assert the subcommand appears somewhere in the USAGE string
5. Known exceptions: none after removing `plan-check-gate` in Task 1

**Implementation sketch:**
```javascript
describe('TOOL_REGISTRY CLI drift guard', () => {
  it('every TOOL_REGISTRY entry maps to a real CLI subcommand in USAGE', () => {
    const rapidToolsSrc = fs.readFileSync(
      path.join(__dirname, '..', 'bin', 'rapid-tools.cjs'), 'utf-8'
    );
    // Extract USAGE block
    const usageMatch = rapidToolsSrc.match(/const USAGE = `([\s\S]*?)`;/);
    assert.ok(usageMatch, 'Could not extract USAGE from rapid-tools.cjs');
    const usage = usageMatch[1];

    for (const [key, doc] of Object.entries(TOOL_REGISTRY)) {
      // Extract the command portion (before " -- ")
      const cmdPart = doc.split(' -- ')[0].trim();
      // Get the base subcommand (first 2 words, e.g. "state get" or "plan create-set")
      const words = cmdPart.split(/\s+/);
      const subcommand = words.slice(0, 2).join(' ');
      assert.ok(
        usage.includes(subcommand),
        `TOOL_REGISTRY["${key}"] references subcommand "${subcommand}" not found in USAGE`
      );
    }
  });
});
```

**Do NOT include** a reverse-direction test (USAGE -> TOOL_REGISTRY). Many USAGE commands are intentionally not in TOOL_REGISTRY (admin, migration, etc.).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/tool-docs.test.cjs 2>&1 | tail -5
```

---

### Task 6: Add hand-written agent guard test

**File:** `src/lib/tool-docs.test.cjs`

**Action:** Add a `describe('hand-written agent guard')` block that verifies:

1. The `SKIP_GENERATION` array in `build-agents.cjs` contains exactly `['planner', 'executor', 'merger', 'reviewer']`
2. Each of those 4 agent files (`agents/rapid-{role}.md`) exists
3. None of those 4 files start with the `<!-- GENERATED by build-agents` comment (confirming they are not generated)
4. Each of those 4 files has a `<tools>` section whose keys match ROLE_TOOL_MAP for that role

**Implementation sketch:**
```javascript
describe('hand-written agent guard', () => {
  const EXPECTED_SKIP = ['planner', 'executor', 'merger', 'reviewer'];

  it('build-agents.cjs SKIP_GENERATION matches expected list', () => {
    const buildSrc = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'build-agents.cjs'), 'utf-8'
    );
    const match = buildSrc.match(/SKIP_GENERATION\s*=\s*\[([^\]]+)\]/);
    assert.ok(match, 'Could not find SKIP_GENERATION in build-agents.cjs');
    const roles = match[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
    assert.deepStrictEqual(roles.sort(), EXPECTED_SKIP.sort());
  });

  it('hand-written agents exist and are not generated', () => {
    for (const role of EXPECTED_SKIP) {
      const filePath = path.join(__dirname, '..', '..', 'agents', `rapid-${role}.md`);
      assert.ok(fs.existsSync(filePath), `Missing hand-written agent: rapid-${role}.md`);
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(
        !content.startsWith('<!-- GENERATED by build-agents'),
        `rapid-${role}.md starts with GENERATED comment -- should be hand-written`
      );
    }
  });

  it('hand-written agents have <tools> matching ROLE_TOOL_MAP', () => {
    for (const role of EXPECTED_SKIP) {
      const keys = ROLE_TOOL_MAP[role];
      if (!keys) continue; // Skip if role has no CLI commands
      const filePath = path.join(__dirname, '..', '..', 'agents', `rapid-${role}.md`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const toolsMatch = content.match(/<tools>([\s\S]*?)<\/tools>/);
      assert.ok(toolsMatch, `rapid-${role}.md missing <tools> section`);
      for (const key of keys) {
        assert.ok(
          toolsMatch[1].includes(key + ':'),
          `rapid-${role}.md <tools> missing key "${key}" from ROLE_TOOL_MAP`
        );
      }
    }
  });
});
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/tool-docs.test.cjs 2>&1 | tail -10
```

---

## File Ownership

| File | Action |
|------|--------|
| `src/lib/tool-docs.cjs` | Modify (remove plan-check-gate) |
| `src/commands/plan.cjs` | Modify (remove check-gate from error message) |
| `agents/rapid-executor.md` | Modify (update tools section) |
| `agents/rapid-planner.md` | Modify (update tools section) |
| `skills/discuss-set/SKILL.md` | Modify (3 edits for 4-option enforcement) |
| `src/lib/tool-docs.test.cjs` | Modify (add drift test + guard test) |

## Success Criteria

1. `plan-check-gate` no longer exists in TOOL_REGISTRY or plan.cjs error message
2. Executor agent has all 7 ROLE_TOOL_MAP commands in its `<tools>` section
3. Planner agent has all 11 ROLE_TOOL_MAP commands in its `<tools>` section
4. discuss-set SKILL.md Step 5 lists exactly 4 options (no 5th)
5. discuss-set Key Principles says "Exactly 4 gray areas"
6. discuss-set Anti-Patterns says "fewer or more than 4"
7. `node --test src/lib/tool-docs.test.cjs` passes with all new tests green
8. No existing tests broken
