# Wave 3 PLAN: Skill Definition and Integration

## Objective

Create the `/rapid:documentation` skill command that orchestrates the full documentation generation workflow. This skill ties together all three library functions from waves 1-2, adds scope filtering and `--diff-only` mode, and provides the user-facing entry point for documentation generation. Also generate `docs/CHANGELOG.md` as a concrete output artifact demonstrating the pipeline end-to-end.

## File Ownership

| File | Action |
|------|--------|
| `skills/documentation/SKILL.md` | Create |
| `docs/CHANGELOG.md` | Create (generated artifact, not a hand-written doc) |

---

## Task 1: Create `skills/documentation/SKILL.md`

**File:** `skills/documentation/SKILL.md`

**Action:** Create the skill definition following the `scaffold/SKILL.md` pattern: YAML frontmatter with `description` and `allowed-tools`, then numbered steps with bash code blocks.

1. **Frontmatter:**
   ```yaml
   ---
   description: Generate, update, and maintain project documentation from git history and RAPID artifacts
   allowed-tools: Bash(rapid-tools:*), Read, Write, Edit
   ---
   ```

2. **Title:** `# /rapid:documentation -- Documentation Generation`

3. **Identity paragraph:** "You are the RAPID documentation generator. This skill produces and updates project documentation by scaffolding templates, extracting changelogs from RAPID artifacts, and performing diff-aware section updates. All documentation is derived from existing project state -- never fabricated."

4. **Environment Setup section:** Same env preamble block as scaffold/SKILL.md:
   ```bash
   RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
   if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
   if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
   ```

5. **Display Stage Banner:**
   ```bash
   # (env preamble)
   node "${RAPID_TOOLS}" display banner documentation
   ```

6. **Step 1: Parse Arguments**
   - Accept optional flags: `--scope <full|changelog|api|architecture>` and `--diff-only`
   - Default scope is `full`
   - `--diff-only` mode: only show what changed without generating new files

7. **Step 2: List Existing Documentation**
   ```bash
   # (env preamble)
   node "${RAPID_TOOLS}" docs list
   ```
   Parse the JSON output. Display a summary: N existing doc files found.

8. **Step 3: Generate Documentation (unless --diff-only)**
   - If NOT `--diff-only`:
     ```bash
     # (env preamble)
     node "${RAPID_TOOLS}" docs generate --scope {scope}
     ```
   - Parse JSON output. Report how many files were created vs skipped (already existed).
   - If files were created, read each new template file and use the Write/Edit tools to fill in content based on the current codebase state. The agent should:
     - Read relevant source files to understand what each doc section should contain
     - Use `updateDocSection` via the Edit tool to write real content into each section
     - Keep sections concise (2-5 paragraphs each)

9. **Step 4: Extract Changelog**
   - Determine the current milestone from ROADMAP.md (the agent reads the file to find the latest milestone ID).
   ```bash
   # (env preamble)
   node "${RAPID_TOOLS}" docs diff {milestoneId}
   ```
   - Parse JSON output. If entries exist, format them into Keep a Changelog markdown format.
   - Write the formatted changelog to `docs/CHANGELOG.md` using the Write tool. Format:
     ```markdown
     # Changelog

     ## [{milestoneId}]

     ### Added
     - {description} (`{setName}`)

     ### Changed
     - {description} (`{setName}`)

     ### Fixed
     - {description} (`{setName}`)
     ```
   - Only include category sections that have entries.

10. **Step 5: Summary and Diff**
    - If `--diff-only` was specified:
      - Run `git diff docs/` to show what has changed in the docs directory since the last commit
      - Display the diff summary
    - If NOT `--diff-only`:
      - Display a summary table of all documentation files with their status (created, updated, unchanged)
      - Suggest the user review changes with `git diff docs/`

11. **Step 6: Completion**
    - Display completion message:
      > **Documentation generation complete.** {N} files created, {M} files updated, {K} changelog entries extracted.
      >
      > Review changes with `git diff docs/` before committing.

12. **Important Constraints section:**
    - Documentation is derived from existing codebase and RAPID artifacts -- never fabricated
    - Template scaffolding is additive-only (never overwrites existing files)
    - Section updates preserve all non-targeted content exactly as-is
    - The skill does NOT commit changes -- the user reviews and commits manually
    - `--diff-only` mode is read-only (no file modifications)

**What NOT to do:**
- Do NOT include git commit steps in the skill (unlike scaffold which commits)
- Do NOT reference wave/job state -- this is a standalone user-facing skill
- Do NOT include implementation code in the skill -- it orchestrates CLI commands
- Do NOT use `AskUserQuestion` -- this is a single-pass generation skill

**Verification:**
```bash
test -f skills/documentation/SKILL.md && head -3 skills/documentation/SKILL.md
```
Expected: YAML frontmatter with `description` field.

---

## Task 2: Create `docs/CHANGELOG.md` template

**File:** `docs/CHANGELOG.md`

**Action:** Create a changelog template following Keep a Changelog format that the skill will populate.

Content:
```markdown
# Changelog

All notable changes to RAPID are documented here. This changelog is generated from ROADMAP.md set descriptions using `/rapid:documentation`.

Format follows [Keep a Changelog](https://keepachangelog.com/).

<!-- Generated by /rapid:documentation -- do not edit manually -->
```

This is a minimal template that the skill populates with actual entries via `updateDocSection`. The template exists so that `scaffoldDocTemplates` with `scope='changelog'` has a concrete target.

**What NOT to do:**
- Do NOT include fabricated changelog entries -- the template is a skeleton only
- Do NOT duplicate ROADMAP.md content here

**Verification:**
```bash
test -f docs/CHANGELOG.md && head -1 docs/CHANGELOG.md
```
Expected: `# Changelog`

---

## Task 3: Integration verification

**Action:** Run the full test suite and verify end-to-end CLI integration.

1. Run all unit tests:
   ```bash
   node --test src/lib/docs.test.cjs
   ```
   All tests from waves 1-3 must pass.

2. Verify CLI routing works end-to-end:
   ```bash
   node src/bin/rapid-tools.cjs docs list
   node src/bin/rapid-tools.cjs docs generate --scope changelog
   node src/bin/rapid-tools.cjs docs diff v3.4.0
   ```
   All three commands should produce valid JSON output without errors.

3. Verify skill file is properly formatted:
   ```bash
   head -5 skills/documentation/SKILL.md
   ```
   Should show YAML frontmatter with `description` and `allowed-tools`.

4. Verify exports are complete:
   ```bash
   node -e "const d = require('./src/lib/docs.cjs'); console.log(Object.keys(d).sort().join(', '))"
   ```
   Expected: `extractChangelog, scaffoldDocTemplates, updateDocSection`

**What NOT to do:**
- Do NOT modify any files during this task -- this is verification only
- Do NOT skip any verification step

---

## Success Criteria

1. `skills/documentation/SKILL.md` exists with proper YAML frontmatter and all 6 steps
2. `docs/CHANGELOG.md` exists with Keep a Changelog template skeleton
3. All unit tests pass: `node --test src/lib/docs.test.cjs`
4. All three CLI subcommands produce valid JSON output
5. The skill file references only existing CLI commands (`docs generate`, `docs list`, `docs diff`)
6. The skill includes `--scope` and `--diff-only` flag handling
7. No files from other sets are modified
