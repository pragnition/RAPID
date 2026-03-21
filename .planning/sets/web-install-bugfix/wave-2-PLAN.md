# Wave 2 PLAN: Integration and Setup

**Set:** web-install-bugfix
**Wave:** 2 of 2
**Objective:** Wire the Wave 1 fixes into the install pipeline. Add backend venv setup, frontend build, and service file generation steps to `setup.sh`. Verify the full install-to-serve flow.

**Prerequisite:** Wave 1 must be complete (TypeScript errors fixed, service file templated).

## Task 1: Expand setup.sh with Web Dashboard Steps

**File:** `setup.sh`

**Current state:** 5 steps (`[1/5]` through `[5/5]`). No web backend or frontend setup. Node.js is checked as a prerequisite but npm is not explicitly checked, and uv/Python are not mentioned.

**Implementation -- the final setup.sh will have 8 steps:**

1. `[1/8]` Check prerequisites (existing + add npm hard check + uv soft check)
2. `[2/8]` Install npm dependencies (existing, unchanged)
3. `[3/8]` Validate RAPID tools (existing, unchanged)
4. `[4/8]` Build agent files (existing, unchanged)
5. `[5/8]` Write .env and register plugin (existing, unchanged)
6. `[6/8]` Set up web backend venv (NEW)
7. `[7/8]` Build web frontend (NEW)
8. `[8/8]` Generate systemd service file (NEW)

### Step count update
Change ALL existing step labels from `N/5` to `N/8`. There are 5 occurrences to update:
- `[1/5]` -> `[1/8]`
- `[2/5]` -> `[2/8]`
- `[3/5]` -> `[3/8]`
- `[4/5]` -> `[4/8]`
- `[5/5]` -> `[5/8]`

### Add npm prerequisite check in Step 1
Insert after the git check block (after line 49 `echo "  OK: git ..."`):
```bash
if ! command -v npm &>/dev/null; then
    echo "  ERROR: npm is required for frontend build. Install from https://nodejs.org"
    exit 1
fi
echo "  OK: npm $(npm -v)"

if command -v uv &>/dev/null; then
    echo "  OK: uv $(uv --version | awk '{print $2}')"
else
    echo "  INFO: uv not found (optional, needed for web backend)"
    echo "  Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi
```

npm is a hard prerequisite (exits with error). uv is a soft check (info message, no exit).

### Add Step 6: Backend venv setup
Insert after line 115 (the closing `fi` of the plugin registration block) and before line 117 (the empty `echo ""`):
```bash

# Step 6: Set up web backend virtual environment
echo "[6/8] Setting up web backend..."
BACKEND_DIR="$SCRIPT_DIR/web/backend"
if [[ -d "$BACKEND_DIR" ]]; then
    if command -v uv &>/dev/null; then
        (cd "$BACKEND_DIR" && uv venv .venv && uv pip install -e . 2>&1) || {
            echo "  WARNING: Backend setup failed (non-fatal)"
            echo "  You can set up manually with: cd $BACKEND_DIR && uv venv .venv && uv pip install -e ."
        }
        echo "  OK: Backend venv created"
    else
        echo "  [skip] uv not found -- install uv, then run: cd $BACKEND_DIR && uv venv .venv && uv pip install -e ."
    fi
else
    echo "  [skip] Backend directory not found at $BACKEND_DIR"
fi
```

### Add Step 7: Frontend build
Insert immediately after Step 6:
```bash

# Step 7: Build web frontend
echo "[7/8] Building web frontend..."
FRONTEND_DIR="$SCRIPT_DIR/web/frontend"
if [[ -d "$FRONTEND_DIR" ]]; then
    (cd "$FRONTEND_DIR" && npm install && npm run build 2>&1) || {
        echo "  WARNING: Frontend build failed (non-fatal)"
        echo "  You can build manually with: cd $FRONTEND_DIR && npm install && npm run build"
    }
    echo "  OK: Frontend built"
else
    echo "  [skip] Frontend directory not found at $FRONTEND_DIR"
fi
```

