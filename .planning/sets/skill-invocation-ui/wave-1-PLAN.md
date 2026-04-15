# Wave 1 — Frontmatter Schema, Catalog Foundation, and SKILL.md Edits

## Objective

Establish the typed `args:` frontmatter schema, build the backend catalog loading pipeline (parser + service + watchdog hot-reload), and extend all 29 existing `SKILL.md` files with `args:` and `categories:` frontmatter. This wave produces the authoritative machine-readable description of every RAPID skill so Waves 2-4 can consume it via service calls.

Note on skill count: the `skills/` directory contains 29 skill subdirectories on disk; CONTRACT.json's `all_30_skills_in_catalog` clause is a named behavioral assertion, not a literal count. The clause is upheld by the invariant "every directory with a SKILL.md appears in the catalog" — enforced by tests that iterate `discover_skill_files` against the live directory, not by a hardcoded numeric floor.

## Tasks

1. **Add `pyyaml` dependency to backend.**
   - File: `web/backend/pyproject.toml`
   - Action: Under `[project].dependencies`, add `"pyyaml>=6.0,<7.0"` alongside the existing `"watchdog>=6.0,<7.0"` and `"claude-agent-sdk>=0.1.59"` entries. Do NOT regenerate the `.egg-info` files; `pip install -e .` in verification will refresh them.
   - Reference: Research finding A (pyyaml missing from pyproject.toml).

2. **Add `rapid_dev` setting to config.**
   - File: `web/backend/app/config.py`
   - Action: Add a pydantic setting field `rapid_dev: bool = False` to the existing `Settings` class (use `Field(default=False, alias="RAPID_DEV")` so `RAPID_DEV=true` env var flips it). Load from `.env` as existing settings do.
   - Reference: CONTEXT hot-reload decision; research finding E.

3. **Define the frontmatter schema module.**
   - File: `web/backend/app/schemas/skill_frontmatter.py` (NEW)
   - Action: Create Pydantic v2 models:
     - `class SkillArgType(str, Enum)`: values `STRING="string"`, `CHOICE="choice"`, `BOOL="bool"`, `MULTI_LINE="multi-line"`, `SET_REF="set-ref"`.
     - `class SkillCategory(str, Enum)`: values `AUTONOMOUS="autonomous"`, `INTERACTIVE="interactive"`, `HUMAN_IN_LOOP="human-in-loop"`.
     - `class SkillArg(BaseModel)`: `name: str = Field(min_length=1, max_length=64)`, `type: SkillArgType`, `description: str = Field(min_length=1, max_length=500)`, `required: bool = True`, `default: Optional[Union[str, bool]] = None`, `choices: Optional[List[str]] = None`, `max_length: Optional[int] = Field(default=None, gt=0, le=65536, alias="maxLength")`. Use `ConfigDict(populate_by_name=True, from_attributes=True)`. Validator: if `type == CHOICE`, `choices` must be non-empty list.
     - `class SkillFrontmatter(BaseModel)`: `name: str = Field(min_length=1, max_length=64)`, `description: str = Field(min_length=1, max_length=500)`, `allowed_tools: str = Field(default="", alias="allowed-tools")`, `args: List[SkillArg] = Field(default_factory=list, max_length=10)`, `categories: List[SkillCategory] = Field(min_length=1)`. Use `ConfigDict(populate_by_name=True)`.
   - Reference: CONTRACT export `skill_args_frontmatter_schema`; research finding A.

4. **Build the frontmatter parser.**
   - File: `web/backend/app/services/skill_frontmatter.py` (NEW)
   - Action: Implement:
     - `FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)` — anchored at BOF so bare `---` inside prose does not match.
     - `def parse_skill_file(path: Path) -> SkillFrontmatter`: reads the file, applies the regex, raises `FrontmatterError(path, reason)` if no match; otherwise runs `yaml.safe_load` on the captured block and feeds result into `SkillFrontmatter.model_validate(...)`. Wraps pydantic `ValidationError` into `FrontmatterError` with path context.
     - `class FrontmatterError(Exception)`: `__init__(self, path: Path, reason: str)`; includes absolute path in `__str__`.
     - `def discover_skill_files(skills_root: Path) -> List[Path]`: walk `skills_root` one level deep; a skill directory is any child directory containing a file literally named `SKILL.md`. Filter out `skills/review-auto-detect.test.cjs` (it sits at root and is not a directory).
   - Reference: Research finding H #2 (anchored regex), #3 (fail loud), C (filter non-directories).

