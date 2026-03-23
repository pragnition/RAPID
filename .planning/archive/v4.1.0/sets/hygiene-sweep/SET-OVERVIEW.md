# SET-OVERVIEW: hygiene-sweep

## Approach

This set performs two independent codebase-wide search-and-replace sweeps to clean up stale references left over from the project's origin as a personal repo. The work is mechanical and low-risk, but touches many files (30+ across skills, roles, docs, and config), so correctness must be verified via automated grep assertions rather than manual review.

**Sweep 1 -- Repository URL correction:** All public-facing references to `fishjojo1/RAPID` must be updated to `pragnition/RAPID`. This affects documentation (DOCS.md, README.md), the plugin manifest (plugin.json), the LICENSE copyright line, and the systemd service documentation URL. Archive and planning files are excluded from modification since they represent historical records.

**Sweep 2 -- RAPID_ROOT removal:** Every skill preamble (26 files) and two role definition files contain a `RAPID_ROOT` variable computation that is no longer used -- the canonical preamble pattern now derives `.env` path from `CLAUDE_SKILL_DIR` directly. The RAPID_ROOT lines must be removed while preserving the rest of the preamble logic (RAPID_TOOLS loading and validation).

Both sweeps are independent of each other and can be done in parallel. Verification is a simple grep across the tree confirming zero remaining matches.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| DOCS.md | User-facing documentation | Existing -- URL fix |
| README.md | Project README | Existing -- URL fix |
| .claude-plugin/plugin.json | Plugin manifest (author, homepage, repository) | Existing -- URL + author fix |
| LICENSE | Copyright holder | Existing -- name fix |
| web/backend/service/rapid-web.service | Systemd service unit | Existing -- Documentation URL fix |
| skills/*/SKILL.md (26 files) | Skill preambles | Existing -- RAPID_ROOT removal |
| src/modules/roles/role-conflict-resolver.md | Conflict resolver role | Existing -- RAPID_ROOT removal |
| src/modules/roles/role-set-merger.md | Set merger role | Existing -- RAPID_ROOT removal |

## Integration Points

- **Exports:**
  - `clean-repo-references` -- All repository URLs point to pragnition/RAPID
  - `rapid-root-removal` -- All skill preambles use the canonical RAPID_TOOLS-only pattern without RAPID_ROOT
- **Imports:** None -- this set has zero dependencies on other sets
- **Side Effects:** The plugin manifest author name changes from "fishjojo1" to "pragnition", which affects how the plugin is displayed in the Claude plugin marketplace

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking skill preamble logic during RAPID_ROOT removal | High -- every skill command would fail | Verify each preamble still contains the `RAPID_TOOLS` loading and validation lines after edit; run grep to confirm pattern integrity |
| Missing fishjojo1 references in unexpected locations | Low -- incomplete cleanup | Run codebase-wide grep excluding .planning/archive/ and .git/ as final verification |
| Role .md files use a different RAPID_ROOT pattern than skills | Medium -- wrong substitution | The two role files use a shell-script style (`RAPID_ROOT="$(cd ...)"`) vs the skill preamble style (`RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."`); handle each pattern separately |
| plugin.json author field should match org name | Low -- cosmetic | Confirm desired author value with user if unclear; default to "pragnition" |

## Wave Breakdown (Preliminary)

- **Wave 1:** Repository URL sweep -- replace all `fishjojo1/RAPID` references with `pragnition/RAPID` across DOCS.md, README.md, plugin.json, LICENSE, and rapid-web.service; run verification grep
- **Wave 2:** RAPID_ROOT removal -- remove RAPID_ROOT computation lines from all 26 skill preambles and 2 role definition files; replace with the canonical `CLAUDE_SKILL_DIR`-based `.env` loading; run verification grep

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
