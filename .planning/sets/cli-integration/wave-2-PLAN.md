# Wave 2 PLAN: Skill Integration and Doctor Checks

## Objective

Wire the web-client module (from Wave 1) into the three CLI integration points: the install skill, the init skill, and a new register-web skill. Also extend `prereqs.cjs` with web service doctor checks. All changes are purely additive -- gated behind `RAPID_WEB=true` -- and must not alter existing behavior when the flag is unset.

## Tasks

### Task 1: Create `/rapid:register-web` skill

**File:** `skills/register-web/SKILL.md` (NEW)

**Implementation:**

Create the skill directory and SKILL.md with this exact content:

```markdown
---
description: Register the current project with the RAPID Mission Control web dashboard
allowed-tools: Bash, Read
---

# /rapid:register-web -- Register Project with Mission Control

You are the RAPID web registration handler. This skill registers the current project with the Mission Control web dashboard by calling the web service API.

## Step 1: Load Environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## Step 2: Check RAPID_WEB

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
node -e "
const { isWebEnabled } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
if (!isWebEnabled()) {
  console.log(JSON.stringify({ enabled: false }));
} else {
  console.log(JSON.stringify({ enabled: true }));
}
"
```

Parse the JSON output.

If `enabled` is `false`, display:

> RAPID_WEB is not enabled. To enable Mission Control, run `/rapid:install` and select the web dashboard option, or add `RAPID_WEB=true` to your shell config and RAPID .env file.

End the skill.

## Step 3: Register Project

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
node -e "
const { registerProjectWithWeb } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
registerProjectWithWeb(process.cwd()).then(result => {
  console.log(JSON.stringify(result));
});
"
```

Parse the JSON result.

If `success` is `true`, display:

> Registered with Mission Control. Open http://127.0.0.1:8998 to view the dashboard.

If `success` is `false`, display:

> Mission Control registration failed: {error}
>
> Troubleshooting:
> - Verify the web service is running: `systemctl --user status rapid-web`
> - Check the service logs: `journalctl --user -u rapid-web -n 20`
> - Restart the service: `systemctl --user restart rapid-web`
```

**What NOT to do:**
- Do NOT add any path argument. The command always operates on the current working directory, matching how all other RAPID commands work.
- Do NOT add retry logic. One attempt, report result.
- Do NOT modify any state files. Registration is a side-effect-only HTTP call.

**Verification:**
```bash
test -f skills/register-web/SKILL.md && echo "SKILL.md exists" || echo "MISSING"
```

---

### Task 2: Extend install skill with optional web service setup

**File:** `skills/install/SKILL.md` (MODIFY)

**Implementation:**

Insert a new **Step 4.5** between the current Step 4 (Verify Installation) and Step 5 (Post-Install Next Actions). This step is purely additive -- it does not change any existing steps.

**Where to insert:** After the line `If prereqs succeeds: display verification passed and proceed to Step 5.` (approximately line 201 area, before the `## Step 5: Post-Install Next Actions` heading).

**Content to insert:**

```markdown
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
> cd {RAPID_ROOT}/web/backend
> pip install -e .
> ```
> After installing, run `/rapid:install` again to complete web dashboard setup.

Proceed to Step 5 (skip remaining web setup).

2. **Write RAPID_WEB=true to RAPID .env file:**

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if grep -q "RAPID_WEB=" "$RAPID_ROOT/.env" 2>/dev/null; then
    sed -i 's/^RAPID_WEB=.*/RAPID_WEB=true/' "$RAPID_ROOT/.env"
else
    echo "" >> "$RAPID_ROOT/.env"
    echo "# RAPID Mission Control web dashboard" >> "$RAPID_ROOT/.env"
    echo "RAPID_WEB=true" >> "$RAPID_ROOT/.env"
fi
echo "Written RAPID_WEB=true to $RAPID_ROOT/.env"
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
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
cp "$RAPID_ROOT/web/backend/service/rapid-web.service" ~/.config/systemd/user/rapid-web.service
systemctl --user daemon-reload
systemctl --user enable rapid-web
systemctl --user start rapid-web
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
```

**Also modify Step 5** to add a new option. Find the existing AskUserQuestion options in Step 5 and add one more option after "Run /rapid:status":

Add this option to the existing list:
```
  - "Run /rapid:register-web" -- description: "Register this project with Mission Control web dashboard"
```

And add a corresponding handler:
```
If "Run /rapid:register-web": invoke the /rapid:register-web skill.
```

**What NOT to do:**
- Do NOT modify Steps 0-4. They remain unchanged.
- Do NOT make web setup mandatory. It is always opt-in behind the AskUserQuestion gate.
- Do NOT change the existing RAPID_TOOLS shell config logic. RAPID_WEB is a separate line.

**Verification:**
```bash
grep -c "Step 4.5" skills/install/SKILL.md
grep -c "RAPID_WEB" skills/install/SKILL.md
grep -c "register-web" skills/install/SKILL.md
```
Expected: At least 1 for each grep.

---

### Task 3: Extend init skill with auto-registration

**File:** `skills/init/SKILL.md` (MODIFY)

**Implementation:**

Insert a new **Step 10.5** between Step 10 (Auto-Commit) and Step 11 (Completion). This is a short addition that fires a non-blocking registration call after STATE.json is committed.

**Where to insert:** After the line `If the commit fails for any reason, warn the user but do NOT fail the entire init process.` (line ~915), before the `## Step 11: Completion` heading.

