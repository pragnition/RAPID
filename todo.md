- add-set -> users might want to add/inject a set at the end (this is for when you want to do something spontaneously as quick, but it isn't just a simple bugfix or feature)

- documentation -> this (meant to be used usually at the end of a version) will generate/update existing documentation for the project
- currently, we do a good job of defining API contracts etc. however, we should also define UI specs/contracts across phases to ensure that the UI is created in a coherent manner.
- hooks: at the moment, when agents finish up they often forget to update the project state. we should add a hook that is ran on the completion of a rapid agent that asks it to check if it has updated the project state (if it needs to do so)
- we need better "memory" on what the user requests for during new-version/when the user changes their mind about an implementation halfway
- code quality is quite low at the moment. I think we need richer planning/context/state to ensure that the agents get a more descriptive view of what they need to create
- /quick should also log in some state file/somewhere to serve as memory of what we did
