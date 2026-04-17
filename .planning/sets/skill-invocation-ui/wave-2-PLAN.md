# Wave 2 — Backend Endpoints, Sanitization, Preconditions, Contract Revision

## Objective

Build the HTTP surface and safety layers that expose the Wave 1 catalog to the frontend: `/api/skills` + `/api/skills/{name}` + `/api/skills/{name}/check-preconditions`, the `sanitize_skill_args` function with tag wrapping + length caps + shape-only set-ref validation, a shallow centralized precondition registry, and a local `build_prompt` helper that satisfies the `skill_runner_contract` import. Also revise `CONTRACT.json` to drop the shell-metachar set-ref clause.

## Tasks

1. **Define catalog and precondition schemas.**
   - File: `web/backend/app/schemas/skills.py` (NEW)
   - Action: Pydantic v2 models used by the router:
     - `class SkillArgOut(BaseModel)`: mirrors `SkillArg` but with `max_length: Optional[int] = Field(alias="maxLength")` serialized with `by_alias=True`. `model_config = ConfigDict(from_attributes=True, populate_by_name=True)`.
     - `class SkillMetaOut(BaseModel)`: `name: str`, `description: str`, `args: list[SkillArgOut]`, `categories: list[str]` (str not enum for JSON), `allowed_tools: str = Field(alias="allowedTools")`, `source_path: str = Field(alias="sourcePath")`. `from_attributes=True`, `populate_by_name=True`.
     - `class PreconditionBlocker(BaseModel)`: `code: str`, `message: str`, `arg: Optional[str] = None` (inline vs global).
     - `class PreconditionCheckRequest(BaseModel)`: `project_id: str = Field(alias="projectId")`, `skill_args: dict[str, Any] = Field(default_factory=dict, alias="skillArgs")`, `set_id: Optional[str] = Field(default=None, alias="setId")`.
     - `class PreconditionCheckResponse(BaseModel)`: `ok: bool`, `blockers: list[PreconditionBlocker]`.
   - Reference: CONTRACT exports `skills_catalog_endpoint`, `precondition_check_endpoint`.

2. **Build the shallow precondition registry.**
   - File: `web/backend/app/services/skill_preconditions.py` (NEW)
   - Action:
     - `@dataclass class PreconditionContext`: `project_id: str`, `project_root: Path`, `set_id: Optional[str]`, `skill_args: dict[str, Any]`.
     - `def resolve_context(project_id: str, set_id: Optional[str], skill_args: dict) -> PreconditionContext`: uses `app.services.project_service.parse_state_json`-style resilience to look up the project's filesystem root from `projects` table via the passed `db` Session (inject via DI from the router). Reuse existing project lookup patterns.
     - Helper functions (shallow state introspection, all path-based):
       - `def _state_json_exists(ctx)`: `(ctx.project_root / ".planning" / "STATE.json").exists()`.
       - `def _set_dir(ctx, set_id)`: `ctx.project_root / ".planning" / "sets" / set_id`.
       - `def _has_artifact(ctx, set_id, filename)`: `_set_dir(ctx, set_id).joinpath(filename).exists()` — used for CONTEXT.md, GAPS.md, REVIEW-SCOPE.md.
       - `def _set_status(ctx, set_id) -> Optional[str]`: parses `.planning/STATE.json` via `parse_state_json`; returns status or None.
     - `CHECKS: dict[str, Callable[[PreconditionContext], list[PreconditionBlocker]]]`. Populate conservative shallow checks:
       - `discuss-set`: require `set_id` arg present; require `_state_json_exists`; require set directory exists.
       - `plan-set`: above + require `CONTEXT.md` artifact.
       - `execute-set`: above + require at least one `wave-*-PLAN.md` via glob (shallow).
       - `review`: require set directory + executor commit exists (shallow: git log check deferred — just require set dir + at least a PLAN.md).
       - `merge`: require `REVIEW-SCOPE.md` present.
       - For all other skills (no entry in `CHECKS`), `run_checks` returns empty list (auto-pass).
     - `def run_checks(skill_name: str, ctx: PreconditionContext) -> list[PreconditionBlocker]`: looks up `CHECKS.get(skill_name)`, runs it, returns blockers. Missing entries return `[]`.
   - Reference: CONTEXT precondition-check decision (shallow, centralized); research finding F.