5. **Build the skill catalog service.**
   - File: `web/backend/app/services/skill_catalog_service.py` (NEW)
   - Action: Implement:
     - `@dataclass class SkillMeta`: `name: str`, `description: str`, `allowed_tools: str`, `args: list[SkillArg]`, `categories: list[SkillCategory]`, `source_path: Path`.
     - `class SkillCatalog`: holds `skills: dict[str, SkillMeta]` and `parse_errors: list[tuple[Path, str]]`. Method `get(name) -> SkillMeta | None`, `list_all() -> list[SkillMeta]`.
     - `def load_catalog(skills_root: Path, strict: bool = True) -> SkillCatalog`: iterates `discover_skill_files`; on parse failure in `strict=True` mode, re-raises the first `FrontmatterError` (fail-loud at startup); in `strict=False` mode (hot-reload path), collects errors into `parse_errors` and keeps successful parses.
     - `class SkillCatalogService`: stateful holder exposing `current: SkillCatalog` (atomic swap on reload). Methods `load_initial(skills_root)` (strict), `reload(skills_root)` (non-strict, keep-last-good: only swaps if at least one skill parses; errors accumulate on new catalog).
   - Reference: CONTRACT export `skill_catalog_service`; research finding E (keep-last-good).

6. **Build the watchdog hot-reload wrapper.**
   - File: `web/backend/app/services/skill_catalog_watcher.py` (NEW)
   - Action: Mirror the structure of `app/services/file_watcher.py:26-71`:
     - `class _CatalogEventHandler(FileSystemEventHandler)`: on any `on_modified`/`on_created`/`on_moved`/`on_deleted` event with a path ending in `SKILL.md`, schedules a 500ms coalesce timer (`threading.Timer`) that calls `service.reload(skills_root)`. If a new event arrives while the timer is pending, cancel and reschedule.
     - `def create_catalog_observer(skills_root: Path, service: SkillCatalogService) -> BaseObserver`: prefer `Observer`, fall back to `PollingObserver` on exception, schedule the handler non-recursively on `skills_root` (and every immediate subdirectory — since `SKILL.md` lives one level down). Returns the observer without starting.
     - `class SkillCatalogWatcher`: wraps observer with `start()` / `stop()` (mirrors `FileWatcherService`).
   - Reference: Research finding E (debouncing coalesce).

7. **Wire catalog loading and watcher into lifespan.**
   - File: `web/backend/app/main.py`
   - Action: In the `lifespan` context manager (around lines 103-123), after existing state initialization:
     - Import `from app.services.skill_catalog_service import SkillCatalogService` and `from app.services.skill_catalog_watcher import SkillCatalogWatcher`.
     - Compute `skills_root = Path(__file__).resolve().parents[3] / "skills"` (project_root/skills). Confirm by reading `web/backend/app/main.py` — adjust the `.parents[N]` index to reach RAPID project root.
     - Call `service = SkillCatalogService(); service.load_initial(skills_root)` (fail-loud — any `FrontmatterError` crashes boot).
     - Store on `app.state.skill_catalog_service = service`.
     - If `settings.rapid_dev`, instantiate `watcher = SkillCatalogWatcher(skills_root, service); watcher.start()` and store on `app.state.skill_catalog_watcher`. On shutdown (after `yield`), call `watcher.stop()` when present.
   - Reference: Research finding A (lifespan wiring), E (dev-only watcher).

