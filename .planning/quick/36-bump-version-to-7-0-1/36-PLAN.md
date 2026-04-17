# Quick Task 36 -- Bump RAPID from v7.0.0 to v7.0.1

## Objective

Cut a patch release of RAPID on top of the shipped v7.0.0 milestone. Sweep the version string across the required files per `/home/kek/Projects/RAPID/bump-version.md`, ship the v7.0.0 CHANGELOG section with today's date (2026-04-18) and a categorized summary of the commits that landed since the v7.0.0 header was added, then open a fresh `## [v7.0.1] (in progress)` section for future patch work.

Execute in-place on the current branch. No worktree, no set lifecycle. Single commit at the end.

## Scope Guardrails

Follow the "Do NOT Update" list in `bump-version.md` strictly:

- **Do NOT touch** `.planning/archive/`, `.planning/research/v*.md`, `package-lock.json`, past milestone entries in `.planning/STATE.json` (e.g., the `"id": "v7.0.0"` milestone entry), or `ROADMAP.md` historical entries.
- **`STATE.json.currentMilestone` stays `"v7.0.0"`.** The milestone ID is the shipping milestone; v7.0.1 is a patch on top, not a new milestone. Only `rapidVersion` changes.
- **`127.0.0.1` matches in the grep are NOT version refs.** The verification grep will surface host/port matches in `src/lib/web-client.cjs`, `branding-server.cjs`, `web/frontend/vite.config.ts`, and `docs/configuration.md`. Do NOT edit these.
- **`package-lock.json` transitive-dep versions** (e.g., `data-urls` 7.0.0, vite peer ranges) are unrelated to RAPID's version. Do NOT edit.

## Tasks

### Task 1: Bump version strings in the four state/manifest files

**Files to modify:**
- `/home/kek/Projects/RAPID/package.json` -- `"version": "7.0.0"` -> `"7.0.1"`
- `/home/kek/Projects/RAPID/.claude-plugin/plugin.json` -- `"version": "7.0.0"` -> `"7.0.1"`
- `/home/kek/Projects/RAPID/.planning/config.json` -- `project.version: "7.0.0"` -> `"7.0.1"`
- `/home/kek/Projects/RAPID/.planning/STATE.json` -- top-level `"rapidVersion": "7.0.0"` -> `"7.0.1"` ONLY. Do NOT touch `currentMilestone` or the milestone entry at line ~720 (`"id": "v7.0.0"`).

**Action:** Use `Edit` with exact old_string matches. For STATE.json, anchor the replacement on `"rapidVersion": "7.0.0"` so it only matches the top-level field, not the historical milestone ID.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && \
  jq -r '.version' package.json && \
  jq -r '.version' .claude-plugin/plugin.json && \
  jq -r '.project.version' .planning/config.json && \
  jq -r '.rapidVersion' .planning/STATE.json && \
  jq -r '.currentMilestone' .planning/STATE.json
```

**Done criteria:** First four lines print `7.0.1`. Fifth line prints `v7.0.0` (milestone ID unchanged).

---

### Task 2: Bump `vX.Y.Z` references in the three skill files

**Files to modify:**
- `/home/kek/Projects/RAPID/skills/help/SKILL.md`
- `/home/kek/Projects/RAPID/skills/install/SKILL.md`
- `/home/kek/Projects/RAPID/skills/status/SKILL.md`

**Action:** For each file, use `Edit` with `replace_all: true` to swap every `v7.0.0` -> `v7.0.1`. Per the bump-version.md guide, install/SKILL.md's description frontmatter field must also be updated (replace_all handles this).

Known call sites from pre-task grep (for the executor's reference -- do not copy verbatim, use replace_all):
- `skills/help/SKILL.md:22,137` -- "RAPID v7.0.0 Workflow" and footer tagline
- `skills/install/SKILL.md:2,9,11,30,140,367,379` -- description, intro, marketplace-cache note, AskUserQuestion text, completion header
- `skills/status/SKILL.md:8,10,186,227,263` -- header, intro, next-action guidance, code-comment references

**Leave untouched:** The longstanding prose anomaly on `skills/install/SKILL.md:30` ("You are on version 3.0") is pre-existing and unrelated to this bump -- flag if encountered but do not edit in scope.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && \
  grep -n "v7\.0\.0" skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md || echo "CLEAN: no v7.0.0 references in skill files"
```

