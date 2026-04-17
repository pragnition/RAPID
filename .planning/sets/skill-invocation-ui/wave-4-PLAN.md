# Wave 4 — AgentsPage / ChatsPage Integration and End-to-End Verification

## Objective

Embed the Wave 3 `SkillGallery` and `RunLauncher` into `AgentsPage` and `ChatsPage` with category-appropriate default filters, wire the submit → dispatch → navigate flow, and add an end-to-end test covering the full path (catalog fetch → launcher → sanitize → precondition check → dispatch → run_id). This wave closes the user-facing loop defined by CONTRACT behavioral clauses.

## Tasks

1. **Integrate SkillGallery + RunLauncher into AgentsPage.**
   - File: `web/frontend/src/pages/AgentsPage.tsx` (MODIFY — currently an 18-line EmptyState stub)
   - Action:
     - Imports: `useSkills`, `SkillGallery`, `RunLauncher`, types from `types/skills`.
     - State:
       - `const [filters, setFilters] = useState<GalleryFilters>({ categories: new Set<SkillCategory>(["autonomous", "human-in-loop"]), showAll: false, query: "" });`
       - `const [launcherSkill, setLauncherSkill] = useState<string | null>(null);`
     - Derive `projectId` from existing route/context (follow the pattern used by other pages — if `useProject()` hook exists, call it; otherwise pull from route params).
     - Fetch `const { data: skills = [] } = useSkills();`.
     - Filter logic: if `filters.showAll`, pass all skills to gallery; else filter to `skills.filter(s => s.categories.some(c => filters.categories.has(c)))`.
     - Render:
       ```tsx
       <SkillGallery skills={filteredSkills} filters={filters} onFiltersChange={setFilters} onPick={(s) => setLauncherSkill(s.name)} />
       <RunLauncher open={launcherSkill !== null} skillName={launcherSkill} projectId={projectId} onClose={() => setLauncherSkill(null)} onLaunched={(runId) => { setLauncherSkill(null); navigate(`/chats/${runId}`); }} />
       ```
     - `navigate` comes from `react-router-dom`'s `useNavigate`; follow the import pattern used by sibling pages. Navigation target `/chats/${runId}` is owned by the `agents-chats-tabs` set — we only call the route; we do not modify any routing config.
     - Remove the existing `<EmptyState>` stub.
   - Reference: CONTEXT Gallery-variants decision (AgentsPage defaults `autonomous + human-in-loop`); research finding H #6 (post-201 navigation).

2. **Integrate SkillGallery + RunLauncher into ChatsPage.**
   - File: `web/frontend/src/pages/ChatsPage.tsx` (MODIFY — currently an 18-line stub)
   - Action: same structure as AgentsPage, with two differences:
     - Default filters: `new Set<SkillCategory>(["interactive", "human-in-loop"])`.
     - Frame the gallery inside an explicit "New Chat" heading context (e.g., wrap with a `<section>` + `<h2>New Chat</h2>` — or if the page already has a tab/frame component pattern from wireframe-rollout for chat lists, reuse that; no new primitive).
     - Post-201 navigation target is the same `/chats/${runId}`.
   - Reference: CONTEXT Gallery-variants decision (ChatsPage defaults `interactive + human-in-loop`).

3. **Add "All skills" toggle wiring in the gallery filter bar.**
   - Files: `web/frontend/src/components/skills/SkillGallery.tsx` is already owned by Wave 3 — this wave does NOT modify it. Instead, AgentsPage/ChatsPage pass `filters.showAll` through the `onFiltersChange` flow already built in Wave 3. Task is verification-only: confirm toggle behavior by writing the integration test below; no code changes required beyond the page hosts.
   - Reference: CONTEXT Gallery-variants decision (toggle preserves discoverability).

4. **End-to-end integration test.**
   - File: `web/frontend/src/pages/__tests__/AgentsPage.integration.test.tsx` (NEW)
   - Action (vitest + RTL + MSW or fetch-mock equivalent already used in this codebase):
     - Mount `<AgentsPage />` inside a `MemoryRouter` + `QueryClientProvider`.
     - Mock `/api/skills` to return a realistic catalog including `plan-set` (autonomous) and `backlog` (interactive).
     - Assert: by default, `plan-set` card visible, `backlog` card NOT visible (filtered out by default autonomous+human-in-loop set).
     - Click the "All skills" toggle → `backlog` now visible.
     - Click `plan-set` card → RunLauncher modal opens, PageHeader shows "plan-set".
     - Mock `/api/skills/plan-set` returning its meta.
     - Mock `POST /api/skills/plan-set/check-preconditions` → `{ok: true, blockers: []}`.
     - Fill set-ref arg via SearchInput, click Submit.
     - Mock `POST /api/agents/runs` → 201 `{run_id: "run-abc"}`.
     - Assert `useNavigate` mock called with `/chats/run-abc`.
   - File: `web/frontend/src/pages/__tests__/ChatsPage.integration.test.tsx` (NEW)
   - Action: mirror the above but assert the interactive+human-in-loop default (e.g., `discuss-set` visible, `plan-set` filtered out until "All skills" toggle clicked).

