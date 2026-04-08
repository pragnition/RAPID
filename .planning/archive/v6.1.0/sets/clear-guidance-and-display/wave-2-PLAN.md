# Wave 2 PLAN: Application -- Wire Footers into All Skills + Structural Test

## Objective

Apply the `display footer` CLI call to all 18 skills that produce artifacts or consume significant context. Each skill's existing "Next step" text, progress breadcrumb, and any scattered guidance get replaced by a single `display footer` invocation at skill completion. Additionally, add a structural regression test to `tests/display.test.cjs` that verifies every designated skill contains the footer call.

## Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `skills/init/SKILL.md` | Modify | Replace Steps 12-13 (Next Step + Breadcrumb) with footer call |
| `skills/start-set/SKILL.md` | Modify | Replace Steps 5-6 (Next Step + Breadcrumb) with footer call |
| `skills/discuss-set/SKILL.md` | Modify | Replace Step 9 next-step + breadcrumb with footer call |
| `skills/plan-set/SKILL.md` | Modify | Replace Next Step + Breadcrumb in confirmation section with footer call |
| `skills/execute-set/SKILL.md` | Modify | Replace next-step + breadcrumb in Step 6 completion with footer call |
| `skills/review/SKILL.md` | Modify | Replace "Next steps" in Step 5 completion banner with footer call |
| `skills/merge/SKILL.md` | Modify | Replace "Next steps" after Step 8 summary with footer call |
| `skills/new-version/SKILL.md` | Modify | Replace next-step + breadcrumb in Step 9 with footer call |
| `skills/add-set/SKILL.md` | Modify | Replace next-step in Step 7 with footer call |
| `skills/scaffold/SKILL.md` | Modify | Replace next-step in Step 4 completion with footer call |
| `skills/audit-version/SKILL.md` | Modify | Add footer call after Step 5 completion banner |
| `skills/quick/SKILL.md` | Modify | Add footer call after completion display |
| `skills/branding/SKILL.md` | Modify | Add footer call after summary display |
| `skills/documentation/SKILL.md` | Modify | Add footer call after Step 6 completion |
| `skills/unit-test/SKILL.md` | Modify | Add footer call after Step 8 completion banner |
| `skills/bug-hunt/SKILL.md` | Modify | Add footer call after Step 4 completion banner |
| `skills/uat/SKILL.md` | Modify | Add footer call after Step 9 completion banner |
| `skills/bug-fix/SKILL.md` | Modify | Add footer call after Step 5 results display |
| `tests/display.test.cjs` | Modify | Add structural regression test (append to existing file from Wave 1) |

---

## Footer Call Template

Every skill uses the same CLI invocation pattern. The footer call goes at the very end of the skill's success path, AFTER any existing completion summary/banner, and BEFORE the `---` separator that precedes Error Handling or Anti-Patterns sections.

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "<next-command>" --breadcrumb "<breadcrumb-string>"
```

The env preamble is mandatory before every CLI call per RAPID convention.

**Important**: The footer REPLACES the existing scattered "Next step:" blockquote lines and standalone breadcrumb blocks. Remove those lines when adding the footer. The footer consolidates next-step, /clear reminder, and breadcrumb into one output block.

**Important**: Do NOT remove or modify error breadcrumbs. Error breadcrumbs are inline diagnostic output that remain unchanged. Only success-path next-step and breadcrumb patterns are consolidated into the footer.

---

## Task 1: Wire footer into init SKILL.md

**File:** `skills/init/SKILL.md`

**Action:** Replace the content of Step 12 (Next Step, lines ~1280-1303) and Step 13 (Progress Breadcrumb, lines ~1305-1313) with a single footer section.

**Replace Step 12 and Step 13 with:**

```markdown
## Step 12: Footer

Display the completion footer. The next command depends on team-size and set availability:

