We are building a unit testing/user verification and code review claude-code plugin for the RAPID
metaprompting framework.
It is meant to run after each phase is complete, with a command like /gsd-test:run

It will ride on the current RAPID files and planning and get context from there


## Unit testing methodology

When you fix a bug caused by invalid data, adding validation at one place feels sufficient. But that single check can be bypassed by different code paths, refactoring, or mocks.

Core principle: Validate at EVERY layer that data passes through. Make the bug structurally impossible.

Validate at the input entry point and at any critical logic points.

Furthermore, when writing your tests after a phase executes and before the verifier runs, write a detailed test plan, which details which features/parts of the code you are going to test, and how you plan to test it. Allow the user to edit/approve the plan first, then continue.

When you write unit tests, you should comment them liberally in case the user wishes to edit them. Furthermore, when running unit tests, instead of just telling the user "it works and X/N tests passes", log your output into a log file along with what command you ran so the user can peruse it.

Do automated testing for web frontends with the playwright server thoroughly.

Lastly, you should try to minimize API costs as much as possible. Eg, if there is a very high cost call, aim to call it with as compact and little test data as possible.

## UAT Testing methodology

UAT Testing is all about testing whether the general, high level features work as expected. There is no need to attempt to test for bugs or vulnerabilities - this is what unit tests and bug hunting methodologies are for.

Therefore, when UAT testing, focus on the broad scope goals of the project and aim to make the UAT test follow the intended workflow of the app. The UAT test should make the user _feel_ as if they are an end user

## Bug hunting methodology

Bug hunting is not a single process. It involves finding bugs (using static code analysis) and assigning them risk/confidence levels, verifying if the bugs are legitamate (again with confidence scores) and then lastly aggregation and a last lap analysis.

Therefore, for bug hunting, we will make use of three agents. The hunter, the devils advocate and the judge.

The hunters job is to look for bugs and assign them a risk level and confidence level. A draft of the hunters prompt can be found in hunter.md
The devils advocate's job is to check the hunters work and attempt to disprove it's findings. A draft of the devils advocate prompt can be found in devils-advocate.md
The judge's job is to look at both the hunters and devil's advocate work and then analyse which findings are more accurate and produce a final judging.


## Plugin operation

The user can run /uat, /unit-test or /bug-hunt commands to run each step seperately. Alternatively, it can run /review which will run the equivalent of the three commands in the order details below
When running /review, each of the individual steps (UAT,unit-test,bug-hunt) will run recursively untill ALL requirements are satisfied for each phase.

### UAT Testing flow
We do UAT first as the biggest most glaring issues are often application breaking. There is no point to create many unit tests and hunt for bugs when the user cannot even load the homepage, for instance.
Therefore, we will use UAT as a simple "catch all" solution for the biggest most glaring and obvious issues.

It is imperative that we do not waste the user's time. Therefore, we can make use of the playwright-mcp and playwright-cli to perform our own versions of UAT whenever possible, defaulting to the user only when something requires their help.

The UAT agent will generate a multi-step UAT plan that follows the intended flow of the application's/phases workflow. Steps that can be completed by the agent with playwright will be tagged as "automated" UATs whilst steps that require a human will be tagged as "human"

The agent will go through the motions of the UAT test, prompting the user for their input whenever needed.

At each step, the agent will either "pass" the step or has to generate a description of the problem/ask the user for a description of the problem.

Whatever that is wrong will be collated and a bugfix will be attempted by a bugfix agent.

Testing will then loop from the start till all requirements are satsified

### Unit testing flow

Unit tests are imperative to catch edge cases and ensure that an application can run smoothly even in high-stress situations.

However, one can often be a myopic and too eager when writing unit tests, leading to many fluff unit tests that don't tackle the real issues.

Therefore, the unit testing agent (a draft prompt can be found in unit-test.md) will do the following


1. The agent will look through each feature and each layer, and then come up with a unit test plan describing which feature/code snippet/function it wishes to test, for what, and it's plan to do so
2. The plan is given to the user to look through and approve/edit
3. One done, the agent goes ahead with writing unit tests and then runs them
4. However, it is imperative that the agent produces a unit-test report that includes the commands it ran, outputs and why it passes/fails so that the user has full observability of the process.
5. The user looks through the report and approves/edits what results they think are important
6. A bug fix agent then attempts to fix the bugs
7. We start again from step 1


### Bug hunting

Bug hunting is an imperative part of testing a project. Here, we act as an auditor that looks through the code

As mentioned above, the flow is as follows

1. A hunter agent will go out and hunt for bugs, detailing risk and confidence factors - this step is meant to be extremely broad and produce many false positives, but a low number of false negatives
2. A devils advocate agent will look at the hunts findings and attempt to disprove bugs where possible - this step is meant to cut down on the false positives
3. A judge agent will compare both findings and then decide which bugs are worthy (with a HITL interaction if needed)
4. A bug fix agent is spawned to fix the bugs
5. We iterate from the top till the judge judges that there are no bugs





# Plugin coding process

When writing the plugin, make sure that the plugin has the four commands available.
You will require to improve the draft prompts for the hunter, devils-advocate, judge and unit-test agent. 
Subagents are extremely powerful. Use them when appropriate (eg. for the bug fix agent)
