1. Review state management. We ought to store the state of the review (eg. if bug hunt has been done etc. so that if we do bughunt and uat, then the uat command will not ask the user to do bughunt again)

2. Better human readable documentation. We are about to opensource this and push to the public. Lets touch up our documentation. Here is the canonical workflow. Our agents should also be aware of this
- /install (if not already installed)
- /init 
- /branding (optional)
- /scaffold (optional)
- /start-set [--solo]
  - /discuss-set
  - /plan-set
  - /execute-set
  - /review (optional, the author believes that the user should be smart about what they review, and the author recommends to review after merge if there are many dependencies on other sets. not all review stages are required)
  - /merge (not necessary if solo mode)

- /audit-version
- /new-version


Additionally, documentation should be provided for /quick, /bug-fix and /add-set

3. Better colouring. Currently, many of the agents colours are very bright colours. This doesn't play well with white text on a dark terminal. Channge them all to dark colours.
