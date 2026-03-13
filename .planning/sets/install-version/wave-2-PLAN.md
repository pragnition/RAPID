# Wave 2 PLAN: CLI Flag and Env Persistence

**Set:** install-version
**Wave:** 2 of 2
**Objective:** Wire `--version` into the CLI entry point, persist `RAPID_VERSION` in `.env` via `setup.sh`, and update `.env.example`.

## Tasks

### Task 1: Add `--version` flag to `src/bin/rapid-tools.cjs`

**File:** `src/bin/rapid-tools.cjs` (MODIFY)

**Actions:**
1. Add `--version, -V` to the USAGE string's Options section. Insert it after the existing `--help, -h` line (line 90). The new line should read: `  --version, -V          Show RAPID version`.
2. Add early-exit handling for `--version` and `-V` flags. Insert a new block immediately after the `--help` early-exit block (after line 119, before `const command = args[0]` at line 121). The block should:
   - Check `if (args[0] === '--version' || args[0] === '-V')`
   - Lazy-require `../lib/version.cjs` to call `getVersion()`
   - Print `RAPID v${version}\n` to stdout
   - Return (exit 0)

**Implementation details:**
- Use lazy `require('../lib/version.cjs')` inside the `if` block, not at the top of the file. This avoids loading the version module for every command invocation.
- The output format is `RAPID v3.0.0` followed by a newline. Use `process.stdout.write()` for consistency with how `USAGE` is printed.
- After printing, just `return;` -- the `main()` function is async so returning exits cleanly.

**What NOT to do:**
- Do not add `--version` handling inside the command dispatch switch -- it must be an early-exit before command parsing.
- Do not import `version.cjs` at the top of the file.
- Do not use `console.log` -- use `process.stdout.write` to match the existing `USAGE` output pattern.

**Verification:**
```bash
node src/bin/rapid-tools.cjs --version
node src/bin/rapid-tools.cjs -V
```
Expected: both print `RAPID v3.0.0` and exit with code 0.

```bash
node -e "const { execSync } = require('child_process'); const out = execSync('node src/bin/rapid-tools.cjs --version').toString(); console.log(out.startsWith('RAPID v'));"
```
Expected: `true`.

---

### Task 2: Add `RAPID_VERSION` to `setup.sh`

**File:** `setup.sh` (MODIFY)

**Actions:**
1. After the existing `RAPID_TOOLS_PATH` assignment (line 8), add a line to extract the version from `package.json`:
   ```bash
   RAPID_VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
   ```
   Note: The `node -e` command runs relative to `$SCRIPT_DIR`, so either `cd` first or use the full path. Since `setup.sh` uses `$SCRIPT_DIR` throughout, use:
   ```bash
   RAPID_VERSION=$(cd "$SCRIPT_DIR" && node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
   ```
2. Modify the `.env` heredoc (lines 92-95) to include `RAPID_VERSION`. The new heredoc should be:
   ```bash
   cat > "$SCRIPT_DIR/.env" << ENVEOF
   # RAPID plugin environment
   RAPID_TOOLS=$RAPID_TOOLS_PATH
   RAPID_VERSION=$RAPID_VERSION
   ENVEOF
   ```
3. Add `RAPID_VERSION` to the summary output at the end of the script. After the existing `echo "RAPID_TOOLS=$RAPID_TOOLS_PATH"` (line 119), add:
   ```bash
   echo "RAPID_VERSION=$RAPID_VERSION"
   ```

**What NOT to do:**
- Do not change the `.env` overwrite strategy -- the existing approach (full heredoc replacement) is intentional.
- Do not add version validation or blocking on version mismatch in `setup.sh` -- staleness detection belongs to the install skill.
- Do not remove or reorder existing steps.

**Verification:**
```bash
bash -n setup.sh  # syntax check
grep -q 'RAPID_VERSION' setup.sh && echo "PASS: RAPID_VERSION found in setup.sh"
```

---

### Task 3: Update `.env.example`

**File:** `.env.example` (MODIFY)

**Actions:**
1. Add a documented `RAPID_VERSION` entry. The updated file should read:
   ```
   # RAPID plugin environment
   # Set by setup.sh -- path to rapid-tools.cjs CLI
   RAPID_TOOLS=/path/to/your/rapid/src/bin/rapid-tools.cjs
   # Set by setup.sh -- installed RAPID version from package.json
   RAPID_VERSION=3.0.0
   ```

**What NOT to do:**
- Do not remove existing comments or the `RAPID_TOOLS` line.
- Do not use a placeholder like `<version>` -- use the current version `3.0.0` as the example value.

**Verification:**
```bash
grep -q 'RAPID_VERSION' .env.example && echo "PASS: RAPID_VERSION documented in .env.example"
```

---

## Success Criteria
- `node src/bin/rapid-tools.cjs --version` prints `RAPID v3.0.0` and exits 0.
- `node src/bin/rapid-tools.cjs -V` produces identical output.
- `--version` appears in the USAGE help text.
- `setup.sh` extracts version from `package.json` and writes `RAPID_VERSION=<semver>` into `.env`.
- `.env.example` documents the `RAPID_VERSION` variable with a comment explaining its source.
- `bash -n setup.sh` passes (no syntax errors).
- Behavioral contracts enforced: version always comes from `package.json` at runtime, `.env.example` documents `RAPID_VERSION`.

## Files Owned by This Wave
| File | Action |
|------|--------|
| `src/bin/rapid-tools.cjs` | MODIFY |
| `setup.sh` | MODIFY |
| `.env.example` | MODIFY |
