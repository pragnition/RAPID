---
description: Install and configure RAPID v3.6.0 plugin for Claude Code
disable-model-invocation: true
allowed-tools: Read, Bash, AskUserQuestion
---

# /rapid:install -- v3.6.0 Plugin Installation and Setup

You are the RAPID installer. This skill bootstraps RAPID v3.6.0 by running the non-interactive setup script, then handles shell detection, config file selection via AskUserQuestion, auto-sourcing with verification, and fallback guidance. It works for both marketplace and git clone installations.

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
echo "RAPID_ROOT=$RAPID_ROOT"
```

There is a caveat: if the user has previously installed RAPID via marketplace, there may be old versions in ~/.claude/plugins/cache. You are on version 3.0, so your install location should contain some sort of reference to v3.6.0.0! So you need to make sure to update the RAPID_TOOLS path in the shell config if it points to an old version. You can detect this by checking if RAPID_TOOLS is already configured in any shell config file and if it points to a path within ~/.claude/plugins/cache. If so, prompt the user to update their config to point to the new RAPID_ROOT path.

## Step 1: Run Non-Interactive Bootstrap

Run setup.sh to handle prereqs, npm install, validation, .env writing, plugin registration, and `build-agents` (generates all agent .md files from source modules):

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
bash "$RAPID_ROOT/setup.sh"
```

If setup.sh fails, use AskUserQuestion:

- Header: "Setup failed"
- Options:
  - "Retry setup" -- description: "Re-run setup.sh to attempt installation again"
  - "Show manual steps" -- description: "Display manual installation commands you can run yourself"
  - "Cancel installation" -- description: "Exit the installer without completing setup"

If "Retry setup": re-run the bash command above.
If "Show manual steps": display these commands:

```
cd $RAPID_ROOT
npm install --production
node src/bin/rapid-tools.cjs prereqs
```

Then proceed to Step 2 to let the user continue with shell config.
If "Cancel installation": end with "Installation cancelled."

## Step 2: Detect Shell and Select Config File

Read the user's shell and present config options.

First, detect the shell:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
SHELL_NAME=$(basename "${SHELL:-/bin/bash}")
echo "Detected shell: $SHELL_NAME ($SHELL)"
```

Display the detected shell to the user: "Detected shell: {SHELL_NAME} ({SHELL})"

Map the shell to its config file:

- bash -> `~/.bashrc` (prefer) or `~/.bash_profile`
- zsh -> `~/.zshrc`
- fish -> `~/.config/fish/config.fish`
- unknown -> `~/.profile`

Check if RAPID_TOOLS is already configured in any shell config:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
for f in ~/.bashrc ~/.bash_profile ~/.zshrc ~/.config/fish/config.fish ~/.profile; do
    if grep -qF "RAPID_TOOLS" "$f" 2>/dev/null; then
        echo "ALREADY_CONFIGURED=$f"
        break
    fi
done
```

If RAPID_TOOLS is already configured, it might be an old version that requires updating, user AskUserQuestion:

- Header: "RAPID_TOOLS already configured"
- Text: "RAPID_TOOLS is already configured in {config_file}. Do you want to update it to the new path for RAPID v3.6.0?"
- Options:
  - "Yes, update config" -- description: "Update the existing config file with the new RAPID_TOOLS path"
  - "No, keep existing config" -- description: "Keep the existing RAPID_TOOLS configuration (you may need to update it manually if it's an old version)"
  - "Show config file" -- description: "Display the contents of the existing config file for review"

If "Yes, update config": remember that you need to update the shell config to point to the new path. Essentially, just do a reinstall like you would if it was not configured, but make sure to overwrite the existing RAPID_TOOLS line instead of adding a new one./

If NOT already configured or user chooses to update, use AskUserQuestion:

