#!/usr/bin/env bash
# RAPID Plugin Setup Script
# Bootstrap RAPID_TOOLS, install dependencies, and register plugin
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

# Step 4: Persist RAPID_TOOLS env var
echo "[4/5] Setting RAPID_TOOLS environment variable..."

export RAPID_TOOLS="$RAPID_TOOLS_PATH"

# Check if already configured in any common shell config
ALREADY_CONFIGURED=""
for check_file in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.config/fish/config.fish" "$HOME/.profile" "$HOME/.rapid-env"; do
    if grep -qF "RAPID_TOOLS" "$check_file" 2>/dev/null; then
        ALREADY_CONFIGURED="$check_file"
        break
    fi
done

if [[ -n "$ALREADY_CONFIGURED" ]]; then
    echo "  RAPID_TOOLS already configured in $ALREADY_CONFIGURED, skipping."
else
    echo ""
    echo "  How would you like to persist the RAPID_TOOLS env var?"
    echo "    1) Append to shell config file (recommended)"
    echo "    2) Create a dedicated env file (~/.rapid-env)"
    echo ""
    printf "  Choose [1/2] (default: 1): "
    read -r choice

    # Default to option 1 if empty or invalid
    if [[ "$choice" != "1" && "$choice" != "2" ]]; then
        choice="1"
    fi

    if [[ "$choice" == "1" ]]; then
        # Option 1: Shell config file
        SHELL_NAME="$(basename "${SHELL:-/bin/bash}")"
        case "$SHELL_NAME" in
            fish)
                CONFIG_FILE="$HOME/.config/fish/config.fish"
                EXPORT_LINE="set -gx RAPID_TOOLS \"$RAPID_TOOLS_PATH\""
                mkdir -p "$HOME/.config/fish"
                ;;
            zsh)
                CONFIG_FILE="$HOME/.zshrc"
                EXPORT_LINE="export RAPID_TOOLS=\"$RAPID_TOOLS_PATH\""
                ;;
            bash)
                if [[ -f "$HOME/.bashrc" ]]; then
                    CONFIG_FILE="$HOME/.bashrc"
                else
                    CONFIG_FILE="$HOME/.bash_profile"
                fi
                EXPORT_LINE="export RAPID_TOOLS=\"$RAPID_TOOLS_PATH\""
                ;;
            *)
                CONFIG_FILE="$HOME/.profile"
                EXPORT_LINE="export RAPID_TOOLS=\"$RAPID_TOOLS_PATH\""
                ;;
        esac

        echo "" >> "$CONFIG_FILE"
        echo "# RAPID plugin for Claude Code" >> "$CONFIG_FILE"
        echo "$EXPORT_LINE" >> "$CONFIG_FILE"
        echo "  OK: Added to $CONFIG_FILE"
    else
        # Option 2: Dedicated env file
        cat > "$HOME/.rapid-env" << ENVEOF
# RAPID plugin for Claude Code
export RAPID_TOOLS="$RAPID_TOOLS_PATH"
ENVEOF
        echo "  OK: Written to ~/.rapid-env"
        echo ""
        echo "  To activate, add this to your shell config:"
        echo "    source ~/.rapid-env"
        echo ""
        echo "  Or source it manually before using RAPID:"
        echo "    source ~/.rapid-env"
    fi
fi

# Step 5: Register Claude Code plugin
echo "[5/5] Registering Claude Code plugin..."

if command -v claude &>/dev/null; then
    (cd "$SCRIPT_DIR" && claude plugin add . 2>&1) || {
        echo "  WARNING: Plugin registration failed (non-fatal)"
        echo "  You can register manually with: claude plugin add $SCRIPT_DIR"
    }
    echo "  OK: Registered"
else
    echo "  [skip] Claude Code CLI not found"
    echo "  Register manually later with: claude plugin add $SCRIPT_DIR"
fi

# Summary
echo ""
echo "=== Setup Complete ==="
echo "RAPID_TOOLS=$RAPID_TOOLS_PATH"
echo "Install method: $INSTALL_METHOD"
echo ""
if [[ -n "$ALREADY_CONFIGURED" ]]; then
    echo "Environment variable already persisted in $ALREADY_CONFIGURED"
elif [[ "${choice:-1}" == "1" ]]; then
    echo "Run 'source ${CONFIG_FILE}' or open a new terminal to activate."
else
    echo "Run 'source ~/.rapid-env' or add it to your shell config to activate."
fi
echo ""
echo "Try: /rapid:help in Claude Code to get started."