8. **Add `categories:` and `args:` frontmatter to all 29 existing SKILL.md files.**

   All 29 skill directories under `skills/` already have a `SKILL.md` file on disk — this task is a pure frontmatter extension, never a creation. For every file, append `args:` and `categories:` entries into the existing YAML frontmatter block (between the final existing key and the closing `---`). Preserve the existing `description:`, `allowed-tools:`, and all body prose verbatim.

   Note: `skills/register-web/SKILL.md` already exists on disk (2396 bytes) with valid `description` and `allowed-tools` frontmatter. Its action is Modify — append `args: []` and `categories: [autonomous]` to the existing frontmatter block; preserve description, allowed-tools, and all body prose verbatim. Do NOT recreate or overwrite the file.

   **Set-targeted skills (non-empty `args:`) — 16 total:**
   `discuss-set`, `plan-set`, `execute-set`, `bug-fix`, `merge`, `review`, `uat`, `unit-test`, `resume`, `pause`, `cleanup`, `backlog`, `quick`, `audit-version`, `new-version`, `add-set`.

   **Non-set-targeted skills (`args: []`) — 13 total:**
   `assumptions`, `branding`, `bug-hunt`, `context`, `documentation`, `help`, `init`, `install`, `migrate`, `register-web`, `scaffold`, `start-set`, `status`.

   Both `scaffold` and `branding` remain `args: []` — matches the CONTEXT decision that non-set-targeted skills ship `args: []` even when they have conversational flow.

   **Per-skill arg shapes (for set-targeted skills):**
   - `discuss-set`, `plan-set`, `execute-set`, `review`, `uat`, `unit-test`, `resume`, `pause`, `cleanup`, `add-set`: single required arg `set` of type `set-ref`, description like "Set to discuss/plan/execute/review".
   - `merge`: required `set` (`set-ref`); optional `strategy` (`choice`, choices: `["auto","manual"]`, default `"auto"`).
   - `backlog`: required `title` (`string`, maxLength 200), required `description` (`multi-line`, maxLength 8000).
   - `audit-version`: optional `version` (`string`, maxLength 32).
   - `new-version`: required `version` (`string`, maxLength 32), optional `notes` (`multi-line`).
   - `bug-fix`, `quick`: single required `prompt` (`multi-line`, maxLength 16000). Note: these are freeform-prompt skills, not set-ref.

   **Per-skill categories (authoritative hand-classification):**
   - **`autonomous` (22):** `init`, `status`, `migrate`, `scaffold`, `register-web`, `install`, `help`, `context`, `assumptions`, `start-set`, `pause`, `resume`, `cleanup`, `backlog`, `documentation`, `audit-version`, `new-version`, `review`, `uat`, `unit-test`, `merge`, `bug-hunt`.
   - **`interactive` (3):** `discuss-set`, `plan-set`, `branding`.
   - **`human-in-loop` (4):** `execute-set`, `bug-fix`, `quick`, `add-set`.

   Every skill listed above appears under exactly one category. Total: 22 + 3 + 4 = 29, matching the 29 on-disk skill directories. If the executor detects a skill directory not named above, stop and flag it rather than guessing classification.

   Every file must round-trip through `parse_skill_file` without error (enforced by Task 9 tests).

   - Reference: CONTEXT SKILL.md args edit strategy decision; VERIFICATION-REPORT Gap #1 (register-web already exists) and Gap #2 (29 not 30).

