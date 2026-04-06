# Wave 1 PLAN: Version Bump (5.0.0 -> 6.0.0)

## Objective

Update all version references from 5.0.0 to 6.0.0 across the 13 files identified by the research sweep (8 canonical + 5 additional). Also fix the README.md Node.js badge from 18+ to 20+ to match the actual minimum set by bug-fixes-foundation.

## Task 1: Bump JSON Config Files (4 files)

Update the version field in each of the 4 JSON configuration files. Use targeted field-level edits -- do NOT use global find-replace on STATE.json because it contains historical milestone IDs like `"v5.0"` that must be preserved.

### Files and Edits

**package.json** (line 3):
- Change `"version": "5.0.0"` to `"version": "6.0.0"`

**.claude-plugin/plugin.json** (line 3):
- Change `"version": "5.0.0"` to `"version": "6.0.0"`

**.planning/config.json** (line 4):
- Change `"version": "5.0.0"` to `"version": "6.0.0"`

**.planning/STATE.json** (line 3):
- Change `"rapidVersion": "5.0.0"` to `"rapidVersion": "6.0.0"`
- CRITICAL: Do NOT change any other lines in STATE.json. Historical milestone IDs like `"id": "v5.0"` must remain unchanged.

### Verification

```bash
# All 4 must show 6.0.0
grep '"version"' package.json
grep '"version"' .claude-plugin/plugin.json
grep '"version"' .planning/config.json
grep '"rapidVersion"' .planning/STATE.json

# Ensure no 5.0.0 remains in these files
grep '5\.0\.0' package.json .claude-plugin/plugin.json .planning/config.json
# STATE.json: only check the rapidVersion line
head -5 .planning/STATE.json | grep '5\.0\.0'
```

### Success Criteria
- All 4 JSON files show version 6.0.0 in their respective version fields
- STATE.json historical milestone IDs remain unchanged

---

## Task 2: Bump Skill Markdown Files (3 files)

Use global find-replace of `5.0.0` with `6.0.0` in each skill file. This is safe because these files contain only RAPID version references.

### Files and Edits

**skills/help/SKILL.md** -- 2 occurrences:
- Line 20: `## RAPID v5.0.0 Workflow` -> `## RAPID v6.0.0 Workflow`
- Line 108: `RAPID v5.0.0 | 7+3+4 commands` -> `RAPID v6.0.0 | 7+3+4 commands`
- Use `replace_all` with old_string `5.0.0` and new_string `6.0.0`

**skills/install/SKILL.md** -- 7 occurrences (mix of `5.0.0` and `v5.0.0`):
- Line 2: frontmatter description
- Line 7: heading
- Line 9: body text
- Line 28: version detection caveat
- Line 92: AskUserQuestion text
- Line 319: header text
- Line 331: display text
- Use `replace_all` with old_string `5.0.0` and new_string `6.0.0` (this handles both `v5.0.0` -> `v6.0.0` and bare `5.0.0` -> `6.0.0`)

**skills/status/SKILL.md** -- 5 occurrences:
- Line 6: heading
- Line 8: body text
- Line 124: suggested action text
- Line 146: numeric shorthand text
- Line 171: command names text
- Use `replace_all` with old_string `5.0.0` and new_string `6.0.0`

### Verification

```bash
# Should return 0 hits for 5.0.0
grep '5\.0\.0' skills/help/SKILL.md skills/install/SKILL.md skills/status/SKILL.md

# Should return expected counts for 6.0.0
grep -c '6\.0\.0' skills/help/SKILL.md      # Expect: 2
grep -c '6\.0\.0' skills/install/SKILL.md    # Expect: 7
grep -c '6\.0\.0' skills/status/SKILL.md     # Expect: 5
```

### Success Criteria
- Zero remaining `5.0.0` references in all 3 skill files
- Correct occurrence counts for `6.0.0` (2, 7, 5 respectively)

---

## Task 3: Bump User-Facing Documentation (2 files)

### Files and Edits