**When sets are available (common case):**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:start-set 1" --breadcrumb "init [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
\`\`\`

**When no sets are planned:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status" --breadcrumb "init [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
\`\`\`
```

**What to remove:**
- The `> **Next step:** ...` blockquote lines in Step 12
- The standalone breadcrumb block in Step 13
- The prose about "This breadcrumb shows..."
- Keep the Step 11 completion summary unchanged

**What NOT to do:**
- Do NOT modify error breadcrumbs elsewhere in the file (Steps 6-9 error handling)
- Do NOT change the completion summary in Step 11 -- only the next-step/breadcrumb output changes

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/init/SKILL.md
```
Expected: At least 1 (the footer calls).

```bash
grep -c "Step 13" /home/kek/Projects/RAPID/skills/init/SKILL.md
```
Expected: 0 (Step 13 removed, merged into Step 12).

---

## Task 2: Wire footer into start-set SKILL.md

**File:** `skills/start-set/SKILL.md`

**Action:** Replace Step 5 (Next Step, lines ~205-216) and Step 6 (Progress Breadcrumb, lines ~218-230) with a single footer section.

**Replace with:**

```markdown
## Step 5: Footer

Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:discuss-set {setIndex}" --breadcrumb "init [done] > start-set [done] > discuss-set > plan-set > execute-set > review > merge"
\`\`\`
```

Where `{setIndex}` is the resolved set index from Step 1.

**What to remove:**
- The `> **Next step:** ...` blockquote in Step 5
- The standalone breadcrumb block in Step 6
- Step 6 header entirely (merged into Step 5)

**What NOT to do:**
- Do NOT modify the error breadcrumb in the Error Handling section

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/start-set/SKILL.md
```
Expected: At least 1.

---

## Task 3: Wire footer into discuss-set SKILL.md

**File:** `skills/discuss-set/SKILL.md`

**Action:** Replace the next-step and breadcrumb in Step 9 (lines ~440-451) with a footer call.

**Replace the next-step blockquote and breadcrumb block with:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:plan-set {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set > execute-set > review > merge"
\`\`\`
```

Keep the Step 9 header `## Step 9: Next Steps` but rename it to `## Step 9: Footer`.

**What to remove:**
- The `> **Next step:** ...` blockquote
- The `Display progress breadcrumb:` line and the standalone breadcrumb code block

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/discuss-set/SKILL.md
```
Expected: At least 1.

---

## Task 4: Wire footer into plan-set SKILL.md

**File:** `skills/plan-set/SKILL.md`

**Action:** Replace the "Next Step" and "Progress Breadcrumb" subsections in the confirmation section (lines ~369-391) with footer calls.

**Replace with:**

```markdown
### Footer

Display the completion footer:

**If `GAPS_MODE=true`:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:execute-set {SET_INDEX} --gaps" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [done] > gap-closure plan [done]"
\`\`\`

**If `GAPS_MODE=false`:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:execute-set {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set > review > merge"
\`\`\`
```

**What to remove:**
- The `### Next Step` subsection header and its `> **Next step:** ...` blockquotes
- The `### Progress Breadcrumb` subsection header and its standalone breadcrumb code blocks

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/plan-set/SKILL.md
```
Expected: At least 2 (gaps mode and normal mode).

---

## Task 5: Wire footer into execute-set SKILL.md

**File:** `skills/execute-set/SKILL.md`

**Action:** There are two completion paths in this file -- the normal path (lines ~552-560) and the gap-closure path (lines ~449-456). Replace each with footer calls.

**Normal path (lines ~552-560) -- replace next-step blockquote and breadcrumb with:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:review {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge"
\`\`\`
```

**Gap-closure path (lines ~449-456) -- replace the conditional next-step and breadcrumb with:**

```markdown
Display the completion footer (next command depends on gap status):

If all gaps resolved:
\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:review {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [done] > gap-closure [done]"
\`\`\`

If gaps remain:
\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:plan-set {SET_INDEX} --gaps" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [done] > gap-closure [done]"
\`\`\`
```

**What to remove:**
- The `> **Next step:** ...` blockquote lines
- The `Display progress breadcrumb:` lines and standalone breadcrumb code blocks
- The `Display next step:` lines

**What NOT to do:**
- Do NOT modify error breadcrumbs in the Error Handling section
- Do NOT change the completion summary text ("Set '{SET_ID}' execution complete.")

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/execute-set/SKILL.md
```
Expected: At least 3 (normal path + 2 gap-closure variants).

---

## Task 6: Wire footer into review SKILL.md

**File:** `skills/review/SKILL.md`

**Action:** The Step 5 completion banner (lines ~340-379) contains "Next steps:" with multiple options. Add a footer call after the existing completion banner block. The review skill has multiple next options, so use the first/primary one (`/rapid:unit-test {setIndex}`) as the next command.

**Add after the completion banner closing `----` line:**

```markdown
Display the completion footer:

**If `POST_MERGE=true`:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:unit-test {setIndex} --post-merge" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review [done] > merge"
\`\`\`

**Standard path:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:unit-test {setIndex}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review [done] > merge"
\`\`\`
```

**Note:** Keep the existing completion banner with its "Next steps:" list as informational context. The footer provides the /clear reminder and primary next command. The banner's multiple-option list remains for user reference.

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/review/SKILL.md
```
Expected: At least 2.

---

## Task 7: Wire footer into merge SKILL.md

**File:** `skills/merge/SKILL.md`

**Action:** Add a footer call after the "Next steps" blockquote (lines ~641-647). Keep the existing multi-option next-steps list. The footer provides the /clear reminder with the primary next action.

**Add after the `> - /rapid:new-version ...` line:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:cleanup" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review [done] > merge [done]"
\`\`\`
```

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/merge/SKILL.md
```
Expected: At least 1.

---

## Task 8: Wire footer into new-version SKILL.md

**File:** `skills/new-version/SKILL.md`

**Action:** Replace the next-step lines and breadcrumb block in Step 9 (lines ~719-749) with footer calls.

**Replace the two conditional next-step blocks and the breadcrumb with:**

```markdown
Display the completion footer:

**When sets were planned:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:start-set 1" --breadcrumb "new-version [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
\`\`\`

**When no sets were planned:**

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status" --breadcrumb "new-version [done] > start-set > discuss-set > plan-set > execute-set > review > merge"
\`\`\`
```

**What to remove:**
- The `Next step: /rapid:start-set 1` plain text line
- The `Next step: /rapid:status` plain text line
- The `Show progress breadcrumb at the end:` line and standalone breadcrumb code block

Keep the completion summary block (milestone name, sets planned, carried forward).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/new-version/SKILL.md
```
Expected: At least 2.

---

## Task 9: Wire footer into add-set SKILL.md

**File:** `skills/add-set/SKILL.md`

**Action:** Replace the next-step blockquote in Step 7 (line ~241) with a footer call.

**Replace `> **Next step:** ...` with:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:start-set {SET_INDEX}"
\`\`\`
```

No breadcrumb for add-set (it is an ad-hoc operation, not part of the linear pipeline).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/add-set/SKILL.md
```
Expected: At least 1.

---

## Task 10: Wire footer into scaffold SKILL.md

**File:** `skills/scaffold/SKILL.md`

**Action:** Replace the next-step blockquote in Step 4 (line ~130) with a footer call.

**Replace `> **Next step:** Continue with ...` with:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:start-set"
\`\`\`
```

No breadcrumb for scaffold (it runs before the set lifecycle).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/scaffold/SKILL.md
```
Expected: At least 1.

---

## Task 11: Wire footer into audit-version SKILL.md

**File:** `skills/audit-version/SKILL.md`

**Action:** Add a footer call after the Step 5 completion banner (line ~426).

**Add after the `---` closing the completion banner:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:new-version"
\`\`\`
```

No breadcrumb (audit is a standalone analysis step).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/audit-version/SKILL.md
```
Expected: At least 1.

---

## Task 12: Wire footer into quick SKILL.md

**File:** `skills/quick/SKILL.md`

**Action:** The quick skill currently says "Do NOT suggest a next action" (line ~264). Override this policy by adding a footer call after the completion display (lines ~257-261). Remove the "Do NOT suggest a next action" instruction.

**Add after the completion display block and before line 263 ("Do NOT add to STATE.json..."):**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status"
\`\`\`
```

**Also remove** the line: `Do NOT suggest a next action (fire-and-forget -- user is done).`

No breadcrumb (quick tasks are standalone).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/quick/SKILL.md
```
Expected: At least 1.

---

## Task 13: Wire footer into branding SKILL.md

**File:** `skills/branding/SKILL.md`

**Action:** Add a footer call after the branding summary display (lines ~501-510), before the `---` that precedes Error Handling.

**Add after the summary block closing backticks:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status"
\`\`\`
```

No breadcrumb (branding is standalone).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/branding/SKILL.md
```
Expected: At least 1.

---

## Task 14: Wire footer into documentation SKILL.md

**File:** `skills/documentation/SKILL.md`

**Action:** Add a footer call after the Step 6 completion message (lines ~132-139), before the `---` that precedes Important Constraints.

**Add after the existing completion blockquote:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status"
\`\`\`
```

No breadcrumb (documentation is standalone).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/documentation/SKILL.md
```
Expected: At least 1.

---

## Task 15: Wire footer into unit-test SKILL.md

**File:** `skills/unit-test/SKILL.md`

**Action:** Add a footer call after the Step 8 completion banner (which already has "Next steps:" list). Add after the banner's closing `---` line.

**Add:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:bug-hunt {setIndex}" --breadcrumb "review [done] > unit-test [done] > bug-hunt > uat"
\`\`\`
```

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/unit-test/SKILL.md
```
Expected: At least 1.

---

## Task 16: Wire footer into bug-hunt SKILL.md

**File:** `skills/bug-hunt/SKILL.md`

**Action:** Add a footer call after the Step 4 completion section (which includes the `mark-stage` CLI call), before the Important Notes section.

**Add:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:uat {setIndex}" --breadcrumb "review [done] > unit-test [done] > bug-hunt [done] > uat"
\`\`\`
```

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/bug-hunt/SKILL.md
```
Expected: At least 1.

---

## Task 17: Wire footer into uat SKILL.md

**File:** `skills/uat/SKILL.md`

**Action:** Add a footer call after the Step 9 completion banner, before the Important Notes section.

**Add:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:review summary {setIndex}" --breadcrumb "review [done] > unit-test [done] > bug-hunt [done] > uat [done]"
\`\`\`
```

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/uat/SKILL.md
```
Expected: At least 1.

---

## Task 18: Wire footer into bug-fix SKILL.md

**File:** `skills/bug-fix/SKILL.md`

**Action:** Add a footer call after the Step 5 results display (lines ~271-283), replacing the `Exit. Do NOT prompt for further action.` instruction.

**Replace `Exit. Do NOT prompt for further action.` with:**

```markdown
Display the completion footer:

\`\`\`bash
# (env preamble here)
node "${RAPID_TOOLS}" display footer "/rapid:status"
\`\`\`
```

No breadcrumb (bug-fix is standalone).

**Verification:**
```bash
grep -c "display footer" /home/kek/Projects/RAPID/skills/bug-fix/SKILL.md
```
Expected: At least 1.

---

## Task 19: Add structural regression test

**File:** `tests/display.test.cjs`

**Action:** Append a new `describe` block to the existing test file (created in Wave 1) that verifies all designated skills contain the `display footer` CLI call.

**Test design:**

1. Define a canonical list of skill names that MUST contain `display footer`:
   ```javascript
   const FOOTER_REQUIRED_SKILLS = [
     'init', 'start-set', 'discuss-set', 'plan-set', 'execute-set',
     'review', 'merge', 'new-version', 'add-set', 'scaffold',
     'audit-version', 'quick', 'branding', 'documentation',
     'unit-test', 'bug-hunt', 'uat', 'bug-fix',
   ];
   ```

2. Define skills that are explicitly excluded (no footer needed):
   ```javascript
   const FOOTER_EXCLUDED_SKILLS = [
     'help', 'install', 'status', 'cleanup', 'pause', 'resume',
     'assumptions', 'context', 'migrate', 'register-web',
   ];
   ```

3. **Test: each required skill contains display footer**: For each skill in `FOOTER_REQUIRED_SKILLS`, read `skills/{name}/SKILL.md` and assert it contains the string `display footer`.

4. **Test: directory scan for unlisted skills**: Read the `skills/` directory, filter to directories only (exclude files like `review-auto-detect.test.cjs`), and assert that every directory is in either `FOOTER_REQUIRED_SKILLS` or `FOOTER_EXCLUDED_SKILLS`. Any unlisted skill triggers a test failure with a message: `Skill '{name}' is not in FOOTER_REQUIRED_SKILLS or FOOTER_EXCLUDED_SKILLS -- add it to one list`.

5. Use `fs.readFileSync` with `path.resolve(__dirname, '..', 'skills', name, 'SKILL.md')` to read each skill file. Use `fs.readdirSync` with `{ withFileTypes: true }` filtered to `.isDirectory()` for directory scanning.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test tests/display.test.cjs
```
Expected: All tests pass, including structural test.

---

## Success Criteria

- [ ] All 18 skills contain at least one `display footer` CLI call in their SKILL.md
- [ ] Existing "Next step" blockquotes are replaced (not duplicated) in lifecycle skills
- [ ] Error breadcrumbs remain unchanged in all skills
- [ ] Structural test passes: all required skills verified, no unlisted skills in directory
- [ ] All unit tests pass: `node --test tests/display.test.cjs`
- [ ] Existing tests still pass: `node --test tests/merge-regression.test.cjs`
