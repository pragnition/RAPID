---
description: Install and configure RAPID v7.0.0 plugin for Claude Code
disable-model-invocation: true
allowed-tools: Read, Bash, AskUserQuestion
args: []
categories: [autonomous]
---

# /rapid:install -- v7.0.0 Plugin Installation and Setup

You are the RAPID installer. This skill bootstraps RAPID v7.0.0 by running the non-interactive setup script, then handles shell detection, config file selection via AskUserQuestion, auto-sourcing with verification, and fallback guidance. It works for both marketplace and git clone installations.

## Step 0: Detect Installation Location

Determine where RAPID is installed:

1. Check if `${CLAUDE_SKILL_DIR}` path contains `.claude/plugins` -- this indicates a marketplace install
2. Otherwise assume git clone installation
3. Compute the plugin root as 2 directories up from the skill directory: `${CLAUDE_SKILL_DIR}/../..`

```bash
if [[ "${CLAUDE_SKILL_DIR}" == *".claude/plugins"* ]]; then
    echo "Detected: marketplace installation"
else
    echo "Detected: git clone installation"
fi
echo "RAPID_PLUGIN_DIR=${CLAUDE_SKILL_DIR}/../.."
```

There is a caveat: if the user has previously installed RAPID via marketplace, there may be old versions in ~/.claude/plugins/cache. You are on version 3.0, so your install location should contain some sort of reference to v7.0.0! So you need to make sure to update the RAPID_TOOLS path in the shell config if it points to an old version. You can detect this by checking if RAPID_TOOLS is already configured in any shell config file and if it points to a path within ~/.claude/plugins/cache. If so, prompt the user to update their config to point to the new plugin root path.

## Step 0.5: Probe Optional Prerequisites (uv)

