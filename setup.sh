#!/usr/bin/env bash
# RAPID Plugin Setup Script
# Non-interactive bootstrap: prereqs, deps, validate, env, register
set -euo pipefail

# Self-location (macOS compatible -- no readlink -f)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAPID_TOOLS_PATH="$SCRIPT_DIR/src/bin/rapid-tools.cjs"
RAPID_VERSION=$(cd "$SCRIPT_DIR" && node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")

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
echo "[1/5] Checking prerequisites..."

if ! command -v node &>/dev/null; then
    echo "  ERROR: Node.js is required (v18+). Install from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
    echo "  ERROR: Node.js 18+ required, found $(node -v)"
    exit 1
fi
echo "  OK: Node.js $(node -v)"

if ! command -v git &>/dev/null; then
    echo "  ERROR: git is required. Install from https://git-scm.com"
    exit 1
fi
echo "  OK: git $(git --version | awk '{print $3}')"

# Step 2: Install npm dependencies
echo "[2/5] Installing dependencies..."

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
echo "[3/5] Validating RAPID tools..."

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
echo "[4/5] Building agent files..."
if node "$RAPID_TOOLS_PATH" build-agents 2>&1; then
    echo "  OK: Agent files generated"
else
    echo "  WARNING: Agent build failed (non-fatal -- agents may be pre-committed)"
fi

# Step 5: Write .env and register plugin
echo "[5/5] Writing .env and registering plugin..."

export RAPID_TOOLS="$RAPID_TOOLS_PATH"

# Always write .env file in plugin root
cat > "$SCRIPT_DIR/.env" << ENVEOF
# RAPID plugin environment
RAPID_TOOLS=$RAPID_TOOLS_PATH
RAPID_VERSION=$RAPID_VERSION
ENVEOF
echo "  OK: Written to $SCRIPT_DIR/.env"

# Create .env.example
cat > "$SCRIPT_DIR/.env.example" << ENVEOF
# RAPID plugin environment
# Set by setup.sh -- path to rapid-tools.cjs CLI
RAPID_TOOLS=/path/to/your/rapid/src/bin/rapid-tools.cjs
# Set by setup.sh -- installed RAPID version from package.json
RAPID_VERSION=3.0.0
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

echo ""
echo "=== Bootstrap Complete ==="
echo "RAPID_TOOLS=$RAPID_TOOLS_PATH"
echo "RAPID_VERSION=$RAPID_VERSION"
echo ""
echo "Shell config will be handled by /rapid:install skill."