- Header: "Shell configuration"
- Text: "Detected shell: {SHELL_NAME} ({SHELL}). Choose where to persist the RAPID_TOOLS environment variable:"
- Options (show only files that exist on disk, mark the detected shell's config as recommended):
  - "{detected_shell_config} (recommended)" -- description: "Add RAPID_TOOLS export to your {SHELL_NAME} config for terminal usage"
  - Other existing config files as additional options -- description: "Add RAPID_TOOLS export to this config file"
  - "Skip -- use .env only" -- description: "RAPID will work in Claude Code via .env fallback. Shell config is for terminal usage."

If user chose "Skip -- use .env only": display "Skipped shell config. RAPID_TOOLS loaded from .env in Claude Code sessions." and proceed to Step 4.

Otherwise proceed to Step 3 with the chosen config file.

## Step 3: Write Shell Config and Auto-Source

Write the RAPID_TOOLS export to the chosen config file, then auto-source and verify.

Determine the export line based on shell type:

- fish: `set -gx RAPID_TOOLS "{RAPID_ROOT}/src/bin/rapid-tools.cjs"`
- All others (bash, zsh, posix): `export RAPID_TOOLS="{RAPID_ROOT}/src/bin/rapid-tools.cjs"`

Append the export line to the chosen config file:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
RAPID_TOOLS_PATH="$RAPID_ROOT/src/bin/rapid-tools.cjs"
# For fish:
echo "" >> ~/.config/fish/config.fish
echo "# RAPID plugin for Claude Code" >> ~/.config/fish/config.fish
echo "set -gx RAPID_TOOLS \"$RAPID_TOOLS_PATH\"" >> ~/.config/fish/config.fish
# For bash/zsh/posix:
# echo "" >> ~/.zshrc
# echo "# RAPID plugin for Claude Code" >> ~/.zshrc
# echo "export RAPID_TOOLS=\"$RAPID_TOOLS_PATH\"" >> ~/.zshrc
```

Use the appropriate block for the chosen shell type. Only run the relevant lines.

Then auto-source and verify in ONE Bash tool call. The source + verify must happen in the same call because each Bash call starts a fresh shell:

For fish:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
fish -c "source ~/.config/fish/config.fish; echo RAPID_TOOLS=\$RAPID_TOOLS; node \$RAPID_TOOLS prereqs"
```

For bash:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
bash -c "source ~/.bashrc && echo RAPID_TOOLS=\$RAPID_TOOLS && node \"\$RAPID_TOOLS\" prereqs"
```

For zsh:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
zsh -c "source ~/.zshrc && echo RAPID_TOOLS=\$RAPID_TOOLS && node \"\$RAPID_TOOLS\" prereqs"
```

If source + verify succeeds: display "Shell config updated and verified. RAPID_TOOLS is active." and proceed to Step 4.

If source + verify FAILS, display fallback guidance:

Show the exact source command for the user's shell in a code block:

For bash: `` `source ~/.bashrc` ``
For zsh: `` `source ~/.zshrc` ``
For fish: `` `source ~/.config/fish/config.fish` ``

Then display: "Note: .env fallback is already configured -- RAPID will work in Claude Code regardless. The shell config is for terminal usage."

Then use AskUserQuestion:

- Header: "Auto-source failed"
- Options:
  - "Retry" -- description: "Re-run source and verification"
  - "Continue anyway" -- description: "Proceed to verification -- .env fallback will handle Claude Code sessions"
  - "Cancel installation" -- description: "Exit the installer"

If "Retry": re-run the source + verify command above.
If "Continue anyway": proceed to Step 4.
If "Cancel installation": end with "Installation cancelled."

## Step 4: Verify Installation

Load RAPID_TOOLS from .env if not already set, then verify the full tool chain:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
    export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
node "${RAPID_TOOLS}" prereqs
```

If prereqs succeeds: display verification passed and proceed to Step 5.

If prereqs fails, use AskUserQuestion:

- Header: "Prereqs verification failed"
- Options:
  - "Retry prereqs" -- description: "Run prerequisite checks again"
  - "Show manual fix steps" -- description: "Display manual troubleshooting commands"
  - "Cancel" -- description: "Exit the installer"

If "Retry prereqs": re-run the verification command.
If "Show manual fix steps": display:

```
# Check Node.js version
node -v  # Must be v18+

# Check RAPID_TOOLS path
cat $RAPID_ROOT/.env

# Run prereqs manually
node ~/path/to/rapid/src/bin/rapid-tools.cjs prereqs
```

If "Cancel": end with "Installation cancelled."

## Step 5: Post-Install Next Actions

Use AskUserQuestion:

- Header: "RAPID v3.6.0 installation complete"
- Options:
  - "Run /rapid:help" -- description: "See all available RAPID commands and workflow guidance"
  - "Run /rapid:init" -- description: "Initialize planning infrastructure for a new project"
  - "Run /rapid:status" -- description: "Check project status if already initialized"
  - "Done" -- description: "Exit installer"

If "Run /rapid:help": invoke the /rapid:help skill.
If "Run /rapid:init": invoke the /rapid:init skill.
If "Run /rapid:status": invoke the /rapid:status skill.
If "Done": display "RAPID v3.6.0 is ready. Happy building!"
