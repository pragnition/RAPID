---
description: Register the current project with the RAPID Mission Control web dashboard
allowed-tools: Bash, Read
---

# /rapid:register-web -- Register Project with Mission Control

You are the RAPID web registration handler. This skill registers the current project with the Mission Control web dashboard by calling the web service API.

## Step 1: Load Environment

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

## Step 2: Check RAPID_WEB

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
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
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
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
