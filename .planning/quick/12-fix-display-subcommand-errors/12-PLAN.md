# Quick Task 12: Fix Display Subcommand Gaps

## Objective

The `display footer` subcommand handler exists in `src/commands/display.cjs` (lines 20-35) and works correctly at runtime. However, it is missing from three surfaces that cause confusion and incomplete coverage:

1. **USAGE text** in `src/bin/rapid-tools.cjs` -- only `display banner` is listed (line 122); `display footer` is absent
2. **TOOL_REGISTRY** in `src/lib/tool-docs.cjs` -- only `display-banner` is registered (line 99); `display-footer` is absent
3. **Unit tests** in `src/commands/display.test.cjs` -- no tests for the `footer` case via `handleDisplay`
4. **Contract tests** in `src/bin/contract.test.cjs` -- no contract test for `display footer` output shape

The `display breadcrumb` error referenced in the task description does not correspond to a real standalone subcommand -- breadcrumbs are provided via the `--breadcrumb` flag on `display footer`. No skill in the codebase invokes `display breadcrumb` as a standalone command. This plan focuses on the real gaps: documentation, discoverability, and test coverage for `display footer`.

Note: `ROLE_TOOL_MAP` in `tool-docs.cjs` does not assign `display-banner` to any role (display commands are invoked directly by skills, not injected via role-based tool docs), so no ROLE_TOOL_MAP changes are needed.

---

## Task 1: Add `display footer` to USAGE text and TOOL_REGISTRY

**Files to modify:**
- `src/bin/rapid-tools.cjs`
- `src/lib/tool-docs.cjs`

**Actions:**

1. In `src/bin/rapid-tools.cjs`, after the existing line 122 (`display banner <stage> [target]  Display branded RAPID stage banner`), add:
   ```
     display footer <next-cmd> [--breadcrumb "<text>"] [--no-clear]  Display next-step footer box
   ```

2. In `src/lib/tool-docs.cjs`, after the existing `display-banner` entry (line 99), add a new entry:
   ```js
   'display-footer': 'display footer <next-command:str> [--breadcrumb <text:str>] [--no-clear] -- Show next-step footer box',
   ```

**What NOT to do:**
- Do not add a `display-breadcrumb` entry. Breadcrumb is a flag on `footer`, not a standalone subcommand.
- Do not modify `src/commands/display.cjs` -- the handler already works correctly.
- Do not modify `src/lib/display.cjs` -- the rendering function is already correct and tested.

**Verification:**
```bash
node src/bin/rapid-tools.cjs --help 2>&1 | grep -c "display footer"
# Expected: 1

node -e "const t = require('./src/lib/tool-docs.cjs'); console.log(Object.keys(t.TOOL_REGISTRY).filter(k => k.startsWith('display-')))"
# Expected: [ 'display-banner', 'display-footer' ]
```

**Done criteria:** `display footer` appears in both the CLI USAGE help text and the TOOL_REGISTRY object.

---

## Task 2: Add unit and contract tests for `display footer` via CLI

**Files to modify:**
- `src/commands/display.test.cjs`
- `src/bin/contract.test.cjs`

**Actions:**

1. In `src/commands/display.test.cjs`, add a new `describe('handleDisplay -- footer subcommand', ...)` block after the existing banner tests (after the closing `});` of the banner describe block at line 84). Use the existing `captureStdout` helper. Add these tests:

   - **basic footer output**: `handleDisplay('footer', ['/rapid:plan-set 1'])` writes output containing "Next: /rapid:plan-set 1" and "Run /clear before continuing"
   - **footer with breadcrumb**: `handleDisplay('footer', ['/rapid:plan-set 1', '--breadcrumb', 'init [done] > start-set'])` writes output containing the breadcrumb text
   - **footer with --no-clear**: `handleDisplay('footer', ['/rapid:plan-set 1', '--no-clear'])` writes output NOT containing "Run /clear"
   - **missing next-command throws CliError**: `handleDisplay('footer', [])` throws `CliError` with message containing "Usage"

2. In `src/bin/contract.test.cjs`, in the `describe('display command output shapes', ...)` block (around line 443), add a new `it` after the existing banner test:

   ```js
   it('display footer returns raw text (NOT JSON)', () => {
     const stdout = runCli('display footer "/rapid:test-cmd"', { cwd: projectDir });
     assert.ok(typeof stdout === 'string', 'should return a string');
     assert.ok(stdout.length > 0, 'should not be empty');
     let isJson = false;
     try { JSON.parse(stdout.trim()); isJson = true; } catch { /* Expected */ }
     assert.ok(!isJson, 'footer output should NOT be valid JSON');
   });
   ```

**What NOT to do:**
- Do not duplicate the `renderFooter` unit tests already in `tests/display.test.cjs` -- those test the rendering function directly. These new tests verify the CLI dispatch layer (`handleDisplay`) routes to `renderFooter` correctly and produces output on stdout.
- Do not add tests for `display breadcrumb` -- it is not a subcommand.

**Verification:**
```bash
node --test src/commands/display.test.cjs 2>&1 | tail -10
# Expected: all tests pass, including new footer tests

node --test src/bin/contract.test.cjs 2>&1 | grep -A2 "display footer"
# Expected: test passes
```

**Done criteria:** All new tests pass. `node --test src/commands/display.test.cjs` and `node --test src/bin/contract.test.cjs` exit 0 with no failures.

---

## Summary

| Task | Files | Action |
|------|-------|--------|
| 1 | `src/bin/rapid-tools.cjs`, `src/lib/tool-docs.cjs` | Add `display footer` to USAGE and TOOL_REGISTRY |
| 2 | `src/commands/display.test.cjs`, `src/bin/contract.test.cjs` | Add unit + contract tests for footer dispatch |

**Total files modified:** 4
**Estimated effort:** Small (each task is 5-15 lines of changes)
