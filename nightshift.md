# Nightshift 

Nightshift is a re-imagine of how RAPID's development lifecycle will look like. 

Currently, developers go through a flow of /new-version, then for each set, they do /start, /discuss, /plan, /execute. This is great and produces good results. However, a consequence of this is that a developer has to be present to do /clear, and /plan then /execute. This translates into a timewaste as developers end up spending much time waiting for agents to complete AND get no work done whilst they sleep. 

Nightshift will be a mode of operation that developers can choose to use through the webui. The standard claude code slash commands will _still_ work.  

The principle of nightshift is this. Agents should do necessary work at night whilst the developer is sleeping, and the developer should use their precious waking hours on making executive, architectural, design and system design decisions. Therefore, the new flow will operate in this way. 

After the developer does a /new-version or a /init, there will be multiple sets that will need to be done. In nightshift mode, there are 2 new commands(/agents), /mega-start and /mega-discuss. Mega-start initializes all the sets (one by one). It does so in SOLO mode. Nightshift does _not_ make use of worktrees. It also puts the project into "nightshift mode"

After mega-start is done, the mega agent is spawned. This is an interactive agent that reads through every single set and asks similar questions to the current /discuss command. The key distinction here is that this one agent asks questions for ALL the sets in the WHOLE project/version. The agent will have to go DEEP and make sure that they cover every thing and know EXACTLY what the user wants. This needs to be done as there will be NO user interaction in the next step. Mega-discuss writes the same files to each set as the current /discuss-set

After all this is done, when in nightshift mode, the orchestrator (this is programmatic) will look through all the sets and spawn /discuss-set (with --skip to skip discuss. the discuss agent here should still be doing the self interview and asking itself the questions), /plan-set and then /execute-set. This will be done in a blocking linear fashion. This is to say that each agent will only be spawned after the next one is complete. 

Naturally, the agents might hit some gaps. For instance, the current execute agent will often notice some gaps and request the developer to do /plan-set --gaps and /execute-set --gaps. We will fix this by exposing a register_output tool call that each agent must call before they end. By calling this, they can give the orchestrator the information that there are gaps and the orchestrator can then go ahead to slot the /plan-set --gaps and /execute-set --gaps into the queue. 

For each set, after the /execute-set, the pipeline will spawn agents one by one to tackle the present kanban board issues.

then, it will spawn a audit set agent that will audit the set and do testing to ensure that everything has been completed. If not, it will use the kanban board to publish any tasks that need to be done. After the audit-set agent is complete, agents will be spawned (either quick or bug-fix depending on the board) to solve the issues for that set in the kanban board. When they are done, the audit-set agent will be spawned again. This happens till the audit-set agent is satisfied and does not create anymore kanban cards for that set.

After everything has been completed, an audit-version agent will also be spawned. This agent does a final audit of the version and proceeds to address gaps and assign tasks with the kanban board. It will then exit and the same loop as the audit-set agent will happen where agents will be spawned one by one to fix the issues and then the audit-version will be spawned again. Once the audit version agent is happy, it will produce a report for the user to see when they wake up (that will be downloadable/viewable from the frontend)

## Kanban board integration 

The kanban board page will now have a "nightshift" tab. This nightshift tab are the agent's way of deferring any work to downstream agents. There will be a bug-fix,quick and done board. At any point in their lifecycle, agents can write to these boards to add cards. These cards will be addressed by spawning agents in a linear fashion (one by one) to fix them after the audit-set/audit-version/set finishes. 



## Considerations 

In order to make this work side by side with the current slash commands, we might have to duplicate some agents (nightshift specific/not). Another thing we can also do is to have them have one source file in the source, and then build them programmatically after to split between nightshift/non night-shift work.
