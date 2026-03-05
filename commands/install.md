---
description: Install and configure RAPID plugin for Claude Code
disable-model-invocation: true
allowed-tools: Read, Bash
---

# /rapid:install -- Plugin Installation and Setup

You are the RAPID installer. This skill bootstraps RAPID by setting the RAPID_TOOLS environment variable, installing npm dependencies, validating prerequisites, and registering the Claude Code plugin. It works for both marketplace and git clone installations.

Setup persists RAPID_TOOLS to both a shell config file (user's choice) AND a `.env` file in the plugin root directory for reliable fallback loading.

## Step 0: Detect Installation Location

Determine where RAPID is installed:

1. Check if `${CLAUDE_SKILL_DIR}` path contains `.claude/plugins` -- this indicates a marketplace install
2. Otherwise assume git clone installation
3. Set `RAPID_ROOT` to 2 directories up from the skill directory: `${CLAUDE_SKILL_DIR}/../..`

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [[ "${CLAUDE_SKILL_DIR}" == *".claude/plugins"* ]]; then
    echo "Detected: marketplace installation"
else
    echo "Detected: git clone installation"
fi
```

## Step 1: Run Setup Script

Run the setup.sh bootstrap script from the RAPID root:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [[ -f "$RAPID_ROOT/setup.sh" ]]; then
    bash "$RAPID_ROOT/setup.sh"
else
    echo "ERROR: setup.sh not found at $RAPID_ROOT/setup.sh"
    echo ""
    echo "Manual installation steps:"
    echo "  1. Clone the repo: git clone https://github.com/fishjojo1/RAPID"
    echo "  2. Run setup:      cd RAPID && ./setup.sh"
    exit 1
fi
```

## Step 2: Verify Installation

After setup completes, verify RAPID_TOOLS is functional. If the environment variable is not set in this session, load it from the .env file as fallback:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
    export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
node "${RAPID_TOOLS}" prereqs
```

If this still fails, try sourcing your shell config or running setup.sh again.

## Step 3: Guide User

If verification succeeded:

- RAPID is installed and ready to use
- Run `/rapid:help` to see all available commands
- If this is a new project, run `/rapid:init` to initialize planning infrastructure
- If you update RAPID (marketplace update or git pull), re-run `/rapid:install` to refresh paths
- The .env file at the plugin root (`$RAPID_ROOT/.env`) can be edited manually if needed
- Shell config was also updated if you chose a shell during setup (restart your terminal or source the config to activate)
