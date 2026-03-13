We are going to write a refresh of the framework. I have realised a few problems with it

1. It is overly complicated. The agents are good enough to do much of their own in an autonomous matter and we do not need such fine grained control eg. we do not need to plan each wave independently. We don't need fancy locks on files either as planning should minimize file overlaps and we can just merge well.

2. The agents suck at calling rapid-tools.cjs as they have no documentation/context of the commands available

3. Many of the agents are still following old workflows/have outdared information

Here are some of the philosophies that I have with this project

1. The project should fully capture the users _vision_ (the why) but need not capture _implementation_ (the how) unless strictly neccessary.

2. Context length is key. Agents and orchestrators should spawn subagents for repeatable tasks and communicate using structured outputs for highest clarity.

3. Agents should have full knowledge of the rapid-tools.cjs commands they need to run. An agent should never _guess_ what it needs to do, it should be part of its identity.

4. The user is meant to /clear context after every command. Therefore, each command needs to constantly update the state of the project when needed.

As a refresher, here is the intended workflow

1. /init (/context for brownfield) (/new-version for projects already using rapid)

This command initializes a new project with the required scaffold (/context) maps out the current project and creates the neccessary scaffold

The user may or may not provide context of their project.
Therefore, when the model does not feel confident that they have enough information, they should prompt the user until they get a good idea of what the user is looking to build. This should not be a "describe your project in one sentence" interaction but rather an in depth discussion that gives the agent rich context and details on what the user envisions.

The agent will then spawn the same 5 researchers and come up with a high level plan -> that then gets validated by a verifier.

The agent should also ask the user for their preferred model choices (quality/balanced). Quality enforces opus (or the best model equivalent) for most tasks and balanced is our default out of the box config that uses sonnet for most tasks but opus for crucial tasks.

During the project scaffolding, the agent will come up with specific deliverables that will then be packaged into "sets" that are _isolatable_ and _parallelizable_ aka. we can do them independently

2. /start-set <set_no> (used to be /set-init)

This creates the scaffolding for a set (worktrees etc).
Remember that since people may work in parallel, the state of the project may not be fully updated. Therefore, sets should be able to be started completely independently of one another (we shouldn't expect set 2 to be completed before working on set 3).

3. /discuss-set <set_no> [args: --skip]

This starts a discussion phase with the user about their _vision_ for the set. The goal isn't do determine things like _how_ we should code certain functions, but rather _what_ the eventual product will look like. Things like UI/UX are of utmost priority. Naturally, the user can specify technical details if they wish but the agent need to prompt the user for every little detail --> they are intelligent enough. The agent then creates a CONTEXT.md file for the next agent (the planner)

If the --skip argument is provided, the discussion phase with the user is skipped and the context file is created by the agent automatically.

4. /plan-set <set_no>

This starts a planning phase using the CONTEXT.md created above. This is an autonomous planning agent that does the following.

- Spawns a set-researcher to do research on the set implementation

- Split the set into multiple waves that can be executed in parallel (1-4)

- Spawns wave-planners if there are 3/4 waves, else just do it by itself to plan the implementation for each wave.

- Spawns wave-verifiers to verify that the plans for each wave match the required objective/criteria. Loops through the wave-planner and wave-verifier if success condition is not met. Success condition is HIGH confidence in the wave's success.

Writes the plan out in markdown files for the executor's consumption.

5. /execute-set <set_no>

This runs rapid-executors in parallel to execute each individual wave in parallel.

After all waves have been executed, we run a lean verifier agent to verify that the wave has fulfilled the criteria. And objectives

At the end of each execution phase, the state is updated and any neccessary files are commited/written

6. /review <set_nos>

The reviewer agent can be used either after a set is completed or after a bunch of sets are completed or after a merge. This is completely up to the user.

The review pipeline is the same as before, with the unit-test, bug-hunt and UAT workflow. This is currently good and does not have to change

7. /merge <set_nos>

This creates a new branch and merges multiple sets into one. This uses the current merge pipeline and also the workflow does not need to change much. Merging should also take into the RAPID state. After a merge the state should be updated to reflect all and any changes, and planning artifacts should be transffered to the new branch.

Auxilliary must have commands:

- /new-version (this just completes the current milestone and starts a new version of the project)

- /add-set (this is for any minor feature sets that the user needs to add after)

- /quick (this is for any quick changes/fixes that the user wishes to implement)

- /status (gets the current status of the project over all available worktrees and shows the user what's next)

- /install (responsible for running the install script and validating installation) -> used after the plugin updates as well to update the plugin's files.

Some key things to note:

- there is no more gating feature of needing set X to be completed before set Y can complete. This is the whole point of RAPID -> that sets can be parallelized and are independent of one another

- We should simplify prompts and prompts only need to be dynamically generated when necessary.

- Each agent should be provided with yaml (can be in-context) of what possible rapid-tools.cjs commands they need to run and how they should run it (aka input and output). This prevents agents from messing up and running invalid commands.

- make sure the install command installs everything and updates old installations (replaced cjs files etc)

- prompts should be XML formatted with a clear consistent format
o