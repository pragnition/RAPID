1. set-01-foundation - pending
  2. set-02-data-layer - pending
  3. set-03-session-mgmt - pending
  4. set-04-hand-logger - pending
  5. set-05-stats-dashboard - pending

right now if you do /set-init or /discuss you need to specify the exact id. make it so that you can just do /set-init 1 or /disucss 1



workflow is a little confusing. it should be
/init 
/plan -> actuaklly since this doesnt require user input maybe it should be auto ran after init?
/set-init
/discuss <set>
/wave-plan?
/execute
/review
/merge

the agent itselfg seems a little confused about the workflow


during the discuss phase if the agent can ask multiple questions in a group it should (to reduce the friction of answer -> wait for agent -> answer again)


maybe the waves should just execute independently, so we can /plan all of them, then /execute will run them sequentially

wave-plan takes in something like wave-a without context about the set it is in. this does not make sense. one should be able to specify the set and the wave


also it seems like there is some form of over planning/granularity, not sure how that should be address

the wave-research-agent attempts to spawn 
 gsd-phase-researcher(Research wave-a implementation)
  ⎿


     +23 more tool uses (ctrl+o to expand)
     ctrl+b to run in background

this is not gsd. fix this.
it also spawns gsd-wave planner.
find all references of gsd and remove them. this is RAPID, not gsd

we should have the different colour highlighting though, that is good


is it possible to plan all waves first within a set?

the execution agent does not need to ask the user for permission before an execute. the waves probbaly don't need to be planned individually to one another?

 for the review, perhaps the review agent should spawn a scoper as well so the context length doesn't get eaten up

also the review agent is called gsd-review. we really need to fix this gsd reference thing

currently the agents eat quite a lot of context, we need to find a way to make use of more subagents/agent teams

the review stag seems to be pretty chonky as well, maybe we need to make that leaner
