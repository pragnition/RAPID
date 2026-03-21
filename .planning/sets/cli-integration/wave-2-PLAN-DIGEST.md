# Wave 2 Plan Digest

**Objective:** Wire web-client.cjs into CLI integration points (install, init, register-web skill) and extend prereqs.cjs with web doctor checks
**Tasks:** 4 tasks completed
**Key files:** skills/register-web/SKILL.md, skills/install/SKILL.md, skills/init/SKILL.md, src/lib/prereqs.cjs
**Approach:** Purely additive changes -- new register-web skill, Step 4.5 in install (optional web setup with AskUserQuestion), Step 10.5 in init (auto-registration), validateWebPrereqs() in prereqs.cjs. All gated behind RAPID_WEB=true.
**Status:** Complete
