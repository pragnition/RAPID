When a new version is created and the previous planning documents are archived, rapid-tools will not consider this and therefore might resolve wrong set names. for instance, say we have sets 1,2,3,4,5 and we archive 4,5 and add 6,7,8,9. then rapid-tools will resolve set 6 to set 8 which is not intended behaviour.

During the discuss phase, the agent sometimes asks the user multiple questions and doesn't provide any options. It should batch the questions in the way that AskUserQuestions natively support (aka. multiple headers and each header = one question and one question has a bunch of pre-filled options). If you ask the user multiple questions in one UI box, it will overwhelm and overload the user. Provide the context and question in each header and allow the user to navigate between them.

Add colours to each subagent spawned. The banner colour shouldn't be pink, change it to dakr purple. This looks really bad with white text.

"
Answer all, or 'Claude decides'.

❯ 1. Claude decides
     Let Claude handle auto-advance behavior decisions
  2. I'll answer
     I'll provide my thoughts on auto-advance behavior
  3. Type something.
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  4. Chat about this
"

NEVER do this. Always give the user prefilled questions with an I'll answer option

Some of the agents tend to call commands that don't even exist (in rapid-tools.cjs). Go through each agent and make sure that they call the right commands.

Errors:
- during contract and state validation
● Bash(RAPID_ROOT="/home/kek/.claude/plugins/cache/joey-plugins/rapid/3.0.0/skills/plan-set/../.."
      if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then expo…)
  ⎿  Error: Exit code 1
     [RAPID ERROR] Unknown command: wave-plan
     Usage: rapid-tools <command> [subcommand] [args...]

     Commands:
       lock acquire <name>    Acquire a named lock
       lock status <name>     Check if a named lock is held
       lock release <name>    Release a named lock (not typically used directly)
       state get --all                                     Read full STATE.json
       state get milestone <id>                            Read milestone
     … +129 lines (ctrl+l to see all

- during merging
 Bash(RAPID_ROOT="/home/kek/.claude/plugins/cache/joey-plugins/rapid/3.0.0"
      if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RA…)
  ⎿  Error: Exit code 1
     {"error":"Invalid transition: \"discussing\" -> \"complete\". Valid transitions from \"discussing\":
     [planning]"}

     {"error":"Invalid transition: \"discussing\" -> \"complete\". Valid transitions from \"discussing\":
     [planning]"}



