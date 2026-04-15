# Wave 3 — Frontend SkillGallery, SkillLauncher, RunLauncher

## Objective

Build the React components that consume the Wave 2 catalog: `SkillGallery` (StatCard grid with category filters and arrow-key navigation), `SkillLauncher` (form modal composed from wireframe-rollout primitives), and `RunLauncher` (modal wrapper). Add the supporting TanStack Query hooks and the debounced-value hook for precondition re-checks. No integration into pages happens in this wave (Wave 4 owns that).

## Tasks

1. **Type definitions for the catalog API.**
   - File: `web/frontend/src/types/skills.ts` (NEW)
   - Action:
     - `export type SkillArgType = "string" | "choice" | "bool" | "multi-line" | "set-ref";`
     - `export type SkillCategory = "autonomous" | "interactive" | "human-in-loop";`
     - `export interface SkillArg { name: string; type: SkillArgType; description: string; required: boolean; default?: string | boolean | null; choices?: string[]; maxLength?: number; }`
     - `export interface SkillMeta { name: string; description: string; args: SkillArg[]; categories: SkillCategory[]; allowedTools: string; sourcePath: string; }`
     - `export interface PreconditionBlocker { code: string; message: string; arg?: string; }`
     - `export interface PreconditionCheckResponse { ok: boolean; blockers: PreconditionBlocker[]; }`
     - `export interface GalleryFilters { categories: Set<SkillCategory>; query?: string; showAll?: boolean; }`
   - Reference: CONTRACT export shapes; Wave 2 `SkillMetaOut`.

2. **Catalog hook.**
   - File: `web/frontend/src/hooks/useSkills.ts` (NEW)
   - Action:
     - `export function useSkills(): UseQueryResult<SkillMeta[]>` — `useQuery({ queryKey: ['skills'], queryFn: () => apiClient.get<SkillMeta[]>('/api/skills'), staleTime: 60_000 })`.
     - `export function useSkill(name: string | null): UseQueryResult<SkillMeta>` — disabled when `name === null`; key `['skills', name]`; path `/api/skills/${name}`.
   - Reference: Research finding D (apiClient, react-query).

3. **Debounced-value hook.**
   - File: `web/frontend/src/hooks/useDebouncedValue.ts` (NEW)
   - Action: Standard `useDebouncedValue<T>(value: T, delayMs = 500): T`. Implemented with `useEffect` + `setTimeout` + cleanup. No external deps.
   - Reference: Research finding F.

4. **Preconditions hook.**
   - File: `web/frontend/src/hooks/useSkillPreconditions.ts` (NEW)
   - Action:
     - `export function useSkillPreconditions(opts: { skillName: string | null; projectId: string; skillArgs: Record<string, unknown>; setId?: string | null; }): UseQueryResult<PreconditionCheckResponse>`.
     - Compute `argsHash = JSON.stringify(skillArgs)`; pass debounced version through `useDebouncedValue(argsHash, 500)`. Query key `['preconditions', skillName, debouncedHash]`. Disabled when `skillName === null`. `queryFn` does `apiClient.post('/api/skills/${name}/check-preconditions', {projectId, skillArgs, setId})`.
     - Also export `async function runPreconditionCheck(...)` for the Submit-click hard re-check (non-debounced) — imperative, returns the raw response.
   - Reference: Research finding F (debounced hook + hard check on submit).

5. **Gallery component.**
   - File: `web/frontend/src/components/skills/SkillGallery.tsx` (NEW)
   - Action:
     - Props: `{ skills: SkillMeta[]; filters: GalleryFilters; onFiltersChange?: (f: GalleryFilters) => void; onPick: (skill: SkillMeta) => void; }`.
     - Top band: `PageHeader` from `components/primitives` with `title="Skills"` and `description` showing total count; `actions` slot holds the filter chips (autonomous / interactive / human-in-loop toggle + an "All skills" toggle from `filters.showAll`).
     - Below header: a search `SearchInput` bound to `filters.query` (optional).
     - Main grid: group skills by `categories[0]` (primary category). Within each group, sort alphabetically by name. Render a `StatCard`-patterned card per skill showing:
       - Title = `skill.name`
       - Body lines: description (truncated to ~2 lines), `args: {n}` count, categories as small chips.
       - Card click → `onPick(skill)`.
     - Arrow-key navigation: capture ArrowUp/Down/Left/Right at the grid container (not at window). Maintain `focusedIndex` state across flattened sorted list (category-banded). Enter activates `onPick(skills[focusedIndex])`. Wrap-around within the flattened list.
     - Empty state: when filtered set is empty, render `EmptyState` with copy "No skills match these filters. Try toggling 'All skills' to widen the view."
     - Must NOT introduce new primitives; compose strictly from `primitives/index.ts`.
   - Reference: CONTRACT `skill_gallery_component`, `adopts_wireframe_primitives`; research finding D.

