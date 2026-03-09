# R.A.P.I.D Mark II

This is a new iteration of the RAPID Agentic Parallelizable and Isolatable Development metaprompting framework. (yay to recurisve acronyms)

We shall be doing an overhaul of the plugin's workflow.

Currently, the way the plugin does its research and the idea of using git worktrees is good. However, the current workflow is not conducive to multiple teams working on a large project.

Let us first define hierarchy and terminology

## Terminology

1. Project -> the project represents the highest level, an all encompassing term that includes planning, code etc.

2. Versions/Milestones -> A milestone or version represents a big leap in a project. You might think of this as a "Ok, I completed a working prototype of the entire project which is V1, then I want to do V2". The initializaion of a project always initializes V1 and works till completion.

3. Sets -> Each milestone has multiple sets. A set represents a group of features/checkpoints/implementable in a project. Every set can be executed independently of one another. This is where the whole concept of _isolation_ and _parallelization_ between developers comes in. The idea is that developers can be assigned sets and then work on them independently. Later on, they can be merged together to produce the finished _project_. Sets should be scaled based off how many developers will work on this at once/users should be given an option to select. Sets should make intuitive "sense". Eg. one whole feature set could be a set, the backend and frontend could be different sets etc.

4. Waves -> Each set has multiple waves. Waves represent a group of jobs that can be executed in parallel. Each wave will be executed in parallel, saving time.

5. Jobs -> A job is the smallest, quantized unit of RAPID. A job is an unisolatable, unparallelizable linear stream of work that a coding agent will be spawned to iterate and execute on. Jobs will have "plans" associated with them. Plans are execution plans that are created via a discussion phase with the user.

## Agents (non exhaustive high level overview)

### Orchestrator (general term)

This is a general term for an agent that runs whenever any command is executed. This agent will be in charge of understanding the user's intentions and then spawning subagents/teammates to perform the tasks

### Executor

This is the most fundamental agent to "creating" a project. An executor is in charge of executing a "plan". Executors take in planning instructions, and proceed to code/write files that fulfill the plan.

### Intializer / Projechert researc

This agent is in charge of initializing a project. The agent might receive instructions that might include project details, architectural details, tech stack details etc. He is then in charge of initializing the project state and creating any neccessary files for future use.

This agent will be in charge of doing research that might include details such as common approaches, previously created solutions, pitfalls, tech stack etc

### Codebase synthesizer

The codebase synthesizer is in charge of digesting a codebase and outputting structured analysis documents that describe the codebase(files, functions, api endpoints, commands, codestyle, tech stack etc). It is used predominantly when initializing a project in a brownfield project

### Roadmapper

During a project's initialization, a roadmap will need to be created that details sets, waves and jobs. The roadmapper is in charge of creating a structured document that details this projects "roadmap", so that future agents have an understanding of what "step" they are on

### Researcher/research synthesizer

This is a general purpose researcher that synthesizes research outputs from parallel research agents into summary documents, and products a structure SUMMARY document.

### Research agent

This is a researcher that can be called in parallel to do in-depth research on any task

### Wave Planner

A wave planner is in charge of planning out the structure of a wave. Therefore, they will have to plan on how to execute the jobs in a wave in parallel. This planner does research(using research agents) on how best to execute the jobs and produces a high level per job plan. Planners always try to discuss features and details with users. They only act autonomously if the user decides so.

### Job Planner

A job planner is in charge of planning out the execution and implementation details of a single job. This carries a huge responsibility as implementation details are crucial. This planner needs to engage in discussion with the user in order to gain clarity on the user's vision of the project.

### Reviewer

The reviewer agent is in charge of reviewing that the generated code and output matches the spec (unification).Furthermore, it will start a testing pipeline that includes UAT, unit tests and a bug hunting pipeline. Some details about the reviewer/review module can be found in mark2-plans/review-module/user_plan.md and the other files in there are draft files for the agents.

### Merger

As we are working in parallel and on different branches, we will naturally need a solid merging pipeline. I have already created a merging agent for another metaprompting framework, but we can use those ideas. You can find the plugin under ~/Projects/gsd_merge_agent or in this repo
https://github.com/pragnition/gsd_merge_agent. I have also cloned the repo to mark2-plans/gsd_merge_agent.

## Workflow

Here I shall present a brief, high level overview of the envisioned workflow. This is not a 100% detail kind of description but more of a "breifly, what should go on kind of description"

1. User does /init. There will be some greenfield/brownfield detection. If brownfield, the codebase synthesizer is ran and the relevant files are produced. If its a greenfield project, the agent will ask the user questions on what they plan to build. This highly depends on the context that the user has already provided. For instance, if they have provided a full PRD and spec sheet, then the agent already has a pretty confident understanding. If the user just did /init and didnt give any context, the agent will have to dive deeper
   Here the agent should ask things like whether opus/sonnet is to be used,
   The agent will then plan out sets/wave/jobs and produce a project roadmap, state etc.

2. User does /set-init
   Remember, RAPID is meant to work using git worktrees and branches. When a user does /set-init, a new branch and worktree is created, helping the user to get ready for iteration on the new set. The set planner also starts and a high level overview of the set is planned out.

3. User starts the discuss -> plan -> execute -> review loop

For each wave in a set, the user will run /discuss -> /plan -> /execute then optionally /review (this can be ran at the end of a set too)

    1. During the /discuss phase, the agent finds out details from the user about their vision of the implementation. This agent should try to be comprehensive and explicit. If the agent thinks that they have not covered a glaring, important facet about something, they should be asking the user more questions. Minor implementation details can be ignored. A plan is then scoped out and written out

    2. During the /plan phase, the agent does research (using researcher agents) and scopes out a detailed implementation plan meant for consumption by the execution agents.

    3. During the /execute phase, an orchestrator will execute parallel agents (via subagents/experimental agent teams) in order to execute the jobs via the plans created by the wave planner agent

    4. During the /review phase, the review agent shall run

In every of these steps, the state should be updated so that the user can clear context in between each phase

## Important Details

1. There should be some form of a state machine so that the state is being continously updated
2. The agents should NEVER use $HOME. They should ALWAYS use ~ instead
3. Agents should ALWAYS call the AskUserQuestion tool and ALWAYS BATCH their queries to save on tokens and time. An agent should never be asking the user in the plain prompt when UX can be improved with an AskUserQuestion tool call
4. ALL Agent outputs that are meant to be parsed by other agents should be in some sort of structured format.
5. UI/UX is of utmost priority in these kind of tools. Emojis/Colour should be used when possible, and the user should always be aware of what is going on, but not bombed by unnecessary details
6. Discussion/Context gathering with the user is SO SO important

## Other information

1. Milestones (eg major versions) should also be able to be started/created with sometjhing like /new-milestone

2. a /quick or a /insert-job task that is meant to quickly implement/fix a feature would be nice too

# Your implementation details

1. Installing plugins like this that need to call scripts is tricky. The current methodology _works_. Use an env var that is set in the users config and preserve the current /install command that is meant to automate the install.

2. Please ask me questions on how the agent prompts should be structured.