5. **Add backend end-to-end test covering the dispatch path.**
   - File: `web/backend/tests/test_skills_end_to_end.py` (NEW)
   - Action: integration-style test using FastAPI TestClient:
     - Set up a tmp project with `.planning/STATE.json` + `.planning/sets/foo/CONTEXT.md` + `.planning/sets/foo/wave-1-PLAN.md` so `execute-set` preconditions pass.
     - `POST /api/skills/execute-set/check-preconditions` → 200 `{ok: true}`.
     - Call the Wave 2 `sanitize_skill_args(catalog.get("execute-set"), {"set": "foo"})` directly → assert wrapped output shape.
     - Call `build_prompt("execute-set", sanitized)` → assert the returned string contains `/rapid:execute-set` and `<user_input>foo</user_input>`.
     - Mock the `agent-runtime-foundation` `start_run` entry (patch `app.agents.session_manager.start_run`) → confirm the end-to-end payload shape lines up with `StartRunRequest`.
   - Reference: Research finding B (`StartRunRequest` shape); CONTRACT behavioral clauses `args_never_shell_interpolated`, `preconditions_block_dispatch`.

6. **Add a behavioral regression test for the 400 race.**
   - File: `web/backend/tests/test_skills_router.py` (MODIFIED — Wave 2 owns this file; Wave 4 appends ONE new test function to it)
   - Action: append `test_dispatch_race_returns_400_with_precondition_shape`: simulate a skill that passes pre-check then fails during actual dispatch (patch the downstream so it raises the precondition-failure error); assert response is 400 with a JSON body matching `{error: "PRECONDITION_FAILED", blockers: [...]}`.
   - **Note on shared ownership:** Wave 4 is explicitly permitted to append (not replace) this one test to the Wave 2 file because the race-path behavior can only be meaningfully tested once the dispatch wiring is integrated end-to-end. Wave 2's existing tests stay untouched.

## Verification

From `~/Projects/RAPID`:

```bash
cd web/frontend && npm run typecheck
cd web/frontend && npm run lint
cd web/frontend && npm test -- --run src/pages/__tests__/AgentsPage.integration.test.tsx
cd web/frontend && npm test -- --run src/pages/__tests__/ChatsPage.integration.test.tsx
cd web/backend && uv run pytest tests/test_skills_end_to_end.py -v
cd web/backend && uv run pytest tests/test_skills_router.py::test_dispatch_race_returns_400_with_precondition_shape -v
cd web/backend && uv run pytest tests/ -q    # full backend suite stays green
cd web/frontend && npm test -- --run     # full frontend suite stays green
cd web/backend && uv run uvicorn app.main:app --port 18123 &
sleep 2
curl -sf http://localhost:18123/api/skills | jq 'length'                              # ≥30
curl -sf http://localhost:18123/api/skills/_health | jq '.parse_errors | length'      # 0
kill %1
```

Expected: all tests pass; full backend + frontend suites remain green; health endpoint reports zero parse errors.

## Success Criteria

- `AgentsPage` renders SkillGallery defaulted to `autonomous + human-in-loop` with working "All skills" toggle.
- `ChatsPage` renders SkillGallery defaulted to `interactive + human-in-loop` with working "All skills" toggle.
- Clicking a skill card opens RunLauncher with correct skill meta loaded.
- Submit dispatches to `POST /api/agents/runs` and navigates to `/chats/{run_id}` on 201.
- 400 race path: submit → 400 precondition → ErrorCard updates, submit re-enabled, no navigation.
- End-to-end backend test exercises catalog → sanitize → build_prompt → dispatch pathway.
- Full backend + frontend test suites remain green (no regressions).

## File Ownership

New files owned by Wave 4 (exclusive):
- `web/frontend/src/pages/__tests__/AgentsPage.integration.test.tsx`
- `web/frontend/src/pages/__tests__/ChatsPage.integration.test.tsx`
- `web/backend/tests/test_skills_end_to_end.py`

Modified files (authoritative final-state owned by Wave 4):
- `web/frontend/src/pages/AgentsPage.tsx` — Wave 4 exclusive (Wave 3 did not touch).
- `web/frontend/src/pages/ChatsPage.tsx` — Wave 4 exclusive (Wave 3 did not touch).

Shared-but-append-only file (documented carve-out):
- `web/backend/tests/test_skills_router.py` — Wave 2 owns initial file creation and all existing tests; Wave 4 appends exactly one new test function (`test_dispatch_race_returns_400_with_precondition_shape`). Final state combines both waves' contributions.

Wave 4 does NOT touch:
- Any Wave 3 component or hook source file.
- Any Wave 1-2 backend service or router source file (except the one append described above).
- Any routing config, global layout, or primitive module.
