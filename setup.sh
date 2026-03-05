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
for check_file in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.config/fish/config.fish" "$HOME/.profile"; do
    if grep -qF "RAPID_TOOLS" "$check_file" 2>/dev/null; then
        ALREADY_CONFIGURED="$check_file"
        break
    fi
done

CHOSEN_CONFIG=""

if [[ -n "$ALREADY_CONFIGURED" ]]; then
    echo "  RAPID_TOOLS already configured in $ALREADY_CONFIGURED, skipping shell config."
else
    # Detect available shell configs and build menu
    SHELL_NAME="$(basename "${SHELL:-/bin/bash}")"
    declare -a MENU_LABELS=()
    declare -a MENU_FILES=()
    declare -a MENU_TYPES=()
    DEFAULT_CHOICE=""

    # Check bash
    if [[ -f "$HOME/.bashrc" ]]; then
        MENU_LABELS+=("~/.bashrc")
        MENU_FILES+=("$HOME/.bashrc")
        MENU_TYPES+=("bash")
        if [[ "$SHELL_NAME" == "bash" ]]; then DEFAULT_CHOICE="${#MENU_LABELS[@]}"; fi
    elif [[ -f "$HOME/.bash_profile" ]]; then
        MENU_LABELS+=("~/.bash_profile")
        MENU_FILES+=("$HOME/.bash_profile")
        MENU_TYPES+=("bash")
        if [[ "$SHELL_NAME" == "bash" ]]; then DEFAULT_CHOICE="${#MENU_LABELS[@]}"; fi
    fi

    # Check zsh
    if [[ -f "$HOME/.zshrc" ]]; then
        MENU_LABELS+=("~/.zshrc")
        MENU_FILES+=("$HOME/.zshrc")
        MENU_TYPES+=("zsh")
        if [[ "$SHELL_NAME" == "zsh" ]]; then DEFAULT_CHOICE="${#MENU_LABELS[@]}"; fi
    fi

    # Check fish
    if [[ -f "$HOME/.config/fish/config.fish" ]]; then
        MENU_LABELS+=("~/.config/fish/config.fish")
        MENU_FILES+=("$HOME/.config/fish/config.fish")
        MENU_TYPES+=("fish")
        if [[ "$SHELL_NAME" == "fish" ]]; then DEFAULT_CHOICE="${#MENU_LABELS[@]}"; fi
    fi

    # Check generic profile
    if [[ -f "$HOME/.profile" ]]; then
        MENU_LABELS+=("~/.profile")
        MENU_FILES+=("$HOME/.profile")
        MENU_TYPES+=("posix")
        if [[ -z "$DEFAULT_CHOICE" ]]; then DEFAULT_CHOICE="${#MENU_LABELS[@]}"; fi
    fi

    # Add skip option
    SKIP_INDEX=$(( ${#MENU_LABELS[@]} + 1 ))

    # If no default found yet, default to first option (or skip if no configs)
    if [[ -z "$DEFAULT_CHOICE" ]]; then
        if [[ ${#MENU_LABELS[@]} -gt 0 ]]; then
            DEFAULT_CHOICE="1"
        else
            DEFAULT_CHOICE="$SKIP_INDEX"
        fi
    fi

    echo ""
    echo "  Available shell configs:"
    for i in "${!MENU_LABELS[@]}"; do
        NUM=$(( i + 1 ))
        LABEL="${MENU_LABELS[$i]}"
        CURRENT_MARKER=""
        # Mark the current shell's config
        if [[ "${MENU_TYPES[$i]}" == "$SHELL_NAME" ]] || \
           { [[ "${MENU_TYPES[$i]}" == "bash" ]] && [[ "$SHELL_NAME" == "bash" ]]; }; then
            CURRENT_MARKER=" (current)"
        fi
        DEFAULT_MARKER=""
        if [[ "$NUM" == "$DEFAULT_CHOICE" ]]; then
            DEFAULT_MARKER=" [default]"
        fi
        echo "    $NUM) $LABEL$CURRENT_MARKER$DEFAULT_MARKER"
    done
    echo "    $SKIP_INDEX) Skip shell config (use .env only)"
    echo ""
    printf "  Choose [1-$SKIP_INDEX] (default: $DEFAULT_CHOICE): "
    read -r choice

    # Default if empty
    if [[ -z "$choice" ]]; then
        choice="$DEFAULT_CHOICE"
    fi

    # Validate choice
    if [[ "$choice" -ge 1 && "$choice" -le "$SKIP_INDEX" ]] 2>/dev/null; then
        : # valid
    else
        choice="$DEFAULT_CHOICE"
    fi

    if [[ "$choice" -lt "$SKIP_INDEX" ]]; then
        IDX=$(( choice - 1 ))
        CONFIG_FILE="${MENU_FILES[$IDX]}"
        SHELL_TYPE="${MENU_TYPES[$IDX]}"
        CHOSEN_CONFIG="$CONFIG_FILE"

        if [[ "$SHELL_TYPE" == "fish" ]]; then
            EXPORT_LINE="set -gx RAPID_TOOLS \"$RAPID_TOOLS_PATH\""
        else
            EXPORT_LINE="export RAPID_TOOLS=\"$RAPID_TOOLS_PATH\""
        fi

        echo "" >> "$CONFIG_FILE"
        echo "# RAPID plugin for Claude Code" >> "$CONFIG_FILE"
        echo "$EXPORT_LINE" >> "$CONFIG_FILE"
        echo "  OK: Added to $CONFIG_FILE"
    else
        echo "  Skipped shell config."
    fi
fi

# Always write .env file in plugin root
echo ""
echo "  Writing .env file to plugin directory..."
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
echo "Environment persisted to:"
echo "  - .env file: $SCRIPT_DIR/.env (always available)"
if [[ -n "$ALREADY_CONFIGURED" ]]; then
    echo "  - Shell config: $ALREADY_CONFIGURED (previously configured)"
elif [[ -n "$CHOSEN_CONFIG" ]]; then
    echo "  - Shell config: $CHOSEN_CONFIG"
    echo ""
    echo "Run 'source $CHOSEN_CONFIG' or open a new terminal to activate."
else
    echo "  - Shell config: skipped"
fi
echo ""
echo "Try: /rapid:help in Claude Code to get started."
