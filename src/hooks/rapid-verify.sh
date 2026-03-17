#!/bin/bash
# rapid-verify.sh -- Post-task hook that runs RAPID verification checks
# Companion to rapid-task-completed.sh. Invokes the hooks system via rapid-tools CLI.
# Non-blocking: exits 0 even if verification finds issues (warnings only).

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract team name to filter RAPID tasks only
TEAM=$(echo "$INPUT" | jq -r '.team_name // "unknown"')

# Only process RAPID team tasks
if echo "$TEAM" | grep -q "^rapid-wave-"; then
  # Find rapid-tools.cjs
  RAPID_TOOLS="${RAPID_TOOLS:-}"
  if [ -z "$RAPID_TOOLS" ]; then
    # Try common locations
    if [ -f "$HOME/.claude/plugins/cache/joey-plugins/rapid/*/src/bin/rapid-tools.cjs" ]; then
      RAPID_TOOLS=$(ls -1 "$HOME/.claude/plugins/cache/joey-plugins/rapid"/*/src/bin/rapid-tools.cjs 2>/dev/null | tail -1)
    fi
  fi

  if [ -n "$RAPID_TOOLS" ] && [ -f "$RAPID_TOOLS" ]; then
    # Extract the task output for RAPID:RETURN parsing
    TASK_OUTPUT=$(echo "$INPUT" | jq -r '.task_output // ""')

    if echo "$TASK_OUTPUT" | grep -q "RAPID:RETURN"; then
      # Parse the return data and feed to hooks runner
      RETURN_JSON=$(echo "$TASK_OUTPUT" | node -e "
        const { parseReturn } = require('$(dirname "$RAPID_TOOLS")/../lib/returns.cjs');
        let input = '';
        process.stdin.on('data', d => input += d);
        process.stdin.on('end', () => {
          const result = parseReturn(input);
          if (result.parsed) {
            process.stdout.write(JSON.stringify(result.data));
          }
        });
      " 2>/dev/null)

      if [ -n "$RETURN_JSON" ]; then
        # Run hooks -- capture output but never fail
        echo "$RETURN_JSON" | node "$RAPID_TOOLS" hooks run 2>/dev/null || true
      fi
    fi
  fi
fi

# Always exit 0 -- hooks are non-blocking
exit 0
