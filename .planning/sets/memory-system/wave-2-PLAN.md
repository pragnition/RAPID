# Wave 2: CLI Wiring and Agent Prompt Integration

## Objective

Wire the memory module into the RAPID CLI and agent prompt pipeline. This wave creates the `memory` command handler, registers it in the CLI router, integrates `buildMemoryContext()` into `assembleExecutorPrompt()` for plan and execute phases, and updates the tool registry for role-based tool docs.

## Dependencies

- Wave 1 must be complete (`src/lib/memory.cjs` exists and all tests pass)

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/commands/memory.cjs` | Create | CLI command handler for memory subcommands |
| `src/bin/rapid-tools.cjs` | Modify | Register `memory` command in CLI router and USAGE |
| `src/lib/execute.cjs` | Modify | Inject memory context into plan/execute prompts |
| `src/lib/tool-docs.cjs` | Modify | Add memory commands to TOOL_REGISTRY and ROLE_TOOL_MAP |

## Task 1: Create `src/commands/memory.cjs`

**File:** `src/commands/memory.cjs`

**Implementation:**

1. Add `'use strict'` header. Import `{ CliError }` from `../lib/errors.cjs` and `{ parseArgs }` from `../lib/args.cjs`.

2. Implement `async function handleMemory(cwd, subcommand, args)` with a switch on `subcommand`:

3. **Case `'log-decision'`**:
   - Parse args with schema: `{ category: 'string', decision: 'string', rationale: 'string', source: 'string', milestone: 'string', 'set-id': 'string', topic: 'string' }`
   - All of `category`, `decision`, `rationale`, `source` are required -- throw `CliError` with usage string if missing
   - Require `../lib/memory.cjs` (lazy require inside the case)
   - Call `memory.appendDecision(cwd, { category: flags.category, decision: flags.decision, rationale: flags.rationale, source: flags.source, milestone: flags.milestone, setId: flags['set-id'], topic: flags.topic })`
   - Output the returned record as JSON to stdout: `process.stdout.write(JSON.stringify(record) + '\n')`

4. **Case `'log-correction'`**:
   - Parse args with schema: `{ original: 'string', correction: 'string', reason: 'string', 'affected-sets': 'string', 'set-id': 'string', milestone: 'string' }`
   - Required: `original`, `correction`, `reason` -- throw `CliError` if missing
   - If `flags['affected-sets']` is provided, split by comma: `flags['affected-sets'].split(',').map(s => s.trim())`
   - Call `memory.appendCorrection(cwd, { ... })`
   - Output returned record as JSON

5. **Case `'query'`**:
   - Parse args with schema: `{ category: 'string', milestone: 'string', 'set-id': 'string', limit: 'string', type: 'string' }`
   - Default `type` to `'decisions'` if not provided
   - If `type === 'corrections'`: call `memory.queryCorrections(cwd, { affectedSet: flags['set-id'], limit: flags.limit ? parseInt(flags.limit, 10) : undefined })`
   - Else: call `memory.queryDecisions(cwd, { category: flags.category, milestone: flags.milestone, setId: flags['set-id'], limit: flags.limit ? parseInt(flags.limit, 10) : undefined })`
   - Output result array as JSON

6. **Case `'context'`**:
   - Parse args with schema: `{ 'set-name': 'string', budget: 'string' }`
   - `setName` = `flags['set-name']` or `positional[0]` -- throw CliError if missing
   - `budget` = `flags.budget ? parseInt(flags.budget, 10) : undefined`
   - Call `memory.buildMemoryContext(cwd, setName, budget)`
   - Output as JSON: `{ setName, tokenBudget: budget || 8000, context: result }`

7. **Default case**: throw `CliError` with usage listing all subcommands

8. Export: `module.exports = { handleMemory };`

**Verification:**
```bash
node -e "const { handleMemory } = require('./src/commands/memory.cjs'); console.log(typeof handleMemory)"
```
Expected: `function`

**Commit:** `feat(memory-system): add CLI command handler for memory operations`

---

## Task 2: Register `memory` command in `src/bin/rapid-tools.cjs`

**File:** `src/bin/rapid-tools.cjs`

**Implementation:**

1. Add import at the top with the other requires (insert alphabetically near `handleMerge`):
   ```js
   const { handleMemory } = require('../commands/memory.cjs');
   ```

2. Add to the USAGE string, after the `merge` section and before the `resolve` section:
   ```
     memory log-decision --category <c> --decision <d> --rationale <r> --source <s>  Log a decision
                         [--milestone <m>] [--set-id <id>] [--topic <t>]
     memory log-correction --original <o> --correction <c> --reason <r>  Log a correction
                           [--affected-sets <s1,s2>] [--set-id <id>]
     memory query [--category <c>] [--type decisions|corrections]  Query memory logs
                  [--set-id <id>] [--milestone <m>] [--limit <n>]
     memory context <set-name> [--budget <n>]  Build token-budgeted memory context
   ```

3. Add case to the switch statement inside `main()`, after the `merge` case and before `set-init`:
   ```js
   case 'memory':
     await handleMemory(cwd, subcommand, args.slice(2));
     break;
   ```

**What NOT to do:**
- Do not modify any existing switch cases
- Do not change the function signatures
- Do not reorder existing imports

**Verification:**
```bash
node src/bin/rapid-tools.cjs --help | grep -c memory
```
Expected: at least 4 (one per memory subcommand in USAGE)

**Commit:** `feat(memory-system): register memory command in CLI router`

---

## Task 3: Integrate memory context into `assembleExecutorPrompt()` in `src/lib/execute.cjs`

**File:** `src/lib/execute.cjs`

**Implementation:**

1. Inside `assembleExecutorPrompt()`, after the `ctx` is prepared (line ~136 `const ctx = prepareSetContext(cwd, setName);`) and before the switch statement, add memory context loading:

   ```js
   // Load memory context for plan and execute phases
   let memoryContext = '';
   if (phase === 'plan' || phase === 'execute') {
     try {
       const memory = require('./memory.cjs');
       memoryContext = memory.buildMemoryContext(cwd, setName);
     } catch {
       // Graceful -- skip memory if module not available or errors
     }
   }
   ```

2. In the `case 'plan':` section, insert the memory context between the "Discussion Decisions" section and the "Instructions" section. Add it only if `memoryContext` is non-empty:

   After the line `priorContext || 'No prior discussion -- proceed with contract and definition as given.',`:
   ```js
   ...(memoryContext ? ['', memoryContext] : []),
   ```

3. In the `case 'execute':` section, insert memory context after the compacted wave context block and before the "Implementation Plan" section. Add it only if non-empty:

   After the prior wave context try/catch block (after line ~212) and before `parts.push('');` / `parts.push('## Implementation Plan')`:
   ```js
   if (memoryContext) {
     parts.push('');
     parts.push(memoryContext);
   }
   ```

**What NOT to do:**
- Do not inject memory context into the `'discuss'` phase -- discussion should be unbiased
- Do not change any existing function signatures
- Do not modify `prepareSetContext()` -- memory injection happens in `assembleExecutorPrompt()` only
- Do not add memory to the module.exports

**Verification:**
```bash
node -e "
  const e = require('./src/lib/execute.cjs');
  // Verify the function still works (will throw if broken)
  console.log(typeof e.assembleExecutorPrompt);
