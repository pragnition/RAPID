# Wave 2 PLAN: Skill Rewrites -- Init Integration & Unit-Test Unbounding

**Set:** unit-test-improvements
**Wave:** 2 of 2
**Objective:** Wire test framework detection into the init skill's research phase so `testFrameworks` is populated in config.json on project initialization. Remove the 5-concern-group cap from the unit-test skill, implement dynamic batching, and replace all hardcoded `node --test` references with config-based runner lookup.

**Depends on:** Wave 1 (detectTestFrameworks function and write-config --test-frameworks flag must exist).

## Owned Files

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Modify -- add test framework detection step |
| `skills/unit-test/SKILL.md` | Modify -- remove cap, add batching, use config runner |

## Task 1: Add test framework detection step to init skill

**File:** `skills/init/SKILL.md`

**Action:** Add a new step between Step 6 (Brownfield Detection) and Step 7 (Parallel Research Agents). This becomes **Step 6a: Test Framework Detection**. It runs after brownfield detection because it needs the project directory to exist and have source code.

Insert the following content after the Step 6 section (after line 553, before the `---` separator preceding Step 7):

### Step 6a content to insert:

```markdown
## Step 6a: Test Framework Detection

Detect the project's test framework(s) and store them in config.json. This enables framework-agnostic test execution in `/rapid:unit-test`.

```bash
# Run test framework detection
node -e "
  const { detectTestFrameworks } = require('${RAPID_TOOLS}/../lib/context.cjs');
  const result = detectTestFrameworks(process.cwd());
  console.log(JSON.stringify(result));
" > /tmp/rapid-test-frameworks.json
```

Read the detection result. If the array is non-empty, write it to config:

```bash
FRAMEWORKS=$(cat /tmp/rapid-test-frameworks.json)
node "${RAPID_TOOLS}" init write-config --name "{name}" --model {model} --team-size {N} --test-frameworks "${FRAMEWORKS}"
```

**Important:** The `write-config` command preserves manual overrides. If the user has already edited `testFrameworks` entries in config.json, those entries are kept and detection only fills in missing language entries.

Display the detected frameworks:

```
Test frameworks detected:
  - {lang}: {framework} ({runner})
```

If no frameworks were detected, display:

```
No test frameworks detected. Test runner will be selected autonomously per language during unit testing.
```

**On error:** Non-fatal. If detection fails, log a warning and continue. Unit-test skill falls back to autonomous framework selection per language.
```

**What NOT to do:**
- Do not renumber existing steps. Use "Step 6a" as an infix.
- Do not modify any other part of the init SKILL.md.
- Do not add test framework detection to the brownfield detection step itself -- keep it separate for clarity.

**Verification:** Read the modified file and confirm:
- Step 6a appears between Step 6 and Step 7
- The `detectTestFrameworks` import path references context.cjs correctly
- The `write-config` call includes `--test-frameworks`

## Task 2: Remove 5-concern-group cap from unit-test skill

**File:** `skills/unit-test/SKILL.md`

**Action:** In Step 3 (line 111), replace the hardcoded limit:

**Find (line 111):**
```
- Spawn one `rapid-unit-tester` agent per concern group (up to 5 concern groups maximum)
```

**Replace with:**
```
- Dispatch concern groups in batches. Batch size = `ceil(totalGroups / 3)` (always approximately 3 batches regardless of group count).
- For each batch:
  1. Spawn one `rapid-unit-tester` agent per concern group in the batch
  2. Collect results from all agents in the batch
  3. If all tests in the batch passed, auto-continue to the next batch
  4. If any test in the batch failed, use AskUserQuestion:
     - **question:** "Batch {N}/{totalBatches} has {failedCount} test failure(s). Continue to next batch or stop to review?"
     - **options:** ["Continue to next batch", "Stop and review failures"]
     - If "Stop": proceed to Step 5a retry flow with the failures so far
  5. After the final batch completes, merge all batch results and continue to Step 4
```

**What NOT to do:**
- Do not change the agent prompt template structure in Step 3
- Do not change the agent ID format
- Do not modify Step 4 (approval) or Step 6+ (writing results)