**README.md**:
- Line 6: Change `version-5.0.0` to `version-6.0.0` in the shields.io badge URL
- Line 9: Change `Node.js-18%2B` to `Node.js-20%2B` in the shields.io badge URL (reflects bug-fixes-foundation change: prereqs.cjs now requires Node 20+)
- These are 2 separate edits on 2 different lines. Be precise.

**DOCS.md**:
- Line 5: Change `**Version:** 5.0.0` to `**Version:** 6.0.0`
- Line 438: Change `RAPID v5.0.0 structures parallel work` to `RAPID v6.0.0 structures parallel work`

### Verification

```bash
# README: version badge should show 6.0.0, Node.js badge should show 20+
grep 'version-' README.md | head -1     # Expect: version-6.0.0
grep 'Node.js-' README.md | head -1     # Expect: Node.js-20%2B

# DOCS.md: no 5.0.0 remaining
grep '5\.0\.0' DOCS.md                   # Expect: 0 hits

# DOCS.md: verify 6.0.0 present
grep '6\.0\.0' DOCS.md                   # Expect: 2 hits
```

### Success Criteria
- README.md version badge shows 6.0.0
- README.md Node.js badge shows 20+ (not 18+)
- DOCS.md shows version 6.0.0 in both locations

---

## Task 4: Bump GitHub Issue Templates (2 files)

### Files and Edits

**.github/ISSUE_TEMPLATE/bug-report.yml** (line 9):
- Change `placeholder: "e.g., v5.0.0"` to `placeholder: "e.g., v6.0.0"`

**.github/ISSUE_TEMPLATE/feature-request.yml** (line 9):
- Change `placeholder: "e.g., v5.0.0"` to `placeholder: "e.g., v6.0.0"`

### Verification

```bash
grep 'placeholder' .github/ISSUE_TEMPLATE/bug-report.yml
grep 'placeholder' .github/ISSUE_TEMPLATE/feature-request.yml
# Both should show v6.0.0
```

### Success Criteria
- Both GitHub issue templates show `v6.0.0` as the version placeholder

---

## Task 5: Full Verification Sweep

After completing all 4 tasks above, run the canonical verification command from bump-version.md to catch any stragglers.

```bash
grep -rn "5\.0\.0" --include="*.json" --include="*.md" --include="*.cjs" --include="*.js" --include="*.ts" --include="*.yml" --exclude-dir=node_modules --exclude-dir=.rapid-worktrees --exclude-dir=.archive --exclude-dir=archive .
```

### Expected Remaining Hits (all acceptable -- DO NOT change these)

| File | Reason to Skip |
|------|---------------|
| `.planning/research/STACK.md` | Research artifact documenting the 5.0.0->6.0.0 task |
| `.planning/research/v6.0.0-research-*.md` | Historical research files |
| `.planning/sets/docs-version-bump/*.md` | Set planning artifacts describing the task |
| `.planning/ROADMAP.md` | Task description text, not a version reference |
| `.planning/STATE.json` | Historical milestone ID `"v5.0"` -- NOT the rapidVersion field |
| `web/frontend/package-lock.json` | Unrelated `sugarss: "^5.0.0"` dependency |
| `.planning/archive/` | Historical archive files (excluded by --exclude-dir) |

If any unexpected 5.0.0 references remain in active files (not in the table above), fix them before committing.

### Success Criteria
- All remaining `5.0.0` references are in the acceptable list above
- No active/user-facing files contain stale `5.0.0` references

---

## Commit

After all tasks pass verification, create a single commit:

```
docs(docs-version-bump): bump version references from 5.0.0 to 6.0.0
```

Files to stage (13 files):
- `package.json`
- `.claude-plugin/plugin.json`
- `.planning/config.json`
- `.planning/STATE.json`
- `skills/help/SKILL.md`
- `skills/install/SKILL.md`
- `skills/status/SKILL.md`
- `README.md`
- `DOCS.md`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/feature-request.yml`

Do NOT stage `docs/CHANGELOG.md` -- that is Wave 2.
