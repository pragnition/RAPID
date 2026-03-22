# Wave 1 PLAN: Code Fixes

**Set:** web-install-bugfix
**Wave:** 1 of 2
**Objective:** Fix all individual code-level bugs -- Alembic path resolution, service file template, and TypeScript compilation errors. These are prerequisite fixes that must be in place before the integration wave can wire them together.

## Task 1: Alembic Path Resolution Fallback

**File:** `web/backend/app/database.py`
**Lines:** 145-153 (the `run_migrations` function)

**Current code (line 150):**
```python
alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
```

**Problem:** When installed as a uv tool, `__file__` resolves to site-packages, not the source tree. The `alembic.ini` file is not found.

**Implementation:**
1. Add `import logging` at the top of the file (after existing imports) if not already present.
2. Create a logger: `logger = logging.getLogger(__name__)` (place after imports, before the `convention` dict).
3. Replace lines 150-151 in `run_migrations` with fallback logic:
   - First try: `Path(__file__).resolve().parent.parent / "alembic.ini"` (works for editable installs and dev)
   - Second try: `Path.cwd() / "alembic.ini"` (works when WorkingDirectory is set correctly in systemd)
   - If first path does not exist but second does, use the second and log a warning: `"alembic.ini not found relative to __file__, falling back to cwd-relative path"`
   - If neither exists, raise a clear `FileNotFoundError` with both paths tried
4. The rest of `run_migrations` stays the same -- `cfg = Config(str(alembic_ini))` etc.

**What NOT to do:**
- Do not change the function signature
- Do not modify any other function in database.py
- Do not add alembic.ini as package data -- the editable install approach is the chosen strategy

**Verification:**
```bash
cd web/backend && python -c "from app.database import run_migrations; print('import OK')"
```

---

## Task 2: Systemd Service File Template

**File:** `web/backend/service/rapid-web.service`

**Current content:** Uses `ExecStart=%h/.local/bin/rapid-web` with no `WorkingDirectory`. This path only works for `uv tool install` which is the wrong install method.

**Implementation:**
Replace the entire file content with a template that uses `__RAPID_ROOT__` placeholders:

