# New auto mode 

We shall be putting the rapid mission control to good use now. 
Currently, we are executing everything in the claude code cli. Things like discuss etc require this. However, we will now implement a fully autonomous mode which will allow the user to experience RAPID fully in the browser. This is how we will implement it 


## Claude Agent SDK 

We shall be using the claude agent SDK to programmtically control our RAPID agents. The claude agent sdk allows one to run the claude binary autonomously. 

## Current skills mapping 

Most of the skills that don't require user input (eg. /rapid:plan, /rapid:execute) can be ran trivially using the claude agent sdk. However, we will require user input for the agents that require input (eg. discuss, init). Therefore, to do this we will require a custom chat interface

### Custom chat interface

We will therefore need to expose new tools to the agents to ask questions. The way we can do this is trivial. We can simply map old tools such as AskUserQuestion onto new tools that will allow users to use the webui to control rapid. 

### Skill arguments

With this newfound level of automation, users might be inclined to skip discuss phases. Additionally, some skills require arguments to be passed in. The webui should be able to do this

## WebUI 

We will probably be doing a UI overhaul. The current dashboard is great. We can keep a similar layout. However, we will now require tabs like "agents", "chats" etc. 

We will basically need a ui to manage the project and start agent runs/chats 

## Kanban agent integration 
The kanban board should now be accessible by agents through custom tools. With this, they can now add, view, and move kanban cards from boards. This will allow for the user to do something like add a bunch of todos to the kanban board, then have agents read from these boards, plan their actions and execute fully autonomously. 


