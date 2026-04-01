# PLAN: readme-migration / Wave 2

## Objective

Two parallel housekeeping operations that prepare the repository for its v5.0.0 public release:

1. **Reference migration**: Change all `fishjojo1/RAPID` references to `pragnition/RAPID` across active files. Archive directories (`.planning/archive/`, `.planning/milestones/`) and brainstorming docs (`oss_brainstorm/`) are excluded.
2. **Version bump**: Update all hardcoded `4.4.0` version strings to `5.0.0` across canonical locations and user-facing files.

These two sub-tasks touch mostly different lines in the same files, so they ship together as a single wave. README.md was already written with correct values in Wave 1, so it is NOT modified here.

## Owned Files

| File | Actions |
|------|---------|
| `.claude-plugin/plugin.json` | Version bump + reference migration (author, homepage, repository) |
| `package.json` | Version bump only (references already migrated) |
| `.planning/config.json` | Version bump only |
| `.planning/STATE.json` | Version bump (`rapidVersion` field only -- do NOT touch milestone `"id": "v4.4.0"`) |
| `DOCS.md` | Version bump (lines 5, 434) |
| `skills/install/SKILL.md` | Version bump (7 occurrences + fix typo on line 28) |
| `skills/status/SKILL.md` | Version bump (5 occurrences) |
| `skills/help/SKILL.md` | Version bump (2 occurrences) |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | Version bump (placeholder) |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | Version bump (placeholder) |
| `.planning/PROJECT.md` | Reference migration (line 87) |
| `.planning/context/CODEBASE.md` | Reference migration (line 8) |
| `.planning/STATE.md` | Reference migration (line 71) |
| `.planning/post-merge/hygiene-sweep/REVIEW-SCOPE.md` | Reference migration (line 224) |
| `.planning/ROADMAP.md` | Reference migration (lines 27, 39) + version reference in line 39 description |
| `.planning/research/v5.0-synthesis.md` | Reference migration (multiple lines) |
| `.planning/research/v5.0-research-pitfalls.md` | Reference migration (multiple lines) |
| `.planning/research/v5.0-research-features.md` | Reference migration |
| `.planning/research/v5.0-research-ux.md` | Reference migration |
| `.planning/research/v5.0-research-stack.md` | Reference migration |
| `.planning/research/v5.0-research-oversights.md` | Reference migration |
| `.planning/research/v5.0-research-architecture.md` | Reference migration |
| `.planning/research/STACK.md` | Reference migration (multiple lines) |

## Task 1: Version Bump -- Canonical 4 Locations

Update the version string from `4.4.0` to `5.0.0` in the four canonical locations. These must all be updated atomically (per CONTRACT.json behavioral constraint `version-consistency`).

### 1a. package.json (line 3)

Change:
```json
"version": "4.4.0",
```
To:
```json
"version": "5.0.0",
```

### 1b. .claude-plugin/plugin.json (line 3)

Change:
```json
"version": "4.4.0",
```
To:
```json
"version": "5.0.0",
```

### 1c. .planning/config.json (line 4)

Change:
```json
"version": "4.4.0"
```
To:
```json
"version": "5.0.0"
```

### 1d. .planning/STATE.json (line 3 only)

Change:
```json
"rapidVersion": "4.4.0",
```
To:
```json
"rapidVersion": "5.0.0",
```

**Critical**: Do NOT modify `"id": "v4.4.0"` on line 430 of STATE.json. That is a historical milestone identifier.

### Verification (Task 1)

```bash
# Canonical 4 -- all should show 5.0.0
grep '"version"' package.json | head -1
grep '"version"' .claude-plugin/plugin.json | head -1
grep '"version"' .planning/config.json | head -1
grep '"rapidVersion"' .planning/STATE.json

# Historical milestone ID must be preserved
grep '"id": "v4.4.0"' .planning/STATE.json  # Expect: 1 match (preserved)
```

## Task 2: Version Bump -- User-Facing Files

### 2a. DOCS.md

Two changes:

Line 5 -- change:
```
**Version:** 4.4.0
```
To:
```
**Version:** 5.0.0
```

Line 434 -- change:
```
RAPID v4.4.0 structures parallel work
```
To:
```
RAPID v5.0.0 structures parallel work
```

### 2b. skills/install/SKILL.md

Seven occurrences of `4.4.0` or `v4.4.0`. Change all to `5.0.0` / `v5.0.0` respectively (preserve the `v` prefix where it exists).

