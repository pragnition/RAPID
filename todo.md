# Features

## Audit Version
After every version, we might have missed out on features or not implemented stuff corrected. Therefore, we need an /audit-version command that audits the current version (to be run after all sets complete) and check and plan for stuff that is missing.
Get shit done has a very good implementation of this that we should take inspiration from. See: https://raw.githubusercontent.com/gsd-build/get-shit-done/refs/heads/main/get-shit-done/workflows/audit-milestone.md

## Discuss table 
Currently, the discuss phase asks questions and lists the pros and cons in a table. but this can be sometimes unaligned. We shuld format this better somehow.

## Discuss gray areas  
currently when there are >4 gray areas, the agent uses 2 AskUserQuestion prompts. however, we can actually just have 1 AskUserQuestion prompts with multiple questions in it. (Eg. for 8 gray areas, we have 2 questions each with 4 chekcboxes)
