# New Features
1. Rapid mission control code graph
Currently rapid mission control is quite sparse in terms of features. 
Lets flesh it out more by changing how the knowledge graph works.
We should make it a graph of the entire codebase. It needs to look modern, sleek and have features that allow us to click into a file and view it. I'm not too sure if an agent should do this or we can do this programmtically


# Feature Changes 
1. /rapid:bug-fix multiple bug-fix agent support

currently, the bug-fix agent spawns only one bugfix executor agent regardless of how many bugs are actually found. we should relax this and allow the orchestrator agent to split up the bugfixing in waves (if needed) and then have it spawn one bugfix agent for each wave sequentially. This will help with context rot 

# Bug Fixes 
1. Shell config update not fully complete

when there are rapid_tools env var set in 2 different shells, the bash command only shows one and therefore the agent only updates one of them


2. Rapid mission control kanban board 
When you add a card to the kanban board and click into it to add details, ctrl+click should save instead of me having to use my mouse 

3. Rapid mission control RAPID version

the rapid versionn on the rapid mission control is hopelessly outdated to reflect v4.2.1 