Specific locations:
- Line 2: `description: Install and configure RAPID v4.4.0 plugin` -> `v5.0.0`
- Line 7: `# /rapid:install -- v4.4.0 Plugin Installation` -> `v5.0.0`
- Line 9: `This skill bootstraps RAPID v4.4.0 by running` -> `v5.0.0`
- Line 28: `should contain some sort of reference to v4.4.0.0!` -> Fix typo: change `v4.4.0.0!` to `v5.0.0!` (remove the extra `.0`)
- Line 92: `update it to the new path for RAPID v4.4.0?` -> `v5.0.0`
- Line 319: `Header: "RAPID v4.4.0 installation complete"` -> `v5.0.0`
- Line 331: `display "RAPID v4.4.0 is ready. Happy building!"` -> `v5.0.0`

**Important**: Line 28 has a typo `v4.4.0.0!` -- fix this to `v5.0.0!` (single version, not `v5.0.0.0`).

### 2c. skills/status/SKILL.md

Five occurrences. Change all `4.4.0` / `v4.4.0` to `5.0.0` / `v5.0.0`:

- Line 6: `# /rapid:status -- v4.4.0 Set Dashboard` -> `v5.0.0`
- Line 8: `using v4.4.0 command names` -> `v5.0.0`
- Line 124: `determine the suggested v4.4.0 next action` -> `v5.0.0`
- Line 146: `the v4.4.0 command with numeric shorthand` -> `v5.0.0`
- Line 171: `v4.4.0 commands:` -> `v5.0.0`

### 2d. skills/help/SKILL.md

Two occurrences:

- Line 20: `## RAPID v4.4.0 Workflow` -> `v5.0.0`
- Line 108: `RAPID v4.4.0 | 7+3+4 commands` -> `v5.0.0`

### 2e. .github/ISSUE_TEMPLATE/bug-report.yml (line 9)

Change:
```yaml
placeholder: "e.g., v4.4.0"
```
To:
```yaml
placeholder: "e.g., v5.0.0"
```

### 2f. .github/ISSUE_TEMPLATE/feature-request.yml (line 9)

Change:
```yaml
placeholder: "e.g., v4.4.0"
```
To:
```yaml
placeholder: "e.g., v5.0.0"
```

### Verification (Task 2)

```bash
# Count 5.0.0 occurrences in each file
grep -c "5\.0\.0" DOCS.md  # Expect: 2
grep -c "5\.0\.0" skills/install/SKILL.md  # Expect: 7
grep -c "5\.0\.0" skills/status/SKILL.md  # Expect: 5
grep -c "5\.0\.0" skills/help/SKILL.md  # Expect: 2
grep -c "5\.0\.0" .github/ISSUE_TEMPLATE/bug-report.yml  # Expect: 1
grep -c "5\.0\.0" .github/ISSUE_TEMPLATE/feature-request.yml  # Expect: 1

# Ensure no stale 4.4.0 in these files
grep "4\.4\.0" DOCS.md  # Expect: 0 matches
grep "4\.4\.0" skills/install/SKILL.md  # Expect: 0 matches
grep "4\.4\.0" skills/status/SKILL.md  # Expect: 0 matches
grep "4\.4\.0" skills/help/SKILL.md  # Expect: 0 matches

# Verify typo fix on install/SKILL.md line 28
grep "v5.0.0.0" skills/install/SKILL.md  # Expect: 0 (typo fixed)
grep "v5.0.0!" skills/install/SKILL.md  # Expect: 1
```

## Task 3: Reference Migration -- Core Files

Change `fishjojo1` to `pragnition` in the 5 core active files identified by research.

### 3a. .claude-plugin/plugin.json

Three changes (this file also gets the version bump from Task 1b):

- Line 6: `"name": "fishjojo1"` -> `"name": "pragnition"`
- Line 8: `"homepage": "https://github.com/fishjojo1/RAPID"` -> `"homepage": "https://github.com/pragnition/RAPID"`
- Line 9: `"repository": "https://github.com/fishjojo1/RAPID"` -> `"repository": "https://github.com/pragnition/RAPID"`

### 3b. .planning/PROJECT.md (line 87)

Change:
```
Hosted at github.com/fishjojo1/RAPID.
```
To:
```
Hosted at github.com/pragnition/RAPID.
```

### 3c. .planning/context/CODEBASE.md (line 8)

Change:
```
hosted at github.com/fishjojo1/RAPID
```
To:
```
hosted at github.com/pragnition/RAPID
```