**Done criteria:** Output is exactly `CLEAN: no v7.0.0 references in skill files`.

---

### Task 3: Ship v7.0.0 in CHANGELOG and open v7.0.1 section

**File to modify:** `/home/kek/Projects/RAPID/docs/CHANGELOG.md`

**Current state (line 9):**
```markdown
## [v7.0.0] (in progress)

This milestone is currently under development. Subsections will be populated by `/rapid:documentation` when the milestone ships.
```

**Action:**
1. First, pull the full commit list since the v7.0.0 header was added:
   ```bash
   cd /home/kek/Projects/RAPID && git log 75b9414..HEAD --oneline
   ```
2. Replace the two lines above with:
   - A new `## [v7.0.1] (in progress)` section at the top (stub content matching the prior "in progress" style: one sentence noting it's under development).
   - A fully populated `## [v7.0.0] (shipped 2026-04-18)` section directly below it.

The v7.0.0 section must follow the existing `Added / Changed / Fixed` structure seen in v6.3.0, v6.2.0, and v6.1.0 entries in the same file. Each bullet should end with a parenthetical tag derived from the commit's scope (e.g., `` (`add-logging-to-backend`) ``, `` (`kanban-agent-selection`) ``, `` (`bug-fix`) ``). **Group commits by scope** -- multi-commit quick tasks (e.g., the four `add-logging-to-backend` commits) collapse into one bullet summarizing the feature, not four bullets.

**Category assignment rules:**
- `feat(...)` and `quick(...)` that add new surface area -> **Added**
- `quick(...)` / commits that modify existing behavior (e.g., `start-set-pending-dropdown-canonical-order`, `discuss-set-skip-self-interview`, `install-offer-uv-pip-guidance`, `readme-made-with-love-banner`) -> **Changed**
- `fix(...)` commits -> **Fixed**
- `docs(...)` -> fold into **Changed** (or omit if purely WIP like `nightshift`)
- `test(...)` -> fold into the same bullet as the feature it tests (do not list separately)

Reference commit cluster (authoritative list via the `git log` command above):
- Quick task 21 `add-logging-to-backend` (4 commits) -> Added
- Quick task 22 `ask-user-option-selection-highlight` (3 commits) -> Changed
- Quick task 23 `activity-tab-markdown-rendering` (3 commits) -> Added
- Quick task 24 `print-the-word-hi` (2 commits) -> skip (not user-facing; judgment call -- may omit)
- Quick task 25 `autopilot-agent-completed-tag` (3 commits) -> Added
- Quick task 26 `kanban-card-modal-and-ignore-toggle` (2 commits) -> Added
- Quick task 27 `kanban-agent-selection` (3 commits) -> Added
- Quick task 28 `agent-chat-and-persistent-sessions` (5 commits incl. materialize-run-history) -> Added
- Quick task 29 `dont-disconnect-agents-on-pending-questions` (3 commits) -> Fixed
- Quick task 30 `add-set-shows-a-dropdown-of-current-sets` (4 commits) -> Changed
- Quick task 31 `discuss-set-skip-self-interview` (4 commits) -> Changed
- Quick task 32 `start-set-pending-dropdown-canonical-order` (4 commits) -> Changed
- Quick task 33 `collapsible-tool-calls-drawer` (4 commits) -> Added
- Quick task 34 `install-offer-uv-pip-guidance` (4 commits) -> Changed
- Quick task 35 `readme-made-with-love-banner` (2 commits) -> Changed
- `feat(agents-wip)` permission system / AskUserModal rewrite -> Added (mark as in-progress if appropriate)
- `docs(nightshift)` design proposal draft -> Changed (or omit; design-only, not shipped)
- Standalone `fix(bug-fix)` commits (many: alembic FK, check_port_available PID naming, systemd install upgrade, install fish verify, setup.sh vite build, autopilot allowed-tools frontmatter, idle in AgentRunResponse, AUQ bridge is_error flip, set dropdown current-milestone filter, set-ref native select, set-ref autocomplete, setId precondition, kanban drop-zone feedback, ask_user persistence, conversation history in chat, ask_user tool_use_id, AUQ dict options, missing GET /api/agents/runs, chat SSE streaming, dag_service nodes->sets, AgentsPage empty states) -> **Fixed**

The executor should read the full `git log 75b9414..HEAD --oneline` output and produce the final categorized bullet list; the cluster summary above is a starting scaffold, not the literal text to write.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && \
  head -20 docs/CHANGELOG.md && \
  echo "---" && \
  grep -c "^## \[v7\.0\.1\] (in progress)" docs/CHANGELOG.md && \
  grep -c "^## \[v7\.0\.0\] (shipped 2026-04-18)" docs/CHANGELOG.md
```

**Done criteria:**
- The two `grep -c` lines each print `1`.
- The `head -20` output shows `v7.0.1 (in progress)` first, then `v7.0.0 (shipped 2026-04-18)` with populated `### Added`, `### Changed`, `### Fixed` subsections underneath.
- No `(in progress)` remains on the `v7.0.0` line.

---

### Task 4: Verify no stale `7.0.0` references remain outside the allowed list

Run the verification grep from `bump-version.md` and manually confirm every remaining hit is on the allow-list.

**Command:**
```bash
cd /home/kek/Projects/RAPID && \
  grep -rn "7\.0\.0" \
    --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" \
    --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive --exclude-dir=archive \
    .
```

**Allow-list (expected hits, DO NOT fix these):**
- `docs/CHANGELOG.md` -- the new `## [v7.0.0] (shipped 2026-04-18)` header from Task 3.
- `.planning/STATE.json` -- the historical milestone entry `"id": "v7.0.0"` (~line 720) and `"currentMilestone": "v7.0.0"` (line 5).
- `.planning/archive/**` -- historical, excluded by policy (`--exclude-dir=archive` should filter, but the grep above only excludes dirs named `archive`, not `.planning/archive`). Visually skip any `.planning/archive/` hits if they appear.
- `.planning/research/v*.md` -- historical, skip visually if present.
- `web/frontend/package-lock.json` -- transitive deps (`data-urls@7.0.0`, vite peer ranges `^7.0.0`). Skip.
- `.planning/ROADMAP.md` -- past milestone headers (e.g., the v7.0.0 milestone entry). Skip.
- Any `127.0.0.1` host matches in `src/lib/*.cjs`, `web/frontend/vite.config.ts`, `docs/configuration.md`, `skills/install/SKILL.md`, `skills/register-web/SKILL.md`. Skip.
- The prose anomaly `skills/install/SKILL.md:30` "You are on version 3.0" -- leave as-is (pre-existing, out of scope).
- `.planning/quick/19-bump-to-7-0-0/`, `.planning/quick/20-bump-claude-plugin-to-7-0-0/` -- historical quick-task directories from the v7.0.0 bump itself. Skip.
- `.planning/quick/36-bump-version-to-7-0-1/36-PLAN.md` (this file) -- contains `7.0.0` in prose describing the bump. Skip.

**Disallowed hits (must be zero):**
- Any remaining `v7.0.0` in `skills/help/SKILL.md`, `skills/install/SKILL.md`, `skills/status/SKILL.md` (beyond the pre-existing "version 3.0" prose).
- Any `"version": "7.0.0"` in `package.json`, `.claude-plugin/plugin.json`, `.planning/config.json`.
- Any `"rapidVersion": "7.0.0"` at the top of `.planning/STATE.json`.

**Done criteria:** Every line of grep output is on the allow-list. If anything else appears, fix it before reporting COMPLETE.

**Belt-and-suspenders check** -- narrow grep for the three skill files and top-level manifest fields:
```bash
cd /home/kek/Projects/RAPID && \
  grep -n "v7\.0\.0\|\"version\": \"7\.0\.0\"\|\"rapidVersion\": \"7\.0\.0\"" \
    package.json .claude-plugin/plugin.json .planning/config.json \
    skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md \
  || echo "CLEAN"
```

Must print `CLEAN`.

---

## Commit

After all four tasks pass their verification steps, stage exactly these files (and no others) and commit:

```bash
cd /home/kek/Projects/RAPID && \
  git add package.json .claude-plugin/plugin.json .planning/config.json .planning/STATE.json \
          docs/CHANGELOG.md \
          skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md \
          .planning/quick/36-bump-version-to-7-0-1/36-PLAN.md && \
  git status --short
```

Expected `git status --short` output: only the nine files above marked `M` or `A`. If anything else is staged, `git restore --staged <file>` before committing.

**Commit message:**
```
quick(bump-version-to-7-0-1): bump RAPID to v7.0.1 and ship v7.0.0 changelog
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && git log -1 --oneline && git log -1 --stat | tail -15
```

**Done criteria:** Single commit hash printed, all nine files listed in the stat, no additional files.

---

### Task 5: Update documentation files and README Mission Control section

**Precedent:** git commit `aee0dba quick(bump-to-7-0-0): update stale version refs in docs and context files to 7.0.0` established that README/DOCS/technical_documentation/.planning/context files ARE bumped during version updates. The `bump-version.md` guide under-specifies this but historical practice requires it.

**User requirement added mid-plan:** The README must also include information about Mission Control, the web dashboard that was substantially overhauled in v7.0.0 (SDK-backed Agents tab, Chats tab, Kanban autopilot, browser-native skill invocation). The current README makes zero mention of it.

**5a. Bump stale version refs:**

Files to modify (exact line numbers from pre-scout):
- `/home/kek/Projects/RAPID/README.md:6` — `version-7.0.0` badge URL → `version-7.0.1`
- `/home/kek/Projects/RAPID/README.md:146` — `Latest: **v7.0.0** (in progress)` → `Latest: **v7.0.1** (in progress)` (patch is the current in-progress work)
- `/home/kek/Projects/RAPID/DOCS.md:479` — `RAPID v7.0.0 structures parallel work` → `RAPID v7.0.1 structures parallel work`
- `/home/kek/Projects/RAPID/technical_documentation.md:3,73,96` — three `v7.0.0` prose references → `v7.0.1`
- `/home/kek/Projects/RAPID/.planning/context/ARCHITECTURE.md:109,111` — headings/prose (`## v7.0.0 Subsystems`, `Three subsystems landed in v7.0.0`) — **KEEP these as v7.0.0** because they reference the milestone ID when the subsystems landed, not the current RAPID version. This is a historical statement. Flag but do not edit.
- `/home/kek/Projects/RAPID/.planning/context/CODEBASE.md:134` — `The v7.0.0 pin policy` — **KEEP as v7.0.0**, same reason (policy was introduced in the v7.0.0 milestone).

Confirm: only the README.md (2 hits), DOCS.md (1 hit), technical_documentation.md (3 hits) are bumped. Context files stay as v7.0.0 (historical milestone references).

**5b. Add Mission Control section to README.md:**

Insert a new `## Mission Control` H2 section in `README.md` between the existing `## Architecture` section (ends ~line 128) and `## Command Reference` (starts ~line 130).

Content (authored by the executor; guidance below):
- 1-2 sentence intro: Mission Control is RAPID's local web dashboard (FastAPI + React) that runs at `localhost:<port>`, giving a browser-native view of sets, waves, kanban board, and now (new in v7.0.0) **autonomous agent runs** and **chat sessions** driven by the Claude Agent SDK.
- Bullet list of what's new / what it offers (keep to 4–6 bullets max):
  - **Agents tab** — browser-invokable skills (plan-set, execute-set, review, merge, etc.) with real-time SSE event streaming, `AskUserQuestion` prompts surfaced as browser modals via the `webui_ask_user` MCP tool bridge.
  - **Chats tab** — persistent conversational sessions with transcripts, materialized run history, and 15-minute idle timeout.
  - **Kanban board** — SQLite-backed canonical board with agent autopilot; agents can claim, move, and update cards via in-process MCP tools.
  - **Autopilot poller** — backend-managed dispatcher that claims cards from autopilot-enabled columns and runs agents against them end-to-end.
  - **Safety rails** — per-skill `permission_mode` defaults, `disallowed_tools` for destructive operations, per-project daily token caps, and `can_use_tool` gating for every agent invocation.
- Getting started line: set `RAPID_WEB=true` before `/rapid:init`, or run `/rapid:register-web` in an existing project. Link to `[DOCS.md](DOCS.md)` for the full dashboard reference.

Style must match the rest of the README: terse, sentence-case headings, no emoji, anchor links wrapped in backticks, keep third-person descriptive voice. Do NOT invent features not in the v7.0.0 research docs or recent commits — if uncertain about a feature, read `.planning/research/v7.0.0-synthesis.md` first.

**5c. Update Command Reference table in README.md:**

The existing table (lines ~132–141) lists only 7 commands but the file says "all 30 commands" at line 142. Leave the table as-is (truncation is intentional), but ensure the trailer text still accurately says "all 30 commands" — verify the current DOCS.md command count matches.

**Files modified by Task 5:** `README.md`, `DOCS.md`, `technical_documentation.md` (3 files).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && \
  grep -n "v7\.0\.0\|version-7\.0\.0" README.md DOCS.md technical_documentation.md | \
    grep -v "## v7\.0\.0 Subsystems" | \
    grep -v "pin policy" || echo "CLEAN: no stale version refs in top-level docs"
echo "---"
grep -c "^## Mission Control" /home/kek/Projects/RAPID/README.md
```

**Done criteria:**
- First grep prints `CLEAN: no stale version refs in top-level docs`.
- Second grep prints `1` (the new Mission Control H2 heading exists).
- `README.md` badge URL shows `version-7.0.1`.
- Mission Control section is placed between `## Architecture` and `## Command Reference`.

---

## Commit (updated)

Stage ADDITIONAL files from Task 5 (on top of the original 9):

```bash
cd /home/kek/Projects/RAPID && \
  git add package.json .claude-plugin/plugin.json .planning/config.json .planning/STATE.json \
          docs/CHANGELOG.md \
          skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md \
          README.md DOCS.md technical_documentation.md \
          .planning/quick/36-bump-version-to-7-0-1/36-PLAN.md && \
  git status --short
```

Expected `git status --short` output: exactly twelve files above marked `M` or `A`. No context-file changes (ARCHITECTURE.md, CODEBASE.md stay unchanged).

**Commit message (unchanged):**
```
quick(bump-version-to-7-0-1): bump RAPID to v7.0.1, ship v7.0.0 changelog, document Mission Control in README
```

---

## Success Criteria (Overall)

- [ ] All four manifest/state files report version `7.0.1` (Task 1 verification passes).
- [ ] No `v7.0.0` strings remain in the three skill files (Task 2 verification prints `CLEAN`).
- [ ] `docs/CHANGELOG.md` has `## [v7.0.1] (in progress)` followed by `## [v7.0.0] (shipped 2026-04-18)` with populated Added/Changed/Fixed subsections summarizing the 75b9414..HEAD commit range (Task 3 verification passes).
- [ ] Broad grep for `7\.0\.0` yields only allow-listed hits, with the allow-list extended to cover historical milestone refs in `.planning/context/*.md` and the unchanged quick-task directories (Task 4 verification passes).
- [ ] Belt-and-suspenders narrow grep prints `CLEAN` (Task 4).
- [ ] README.md, DOCS.md, technical_documentation.md bumped for prose/badge version refs; context files intentionally unchanged (Task 5a).
- [ ] README.md has a new `## Mission Control` section between Architecture and Command Reference describing v7.0.0's dashboard capabilities (Task 5b).
- [ ] Single commit landed on the current branch, exactly twelve files changed (commit step verification passes).
