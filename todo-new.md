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


this should've been fixed previously but the DEFINITION.md is still broken
Warning: Scoped CLAUDE.md could not be generated (missing DEFINITION.md). Let me check what's available for this
  set.

additionally, the discuss skilll should be changed to only discuss 4 areas. i realised my previous mistake -> AskUseQuestion doesn't allow for > 4 options


when dealing with package management like uv, we need to make sure that we can run each worktree individuallly for testing purposes. how we should do this is specify to the merge agent that it should check that all packages are installed etc

oftentimes the execution agent fails to transition the set to "complete" and the review agent doesn't want to run because of that. actually this should probably be a review agent fix to make it play nice with "executed" since the "complete" state is kind of irrelevant

When we finish a set, we should update the planning documents within the set's worktree. Then, we merge those into main and then update the state according. This will prevent errors like this
● Merge error for set 'code-quality': Untracked files on main would be overwritten by the merge.

  Conflicting files:
  - .planning/sets/code-quality/WAVE-1-COMPLETE.md
  - .planning/sets/code-quality/WAVE-2-COMPLETE.md
  - .planning/sets/code-quality/WAVE-3-COMPLETE.md
  - .planning/sets/code-quality/wave-1-PLAN-DIGEST.md
  - .planning/sets/code-quality/wave-2-PLAN-DIGEST.md
  - .planning/sets/code-quality/wave-3-PLAN-DIGEST.md

  These are untracked planning artifacts on main that also exist on the rapid/code-quality branch. They
───────────────────────────────────────────────────────────────────────────────────────────────────────
 ☐ Merge error

Untracked files block the merge. Remove these 6 planning artifacts from main's working tree so the
merge can proceed?

❯ 1. Remove and retry
     Delete the 6 untracked files from main, then retry the merge
  2. Skip set
     Continue pipeline without merging code-quality
  3. Abort pipeline
     Exit merge pipeline entirely
  4. Type something.
─────────────────────────────────


also, /review currently creates the files in the main branch in post merge mode, but the unit-test, uat and bug-hunt agents dont know this so they end up not finding the file