6. **ArgField dispatcher.**
   - File: `web/frontend/src/components/skills/ArgField.tsx` (NEW)
   - Action:
     - Props: `{ arg: SkillArg; value: unknown; onChange: (v: unknown) => void; blocker?: PreconditionBlocker; setSuggestions?: string[]; }`.
     - Dispatch on `arg.type`:
       - `string`: single-line text input (use a plain styled `<input>` — SearchInput is reserved for set-ref). Show "default" marker pill next to label when `value === arg.default` and `arg.default != null`.
       - `multi-line`: `Composer`-pattern `<textarea>` with auto-grow 22→200px (reuse existing logic from `Composer` primitive via prop composition if possible — otherwise inline the same resize behavior).
       - `bool`: `StructuredQuestion` with two options `[{value: "true", label: "Yes"}, {value: "false", label: "No"}]`; convert string ↔ boolean in `onChange`.
       - `choice`: `StructuredQuestion` with one option per entry in `arg.choices`.
       - `set-ref`: `SearchInput` with optional `setSuggestions` rendered in a popover below the input (popover is a local component in this file — simple absolutely-positioned list, no new primitive). When user selects a suggestion, `onChange` fires. Free typing also calls `onChange`. Shape regex is server-validated; client-side only hints via the suggestion list.
     - Render the `arg.description` under the field as a subdued caption.
     - When `blocker` is set, render its message in an inline muted-error style directly below the field (per CONTEXT precondition error display decision).
   - Reference: Research finding D (StructuredQuestion must get `value`+`onChange`; SearchInput has no built-in dropdown).

7. **SkillLauncher form.**
   - File: `web/frontend/src/components/skills/SkillLauncher.tsx` (NEW)
   - Action:
     - Props: `{ skillName: string; projectId: string; defaultSetId?: string; onDispatched: (runId: string) => void; onCancel: () => void; }`.
     - Fetches skill via `useSkill(skillName)`. While loading, show `PageHeader` + spinner-or-placeholder (no new primitive — can reuse existing loading patterns).
     - Once loaded:
       - `PageHeader` at top: `title=skill.name`, `description=skill.description`, `breadcrumb={[{ label: "Skills", href: "#" }]}`, `actions=<submit button + cancel button>`. Submit button uses `bg-accent text-bg-0` token classes per BRANDING.
       - State: `formValues: Record<string, unknown>` initialized from each arg's `default` (or empty per type). `formValues[setRefArg.name] = defaultSetId` if provided.
       - Required args rendered inline; optional args inside a `<details>`-style "Show optional inputs (N)" disclosure (local collapse, no new primitive).
       - Hook `useSkillPreconditions({skillName, projectId, skillArgs: formValues, setId: defaultSetId ?? null})` drives the blocker state.
       - Map blockers: blockers with `arg` go inline on that field via `ArgField.blocker`; blockers with no `arg` render as a single top `ErrorCard` above the form (title="Cannot launch", body=bullet list of blocker messages).
       - Submit button disabled while any blocker exists OR while mutation is pending.
       - `onSubmit`: call `runPreconditionCheck` (hard, non-debounced). If `ok:false`, update blocker state and abort. If `ok:true`, POST to `/api/agents/runs` via `apiClient.post` with body `{project_id, skill_name: skillName, skill_args: formValues, prompt: buildClientPromptPreview(skill, formValues), set_id: defaultSetId, worktree: null}`.
         - `buildClientPromptPreview` is a LOCAL helper in this file that produces a best-effort prompt string for the `prompt` required field of `StartRunRequest`. Actual authoritative prompt is built server-side by `build_prompt`; this field only satisfies the `min_length=1` constraint. Keep it simple: `/rapid:${skillName} ${JSON.stringify(formValues)}`.
         - On 201: call `onDispatched(response.run_id)`.
         - On 400 with precondition shape: extract blockers from response body, overwrite local blocker state, re-enable Submit. Do NOT call `onDispatched`.
     - For set-ref args, optionally fetch `/api/projects/{projectId}/sets` (existing endpoint, likely already present) to populate `setSuggestions` on ArgField — guarded with feature detection: if the endpoint 404s, degrade to free-text only.
   - Reference: CONTRACT `skill_launcher_component`, CONTEXT launcher form layout decision, research finding B (StartRunRequest.prompt min_length=1).

