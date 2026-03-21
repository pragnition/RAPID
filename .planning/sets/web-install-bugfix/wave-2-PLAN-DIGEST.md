# Wave 2 Plan Digest

**Objective:** Wire Wave 1 fixes into the install pipeline -- add backend venv setup, frontend build, and service file generation steps to setup.sh
**Tasks:** 2 tasks completed
**Key files:** setup.sh
**Approach:** Updated setup.sh step count from 5 to 8, added npm/uv prerequisite checks, added 3 new steps (backend venv, frontend build, systemd service file generation with __RAPID_ROOT__ substitution)
**Status:** Complete
