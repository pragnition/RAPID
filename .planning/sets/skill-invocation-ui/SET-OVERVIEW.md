# SET-OVERVIEW: skill-invocation-ui

## Approach

This set builds the end-to-end user-facing path for launching RAPID skills (all ~30 SKILL.md files) from the web dashboard. The core problem is exposing skills as structured, validated, gallery-browsable actions without letting user input leak into shell interpolation or bypass skill preconditions. The strategy mirrors GitHub Actions `workflow_dispatch`: extend each SKILL.md with an `args:` frontmatter block (capped at ~10 inputs per skill, typed as string/choice/bool/multi-line/set-ref), parse all skills once at startup into a catalog, and drive both the gallery and the launcher modal from that catalog.

The UI side is a pure consumer of primitives introduced by the `wireframe-rollout` set -- StructuredQuestion, PageHeader, StatCard, SearchInput, ErrorCard, and the Composer-pattern textarea. SkillGallery is a component (not a page) embedded in AgentsPage's "Launch New Run" tab and ChatsPage's "New Chat" flow; SkillLauncher is a modal composed from the same primitives. Category filters split skills into autonomous / interactive / human-in-loop. Arrow-key navigation and the `bg-accent`/`text-bg-0` submit-button token pairing come straight from BRANDING.md.

The backend side enforces safety in three layers: a Zod-equivalent Python schema validates frontmatter at startup (loud failure, not silent omission); `sanitize_skill_args` wraps strings in `<user_input>` tags, enforces per-type length caps (4096 default, 32768 for multi-line), and rejects shell metacharacters in set-ref args; `check_preconditions` validates against live project state (e.g. `/execute-set` requires a plan) both pre-dispatch (to disable Submit + render blockers via ErrorCard) and server-side at dispatch time (400 on race). Sanitized args flow into `agent-runtime-foundation`'s `build_sdk_options` and `skill_runner.build_prompt` -- never onto a shell.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/*/SKILL.md (~30 files) | Add `args:` frontmatter per skill | Existing (extend) |
| web/backend/app/services/skill_catalog_service.py | Frontmatter parser, catalog cache, precondition checker | New |
| web/backend/app/routers/skills.py | `GET /api/skills`, `GET /api/skills/{name}`, `POST /api/skills/{name}/check-preconditions` | New |
| web/backend/app/services/skill_args_sanitizer.py | `sanitize_skill_args` -- tag wrapping, length caps, metachar rejection | New |
| web/backend/app/schemas/skill_frontmatter.py | Pydantic/Zod-equivalent schema for `args:` frontmatter | New |
| web/frontend/src/components/SkillGallery.tsx | Gallery component (StatCard grid, category filters, arrow-key nav) | New |
| web/frontend/src/components/SkillLauncher.tsx | Launcher modal (PageHeader + StructuredQuestion + Composer + SearchInput + ErrorCard) | New |
| web/frontend/src/components/RunLauncher.tsx | Modal wrapper around SkillLauncher | New |
| web/frontend/src/pages/AgentsPage.tsx | Host the "Launch New Run" tab consuming SkillGallery | Existing (integrate) |
| web/frontend/src/pages/ChatsPage.tsx | Host the "New Chat" flow consuming SkillGallery | Existing (integrate) |
| tests/backend/test_skill_catalog.py | Catalog parsing, precondition validation, all-30-skills coverage | New |
| tests/backend/test_skill_args_sanitizer.py | Shell-injection / length-cap / tag-wrapping tests | New |

## Integration Points

- **Exports:**
  - `skill_args_frontmatter_schema` -- extended SKILL.md frontmatter format consumed by catalog loader
  - `skill_catalog_service` -- `load_catalog()`, `get_skill(name)`, `check_preconditions(name, project_state)`
  - `skills_catalog_endpoint` -- `GET /api/skills`, `GET /api/skills/{name}`
  - `precondition_check_endpoint` -- `POST /api/skills/{name}/check-preconditions`
  - `sanitized_args_contract` -- `sanitize_skill_args(skill_name, raw_args) -> sanitized_args`
  - `skill_launcher_component` -- `<SkillLauncher skillName=string />`, `<RunLauncher />`
  - `skill_gallery_component` -- `<SkillGallery skills filters onPick />`