3. **Build the args sanitizer.**
   - File: `web/backend/app/services/skill_args_sanitizer.py` (NEW)
   - Action:
     - `SET_REF_SHAPE = re.compile(r"^[a-zA-Z0-9._-]+$")` — shape-only, per research finding G.
     - `DEFAULT_STRING_MAX = 4096`, `DEFAULT_MULTILINE_MAX = 32768`, `DEFAULT_SET_REF_MAX = 128`.
     - `class SanitizerError(Exception)`: `__init__(self, arg_name: str, reason: str, code: str)`; has `to_http_exception()` returning `HTTPException(status_code=400, detail={"error": code, "arg": arg_name, "message": reason})` (mirrors `StateError` pattern, research finding A).
     - `def sanitize_skill_args(catalog_meta: SkillMeta, raw_args: dict[str, Any]) -> dict[str, Any]`:
       - Iterate `catalog_meta.args`. For each declared arg:
         - Missing + required → raise `SanitizerError(name, "missing required argument", "ARG_MISSING")`.
         - Missing + optional + has default → substitute default.
         - Present: dispatch by type:
           - `string`: coerce to str; cap at `arg.max_length or DEFAULT_STRING_MAX`; wrap in `<user_input>...</user_input>`.
           - `multi-line`: coerce to str; cap at `arg.max_length or DEFAULT_MULTILINE_MAX`; wrap in `<user_input>...</user_input>`.
           - `choice`: must be in `arg.choices`; no wrap; pass through.
           - `bool`: coerce to `bool`; pass through.
           - `set-ref`: cap at `DEFAULT_SET_REF_MAX`; assert `SET_REF_SHAPE.fullmatch(value)` — raise `SanitizerError(name, "set-ref must match [a-zA-Z0-9._-]+", "ARG_SHAPE")` on failure. No shell-metachar rejection, no existence check. Wrap in `<user_input>...</user_input>` (consistent defense-in-depth for prompt safety).
       - Reject unknown arg names not in `catalog_meta.args` (raise `SanitizerError(unknown_name, "unknown argument", "ARG_UNKNOWN")`).
       - Return sanitized dict.
   - Reference: CONTEXT set-ref decision; research finding G; CONTRACT `sanitized_args_contract`.

4. **Introduce local `build_prompt` helper.**
   - File: `web/backend/app/services/skill_runner.py` (NEW)
   - Action: Satisfies the contract's `skill_runner_contract` import locally (see research finding B — the aspirational import from `agent-runtime-foundation` does not exist; this set owns the implementation):
     - `def build_prompt(skill_name: str, sanitized_args: dict[str, Any]) -> str`: returns a prompt string shaped as:
       ```
       /rapid:{skill_name}{optional positional arg}

       <args>
         <{key}>{value}</{key}>
         ...
       </args>
       ```
       - If sanitized_args has a single arg (e.g. `set`, `prompt`) and its type is `set-ref` or `multi-line`/`string`, inline the value on the command line after the slash command (wrapped string values retain their `<user_input>` tags).
       - Otherwise emit a structured `<args>` XML block.
     - Module docstring MUST explicitly note: "This helper satisfies the `skill_runner_contract` import declared in `.planning/sets/skill-invocation-ui/CONTRACT.json`. The upstream `agent-runtime-foundation` set did not ship a `build_prompt` function; this local implementation fulfills the contract."
   - Reference: Research finding B (reconciliation); CONTRACT import `skill_runner_contract`.

