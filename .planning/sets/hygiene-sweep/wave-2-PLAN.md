# PLAN: hygiene-sweep / Wave 2 -- RAPID_ROOT Variable Removal

## Objective

Remove the unused `RAPID_ROOT` variable from all 26 skill preambles (124 occurrences) and 2 role definition files (6 occurrences). Replace inline with direct `${CLAUDE_SKILL_DIR}/../..` path computation. Then regenerate the agent files from updated role sources.

## Context

`RAPID_ROOT` was introduced as a convenience variable to compute the plugin root directory. It is set to `${CLAUDE_SKILL_DIR}/../..` in skills and `$(cd "$(dirname "$0")/../.." && pwd)` in roles. Since it is only used to find `.env` and is never exported or used beyond the preamble in 25 of 26 skills, it can be eliminated by inlining the path. The install skill uses it extensively throughout the file, so each occurrence needs individual replacement.

## Approach

There are three categories of files and two replacement patterns:

**Category A: Standard skills (25 skills, 47 two-line preamble blocks)**
Replace the two-line pattern:
```
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
```
With the single-line pattern:
```
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
```

**Category B: Install skill (1 skill, 30 occurrences with diverse patterns)**
Replace each `$RAPID_ROOT` or `${RAPID_ROOT}` with `${CLAUDE_SKILL_DIR}/../..` inline, and update prose references that mention `{RAPID_ROOT}` or `RAPID_ROOT` as a concept.

**Category C: Role files (2 files, 3 occurrences each)**
Replace the multi-line RAPID_ROOT block with inline path computation.

---

## Task 1: Update standard skill preambles (25 skills)

**Files (25):** Every `skills/*/SKILL.md` EXCEPT `skills/install/SKILL.md` and `skills/help/SKILL.md` (help has no preamble).

The 25 skills to modify:
- `add-set`, `assumptions`, `branding`, `bug-fix`, `bug-hunt`, `cleanup`, `context`, `discuss-set`, `documentation`, `execute-set`, `init`, `merge`, `migrate`, `new-version`, `pause`, `plan-set`, `quick`, `register-web`, `resume`, `review`, `scaffold`, `start-set`, `status`, `uat`, `unit-test`

**Action:** For each file, perform a global search-and-replace of the two-line block with the one-line block.

**Before (2 lines):**
```
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
```

**After (1 line):**
```
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
```

**Preamble block counts per skill** (to verify completeness):
- 1 block: add-set, branding, bug-fix, cleanup, context, discuss-set, execute-set, pause, plan-set, quick, resume
- 2 blocks: assumptions, bug-hunt, documentation, merge, new-version, review, scaffold, start-set, uat, unit-test
- 3 blocks: init, register-web, status
- 7 blocks: migrate

**Verification per file:**
```bash
grep -c "RAPID_ROOT" skills/{skill}/SKILL.md  # Expected: 0 for each
```

**Batch verification:**
```bash
grep -r "RAPID_ROOT" skills/ --include="*.md" | grep -v "skills/install/"
# Expected: zero matches
```

---

## Task 2: Update the install skill

**File:** `skills/install/SKILL.md`
**Count:** 30 RAPID_ROOT occurrences across the file.

This skill uses RAPID_ROOT in diverse ways beyond the standard preamble. Every occurrence must be replaced individually. The replacement strategy:

### 2a: Standard preamble blocks within install (lines 195-197)

Replace the 3-line preamble block (Step 4 verification):
```
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then
    export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs)
fi
```
With:
```
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then
    export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs)
fi
```

### 2b: Code blocks that assign RAPID_ROOT then use it

For all bash code blocks that start with `RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."` and then reference `$RAPID_ROOT` in subsequent lines:

1. **Delete** the `RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."` assignment line
2. **Replace** every `$RAPID_ROOT` and `"$RAPID_ROOT` in the same code block with `"${CLAUDE_SKILL_DIR}/../.."` or `${CLAUDE_SKILL_DIR}/../..`

Specific blocks to transform:

- **Step 0 (lines 19-27):** Remove assignment line 20, replace `$RAPID_ROOT` on line 26 with `${CLAUDE_SKILL_DIR}/../..`
  - Line 17 prose: `Set \`RAPID_ROOT\` to 2 directories up` -> `Compute the plugin root as 2 directories up from the skill directory: \`${CLAUDE_SKILL_DIR}/../..\``
  - Line 26: `echo "RAPID_ROOT=$RAPID_ROOT"` -> `echo "RAPID_PLUGIN_DIR=${CLAUDE_SKILL_DIR}/../.."`

- **Step 0 prose (line 29):** Contains reference to `RAPID_ROOT path` -- replace with `plugin root path`

- **Step 1 (lines 36-37):** Remove assignment, inline: `bash "${CLAUDE_SKILL_DIR}/../../setup.sh"`

- **Manual steps (line 52):** `cd $RAPID_ROOT` -> `cd "${CLAUDE_SKILL_DIR}/../.."`

- **Step 2 shell detect (line 67):** Remove assignment (RAPID_ROOT not used in this block after assignment -- but check: it is set and then SHELL_NAME is used. The RAPID_ROOT assignment is dead code here). Delete line 67.

- **Step 2 config check (line 84):** Remove assignment (dead code -- RAPID_ROOT not used after). Delete line 84.

