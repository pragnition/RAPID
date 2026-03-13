---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - setup.sh
  - commands/install.md
  - skills/install/SKILL.md
autonomous: true
must_haves:
  truths:
    - "setup.sh detects all available shells on the system and presents them as options"
    - "User can choose which shell config file to update from a numbered list"
    - "RAPID_TOOLS env var is also saved to a .env file inside the plugin directory"
    - "Skills/commands that reference RAPID_TOOLS can load it from the .env file as fallback"
  artifacts:
    - path: "setup.sh"
      provides: "Shell detection, user prompt, .env persistence"
    - path: "commands/install.md"
      provides: "Updated install command reflecting new setup flow"
    - path: "skills/install/SKILL.md"
      provides: "Updated install skill reflecting new setup flow"
  key_links:
    - from: "setup.sh"
      to: ".env file in plugin root"
      via: "writes RAPID_TOOLS to .env alongside shell config"
---

<objective>
Fix the install/setup flow to: (1) detect available shells and let user pick which config to update, (2) always persist RAPID_TOOLS to a .env file in the plugin root directory, (3) update install command/skill docs to reflect the changes.

Purpose: Current setup.sh only reads $SHELL to decide which config file to update, which can be wrong (e.g., user runs bash but uses fish as daily driver). Also, env vars should be saved to a .env file for reliability (per project conventions).
Output: Updated setup.sh with shell detection + .env persistence, updated install command and skill.
</objective>

<execution_context>
@/home/kek/.claude/get-shit-done/workflows/execute-plan.md
@/home/kek/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@setup.sh
@commands/install.md
@skills/install/SKILL.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite setup.sh shell detection and add .env persistence</name>
  <files>setup.sh</files>
  <action>
Rewrite Step 4 ("Persist RAPID_TOOLS environment variable") of setup.sh with two changes:

**A) Shell detection with user choice:**

Replace the current approach (reading $SHELL) with:
1. Build a list of AVAILABLE shell configs by checking which files exist on the system:
   - `~/.bashrc` or `~/.bash_profile` (label: "bash")
   - `~/.zshrc` (label: "zsh")
   - `~/.config/fish/config.fish` (label: "fish")
   - `~/.profile` (label: "generic/POSIX")
2. Also detect if the user's current shell (`$SHELL`) is one of these -- mark it as "(current)" in the list
3. Present a numbered menu like:
   ```
   Available shell configs:
     1) ~/.zshrc (current)
     2) ~/.bashrc
     3) ~/.config/fish/config.fish
     4) Skip shell config (use .env only)
   ```
4. Read user choice. Default to the "(current)" shell option if user presses Enter.
5. Write the appropriate export line to the chosen config (same fish/zsh/bash/profile logic as current code).
6. Always include a "Skip" option as the last numbered choice.

Keep the existing "already configured" check (grep for RAPID_TOOLS) -- if already found in any config, skip the shell prompt entirely.

**B) Always write .env file in plugin root:**

After the shell config step (whether user chose a shell config or skipped), ALWAYS write a `.env` file in `$SCRIPT_DIR/.env`:
```
# RAPID plugin environment
RAPID_TOOLS=/absolute/path/to/rapid-tools.cjs
```
Also create a `.env.example` file in `$SCRIPT_DIR/.env.example`:
```
# RAPID plugin environment
# Set by setup.sh -- path to rapid-tools.cjs CLI
RAPID_TOOLS=/path/to/your/rapid/src/bin/rapid-tools.cjs
```

Update the summary message at the end to mention both the shell config AND the .env file.

IMPORTANT: Use `~` in echo messages per CLAUDE.md convention ("use the tilde ~ instead of the $HOME environment variable" for display), but use `$HOME` in actual path operations (tilde doesn't expand in variables).
  </action>
  <verify>
    <automated>bash -n /home/kek/Projects/RAPID/setup.sh && echo "Syntax OK" && grep -q "\.env" /home/kek/Projects/RAPID/setup.sh && echo ".env reference found" && grep -q "Available shell" /home/kek/Projects/RAPID/setup.sh && echo "Shell menu found"</automated>
  </verify>
  <done>setup.sh detects available shells, presents numbered menu with current shell marked, writes .env file to plugin root, creates .env.example</done>
</task>

<task type="auto">
  <name>Task 2: Update install command and skill to reflect new setup flow</name>
  <files>commands/install.md, skills/install/SKILL.md</files>
  <action>
Update both `commands/install.md` and `skills/install/SKILL.md` (they are identical files -- keep them in sync):

1. In the description/intro, mention that setup now persists to both shell config AND a .env file.

2. Update Step 2 (Verify Installation) to add a fallback: if `RAPID_TOOLS` is not set in the environment, try loading it from the .env file in the plugin root before failing:
   ```bash
   RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
   if [ -z "${RAPID_TOOLS}" ] && [ -f "$RAPID_ROOT/.env" ]; then
       export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
   fi
   node "${RAPID_TOOLS}" prereqs
   ```

3. Update Step 3 (Guide User) to mention:
   - The .env file location for manual editing
   - That shell config was also updated (if chosen)

Both files should be kept identical in content (they serve the same purpose via dual registration pattern per decision [02-01]).
  </action>
  <verify>
    <automated>grep -q "\.env" /home/kek/Projects/RAPID/commands/install.md && grep -q "\.env" /home/kek/Projects/RAPID/skills/install/SKILL.md && echo "Both files updated"</automated>
  </verify>
  <done>Both install.md files load RAPID_TOOLS from .env as fallback, mention new setup flow</done>
</task>

</tasks>

<verification>
1. `bash -n setup.sh` -- no syntax errors
2. `.env.example` file exists at repo root
3. `grep "Available shell" setup.sh` -- shell detection menu present
4. `grep "\.env" commands/install.md skills/install/SKILL.md` -- .env fallback in both install docs
</verification>

<success_criteria>
- setup.sh detects available shells and shows numbered menu with current shell marked
- setup.sh always writes .env to plugin root (SCRIPT_DIR/.env)
- .env.example created as template
- Install command/skill loads RAPID_TOOLS from .env as fallback when env var not set
- Both commands/install.md and skills/install/SKILL.md stay in sync
</success_criteria>

<output>
After completion, create `.planning/quick/5-fix-install-command-shell-detection-and-/5-SUMMARY.md`
</output>