### Verification (Task 3)

```bash
# Core files should have zero fishjojo1 references
grep "fishjojo1" .claude-plugin/plugin.json  # Expect: 0
grep "fishjojo1" .planning/PROJECT.md  # Expect: 0
grep "fishjojo1" .planning/context/CODEBASE.md  # Expect: 0

# Verify pragnition is present
grep "pragnition" .claude-plugin/plugin.json  # Expect: 3 matches
grep "pragnition" .planning/PROJECT.md  # Expect: at least 1
grep "pragnition" .planning/context/CODEBASE.md  # Expect: at least 1
```

## Task 4: Reference Migration -- Borderline Files

These files are active (not in archive/milestones) but contain `fishjojo1` in contextual or historical-ish lines. Per the research decision, all are in scope because the CONTRACT behavioral constraint scopes exclusion to `.planning/archive/` and `.planning/milestones/` directories only.

### 4a. .planning/STATE.md (line 71)

Change:
```
Commit and push to fishjojo1/RAPID
```
To:
```
Commit and push to pragnition/RAPID
```

### 4b. .planning/post-merge/hygiene-sweep/REVIEW-SCOPE.md (line 224)

Change:
```
Zero `fishjojo1` references
```
To:
```
Zero `fishjojo1` references
```

Wait -- this line is a checklist item that describes the acceptance criterion of the migration itself. The content is "Zero `fishjojo1` references in DOCS.md, README.md, LICENSE, or rapid-web.service". The text `fishjojo1` here is used as a search term in a checklist description, not as an active URL or org reference. However, the research decision says to migrate it since it is not in an archive directory.

Change the line so the checklist description reflects the completed state. Change:
```
1. [wave-1] Zero `fishjojo1` references in DOCS.md, README.md, LICENSE, or rapid-web.service
```
To:
```
1. [wave-1] Zero `fishjojo1` references in DOCS.md, README.md, LICENSE, or rapid-web.service (verified -- all migrated to pragnition)
```

Actually, per the research, the instruction is to simply replace `fishjojo1` with `pragnition` throughout. But this line uses `fishjojo1` as a search term in backticks. Changing it to `pragnition` would change the meaning of the checklist item. Best approach: leave this line unchanged since modifying it would change the semantics of a verification checklist. The research decision was to migrate it, but the verification grep will flag it as a known exception.

**Decision for executor**: Skip this specific line. It contains `fishjojo1` inside backticks as a reference to the old name being checked for, not as an active reference. Document it as a known exception in the commit message.

### 4c. .planning/ROADMAP.md (lines 27, 39)

Both lines describe the migration work itself and contain `fishjojo1/RAPID` as descriptive text. Replace:

Line 27: Change `from fishjojo1/RAPID to pragnition/RAPID` to `from fishjojo1/RAPID to pragnition/RAPID` -- this line describes the migration, so `fishjojo1` is the "from" reference. Leave as-is since it describes what the migration does.

Line 39: Same pattern -- `Migrate all active fishjojo1/RAPID references to pragnition/RAPID`.

**Decision for executor**: Leave ROADMAP.md lines 27 and 39 unchanged. They describe the migration (what is being changed from/to) and changing `fishjojo1` here would make the description nonsensical. These are descriptive references, not active links.

### 4d. .planning/research/v5.0-*.md files and .planning/research/STACK.md

These research files contain `fishjojo1` extensively as part of their analysis of the migration work. They describe what needs to be migrated, list file inventories with `fishjojo1` content, and discuss risks related to incomplete migration.

**Decision for executor**: Leave all `.planning/research/` files unchanged. These are research artifacts that document the migration analysis. Replacing `fishjojo1` in them would corrupt the research findings (e.g., "Change `fishjojo1` to `pragnition`" would become "Change `pragnition` to `pragnition`" which is nonsensical). The verification grep should exclude `.planning/research/` as a known exception alongside `.planning/archive/` and `.planning/milestones/`.

### Verification (Task 4)

```bash
# STATE.md should have zero active fishjojo1 references
grep "fishjojo1" .planning/STATE.md  # Expect: 0

# Document known exceptions for the verification grep
echo "Known exceptions (not migrated intentionally):"
echo "- .planning/post-merge/hygiene-sweep/REVIEW-SCOPE.md:224 (backtick-quoted search term)"
echo "- .planning/ROADMAP.md:27,39 (describes the from/to migration)"
echo "- .planning/research/*.md (research analysis artifacts)"
```

