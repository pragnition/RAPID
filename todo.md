1. The current branding skill is focused at documentation. This is not right. It should be focused on UI/UX. We are talking about the visual BRAND as well. This skill needs to be codebase aware as not all projects might involve a webapp for instance

2. The init command should scope the project into a few specific criteria instead of just listing it out generally. Then, the rapid verifier agent should look at these criteria and check that they are fulfilled. We can label the criteria with some sort of encoding like say we are doing UI/UX, it could be UIUX-001, UIUX-002 ....

3. We should add back the DAG. Certain sets might depend on another set invariably, so the DAG will help resolve that. Furthermore, this can be displayed in the command center

4. The discuss phase currently generates 4 gray areas and tends to ask about specific coding details (eg. HOW TO CODE). However, the user should be seen as a system architect and a application designer. We should be asking high level architectural and fine grained UI-UX details instead. 4 gray areas might also be too little. However, we need to make sure to keep the number of questions to a multiple of 4 as each ask user question can only have 4 options. (therefore, if we have 4n gray areas, we should have n ask user questions to ask the user which they wish to discuss). Each gray area should still have it's own set of questions as normal. Lastly, the CONTEXT.md that it produces should have richer detail. You can see https://github.com/gsd-build/get-shit-done/blob/main/get-shit-done/workflows/discuss-phase.md for some inspiration on how the discuss-set should look like.

We should also allow any out of scope user questions/decisions to be outputted to a deferred decisions file/folder and then manage that

5. The /new-version command often misses out on things the user asks it to. We should make it plan comprehensively
