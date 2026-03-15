Sometimes developers using RAPID might be developing solo. Therefore, we should ask (during the init stage or by providing a --solo flag during start-set) and save this configuration somewhere. 
In solo mode, we will not be using worktrees and we will just work on the main branch directly

In addition, when developing webapps it is probably good to have some sort of frontend "scaffold" or project "scaffold". Same goes for many different kinds of projects
Therefore, I am thinking that we should have a /scaffold command that is meant to run after /new-project that generates a scaffold for the project. Think about this like a set-0 that all sets are dependent on. This will help ensure consistent testing/better merging.

Currently, when starting sets i keep seeing this error
Warning: Scoped CLAUDE.md could not be generated (missing DEFINITION.md). Let me check what files exist for this
  set.


When the discuss agent identifies sets for ux improvements, it puts "let claude decide all" as an option along 3 other options which is plain wrong
I've identified 4 areas for set 'ux-improvements'. Which would you like to discuss?

  1. [ ] Let Claude decide all
  Skip discussion, all 4 decisions at Claude's discretion
  2. [✔] Banner color choice
  Dark purple vs alternatives for planning-stage backgrounds; freeform escape hatch UX (phrasing and position of
  'I'll answer in my own words')
  3. [✔] Discuss-set batching
  How to restructure Steps 5-6 gray area questions — grouping strategy for 2-3 questions per area
❯ 4. [✔] Audit scope boundaries
  Audit only the 6-8 files with known gaps, or do a full 17-skill sweep of all AskUserQuestion calls
  5. [ ] Type something
     Submit


Currently the entire review process is very context heavy. Lets make the /review run the scoping agent and write its output/files to a REVIEW-SCOPE.md

Afterwhich, we can ahve the user do /unit-test /uat /bug-hunt on their own (this way, we don't even need to prompt the user to choose which review stages we need!)
Also show the judge's leaning for each of the rulings