"
```
Expected: `function`

**Commit:** `feat(memory-system): inject memory context into plan and execute prompts`

---

## Task 4: Update TOOL_REGISTRY and ROLE_TOOL_MAP in `src/lib/tool-docs.cjs`

**File:** `src/lib/tool-docs.cjs`

**Implementation:**

1. Add memory commands to `TOOL_REGISTRY` (insert alphabetically, after the `merge` entries and before `plan`):
   ```js
   // Memory
   'memory-log-decision':  'memory log-decision --category <c:str> --decision <d:str> --rationale <r:str> --source <s:str> -- Log decision',
   'memory-log-correction': 'memory log-correction --original <o:str> --correction <c:str> --reason <r:str> -- Log correction',
   'memory-query':         'memory query [--category <c:str>] [--type <t:str>] [--limit <n:int>] -- Query memory',
   'memory-context':       'memory context <set:str> [--budget <n:int>] -- Build memory context',
   ```

2. Add memory tools to `ROLE_TOOL_MAP` for relevant roles:
   - Add `'memory-log-decision'`, `'memory-log-correction'` to the `'executor'` role array
   - Add `'memory-query'`, `'memory-context'` to the `'planner'` role array
   - Add `'memory-log-decision'` to the `'set-planner'` role array (planners may log architectural decisions)

**What NOT to do:**
- Do not modify `estimateTokens()` or `getToolDocsForRole()`
- Do not remove any existing entries
- Do not change the structure of the objects

**Verification:**
```bash
node -e "
  const td = require('./src/lib/tool-docs.cjs');
  console.log(td.TOOL_REGISTRY['memory-log-decision'] ? 'OK' : 'MISSING');
  console.log(td.ROLE_TOOL_MAP['executor'].includes('memory-log-decision') ? 'OK' : 'MISSING');
  console.log(td.ROLE_TOOL_MAP['planner'].includes('memory-query') ? 'OK' : 'MISSING');
"
```
Expected: `OK` three times

**Commit:** `feat(memory-system): add memory commands to tool registry and role map`

---

## Success Criteria

1. `node src/bin/rapid-tools.cjs --help` includes memory command documentation
2. `node src/bin/rapid-tools.cjs memory query --type decisions` runs without error (returns `[]` on fresh project)
3. Memory context appears in `assembleExecutorPrompt()` output for `plan` and `execute` phases when decisions exist
4. Memory context does NOT appear in `discuss` phase prompts
5. `node --test src/lib/memory.test.cjs` still passes (wave 1 tests unbroken)
6. Existing tests (`node --test src/lib/tool-docs.test.cjs`, `node --test src/lib/execute.test.cjs`) still pass
7. No new npm dependencies added