**Content to insert:**

```markdown
---

## Step 10.5: Web Dashboard Registration

If `RAPID_WEB=true` is set, automatically register this project with Mission Control.

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
node -e "
const { isWebEnabled, registerProjectWithWeb } = require('${RAPID_TOOLS}/../lib/web-client.cjs');
if (!isWebEnabled()) {
  console.log(JSON.stringify({ skipped: true }));
  process.exit(0);
}
registerProjectWithWeb(process.cwd()).then(result => {
  console.log(JSON.stringify(result));
});
"
```

Parse the JSON result:

- If `skipped` is `true`: silently continue to Step 11. Do NOT display anything about web registration.
- If `success` is `true`: display "Registered with Mission Control."
- If `success` is `false`: display "Mission Control unavailable. Run `/rapid:register-web` later to register this project."

This step must NEVER fail the init process. Any error is informational only.
```

**What NOT to do:**
- Do NOT move this before Step 10. The registration must happen AFTER STATE.json is written, because the backend reads STATE.json when registering.
- Do NOT add any AskUserQuestion here. This is fully automatic.
- Do NOT change any existing step numbers. Insert as 10.5 to avoid renumbering.

**Verification:**
```bash
grep -c "Step 10.5" skills/init/SKILL.md
grep -c "registerProjectWithWeb" skills/init/SKILL.md
grep -c "Mission Control" skills/init/SKILL.md
```
Expected: At least 1 for each grep.

---

### Task 4: Add web service health checks to prereqs.cjs

**File:** `src/lib/prereqs.cjs` (MODIFY)

**Implementation:**

Add a new exported function `validateWebPrereqs()` that returns an array of check results in the same shape as `checkTool()` results (`{name, status, version, minVersion, required, reason, message}`). This function is called by the doctor/status commands when `RAPID_WEB=true` is set.

**Where to add:** After the `formatPrereqSummary` function (around line 192), before `module.exports`.

**New function:**

```javascript
/**
 * Validate web service prerequisites (only when RAPID_WEB=true).
 * Returns check results in the same shape as checkTool() for unified display.
 *
 * @returns {Promise<Array>} Array of 3 result objects (service, database, port)
 */
async function validateWebPrereqs() {
  const { isWebEnabled, checkWebService } = require('./web-client.cjs');

  if (!isWebEnabled()) {
    return []; // Return empty array -- no web rows in doctor output
  }

  const checks = await checkWebService();

  const results = [];

  // Service running check
  results.push({
    name: 'Web Service',
    status: checks.service_running ? 'pass' : 'warn',
    version: checks.version || null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control dashboard',
    message: checks.service_running
      ? `Web service running (v${checks.version})`
      : 'Web service not running (start with: systemctl --user start rapid-web)',
  });

  // Database check
  results.push({
    name: 'Web Database',
    status: checks.db_accessible ? 'pass' : 'warn',
    version: null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control data store',
    message: checks.db_accessible
      ? 'Database connected'
      : 'Database not accessible',
  });

  // Port check
  results.push({
    name: 'Port 8998',
    status: checks.port_available ? 'pass' : 'warn',
    version: null,
    minVersion: '-',
    required: false,
    reason: 'Mission Control endpoint',
    message: checks.port_available
      ? 'Port 8998 responding'
      : 'Port 8998 not responding',
  });

  return results;
}
```

**Update `module.exports`:** Add `validateWebPrereqs` to the exports:

Change:
```javascript
module.exports = {
  compareVersions,
  checkTool,
  validatePrereqs,
  checkGitRepo,
  formatPrereqSummary,
};
```

To:
```javascript
module.exports = {
  compareVersions,
  checkTool,
  validatePrereqs,
  validateWebPrereqs,
  checkGitRepo,
  formatPrereqSummary,
};
```

**What NOT to do:**
- Do NOT modify `validatePrereqs()`. The core prereq checks remain unchanged.
- Do NOT make web checks `required: true`. They are always optional (status `'warn'` not `'fail'`).
- Do NOT import `web-client.cjs` at the top of the file. Use inline `require()` inside the function to avoid loading the web client module when web is not enabled.
- Do NOT change the result shape. The results must match `checkTool()` output exactly so `formatPrereqSummary()` can render them.

**Verification:**
```bash
node -e "const { validateWebPrereqs } = require('./src/lib/prereqs.cjs'); validateWebPrereqs().then(r => console.log('checks:', r.length))"
```
Expected: `checks: 0` if RAPID_WEB is not set, `checks: 3` if RAPID_WEB=true.

---

## Success Criteria

- `skills/register-web/SKILL.md` exists and defines a working `/rapid:register-web` command.
- `skills/install/SKILL.md` includes Step 4.5 for optional web dashboard setup with AskUserQuestion gate.
- `skills/init/SKILL.md` includes Step 10.5 for auto-registration after STATE.json commit.
- `src/lib/prereqs.cjs` exports `validateWebPrereqs()` returning 0 checks when web is disabled, 3 checks when enabled.
- No existing CLI behavior is altered when `RAPID_WEB` is unset.
- All modifications are purely additive -- no existing lines are deleted or modified (only insertions and the module.exports update).
