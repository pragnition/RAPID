# Feature Changes 
1. Integration of /branding into the init flow

There is quite a lot of friction currently for the user to do /branding. Therefore, we shall integrate the /branding skill into the project initialisation flow. Insert it somewhere in 4B. Maybe after all the areas now and before the granularity preference 


2. /branding webserver Changes

Currently, the branding skill spawns a light webserver that requires the user to refresh on every change. I think this could be made much better. Lets instead spawn a webserver with autoreload that stores "artifacts". In this webpage, the model can create new artifacts (eg. logo, theme etc) that will be populated on the main page. The user can then browse through these artifacts on their own.

Therefore, the branding skill can also be expanded to do mroe things. For instance, after the theme is settled, the branding skill should ask the user if they want to generate logos(document)/a wireframe of the site. After everything is completed, the agent can then generate a branding guidelines page as well.


# Feature adds 

1. Update reminder. When we do /rapid:install, we should add a updated_on env var or temp file somewhere. When the date of this exceeds a week, we should encourage the user to update. 
