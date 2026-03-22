# CONTEXT: hygiene-sweep

**Set:** hygiene-sweep
**Generated:** 2026-03-22
**Mode:** interactive

<domain>
## Set Boundary
Two independent codebase-wide sweeps: (1) replace fishjojo1/RAPID references with pragnition/RAPID in user-facing documentation and service files, and (2) remove unused RAPID_ROOT variable from all 26 skill preambles and 2 role definition files. Both sweeps are mechanical search-and-replace operations verified by grep assertions.
</domain>

<decisions>
## Implementation Decisions

### URL Sweep Scope

- Update ALL non-archive files that reference fishjojo1, EXCEPT:
  - **plugin.json** — keep as-is (author stays "Joey Tang/fishjojo1", homepage stays github.com/fishjojo1/RAPID)
  - **.planning/ files** (PROJECT.md, STATE.md, CODEBASE.md, context/) — leave as historical records
  - **issues-todo.md** — leave as-is (temporary scratch file)
- Files to update: DOCS.md, README.md, LICENSE, web/backend/service/rapid-web.service

### Plugin Identity

- plugin.json author field: keep as "Joey Tang/fishjojo1" (personal attribution)
- plugin.json homepage/repository URLs: keep pointing to github.com/fishjojo1/RAPID
- Do NOT modify plugin.json in this set

### RAPID_ROOT Removal (Skills)

- Delete the `RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."` assignment line from all 26 skill preambles
- Replace `$RAPID_ROOT/.env` with `$CLAUDE_SKILL_DIR/../../.env` in the .env loading line
- Preserve the rest of the preamble (RAPID_TOOLS loading and validation)
- Confirmed: rapid-tools.cjs does NOT depend on RAPID_ROOT — safe to remove

### RAPID_ROOT Removal (Roles)

- Apply the same removal pattern to src/modules/roles/role-conflict-resolver.md and role-set-merger.md
- These use a different shell-script style (`RAPID_ROOT="$(cd ...)"`) — adapt the inline replacement accordingly
- Replace `$RAPID_ROOT/.env` path references with the equivalent inline computation

### Claude's Discretion

- None — all areas were discussed
</decisions>

<specifics>
## Specific Ideas
- Verification should include a final grep across the tree confirming zero RAPID_ROOT matches in skills/ and src/, and zero fishjojo1 matches outside of .planning/archive/, .planning/milestones/, .planning/sets/hygiene-sweep/, .planning/research/, .planning/PROJECT.md, .planning/STATE.md, .planning/context/, issues-todo.md, issues.md, and .claude-plugin/plugin.json
</specifics>

<code_context>
## Existing Code Insights

**Skill preamble pattern (26 files):**
```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

**Role file pattern (2 files):**
```bash
if [ -z "${RAPID_TOOLS:-}" ]; then
  RAPID_ROOT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)"
  if [ -f "$RAPID_ROOT/.env" ]; then
    set -a
    . "$RAPID_ROOT/.env"
    set +a
  fi
fi
```

**fishjojo1 references in actionable files:**
- DOCS.md, README.md — clone/install URLs
- LICENSE — copyright holder line
- web/backend/service/rapid-web.service — Documentation URL
</code_context>

<deferred>
## Deferred Ideas
- Consider whether plugin.json should eventually point to pragnition org (separate decision, not for this set)
</deferred>
