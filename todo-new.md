Some commands to add:
NOTE: all these commands should write state files/update the state
- /review -> users might want to merge first then review -> therefore, we should configure /review to allow for rev>
- /bug-fix -> for users to fix bugs when they find any



Some agents still try to run commands like so 
● Bash(RAPID_ROOT="/home/kek/.claude/plugins/cache/joey-plugins/rapid/3.3.0/skills/status/../.."
      if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export…)
  ⎿  Error: Exit code 1
     {"error":"Unknown state subcommand: set-status"}
     [RAPID ERROR] Unknown state subcommand: set-status

● Bash(RAPID_ROOT="/home/kek/.claude/plugins/cache/joey-plugins/rapid/3.3.0/skills/status/../.."
      if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export…)
  ⎿  Error: Exit code 1
     {"error":"Unknown state subcommand: --help"}
     [RAPID ERROR] Unknown state subcommand: --help

● Bash(RAPID_ROOT="/home/kek/.claude/plugins/cache/joey-plugins/rapid/3.3.0/skills/status/../.."
      if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export…)
  ⎿  Error: Exit code 1
     {"error":"Unknown state subcommand: update-set"}
     [RAPID ERROR] Unknown state subcommand: update-set

we should sweep through all agents and make sure they are aware of the syntax of commmands they might want to use