- **Step 3 prose (lines 123-124):**
  - `{RAPID_ROOT}/src/bin/rapid-tools.cjs` -> `{PLUGIN_ROOT}/src/bin/rapid-tools.cjs` (these are prose template descriptions, not actual code)

- **Step 3 code block (lines 129-130):** Remove assignment, replace: `RAPID_TOOLS_PATH="${CLAUDE_SKILL_DIR}/../../src/bin/rapid-tools.cjs"`

- **Step 3 fish verify (line 148):** Remove assignment (dead code). Delete line 148.

- **Step 3 bash verify (line 155):** Remove assignment (dead code). Delete line 155.

- **Step 3 zsh verify (line 162):** Remove assignment (dead code). Delete line 162.

- **Step 4 troubleshooting (line 220):** `cat $RAPID_ROOT/.env` -> `cat "${CLAUDE_SKILL_DIR}/../../.env"`

- **Step 4.5 prose (line 265):** `cd {RAPID_ROOT}/web/backend` -> `cd {PLUGIN_ROOT}/web/backend`

- **Step 4.5 code block (lines 275-283):** Remove line 275 assignment, replace all `$RAPID_ROOT` with `${CLAUDE_SKILL_DIR}/../..`:
  - Line 276: `"${CLAUDE_SKILL_DIR}/../../.env"`
  - Line 277: `"${CLAUDE_SKILL_DIR}/../../.env"`
  - Line 279-281: `"${CLAUDE_SKILL_DIR}/../../.env"`
  - Line 283: `${CLAUDE_SKILL_DIR}/../../.env`

- **Step 4.5 systemd (lines 305-306):** Remove line 305 assignment, replace line 306: `cp "${CLAUDE_SKILL_DIR}/../../web/backend/service/rapid-web.service" ~/.config/systemd/user/rapid-web.service`

**Verification:**
```bash
grep -c "RAPID_ROOT" skills/install/SKILL.md  # Expected: 0
grep "CLAUDE_SKILL_DIR" skills/install/SKILL.md | head -5  # Confirm replacements present
```

---

## Task 3: Update role definition files

**Files (2):**
- `src/modules/roles/role-conflict-resolver.md`
- `src/modules/roles/role-set-merger.md`

Both contain identical blocks (lines 17-26 in each):

**Before:**
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

**After:**
```bash
if [ -z "${RAPID_TOOLS:-}" ]; then
  _rapid_env="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)/.env"
  if [ -f "$_rapid_env" ]; then
    set -a
    . "$_rapid_env"
    set +a
  fi
  unset _rapid_env
fi
```

This eliminates the `RAPID_ROOT` name while preserving the path computation inline via a temporary `_rapid_env` variable (scoped and cleaned up with `unset`).

**Verification:**
```bash
grep -c "RAPID_ROOT" src/modules/roles/role-conflict-resolver.md  # Expected: 0
grep -c "RAPID_ROOT" src/modules/roles/role-set-merger.md  # Expected: 0
```

---

## Task 4: Regenerate agent files

**Action:** Run `build-agents` to regenerate the agent .md files from the updated role sources.

```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs build-agents
```

**Verification:**
```bash
grep -r "RAPID_ROOT" agents/  # Expected: zero matches
```

---

## Task 5: Final RAPID_ROOT sweep verification

**Action:** Run comprehensive grep across skills/ and src/ to confirm zero RAPID_ROOT references remain.

**Verification commands:**
```bash
# Zero RAPID_ROOT in skills and src
grep -r "RAPID_ROOT" skills/ src/
# Expected: zero matches

# Every skill still has CLAUDE_SKILL_DIR references (preamble intact)
for skill in add-set assumptions branding bug-fix bug-hunt cleanup context discuss-set documentation execute-set init install merge migrate new-version pause plan-set quick register-web resume review scaffold start-set status uat unit-test; do
  count=$(grep -c "CLAUDE_SKILL_DIR" "skills/$skill/SKILL.md")
  echo "$skill: $count"
done
# Expected: every skill has at least 1 match

# Agent files regenerated without RAPID_ROOT
grep -r "RAPID_ROOT" agents/
# Expected: zero matches
```

---

## Success Criteria

1. Zero `RAPID_ROOT` references in `skills/` directory (was 124 occurrences across 26 files)
2. Zero `RAPID_ROOT` references in `src/` directory (was 6 occurrences across 2 files)
3. Zero `RAPID_ROOT` references in `agents/` directory (was 6 occurrences across 2 files)
4. All 26 skill preambles (excluding help which has none) still correctly load RAPID_TOOLS from `.env` and validate its presence
5. All preamble code blocks contain `CLAUDE_SKILL_DIR` references for .env loading
6. Agent files successfully regenerated from updated role sources

## What NOT to Do

- Do NOT modify `skills/help/SKILL.md` -- it has no RAPID_ROOT references
- Do NOT modify `setup.sh` -- its `__RAPID_ROOT__` is a template placeholder, not the same variable
- Do NOT modify any files under `.planning/`, `.archive/`, or `agents/` directly (agents are generated)
- Do NOT change the validation line (`if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR]...`) -- it stays as-is
- Do NOT add `CLAUDE_SKILL_DIR` checks to blocks that previously had no validation (e.g., the register-web and status blocks that lack the error-exit line should remain without it)
