# PLAN: docs-update -- Wave 2

**Objective:** Update DOCS.md to accurately reflect v5.0. DOCS.md is already close to target (routing-hub format, ~v4.4 content). This wave applies incremental fixes identified in GAP-ANALYSIS.md: fix state machine status names, add missing v5.0 features, verify file structure tree, and ensure all docs/ cross-references are present.

**Input:** `.planning/sets/docs-update/GAP-ANALYSIS.md` (produced by Wave 1)
**Modified File:** `DOCS.md`

---

## Task 1: Fix State Machine Section

**File:** `DOCS.md` (Architecture Overview > State Machine section, around line 449-455)

**Action:** Replace the state machine diagram and description to use past-tense status names matching `docs/state-machines.md` (the canonical reference).

**Current (wrong):**
```
pending --> discussing --> planning --> executing --> complete --> merged
```

**Replace with:**
```
pending --> discussed --> planned --> executed --> complete --> merged
              ^                        ^
              |                        |
              +-- (self-loop)          +-- (self-loop)
```

**Additional changes in this section:**
- Add note about the `pending -> planned` shortcut (skip discuss)
- Add note about `discussed -> discussed` and `executed -> executed` self-loops
- Add note about solo mode auto-transition `complete -> merged`
- Ensure the text says "see [docs/state-machines.md](docs/state-machines.md) for full transition rules" (keep existing link)

**What NOT to do:** Do not reproduce the full transition table from docs/state-machines.md. DOCS.md is a routing hub -- brief summary plus link.

**Verification:** `grep -c "discussed" DOCS.md` returns at least 2 (diagram + text). `grep -c "discussing" DOCS.md` returns 0 (fully replaced).

---

## Task 2: Add Missing v5.0 Features

**File:** `DOCS.md`

**Action:** Add documentation for v5.0 features that are missing from DOCS.md. Consult GAP-ANALYSIS.md for the complete list. Known missing features:

1. **UAT workflow rewrite** -- The `/rapid:uat` entry (around line 199-207) needs updating if the v5.0 UAT workflow changed to plan-generation-only with human-verified loop and UAT-FAILURES.md. Check the actual `skills/uat/` implementation and `docs/review.md` to determine the current behavior. Update the entry accordingly.

2. **bug-fix --uat flag** -- The `/rapid:bug-fix` entry (around line 299-306) should mention the `--uat` flag if it exists. Check `skills/bug-fix/` for the actual flag support.

3. **Branding server** -- If `branding-server.cjs` exists in the codebase, verify whether it warrants mention in DOCS.md. The `/rapid:branding` entry already exists (around line 371-379). Only add branding server details if it is a user-facing feature.

4. **Planning granularity** -- Check if the `--granularity` flag or generous planning prompt is a user-facing feature that needs documentation in the `/rapid:plan-set` entry.

**For each feature:** Follow the existing routing-hub format -- command name, one-line description, key flags, code block with usage example, link to relevant docs/ file.

**What NOT to do:** Do not add features that do not actually exist in the codebase. Verify each feature against the skill directory before adding it.

**Verification:** Each added feature has a usage example code block and a link to a docs/ file.

---

## Task 3: Verify and Update File Structure Tree

**File:** `DOCS.md` (File Structure section, around lines 469-513)

**Action:** Compare the file structure tree in DOCS.md against the actual directory listing. Run `ls` on the key directories (skills/, agents/, src/, docs/) and update the tree to match reality.

**Specific checks:**
- All 28 skill directories under `skills/` are listed
- The `agents/` comment reflects the actual count
- Any new top-level files or directories are included
- The `docs/` entry reflects all 11 files
- The `branding-server.cjs` file location is included if it exists

**What NOT to do:** Do not list every single file -- the tree should show directory structure with representative entries, matching the existing style.

**Verification:** `diff <(grep "skills/" DOCS.md | wc -l) <(ls -d skills/*/ | wc -l)` -- the skill count in the tree matches the actual skill count (or is close if the tree uses representative entries).

---

## Task 4: Verify Cross-References to docs/

**File:** `DOCS.md`

**Action:** Ensure every one of the 11 docs/ files is linked from DOCS.md at least once. Check the GAP-ANALYSIS.md cross-reference checklist.

**The 11 docs/ files:**
1. `docs/agents.md`
2. `docs/auxiliary.md`
3. `docs/CHANGELOG.md`
4. `docs/configuration.md`
5. `docs/execution.md`
6. `docs/merge-and-cleanup.md`
7. `docs/planning.md`
8. `docs/review.md`
9. `docs/setup.md`
10. `docs/state-machines.md`
11. `docs/troubleshooting.md`

**For any missing link:** Add it in the most natural location (usually the "See [docs/X.md] for details" pattern already used throughout DOCS.md).

**Verification:** For each docs/ file, `grep -c "docs/filename.md" DOCS.md` returns at least 1.

---

## Task 5: Add Cross-Reference to technical_documentation.md

**File:** `DOCS.md`

**Action:** Ensure DOCS.md has an explicit cross-reference to `technical_documentation.md`. This should appear in a natural location -- likely the introductory paragraph (around line 7) or the Table of Contents.

**Target text (example):** "For architectural deep-dives and system design narrative, see [technical_documentation.md](technical_documentation.md)."

**Verification:** `grep -c "technical_documentation.md" DOCS.md` returns at least 1.

---

## Success Criteria

1. State machine diagram uses past-tense names (`discussed`, `planned`, `executed`) everywhere
2. No occurrences of present-tense status names (`discussing`, `planning`, `executing`) remain in DOCS.md state machine context (note: these words may legitimately appear in prose descriptions of actions, only the status name usages should be past-tense)
3. All v5.0 features verified in the codebase are documented
4. File structure tree matches actual directory layout
5. All 11 docs/ files are linked at least once
6. Explicit cross-reference to technical_documentation.md is present
7. DOCS.md routing-hub format is preserved (brief entries with links, not exhaustive detail)