5. **Build the skills router.**
   - File: `web/backend/app/routers/skills.py` (NEW)
   - Action: Follow the existing router pattern (prefix, tags, `Depends(get_db)`, `request.app.state.*`):
     - `router = APIRouter(prefix="/api/skills", tags=["skills"])`
     - `@router.get("", response_model=list[SkillMetaOut])` → returns `service.current.list_all()` projected through `SkillMetaOut.model_validate(...)`. Sorted alphabetically by name.
     - `@router.get("/_health")` → returns `{"skills": len(catalog.skills), "parse_errors": [{"path": str, "reason": str}]}`. Always 200.
     - `@router.get("/{name}", response_model=SkillMetaOut)` → 404 if `service.current.get(name)` is None.
     - `@router.post("/{name}/check-preconditions", response_model=PreconditionCheckResponse)`:
       - Look up skill; 404 if unknown.
       - Resolve `PreconditionContext` from body + db.
       - Run `run_checks(name, ctx)`.
       - ALSO validate args via `sanitize_skill_args` in a try/except: catch `SanitizerError` and translate to a `PreconditionBlocker(code=e.code, message=e.reason, arg=e.arg_name)`.
       - Always returns 200 with `{ok: blockers == [], blockers: [...]}`.
   - Reference: Research finding A (router conventions).

6. **Wire the router in main.py.**
   - File: `web/backend/app/main.py`
   - Action: Add `from app.routers.skills import router as skills_router` (with other router imports around lines 21-25) and `app.include_router(skills_router)` alongside existing router includes (lines 167-170). Do NOT touch the lifespan wiring region added in Wave 1.
   - Reference: Research finding A.

7. **Revise CONTRACT.json.**
   - File: `.planning/sets/skill-invocation-ui/CONTRACT.json`
   - Action: Edit the `exports.sanitized_args_contract` entry:
     - `signature`: replace the trailing "rejects shell metacharacters in set-ref args" with "validates set-ref arg shape against `^[a-zA-Z0-9._-]+$` (shape only, not shell defense)". New full signature:
       `"def sanitize_skill_args(skill_name, raw_args) -> sanitized_args; wraps string args in <user_input>...</user_input> tags; enforces maxLength per arg; validates set-ref arg shape against ^[a-zA-Z0-9._-]+$ (shape validator only, not shell defense)"`
     - `description`: append a sentence: `"Note: per the set-ref validation decision in CONTEXT.md, we no longer reject shell metacharacters; args never reach a shell because they flow through ClaudeAgentOptions. The shape regex is a cleanliness guard for prompt text, not a security boundary."`
     - Bump `version` from `"1.1.0"` to `"1.2.0"`.
   - Reference: DEFERRED item #3; CONTEXT set-ref decision.

8. **Add backend unit tests.**
   - File: `web/backend/tests/test_skill_args_sanitizer.py` (NEW)
   - Action:
     - `test_string_arg_wrapped_in_user_input_tags`: asserts `<user_input>hello</user_input>` output shape.
     - `test_string_arg_truncated_at_max_length`: oversize string is truncated to declared `maxLength` (document the truncation policy — or, if reject-on-oversize is preferred, raise `SanitizerError("ARG_TOO_LONG")`. CHOOSE rejection: server should reject, not silently truncate, per CONTRACT `arg_length_limits` "400 on oversized"). Assert raises.
     - `test_set_ref_shape_accepts_valid`: `"skill-invocation-ui"`, `"wave-1"`, `"foo.bar_baz"` all pass.
     - `test_set_ref_shape_rejects_metachars`: `"foo;bar"`, `"foo/bar"`, `"foo bar"`, `"foo$"` all raise `SanitizerError` with code `ARG_SHAPE`.
     - `test_choice_arg_rejects_unknown_choice`: value not in `choices` raises.
     - `test_missing_required_arg_raises`: `ARG_MISSING`.
     - `test_unknown_arg_raises`: unknown arg name raises `ARG_UNKNOWN`.
     - `test_default_value_substituted_when_optional_and_missing`.
   - File: `web/backend/tests/test_skill_preconditions.py` (NEW)
   - Action:
     - Fixture builds a tmp project_root with `.planning/STATE.json` and a `.planning/sets/foo/CONTEXT.md`.
     - `test_plan_set_blocks_without_context_md`: remove CONTEXT.md → expect blocker with code like `PRECONDITION_MISSING_CONTEXT`.
     - `test_execute_set_blocks_without_plan_md`: no `wave-*-PLAN.md` → expect blocker.
     - `test_unknown_skill_passes_with_empty_blockers`: `run_checks("find-skills", ctx)` returns `[]`.
   - File: `web/backend/tests/test_skills_router.py` (NEW)
   - Action: Use FastAPI `TestClient` (mirror existing router test patterns in `web/backend/tests/`):
     - `test_list_skills_returns_all`: `GET /api/skills` returns ≥30 entries, sorted by name.
     - `test_get_unknown_skill_404`: `GET /api/skills/does-not-exist` → 404.
     - `test_check_preconditions_returns_ok_for_trivial_skill`: `POST /api/skills/status/check-preconditions` with a valid project → 200 `{"ok": true, "blockers": []}`.
     - `test_check_preconditions_blocks_on_missing_artifact`: `POST /api/skills/plan-set/check-preconditions` with no CONTEXT.md → 200 `{"ok": false, "blockers": [...]}`.
     - `test_health_endpoint`: `GET /api/skills/_health` returns `{"skills": N, "parse_errors": []}`.
   - File: `web/backend/tests/test_skill_runner_build_prompt.py` (NEW)
   - Action: unit-test `build_prompt` for both single-arg inline and multi-arg XML block shapes.

