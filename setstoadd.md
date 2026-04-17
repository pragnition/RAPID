1. new version does not need all 6 research agents

the new version command does not need to spawn all 6 research agents, we can remove 18:38:34

2. Branding within init command not working as intended

in a previous version, we incorporated the branding skill into the init phase. However, we did not do this correctly. The branding skill (and the one that is incorporated into init) should spawn a webserver with artifacts. 
Currently, the branding skill spawns a light webserver that requires the user to refresh on every change. I think this could be made much better. Lets instead spawn a webserver with autoreload that stores "artifacts". In this webpage, the model can create new artifacts (eg. logo, theme etc) that will be populated on the main page. The user can then browse through these artifacts on their own.

Therefore, the branding skill can also be expanded to do mroe things. For instance, after the theme is settled, the branding skill should ask the user if they want to generate logos(document)/a wireframe of the site. After everything is completed, the agent can then generate a branding guidelines page as well. This will apply to BOTH branding and the branding within init. (actually we can just ask the init agent to call the branding skill)
