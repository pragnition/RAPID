# Quick Task 34: install-offer-uv-pip-guidance

**Description:** Currently the install breaks on many devices due to uv and the like not being installed. If this happens, the install agent should offer to install/tell the user how to install pip/uv.

**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 02a3d6e, 9c9b1fa, af24397
**Files Modified:**
- setup.sh
- skills/install/SKILL.md
- src/lib/prereqs.cjs
- src/lib/prereqs.test.cjs

## Changes
1. `setup.sh` now honors `RAPID_INSTALL_UV={auto,skip}` — auto runs Astral's installer and re-probes PATH (both `~/.local/bin` and legacy `~/.cargo/bin`); silent `[skip]` in Step 6 promoted to WARNING when auto-install was requested but failed.
2. `/rapid:install` SKILL.md adds Step 0.5: probes `uv`, offers `AskUserQuestion` with Yes/Skip/Show-manual, forwards env var to `setup.sh`.
3. `src/lib/prereqs.cjs` adds `uv` as optional prereq (required=false, minVersion=0.3); `hasWarnings` flips true when missing, `hasBlockers` unchanged. Test assertion count updated 3→4.

All 23 prereqs unit tests pass. `bash -n setup.sh` clean.
