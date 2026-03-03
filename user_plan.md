RAPID

RAPID Agentic Parallelizable and Isolatable Development is a metaprompting development framework for claude code.
Tools such as get shit done (https://github.com/gsd-build/get-shit-done) and PAUL (https://github.com/ChristopherKahler/paul) provide a good metaprompting framework for individual developers to work on projects.

If you want you can download these repos to take a look at their code

However, due to the linear nature of these frameworks (eg. phases for get shit done depending on previous phases), it is hard to get it to work with teams of developers that might be developing asynchronously. PAID aims to solve this problem by ensuring isolatability and parallelizability during the planning phase. Take inspiration from get-shit-done and PAUL and to create a similar plugin/skill system with state management that allows one to work with teams.

Each "isolated feature/feature-set" shall be called a set, and it shall be done in phases. Use a similar discuss/plan/execute phase strategy as get shit done or propose something better if you wish.

Due to the asynchronity of work, a new repository management paradigm needs to be put in place. We will use git worktrees/branchs, and then merge them later on. We need to keep this in mind. As a result, we will require a consistently styling guide (the initial research agent/a seperate agent should append a styling guide/info for future selfs in CLAUDE.md). Furthermore, we will probably need a dedicated diff reviewer/merge reviewer to manage the merges and ensure that stuff doesn't go terribly wrong.

We should also support the claude code EXPERIMENTAL_AGENT_TEAMS feature. Make sure that the orchestration agents check for the EXPERIMENTAL_AGENT_TEAMS env var and prompt the user if they should use it or not. Else, normal subagents will do just fine. 