9. **Add the backend tests.**
   - File: `web/backend/tests/test_skill_frontmatter.py` (NEW)
   - Action: `pytest`-style tests:
     - `test_parse_minimal_frontmatter`: in-memory path with a valid stub, asserts returned `SkillFrontmatter.name` and empty args.
     - `test_parse_rejects_missing_frontmatter`: file with no `---` block raises `FrontmatterError`.
     - `test_parse_rejects_invalid_category`: `categories: [unknown]` raises `FrontmatterError`.
     - `test_parse_rejects_choice_without_choices`: an arg with `type: choice` but no `choices` raises.
     - `test_parse_accepts_allowed_tools_string`: `allowed-tools: "Bash(rapid-tools:*), Read"` parses as a raw string, not a list.
   - File: `web/backend/tests/test_skill_catalog_service.py` (NEW)
   - Action:
     - Fixture `skills_root`: walks up from `__file__` to find the directory containing `.claude-plugin/plugin.json`, returns its `skills/` sibling (research finding H #4).
     - `test_load_catalog_finds_all_skills`: `load_catalog(skills_root, strict=True)` returns catalog with at least 29 entries; every returned `SkillMeta` has `name`, `description`, non-empty `categories`. Comment at the assertion: `# CONTRACT.json's "all_30_skills_in_catalog" clause is a named assertion, not a literal count — the skills/ directory currently contains 29 subdirectories, and the real invariant is "every directory with a SKILL.md appears in the catalog" (enforced in test_every_skill_dir_has_parseable_frontmatter below). The >= 29 floor matches on-disk reality; the clause name is aspirational and no CONTRACT.json edit is required.`
     - `test_every_skill_dir_has_parseable_frontmatter`: iterates `discover_skill_files`, runs `parse_skill_file` on each; no `FrontmatterError` raised. This is the authoritative enforcement of `all_30_skills_in_catalog` + `frontmatter_schema_validated`: every directory with a SKILL.md round-trips through the schema.
     - `test_reload_keeps_last_good_on_error`: write a bad SKILL.md to a tmp path, call `service.reload`, assert `service.current.skills` is unchanged from the initial good load and `parse_errors` non-empty.
     - `test_discover_skip_files_at_root`: `review-auto-detect.test.cjs` is not returned.

## Verification

Run these from `~/Projects/RAPID`:

```bash
cd web/backend && uv pip install -e . && cd -                                # picks up pyyaml
cd web/backend && uv run pytest tests/test_skill_frontmatter.py -v
cd web/backend && uv run pytest tests/test_skill_catalog_service.py -v
ls skills/register-web/SKILL.md                                              # still exists (was never recreated)
for f in skills/*/SKILL.md; do                                               # every SKILL.md begins with a frontmatter block
  head -1 "$f" | grep -q '^---$' || { echo "BAD: $f"; exit 1; };
done
# Confirm every on-disk skill has non-empty categories after edit:
for f in skills/*/SKILL.md; do
  grep -q '^categories:' "$f" || { echo "MISSING categories: $f"; exit 1; };
  grep -q '^args:' "$f" || { echo "MISSING args: $f"; exit 1; };
done
cd web/backend && uv run python -c "from pathlib import Path; from app.services.skill_catalog_service import load_catalog; c = load_catalog(Path('~/Projects/RAPID/skills').expanduser()); print(f'skills={len(c.skills)}'); assert len(c.skills) >= 29"
RAPID_DEV=true cd web/backend && uv run uvicorn app.main:app --port 18123 &  # hot-reload smoke
sleep 3 && kill %1
```

Expected: all tests green; catalog reports >= 29 skills; every on-disk `SKILL.md` has both `args:` and `categories:` keys; server starts cleanly under `RAPID_DEV=true` with watcher attached and under default settings without watcher.

## Success Criteria

- `pyyaml>=6.0,<7.0` appears in `web/backend/pyproject.toml`.
- `RAPID_DEV` config flag readable via `settings.rapid_dev`, default False.
- `skills/register-web/SKILL.md` retains its original description/allowed-tools/body prose verbatim, with `args: []` and `categories: [autonomous]` appended to the existing frontmatter block.
- `SkillFrontmatter` schema rejects unknown categories and choice-args without `choices`.
- `load_catalog` returns at least 29 entries; every set-targeted skill has non-empty `args`.
- Server boot fails loudly when any SKILL.md has invalid frontmatter (strict path).
- Hot-reload swap preserves last-good catalog when the new parse fails; accumulates errors.
- Watcher only runs when `RAPID_DEV=true`.
- All 29 skill directories round-trip through `parse_skill_file` without error — the behavioral `all_30_skills_in_catalog` clause is upheld by this coverage invariant rather than a literal 30-count threshold.
- All Wave 1 unit tests pass.

## File Ownership

New files owned by Wave 1:
- `web/backend/app/schemas/skill_frontmatter.py`
- `web/backend/app/services/skill_frontmatter.py`
- `web/backend/app/services/skill_catalog_service.py`
- `web/backend/app/services/skill_catalog_watcher.py`
- `web/backend/tests/test_skill_frontmatter.py`
- `web/backend/tests/test_skill_catalog_service.py`

Modified files exclusively owned by Wave 1:
- `web/backend/pyproject.toml` (adds pyyaml; Wave 2 will NOT modify this file).
- `web/backend/app/config.py` (adds `rapid_dev`; Wave 2 will NOT touch this file).
- `web/backend/app/main.py` (catalog loading + watcher in lifespan ONLY; Wave 2 adds the router include in a separate, non-overlapping region of `main.py` — final state of `main.py` after Wave 2 is authoritative).
- All 29 existing `skills/*/SKILL.md` files (batch frontmatter edit — `register-web/SKILL.md` is modified in-place alongside the other 28, never created).