```ini
[Unit]
Description=RAPID Web Dashboard Service
After=network.target
Documentation=https://github.com/fishjojo1/RAPID

[Service]
Type=simple
WorkingDirectory=__RAPID_ROOT__/web/backend
ExecStart=__RAPID_ROOT__/web/backend/.venv/bin/rapid-web
Environment=RAPID_WEB=true
Environment=RAPID_WEB_PORT=8998
Environment=RAPID_WEB_HOST=127.0.0.1
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

Key changes from current:
- Added `WorkingDirectory=__RAPID_ROOT__/web/backend` (new line, after `Type=simple`)
- Changed `ExecStart` from `%h/.local/bin/rapid-web` to `__RAPID_ROOT__/web/backend/.venv/bin/rapid-web`
- `__RAPID_ROOT__` will be replaced by `setup.sh` with `$SCRIPT_DIR` at install time

**What NOT to do:**
- Do not auto-install or auto-enable the service
- Do not remove any existing Environment lines
- Do not use `%h` (home directory) -- the template uses absolute paths filled at install time

**Verification:**
```bash
grep -c '__RAPID_ROOT__' web/backend/service/rapid-web.service
# Should output: 2 (one for WorkingDirectory, one for ExecStart)
```

---

## Task 3: Fix TypeScript Error in useKanban.ts

**File:** `web/frontend/src/hooks/useKanban.ts`
**Lines:** 122-209 (the `useMoveCard` function)

**Problem:** The `useMutation` call has 3 generic type parameters: `<KanbanCardResponse, ApiError, { cardId: string; column_id: string; position: number }>`. The 4th generic parameter (context type) defaults to `unknown`. The `onMutate` callback returns `{ previous }` but TypeScript does not infer the context type in `onError`'s 3rd parameter, so `context?.previous` fails with "Property 'previous' does not exist on type '{}'".

**Implementation:**
Add a 4th generic type parameter to the `useMutation` call to explicitly type the context:

Change line 124-128 from:
```typescript
  return useMutation<
    KanbanCardResponse,
    ApiError,
    { cardId: string; column_id: string; position: number }
  >({
```

To:
```typescript
  return useMutation<
    KanbanCardResponse,
    ApiError,
    { cardId: string; column_id: string; position: number },
    { previous: KanbanBoardResponse | undefined }
  >({
```

This tells TypeScript the shape of the context object returned by `onMutate`, so `context?.previous` is correctly typed in `onError`.

**What NOT to do:**
- Do not change the `onMutate` return value -- `{ previous }` is correct
- Do not change the `onError` callback signature -- `context?.previous` is correct
- Do not add type casts or `as any` -- the generic parameter is the proper fix
- Do not modify `useDeleteCard` or any other function

**Verification:**
```bash
cd web/frontend && npx tsc -b 2>&1 | grep useKanban
# Should produce no output (no errors in useKanban.ts)
```

---

## Task 4: Fix TypeScript Error in KnowledgeGraphPage.tsx

**File:** `web/frontend/src/pages/KnowledgeGraphPage.tsx`
**Lines:** 17-24 (the `NODE_COLORS` definition) and lines 138, 143 (usage sites)

**Problem:** `NODE_COLORS` is typed as `Record<string, string>`. With `noUncheckedIndexedAccess: true` in tsconfig, indexing `Record<string, string>` returns `string | undefined`. The expression `NODE_COLORS[status] ?? NODE_COLORS.pending` still evaluates to `string | undefined` because `NODE_COLORS.pending` is also `string | undefined`. The `darken()` function expects `string`.

**Implementation:**
Change the `NODE_COLORS` declaration (lines 17-24) from:
```typescript
const NODE_COLORS: Record<string, string> = {
  pending: "#6b7280",
  discussed: "#eab308",
  planned: "#3b82f6",
  executing: "#f97316",
  complete: "#22c55e",
  merged: "#4b5563",
};
```

To:
```typescript
const NODE_COLORS = {
  pending: "#6b7280",
  discussed: "#eab308",
  planned: "#3b82f6",
  executing: "#f97316",
  complete: "#22c55e",
  merged: "#4b5563",
} as const satisfies Record<string, string>;
```

With `as const satisfies Record<string, string>`:
- `NODE_COLORS.pending` has type `"#6b7280"` (a definite string literal), not `string | undefined`
- `NODE_COLORS[status]` (dynamic key) still returns `string | undefined`, but `?? NODE_COLORS.pending` resolves to `string` because the fallback is a known literal
- The `satisfies` ensures the object still matches `Record<string, string>` for type safety

Additionally, change the two usage sites (lines 138 and 143) to use a `const` intermediate variable pattern to avoid the `?? fallback` being `string | undefined`:

Actually, after the `as const satisfies` change, `NODE_COLORS.pending` becomes type `"#6b7280"`, so:
- `NODE_COLORS[status] ?? NODE_COLORS.pending` resolves to `string | "#6b7280"` which is just `string`. This fixes the darken() call.

No changes needed at the usage sites (lines 138, 143). Only the declaration on lines 17-24 needs to change.

**What NOT to do:**
- Do not remove the `NODE_COLORS` object or change its values
- Do not add `// @ts-ignore` or `as string` casts
- Do not change the `darken` function signature
- Do not remove `noUncheckedIndexedAccess` from tsconfig

**Verification:**
```bash
cd web/frontend && npx tsc -b 2>&1 | grep KnowledgeGraph
# Should produce no output (no errors in KnowledgeGraphPage.tsx)
```

---

## Success Criteria

1. `cd web/frontend && npx tsc -b` produces zero errors
2. `cd web/backend && python -c "from app.database import run_migrations; print('OK')"` succeeds
3. `grep -c '__RAPID_ROOT__' web/backend/service/rapid-web.service` returns `2`
4. `git diff --stat` shows exactly these 4 files modified:
   - `web/backend/app/database.py`
   - `web/backend/service/rapid-web.service`
   - `web/frontend/src/hooks/useKanban.ts`
   - `web/frontend/src/pages/KnowledgeGraphPage.tsx`

## File Ownership (Wave 1)

| File | Action |
|------|--------|
| `web/backend/app/database.py` | Modify (add fallback logic to `run_migrations`) |
| `web/backend/service/rapid-web.service` | Modify (template with `__RAPID_ROOT__` placeholders) |
| `web/frontend/src/hooks/useKanban.ts` | Modify (add 4th generic type param) |
| `web/frontend/src/pages/KnowledgeGraphPage.tsx` | Modify (change `NODE_COLORS` type annotation) |