### Add Step 8: Generate systemd service file
Insert immediately after Step 7:
```bash

# Step 8: Generate systemd service file
echo "[8/8] Generating systemd service file..."
SERVICE_TEMPLATE="$SCRIPT_DIR/web/backend/service/rapid-web.service"
SERVICE_OUTPUT="$SCRIPT_DIR/web/backend/service/rapid-web.generated.service"
if [[ -f "$SERVICE_TEMPLATE" ]]; then
    sed "s|__RAPID_ROOT__|$SCRIPT_DIR|g" "$SERVICE_TEMPLATE" > "$SERVICE_OUTPUT"
    echo "  OK: Service file generated at $SERVICE_OUTPUT"
    echo "  To install: cp $SERVICE_OUTPUT ~/.config/systemd/user/rapid-web.service"
    echo "  To enable:  systemctl --user enable --now rapid-web"
else
    echo "  [skip] Service template not found"
fi
```

### Insertion order summary
The three new steps go between the plugin registration `fi` (end of current Step 5) and the final `echo ""` / `=== Bootstrap Complete ===` banner. The order is: Step 6 (backend venv), Step 7 (frontend build), Step 8 (service file).

**What NOT to do:**
- Do not make uv a hard prerequisite -- RAPID core works without the web backend
- Do not make the frontend build or backend venv fatal errors -- use `WARNING` if they fail
- Do not auto-install or auto-enable the systemd service -- just generate the filled file and print instructions
- Do not activate the venv in the script -- the service file ExecStart path handles that
- Do not run Alembic migrations in setup.sh -- they run automatically on service startup
- Do not modify existing Step 1-5 logic beyond the step count label changes and the new prereq checks in Step 1
- Do not change the `SCRIPT_DIR` or `RAPID_TOOLS_PATH` definitions

**Verification:**
```bash
# Check step numbering is consistent
grep -c '\[.*\/8\]' setup.sh
# Should output: 8

# Check new steps exist
grep -c 'npm run build' setup.sh
# Should output: at least 1

grep -c 'rapid-web.generated.service' setup.sh
# Should output: at least 1

grep -c 'uv venv' setup.sh
# Should output: at least 1

# Verify script syntax
bash -n setup.sh && echo "Syntax OK"
```

---

## Task 2: End-to-End Verification

**Files:** None modified (verification only)

**Implementation:** Run the following checks to confirm all fixes work together:

1. **TypeScript compilation (Wave 1 validation):**
   ```bash
   cd web/frontend && npx tsc -b
   # Must produce zero errors
   ```

2. **Frontend build:**
   ```bash
   cd web/frontend && npm run build
   # Must succeed and produce dist/index.html and dist/assets/
   ls web/frontend/dist/index.html && ls web/frontend/dist/assets/ | head -3
   ```

3. **Service file template:**
   ```bash
   grep -c '__RAPID_ROOT__' web/backend/service/rapid-web.service
   # Must output: 2
   ```

4. **Service file generation (dry run):**
   ```bash
   SCRIPT_DIR=$(pwd)
   sed "s|__RAPID_ROOT__|$SCRIPT_DIR|g" web/backend/service/rapid-web.service | grep -E '(WorkingDirectory|ExecStart)'
   # Both lines should contain absolute paths, no __RAPID_ROOT__ remaining
   ```

5. **Alembic import:**
   ```bash
   cd web/backend && python -c "from app.database import run_migrations; print('import OK')"
   ```

6. **setup.sh syntax:**
   ```bash
   bash -n setup.sh && echo "Syntax OK"
   ```

**What NOT to do:**
- Do not actually start the backend service (requires database setup)
- Do not run the full `setup.sh` (would modify the development environment)

---

## Success Criteria

1. `setup.sh` has 8 numbered steps with consistent `[N/8]` labels
2. `bash -n setup.sh` passes (valid bash syntax)
3. `cd web/frontend && npm run build` succeeds (produces `dist/`)
4. `grep -c '__RAPID_ROOT__' web/backend/service/rapid-web.service` returns `2`
5. `cd web/backend && python -c "from app.database import run_migrations; print('OK')"` succeeds
6. `cd web/frontend && npx tsc -b` produces zero errors

## File Ownership (Wave 2)

| File | Action |
|------|--------|
| `setup.sh` | Modify (update step counts 5->8, add npm/uv prereq checks, add 3 new steps) |