Before running `setup.sh`, check whether `uv` (Astral's Python package manager) is available. `uv` is required for the RAPID web backend (Mission Control) and for Step 6 of `setup.sh`. It is NOT required for core RAPID (solo-mode users who don't use the web dashboard don't need it).

Run a bash probe:

```bash
if command -v uv &>/dev/null; then
    echo "UV=present $(uv --version | awk '{print $2}')"
else
    echo "UV=missing"
fi
```

**If `UV=present`:** Display `"uv <version> found -- continuing."` and proceed to Step 1 with `RAPID_INSTALL_UV` unset.

**If `UV=missing`:** Use `AskUserQuestion`:

- Header: "uv not found -- install now?"
- Text: "The 'uv' Python package manager is required for the RAPID web backend (Mission Control). It's not currently on your PATH. Astral provides a one-line installer: curl -LsSf https://astral.sh/uv/install.sh | sh"
- Options:
  - "Yes, auto-install uv" -- description: "Run the Astral installer now. RAPID setup will continue after uv is installed."
  - "Skip -- I'll install it later" -- description: "Continue install without uv. Mission Control and backend features won't work until you install uv and re-run /rapid:install."
  - "Show manual install instructions" -- description: "Display platform-specific install commands (homebrew, curl, pipx) so you can install outside Claude Code."

Handle the answers:

- **"Yes, auto-install uv":** Export `RAPID_INSTALL_UV=auto` so Step 1 forwards it to `setup.sh`. `setup.sh` will run the Astral installer and re-probe PATH.
- **"Skip -- I'll install it later":** Export `RAPID_INSTALL_UV=skip` (explicit, matches existing non-interactive behavior).
- **"Show manual install instructions":** Display the following block, then re-prompt with the same question. Cap the re-prompt loop at two iterations -- if the user picks "Show manual install instructions" a third time, treat it as "Skip".

  ```
  # macOS (Homebrew)
  brew install uv

  # Linux / macOS (Astral installer)
  curl -LsSf https://astral.sh/uv/install.sh | sh

  # Windows (PowerShell)
  powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

  # Python users with pipx
  pipx install uv
  ```

Proceed to Step 1 with `RAPID_INSTALL_UV` set (or unset if `uv` was already present).

## Step 1: Run Non-Interactive Bootstrap

Run setup.sh to handle prereqs, npm install, validation, .env writing, plugin registration, and `build-agents` (generates all agent .md files from source modules). Forward `RAPID_INSTALL_UV` (set in Step 0.5) so setup.sh can honor the user's auto-install / skip choice:

```bash
RAPID_INSTALL_UV="${RAPID_INSTALL_UV:-}" bash "${CLAUDE_SKILL_DIR}/../../setup.sh"
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
cd "${CLAUDE_SKILL_DIR}/../.."
npm install --production
node src/bin/rapid-tools.cjs prereqs
```

Then proceed to Step 2 to let the user continue with shell config.
If "Cancel installation": end with "Installation cancelled."

## Step 2: Detect Shell and Select Config File

Read the user's shell and present config options.

First, detect the shell:

```bash
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
for f in ~/.bashrc ~/.bash_profile ~/.zshrc ~/.config/fish/config.fish ~/.profile; do
    if grep -qF "RAPID_TOOLS" "$f" 2>/dev/null; then
        echo "ALREADY_CONFIGURED=$f"
    fi
done
```

If RAPID_TOOLS is already configured, it might be an old version that requires updating, user AskUserQuestion:

- Header: "RAPID_TOOLS already configured"
- Text: "RAPID_TOOLS is already configured in {config_file}. Do you want to update it to the new path for RAPID v7.0.0?"
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

- fish: `set -gx RAPID_TOOLS "{PLUGIN_ROOT}/src/bin/rapid-tools.cjs"`
- All others (bash, zsh, posix): `export RAPID_TOOLS="{PLUGIN_ROOT}/src/bin/rapid-tools.cjs"`

Append the export line to the chosen config file:

```bash
RAPID_TOOLS_PATH="${CLAUDE_SKILL_DIR}/../../src/bin/rapid-tools.cjs"
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
fish -i -c "source ~/.config/fish/config.fish; echo RAPID_TOOLS=\$RAPID_TOOLS; node \$RAPID_TOOLS prereqs"
```

For bash:

```bash
bash -c "source ~/.bashrc && echo RAPID_TOOLS=\$RAPID_TOOLS && node \"\$RAPID_TOOLS\" prereqs"
```

For zsh:

```bash
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
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then
    export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs)
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
node -v  # Must be v20+

# Check RAPID_TOOLS path
cat "${CLAUDE_SKILL_DIR}/../../.env"

# Run prereqs manually
node ~/path/to/rapid/src/bin/rapid-tools.cjs prereqs
```

If "Cancel": end with "Installation cancelled."

---

## Step 4.5: Optional Web Dashboard Setup

After successful verification, offer the user the option to enable the RAPID Mission Control web dashboard.

Use AskUserQuestion with:
- Header: "Enable RAPID Mission Control web dashboard?"
- Text: "RAPID Mission Control provides a web-based project dashboard at http://127.0.0.1:8998 with kanban boards, project overview, and real-time sync."
- Options:
  - "Yes, enable Mission Control" -- description: "Set up the web dashboard service (systemd) and enable RAPID_WEB integration"
  - "No, skip for now" -- description: "You can enable it later by adding RAPID_WEB=true to your config"

**If "No, skip for now":**
Display "Skipped web dashboard setup. You can enable it later by adding `RAPID_WEB=true` to your shell config and running `/rapid:register-web`."
Proceed to Step 5.

**If "Yes, enable Mission Control":**

1. **Check if `rapid-web` binary exists:**

```bash
if command -v rapid-web &>/dev/null; then
    echo "RAPID_WEB_BINARY=found"
    which rapid-web
elif [ -f ~/.local/bin/rapid-web ]; then
    echo "RAPID_WEB_BINARY=found"
    echo "$HOME/.local/bin/rapid-web"
else
    echo "RAPID_WEB_BINARY=missing"
fi
```

If the binary is missing, display:

> The `rapid-web` binary was not found. Install the web backend first:
> ```
> cd {PLUGIN_ROOT}/web/backend
> pip install -e .
> ```
> After installing, run `/rapid:install` again to complete web dashboard setup.

Proceed to Step 5 (skip remaining web setup).

2. **Write RAPID_WEB=true to RAPID .env file:**

```bash
if grep -q "RAPID_WEB=" "${CLAUDE_SKILL_DIR}/../../.env" 2>/dev/null; then
    sed -i 's/^RAPID_WEB=.*/RAPID_WEB=true/' "${CLAUDE_SKILL_DIR}/../../.env"
else
    echo "" >> "${CLAUDE_SKILL_DIR}/../../.env"
    echo "# RAPID Mission Control web dashboard" >> "${CLAUDE_SKILL_DIR}/../../.env"
    echo "RAPID_WEB=true" >> "${CLAUDE_SKILL_DIR}/../../.env"
fi
echo "Written RAPID_WEB=true to ${CLAUDE_SKILL_DIR}/../../.env"
```

3. **Write RAPID_WEB=true to shell config:**

Use the same shell detection from Step 2 (SHELL_NAME, config file). Append the RAPID_WEB export to the same shell config file that already has RAPID_TOOLS:

For fish:
```bash
echo "set -gx RAPID_WEB true" >> ~/.config/fish/config.fish
```

For bash/zsh/posix:
```bash
echo 'export RAPID_WEB=true' >> {chosen_config_file}
```

4. **Enable and start the systemd user service:**

```bash
# Copy service file if not already in place
mkdir -p ~/.config/systemd/user
cp "${CLAUDE_SKILL_DIR}/../../web/backend/service/rapid-web.generated.service" ~/.config/systemd/user/rapid-web.service
systemctl --user daemon-reload
systemctl --user enable rapid-web
systemctl --user restart rapid-web
sleep 2
systemctl --user status rapid-web --no-pager
```

If the service starts successfully, display:

> Mission Control enabled. The web dashboard is running at http://127.0.0.1:8998
> Service: `systemctl --user status rapid-web`

If it fails to start, display the status output and suggest troubleshooting:

> Mission Control service failed to start. Check logs with:
> `journalctl --user -u rapid-web -n 20`

Proceed to Step 5 regardless of service start outcome.

## Step 5: Post-Install Next Actions

Use AskUserQuestion:

- Header: "RAPID v7.0.0 installation complete"
- Options:
  - "Run /rapid:help" -- description: "See all available RAPID commands and workflow guidance"
  - "Run /rapid:init" -- description: "Initialize planning infrastructure for a new project"
  - "Run /rapid:status" -- description: "Check project status if already initialized"
  - "Run /rapid:register-web" -- description: "Register this project with Mission Control web dashboard"
  - "Done" -- description: "Exit installer"

If "Run /rapid:help": invoke the /rapid:help skill.
If "Run /rapid:init": invoke the /rapid:init skill.
If "Run /rapid:status": invoke the /rapid:status skill.
If "Run /rapid:register-web": invoke the /rapid:register-web skill.
If "Done": display "RAPID v7.0.0 is ready. Happy building!"

## Step 6: Update Reminder

After the post-install action prompt is handled (or "Done" is selected), emit the deferred update-reminder banner. On a fresh install this is always a no-op (the timestamp was just written -- the install is 0 days old), but the call is unconditional so that re-running `/rapid:install` after months without setup.sh produces the right banner. The CLI handles all gating internally.

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
node "${RAPID_TOOLS}" display update-reminder
```

Do not interpret or react to the output. The CLI handles all gating internally; this skill only invokes it.