## Verification

From `~/Projects/RAPID`:

```bash
cd web/backend && uv run pytest tests/test_skill_args_sanitizer.py -v
cd web/backend && uv run pytest tests/test_skill_preconditions.py -v
cd web/backend && uv run pytest tests/test_skills_router.py -v
cd web/backend && uv run pytest tests/test_skill_runner_build_prompt.py -v
cd web/backend && uv run uvicorn app.main:app --port 18123 &
sleep 2
curl -sf http://localhost:18123/api/skills | jq 'length' | grep -q '^3[0-9]$'
curl -sf http://localhost:18123/api/skills/plan-set | jq -e '.args | length > 0'
curl -sf -X POST http://localhost:18123/api/skills/plan-set/check-preconditions \
  -H 'content-type: application/json' \
  -d '{"projectId":"<real-project-id>","skillArgs":{"set":"skill-invocation-ui"},"setId":"skill-invocation-ui"}' \
  | jq -e '.ok == true'
kill %1
node -e "const c = require('./.planning/sets/skill-invocation-ui/CONTRACT.json'); console.log('version:', c.version); console.log(c.exports.sanitized_args_contract.signature)"
```

Expected: all tests green; `/api/skills` returns ≥30 skills; per-skill GET returns non-empty args for `plan-set`; preconditions endpoint returns `ok:true` for a well-set-up project; CONTRACT.json version is `1.2.0` and signature contains `^[a-zA-Z0-9._-]+$`.

## Success Criteria

- `GET /api/skills` returns ≥30 skills sorted alphabetically.
- `GET /api/skills/{name}` returns 404 for unknown, full meta for known.
- `POST /api/skills/{name}/check-preconditions` returns 200 with `{ok, blockers[]}` shape in all cases (no 500 for arg errors — they become blockers).
- `sanitize_skill_args` wraps string/multi-line/set-ref args in `<user_input>` tags, rejects unknown arg names, enforces maxLength (via raise, not truncate), and validates set-ref shape via `^[a-zA-Z0-9._-]+$`.
- `build_prompt` lives at `app/services/skill_runner.py` with a docstring noting the contract reconciliation.
- `CONTRACT.json` bumped to `1.2.0`; `sanitized_args_contract` no longer mentions shell-metacharacter rejection.
- All Wave 2 unit and router tests pass.

## File Ownership

New files owned by Wave 2:
- `web/backend/app/schemas/skills.py`
- `web/backend/app/services/skill_preconditions.py`
- `web/backend/app/services/skill_args_sanitizer.py`
- `web/backend/app/services/skill_runner.py`
- `web/backend/app/routers/skills.py`
- `web/backend/tests/test_skill_args_sanitizer.py`
- `web/backend/tests/test_skill_preconditions.py`
- `web/backend/tests/test_skills_router.py`
- `web/backend/tests/test_skill_runner_build_prompt.py`

Modified files (shared, final-state authoritative):
- `web/backend/app/main.py` — Wave 2 adds ONLY the `from app.routers.skills import router as skills_router` import block (around line 21-25) and the `app.include_router(skills_router)` call (around lines 167-170). The lifespan block added in Wave 1 stays untouched. **Wave 2 owns the final state of `main.py`.**
- `.planning/sets/skill-invocation-ui/CONTRACT.json` — Wave 2 exclusive.