- **Imports (from `agent-runtime-foundation`):**
  - `POST /api/agents/runs` -- launcher posts here after local + server-side validation
  - `build_sdk_options(project_root, worktree, skill_name, skill_args, run_id)` -- sanitized args shape must match
  - `skill_runner.build_prompt(skill_name, sanitized_args)` -- foundation's prompt constructor consumes our sanitized output

- **Side Effects:**
  - Startup I/O: reads every `skills/*/SKILL.md` at process boot; cache reloads on file-watch in dev
  - Prompt construction: user args appear in the agent prompt wrapped in `<user_input>...</user_input>` tags
  - Startup failure mode: invalid frontmatter crashes boot loudly (by design, not silent)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shell injection through set-ref or string args | High | `sanitize_skill_args` rejects shell metacharacters in set-ref args; all args flow through SDK `ClaudeAgentOptions`, never via shell; behavioral test `args_never_shell_interpolated` enforces this |
| Missing or malformed `args:` frontmatter in any of ~30 SKILL.md files | High | CI test enforces `all_30_skills_in_catalog`; startup schema validation fails loudly on malformed frontmatter |
| Precondition race (user passes client check, state changes before dispatch) | Medium | Server-side second check rejects with 400; launcher treats 400 as a fresh precondition failure and re-renders via ErrorCard |
| `build_sdk_options` / `skill_runner` arg-shape drift with foundation set | Medium | Contract imports pin the function signatures; integration test covers sanitize -> build_sdk_options -> build_prompt end-to-end |
| Oversized input (DoS via huge multi-line args) | Medium | Per-type length caps (4096 / 32768); server rejects with 400 before reaching SDK |
| Gallery/launcher primitives not yet merged from `wireframe-rollout` | Medium | Consumption-only contract (`adopts_wireframe_primitives`); sequence after wireframe-rollout lands, or stub primitives locally during parallel development |
| ~30 SKILL.md edits touching every skill file -- merge conflict surface | Medium | Batch frontmatter edits in one wave; keep arg definitions minimal and per-skill scoped; no cross-skill coupling |
| Category taxonomy (autonomous / interactive / human-in-loop) misclassifies skills | Low | Treat `categories:` as a frontmatter field reviewed per-skill during Wave 1; filters are additive, not exclusive |

## Wave Breakdown (Preliminary)

- **Wave 1 -- Frontmatter schema and catalog foundation:** define the `args:` frontmatter schema (Pydantic/Zod-equivalent), implement `skill_catalog_service` with startup parsing + caching, extend all ~30 SKILL.md files with `args:` blocks (many will be `args: []`), add startup validation and the CI test for full catalog coverage.

- **Wave 2 -- Backend endpoints and sanitization:** implement `sanitize_skill_args` with tag wrapping, length caps, and metachar rejection; wire `GET /api/skills`, `GET /api/skills/{name}`, and `POST /api/skills/{name}/check-preconditions`; implement `check_preconditions` against project state; add unit tests for sanitizer and precondition checker.

- **Wave 3 -- Frontend components:** build `SkillGallery` (StatCard grid, category filters, arrow-key nav) and `SkillLauncher` / `RunLauncher` modal (PageHeader + StructuredQuestion + Composer textarea + SearchInput set-ref picker + ErrorCard blockers); consume primitives from `wireframe-rollout`.

- **Wave 4 -- Integration and polish:** embed `SkillGallery` in `AgentsPage`'s "Launch New Run" tab and `ChatsPage`'s "New Chat" flow; wire submit -> `POST /api/agents/runs` with the imported dispatch contract; end-to-end test (catalog -> launcher -> sanitize -> dispatch -> run_id); handle 400 precondition race by re-rendering ErrorCard.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
