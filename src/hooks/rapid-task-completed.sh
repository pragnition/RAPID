#!/bin/bash
# rapid-task-completed.sh -- TaskCompleted hook for RAPID agent teams tracking
# Writes completion records to .planning/teams/{team}-completions.jsonl
# Only processes tasks from RAPID teams (rapid-wave-* naming convention)

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from hook JSON input
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // "unknown"')
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // "unknown"')
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name // "unknown"')
TEAM=$(echo "$INPUT" | jq -r '.team_name // "unknown"')

# Only process RAPID team tasks (rapid-wave-* convention)
if echo "$TEAM" | grep -q "^rapid-wave-"; then
  # Find project root by looking for .planning/ directory
  PROJECT_ROOT="."
  if [ -d ".planning" ]; then
    PROJECT_ROOT="."
  elif [ -d "../.planning" ]; then
    PROJECT_ROOT=".."
  fi

  TRACKING_DIR="$PROJECT_ROOT/.planning/teams"
  mkdir -p "$TRACKING_DIR"

  # Append completion record as JSONL
  echo "{\"task_id\":\"$TASK_ID\",\"subject\":\"$TASK_SUBJECT\",\"teammate\":\"$TEAMMATE\",\"team\":\"$TEAM\",\"completed_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >> "$TRACKING_DIR/$TEAM-completions.jsonl"
fi

exit 0