**Verification:** Search the modified file for "5 concern groups" -- should return zero matches. Search for "batch" -- should find the new batching logic.

## Task 3: Replace hardcoded node --test with config-based runner

**File:** `skills/unit-test/SKILL.md`

**Action:** Make four surgical replacements:

### 3a: Add config loading to Step 0

After the environment loading in Step 0 (after the "0a: Load environment" bash block, around line 17), add a new substep:

```markdown
### 0c: Load test runner config

```bash
# Load testFrameworks from config.json
CONFIG_PATH=".planning/config.json"
if [ -f "$CONFIG_PATH" ]; then
  TEST_FRAMEWORKS=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_PATH','utf-8')); console.log(JSON.stringify(c.testFrameworks || []))")
else
  TEST_FRAMEWORKS="[]"
fi
```

The skill uses `TEST_FRAMEWORKS` to select the appropriate runner for each file being tested. Runner selection logic:
1. Determine the file's language from its extension (.js/.cjs/.mjs/.ts/.tsx -> javascript/typescript, .py -> python, .go -> go, .rs -> rust)
2. Find the matching entry in `TEST_FRAMEWORKS` by `lang`
3. If found, use that entry's `runner` and `framework`
4. If not found (no config entry for this language), the agent autonomously picks the best test framework for that language
```

### 3b: Step 5 execution agent prompt (line 191)

**Find:**
```
1. Write test files using `node --test` framework (node:test + node:assert/strict)
2. Test file naming: `{originalFile}.test.cjs` in the same directory
3. Run tests with: node --test {testFile}
```

**Replace with:**
```
1. Write test files using the `{framework}` framework
2. Test file naming: `{originalFile}.test.{ext}` in the same directory (use the appropriate extension for the language: .cjs for JS, .test.py for Python, _test.go for Go, etc.)
3. Run tests with: {runner} {testFile}
```

Where `{framework}` and `{runner}` come from the TEST_FRAMEWORKS config for the file's language. If no config entry exists for the language, autonomously select the best framework.

### 3c: Step 5a fixer agent prompt (line 235)

**Find:**
```
4. Re-run each fixed test with: node --test {testFile}
```

**Replace with:**
```
4. Re-run each fixed test with: {runner} {testFile}
```

Where `{runner}` is the configured runner for the test file's language (same lookup as Step 5).

### 3d: Important Notes section (line 339)

**Find:**
```
- **Uses `node --test` framework.** All tests use Node.js built-in test runner (`node:test`) with `node:assert/strict`. No external test frameworks.
```

**Replace with:**
```
- **Framework-agnostic test runner.** The test framework is auto-detected during `/rapid:init` and stored in `.planning/config.json` under `testFrameworks`. Each language uses its configured runner (e.g., `node --test` for JS, `pytest` for Python, `cargo test` for Rust, `go test` for Go). If no configuration exists for a language, the agent autonomously selects the best framework for that language.
```

**What NOT to do:**
- Do not change the structured return format (`<!-- RAPID:RETURN ... -->`)
- Do not change Step 6 (REVIEW-UNIT.md writing) or Step 7 (issue logging)
- Do not change Step 4 (plan approval)
- Do not add framework installation logic -- assume frameworks are already available in the project

**Verification:** Search the modified file for the literal string `node --test` -- should return zero matches (all replaced with config-based references). The only occurrence should be in example output or if referencing it as a possible framework value.

## Success Criteria

- [ ] Init SKILL.md has Step 6a that runs `detectTestFrameworks` and writes results via `write-config --test-frameworks`
- [ ] Unit-test SKILL.md has no hardcoded "5 concern groups maximum" -- replaced with dynamic `ceil(totalGroups / 3)` batching
- [ ] Unit-test SKILL.md has no hardcoded `node --test` runner references -- all replaced with config-based `{runner}` lookup
- [ ] Batch approval gate: auto-continues on pass, prompts user on failure
- [ ] Config loading added to Step 0 of unit-test skill
- [ ] Backward compatible: JS projects with no test framework config default to node:test through the autonomous fallback
- [ ] Both SKILL.md files parse correctly as Markdown (no broken formatting)
