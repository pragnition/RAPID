#!/usr/bin/env bash
# RAPID Plugin Setup Script
# Non-interactive bootstrap: prereqs, deps, validate, env, register
set -euo pipefail

# Self-location (macOS compatible -- no readlink -f)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAPID_TOOLS_PATH="$SCRIPT_DIR/src/bin/rapid-tools.cjs"

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

detect_install_method() {
    if [[ "$SCRIPT_DIR" == *".claude/plugins"* ]]; then
        echo "marketplace"
    else
        echo "clone"
    fi
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

INSTALL_METHOD="$(detect_install_method)"
echo "=== RAPID Setup ==="
echo "Installation method: $INSTALL_METHOD"
echo ""

# Step 1: Check prerequisites
echo "[1/8] Checking prerequisites..."

if ! command -v node &>/dev/null; then
    echo "  ERROR: Node.js is required (v22+). Install from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 22 ]]; then
    echo "  ERROR: Node.js 22+ required, found $(node -v)"
    exit 1
fi
echo "  OK: Node.js $(node -v)"

if ! command -v git &>/dev/null; then
    echo "  ERROR: git is required. Install from https://git-scm.com"
    exit 1
fi
echo "  OK: git $(git --version | awk '{print $3}')"

if ! command -v npm &>/dev/null; then
    echo "  ERROR: npm is required for frontend build. Install from https://nodejs.org"
    exit 1
fi
echo "  OK: npm $(npm -v)"

if command -v uv &>/dev/null; then
    echo "  OK: uv $(uv --version | awk '{print $2}')"
else
    case "${RAPID_INSTALL_UV:-}" in
        auto)
            echo "  INFO: uv not found -- attempting auto-install via astral.sh installer"
            # Wrap curl|sh in an if so failure is caught (set -e would otherwise abort).
            if curl -LsSf https://astral.sh/uv/install.sh | sh; then
                # Astral installer drops uv in ~/.local/bin (current, since uv v0.5)
                # or ~/.cargo/bin (legacy). Add both defensively so the re-probe finds it.
                export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
                if command -v uv &>/dev/null; then
                    echo "  OK: uv $(uv --version | awk '{print $2}') installed"
                else
                    echo "  WARNING: uv installer ran but 'uv' not on PATH"
                    echo "  Restart your shell or add ~/.local/bin to PATH, then re-run setup."
                fi
            else
                echo "  WARNING: uv auto-install failed."
                echo "  Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
            fi
            ;;
        skip|*)
            echo "  INFO: uv not found (optional, needed for web backend)"
            echo "  Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
            ;;
    esac
fi

# Step 2: Install npm dependencies
echo "[2/8] Installing dependencies..."

if [[ -d "$SCRIPT_DIR/node_modules" ]]; then
    echo "  [skip] node_modules already exists"
else
    (cd "$SCRIPT_DIR" && npm install --production 2>&1) || {
        echo "  ERROR: npm install failed"
        exit 1
    }
    echo "  OK: Dependencies installed"
fi

# Step 3: Validate rapid-tools.cjs
echo "[3/8] Validating RAPID tools..."

if [[ ! -f "$RAPID_TOOLS_PATH" ]]; then
    echo "  ERROR: rapid-tools.cjs not found at $RAPID_TOOLS_PATH"
    exit 1
fi

if ! node "$RAPID_TOOLS_PATH" prereqs --json &>/dev/null; then
    echo "  ERROR: rapid-tools.cjs validation failed"
    exit 1
fi
echo "  OK: RAPID tools functional"

# Step 4: Build agent files
echo "[4/8] Building agent files..."
if node "$RAPID_TOOLS_PATH" build-agents 2>&1; then
    echo "  OK: Agent files generated"
else
    echo "  WARNING: Agent build failed (non-fatal -- agents may be pre-committed)"
fi

# Step 5: Write .env and register plugin
echo "[5/8] Writing .env and registering plugin..."

export RAPID_TOOLS="$RAPID_TOOLS_PATH"

# Always write .env file in plugin root
cat > "$SCRIPT_DIR/.env" << ENVEOF
# RAPID plugin environment
RAPID_TOOLS=$RAPID_TOOLS_PATH
ENVEOF
echo "  OK: Written to $SCRIPT_DIR/.env"

# Create .env.example
cat > "$SCRIPT_DIR/.env.example" << ENVEOF
# RAPID plugin environment
# Set by setup.sh -- path to rapid-tools.cjs CLI
RAPID_TOOLS=/path/to/your/rapid/src/bin/rapid-tools.cjs
ENVEOF

# Register Claude Code plugin
if command -v claude &>/dev/null; then
    (cd "$SCRIPT_DIR" && claude plugin add . 2>&1) || {
        echo "  WARNING: Plugin registration failed (non-fatal)"
        echo "  You can register manually with: claude plugin add $SCRIPT_DIR"
    }
    echo "  OK: Plugin registered"
else
    echo "  [skip] Claude Code CLI not found"
    echo "  Register manually later with: claude plugin add $SCRIPT_DIR"
fi

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
        if [[ "${RAPID_INSTALL_UV:-}" == "auto" ]]; then
            echo "  WARNING: uv still not available after auto-install attempt."
            echo "  Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
            echo "  Then run: cd $BACKEND_DIR && uv venv .venv && uv pip install -e ."
        else
            echo "  [skip] uv not found -- install uv, then run: cd $BACKEND_DIR && uv venv .venv && uv pip install -e ."
        fi
    fi
else
    echo "  [skip] Backend directory not found at $BACKEND_DIR"
fi

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

# Record install timestamp for update reminder (non-fatal -- guarded with || echo
# because set -euo pipefail is active and would otherwise abort the script).
node -e "require('$SCRIPT_DIR/src/lib/version.cjs').writeInstallTimestamp('$SCRIPT_DIR')" 2>/dev/null \
  || echo "  WARNING: Could not record install timestamp (non-fatal)"

echo ""
echo "=== Bootstrap Complete ==="
echo "RAPID_TOOLS=$RAPID_TOOLS_PATH"
echo ""
echo "Shell config will be handled by /rapid:install skill."