## Task 5: Global Verification

Run comprehensive verification greps to confirm both operations are complete.

### 5a. Reference Migration Verification

```bash
# Verification grep for fishjojo1 in active files
# Exclude: archive, milestones, oss_brainstorm, research (analysis artifacts), ROADMAP (describes migration)
grep -r "fishjojo1" \
  --include="*.md" --include="*.json" --include="*.yml" --include="*.cjs" \
  --exclude-dir=".planning/archive" \
  --exclude-dir=".planning/milestones" \
  --exclude-dir="oss_brainstorm" \
  --exclude-dir=".archive" \
  --exclude-dir=".planning/research" \
  --exclude-dir=".planning/sets" \
  --exclude-dir="branding" \
  --exclude-dir="node_modules" \
  .

# Expected: Only these known exceptions (all intentional):
# - .planning/ROADMAP.md:27 (describes from/to migration)
# - .planning/ROADMAP.md:39 (describes from/to migration)
# - .planning/post-merge/hygiene-sweep/REVIEW-SCOPE.md:224 (backtick search term)
#
# All other active files should have ZERO fishjojo1 matches.
```

### 5b. Version Bump Verification

```bash
# Verification grep for stale 4.4.0 in active user-facing files
grep -r "4\.4\.0" \
  --include="*.md" --include="*.json" --include="*.yml" --include="*.cjs" \
  --exclude-dir=".planning/archive" \
  --exclude-dir=".planning/milestones" \
  --exclude-dir=".planning/research" \
  --exclude-dir=".planning/sets" \
  --exclude-dir="oss_brainstorm" \
  --exclude-dir=".archive" \
  --exclude-dir="branding/designs" \
  --exclude-dir="node_modules" \
  .

# Expected remaining hits (all historical/intentional):
# - .planning/STATE.json (milestone "id": "v4.4.0" -- preserved)
# - docs/CHANGELOG.md (historical changelog entry)
# - .planning/v4.4.0-AUDIT.md (historical audit report)
# - .planning/v4.4.0-DEFERRED.md (historical deferred items)
# - .planning/ROADMAP.md (historical milestone label "v4.4.0 Polish & Documentation")
#
# If any unexpected hits appear, they must be addressed before committing.
```

### 5c. Canonical Version Consistency Check

```bash
# All 4 canonical locations must show exactly "5.0.0"
echo "=== Canonical Version Check ==="
grep -o '"version": "[^"]*"' package.json | head -1
grep -o '"version": "[^"]*"' .claude-plugin/plugin.json | head -1
grep -o '"version": "[^"]*"' .planning/config.json | head -1
grep -o '"rapidVersion": "[^"]*"' .planning/STATE.json
# All four lines must show 5.0.0
```

## Success Criteria

1. All 4 canonical version locations show `5.0.0`
2. All 16 user-facing version references updated from `4.4.0` to `5.0.0`
3. Typo `v4.4.0.0!` in skills/install/SKILL.md fixed to `v5.0.0!`
4. `fishjojo1` replaced with `pragnition` in plugin.json (author + homepage + repository), PROJECT.md, CODEBASE.md, STATE.md
5. Historical milestone IDs preserved (`"id": "v4.4.0"` in STATE.json)
6. Archive directories untouched
7. Global verification greps pass with only known exceptions
8. Research files left unchanged (they describe the migration, not active references)

## What NOT to Do

- Do NOT modify README.md -- it was already written with correct values in Wave 1
- Do NOT modify `.planning/STATE.json` line 430 (`"id": "v4.4.0"` milestone) -- this is a historical identifier
- Do NOT modify `docs/CHANGELOG.md` -- historical changelog entries are preserved
- Do NOT modify `.planning/v4.4.0-AUDIT.md` or `.planning/v4.4.0-DEFERRED.md` -- historical reports
- Do NOT modify `.planning/ROADMAP.md` milestone labels (e.g., "v4.4.0 Polish & Documentation") -- historical labels preserved
- Do NOT modify `branding/designs/16-terminal/banner.svg` -- deferred per CONTEXT.md
- Do NOT modify files in `.planning/archive/`, `.planning/milestones/`, or `oss_brainstorm/`
- Do NOT modify `.planning/research/` files -- they document the migration analysis and changing them would corrupt research findings
- Do NOT modify `.planning/sets/` files -- these are planning artifacts, not deliverables
- Do NOT use global find-and-replace without checking each file -- some `4.4.0` and `fishjojo1` references are intentionally preserved