8. **RunLauncher modal wrapper.**
   - File: `web/frontend/src/components/skills/RunLauncher.tsx` (NEW)
   - Action:
     - Props: `{ open: boolean; skillName: string | null; projectId: string; defaultSetId?: string; onClose: () => void; onLaunched: (runId: string) => void; }`.
     - Renders a modal container (portal-backed div with backdrop; see existing modal patterns in the codebase — if none, create a minimal local modal using the same class tokens as `SurfaceCard`). Inside, render `<SkillLauncher skillName=... projectId=... defaultSetId=... onDispatched=(runId) => { onLaunched(runId); onClose(); } onCancel={onClose} />` when `open && skillName`.
     - Escape key closes. Backdrop click closes.
     - No new primitives.
   - Reference: CONTRACT `skill_launcher_component`.

9. **Add frontend tests.**
   - File: `web/frontend/src/components/skills/__tests__/SkillGallery.test.tsx` (NEW)
   - Action (vitest + React Testing Library):
     - `renders category-banded sorted list`: pass 6 mock skills across 3 categories, assert cards grouped and sorted alphabetically within band.
     - `arrow-down moves focus to next card`: mount, keyDown ArrowDown, assert focused card changes.
     - `enter activates onPick`: focused + Enter → onPick called with right skill.
     - `empty state when no matches`: filter category-set excludes all skills → EmptyState rendered.
   - File: `web/frontend/src/components/skills/__tests__/SkillLauncher.test.tsx` (NEW)
   - Action:
     - `renders args from catalog fetch`: mock `useSkill` returning plan-set meta; assert set-ref SearchInput rendered.
     - `disables submit while blockers exist`: mock preconditions returning `{ok:false, blockers:[{code:"X", message:"no plan"}]}`; assert submit button disabled.
     - `inline blocker renders under named arg`: blocker with `arg:"set"` → message rendered near the set field.
     - `submit posts to /api/agents/runs and fires onDispatched with run_id`: mock apiClient, assert POST body shape and callback invocation.
     - `handles 400 precondition race`: submit → 400 with blockers → UI updates, onDispatched NOT called.
   - File: `web/frontend/src/hooks/__tests__/useDebouncedValue.test.ts` (NEW)
   - Action: standard fake-timers test asserting debounce behavior.

## Verification

From `~/Projects/RAPID`:

```bash
cd web/frontend && npm run typecheck
cd web/frontend && npm run lint
cd web/frontend && npm test -- --run src/components/skills
cd web/frontend && npm test -- --run src/hooks/__tests__/useDebouncedValue.test.ts
grep -rE "from ['\"]\\.\\./primitives['\"]|from ['\"]@/components/primitives['\"]" web/frontend/src/components/skills/   # proves primitive composition
```

Expected: typecheck clean; lint clean; all skill component tests pass; debounced-value hook tests pass; grep shows SkillGallery/SkillLauncher import only from `primitives/` (no self-invented primitive modules).

## Success Criteria

- `SkillGallery` consumes only wireframe-rollout primitives (PageHeader, SearchInput, StatCard-pattern cards, EmptyState).
- Arrow-key navigation works across category-banded grid.
- `SkillLauncher` renders one field per arg using the correct primitive (StructuredQuestion for bool/choice, Composer-style textarea for multi-line, SearchInput for set-ref, styled input for string).
- Defaults pre-filled with visible "default" marker.
- Debounced precondition check (500ms) runs on args change.
- Hard precondition re-check runs on submit; 400 response updates ErrorCard and re-enables Submit.
- `RunLauncher` is a modal wrapper around `SkillLauncher` with Escape/backdrop close.
- Submit POST to `/api/agents/runs` fires `onDispatched(run_id)` on 201.
- Frontend typecheck, lint, and component tests all pass.

## File Ownership

New files owned by Wave 3 (exclusive):
- `web/frontend/src/types/skills.ts`
- `web/frontend/src/hooks/useSkills.ts`
- `web/frontend/src/hooks/useSkillPreconditions.ts`
- `web/frontend/src/hooks/useDebouncedValue.ts`
- `web/frontend/src/components/skills/SkillGallery.tsx`
- `web/frontend/src/components/skills/SkillLauncher.tsx`
- `web/frontend/src/components/skills/RunLauncher.tsx`
- `web/frontend/src/components/skills/ArgField.tsx`
- `web/frontend/src/components/skills/__tests__/SkillGallery.test.tsx`
- `web/frontend/src/components/skills/__tests__/SkillLauncher.test.tsx`
- `web/frontend/src/hooks/__tests__/useDebouncedValue.test.ts`

Wave 3 does NOT touch:
- `AgentsPage.tsx`, `ChatsPage.tsx` (Wave 4 owns integration).
- Any file under `web/backend/` (Waves 1-2 exclusive).
- Any existing primitive in `web/frontend/src/components/primitives/` (consumption only).
