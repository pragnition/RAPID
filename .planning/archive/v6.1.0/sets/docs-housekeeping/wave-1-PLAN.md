# Wave 1 PLAN: Version Bumps and Stale Prose Fixes

## Objective
Bump all active version references from 6.0.0 to 6.1.0 across the repository, fix stale command counts (28 -> 29), and correct stale Node.js version prerequisites (20+ -> 22+). This wave touches only existing version strings and factual corrections -- no new prose is authored.

## Pre-Flight
Before starting any edits, run a repo-wide grep to confirm the full list of 6.0.0 references and verify which are historical (must NOT change) vs active (must change):
```bash
grep -rn "6\.0\.0" --include="*.json" --include="*.md" --include="*.yml" /home/kek/Projects/RAPID | grep -v node_modules | grep -v '.planning/archive' | grep -v '.planning/ROADMAP' | grep -v '.planning/v6.0.0-AUDIT' | grep -v 'docs/CHANGELOG' | grep -v '.planning/research' | grep -v '.planning/quick' | grep -v '.planning/sets/' | grep -v 'web/' | grep -v '.archive'
```
This should return ONLY the files listed in the tasks below. If additional files appear, evaluate them before proceeding.

## Tasks

### Task 1: Canonical Version Fields (JSON files)
**Files:**
- `/home/kek/Projects/RAPID/package.json` (line 3)
- `/home/kek/Projects/RAPID/.claude-plugin/plugin.json` (line 3)
- `/home/kek/Projects/RAPID/.planning/config.json` (line 4)
- `/home/kek/Projects/RAPID/.planning/STATE.json` (line 3, `rapidVersion` field ONLY)

**Action:** In each file, replace `"6.0.0"` with `"6.1.0"` in the version/rapidVersion field only. Do NOT touch any other fields in STATE.json (e.g., milestone IDs that reference v6.0.0 are historical).

**Verification:**
```bash
grep -n '"version".*6\.1\.0' /home/kek/Projects/RAPID/package.json /home/kek/Projects/RAPID/.claude-plugin/plugin.json /home/kek/Projects/RAPID/.planning/config.json
grep -n 'rapidVersion.*6\.1\.0' /home/kek/Projects/RAPID/.planning/STATE.json
```
All four files should show 6.1.0. No other 6.0.0 references should remain in these files' version fields.

### Task 2: README.md Version Badge and Command Counts
**File:** `/home/kek/Projects/RAPID/README.md`

**Actions:**
1. Line 6: Replace `version-6.0.0` with `version-6.1.0` in the shields.io badge URL
2. Line 41: Replace `17 of 28 commands` with `17 of 29 commands`
3. Line 131: Replace `all 28 commands` with `all 29 commands`
4. Line 139: Replace `all 28 commands` with `all 29 commands`

**What NOT to do:** Do NOT modify line 135 (the changelog summary line). That line will be updated in Wave 2 when the CHANGELOG is authored.

**Verification:**
```bash
grep -n "6\.0\.0" /home/kek/Projects/RAPID/README.md  # Should return ONLY line 135
grep -n "28 commands" /home/kek/Projects/RAPID/README.md  # Should return zero results
grep -n "29 commands" /home/kek/Projects/RAPID/README.md  # Should return lines 41, 131, 139
```

### Task 3: DOCS.md Version and Command Count
**File:** `/home/kek/Projects/RAPID/DOCS.md`

**Actions:**
1. Line 5: Replace `**Version:** 6.0.0` with `**Version:** 6.1.0`
2. Line 447: Replace `all 28 commands` with `all 29 commands`
3. Line 479: Replace `RAPID v6.0.0` with `RAPID v6.1.0`

**Verification:**
```bash
grep -n "6\.0\.0" /home/kek/Projects/RAPID/DOCS.md  # Should return zero results
grep -n "28 commands" /home/kek/Projects/RAPID/DOCS.md  # Should return zero results
```

### Task 4: technical_documentation.md
**File:** `/home/kek/Projects/RAPID/technical_documentation.md`

**Actions:**
1. Line 3: Replace `RAPID v6.0.0` with `RAPID v6.1.0` (in the document title/intro)
2. Line 73: Replace `RAPID v6.0.0 uses 27 specialized agents` with `RAPID v6.1.0 uses 27 specialized agents`
3. Line 96: Replace `RAPID v6.0.0 tracks state` with `RAPID v6.1.0 tracks state`

**Verification:**
```bash
grep -n "6\.0\.0" /home/kek/Projects/RAPID/technical_documentation.md  # Should return zero results
```

### Task 5: skills/help/SKILL.md
**File:** `/home/kek/Projects/RAPID/skills/help/SKILL.md`

**Actions:**
1. Line 20: Replace `## RAPID v6.0.0 Workflow` with `## RAPID v6.1.0 Workflow`
2. Line 135: Replace `RAPID v6.0.0 | 28 commands` with `RAPID v6.1.0 | 29 commands`

**Verification:**
```bash
grep -n "6\.0\.0\|28 commands" /home/kek/Projects/RAPID/skills/help/SKILL.md  # Should return zero results
```

### Task 6: skills/status/SKILL.md
**File:** `/home/kek/Projects/RAPID/skills/status/SKILL.md`

**Actions:** Replace all 5 occurrences of `v6.0.0` with `v6.1.0`:
1. Line 6: `# /rapid:status -- v6.0.0 Set Dashboard` -> `v6.1.0`
2. Line 8: `using v6.0.0 command names` -> `v6.1.0`
3. Line 163: `the suggested v6.0.0 next action` -> `v6.1.0`
4. Line 185: `the v6.0.0 command with numeric shorthand` -> `v6.1.0`
5. Line 210: `**v6.0.0 commands:** All suggested actions use v6.0.0 command names` -> `v6.1.0` (both occurrences on this line)

**Verification:**
```bash
grep -n "6\.0\.0" /home/kek/Projects/RAPID/skills/status/SKILL.md  # Should return zero results
```

### Task 7: skills/install/SKILL.md
**File:** `/home/kek/Projects/RAPID/skills/install/SKILL.md`

**Actions:** Replace all 7 occurrences of `v6.0.0` / `6.0.0` with `v6.1.0` / `6.1.0`:
1. Line 2: `RAPID v6.0.0` -> `RAPID v6.1.0` (frontmatter description)
2. Line 7: `v6.0.0 Plugin Installation` -> `v6.1.0`
3. Line 9: `RAPID v6.0.0 by running` -> `RAPID v6.1.0`
4. Line 28: `reference to v6.0.0` -> `reference to v6.1.0`
5. Line 92: `for RAPID v6.0.0?` -> `for RAPID v6.1.0?`
6. Line 319: `RAPID v6.0.0 installation complete` -> `RAPID v6.1.0`
7. Line 331: `RAPID v6.0.0 is ready` -> `RAPID v6.1.0`

**Verification:**
```bash
grep -n "6\.0\.0" /home/kek/Projects/RAPID/skills/install/SKILL.md  # Should return zero results
```

### Task 8: GitHub Issue Templates
**Files:**
- `/home/kek/Projects/RAPID/.github/ISSUE_TEMPLATE/feature-request.yml` (line 9)
- `/home/kek/Projects/RAPID/.github/ISSUE_TEMPLATE/bug-report.yml` (line 9)

**Action:** Replace `placeholder: "e.g., v6.0.0"` with `placeholder: "e.g., v6.1.0"` in both files.

**Verification:**
```bash
grep -rn "6\.0\.0" /home/kek/Projects/RAPID/.github/  # Should return zero results
```

### Task 9: Node.js Version Prerequisites
**Files:**
- `/home/kek/Projects/RAPID/CONTRIBUTING.md` (line 9)
- `/home/kek/Projects/RAPID/docs/setup.md` (line 9)

**Actions:**
1. CONTRIBUTING.md: Replace `Node.js 20+` with `Node.js 22+`
2. docs/setup.md: Replace `Node.js 20+` with `Node.js 22+`

**Context:** The actual engine requirement in package.json is `"node": ">=22"`. These docs are stale from the v6.0.0 bump that raised it from 18 to 20.

**Verification:**
```bash
grep -n "Node.js 20" /home/kek/Projects/RAPID/CONTRIBUTING.md /home/kek/Projects/RAPID/docs/setup.md  # Should return zero results
grep -n "Node.js 22" /home/kek/Projects/RAPID/CONTRIBUTING.md /home/kek/Projects/RAPID/docs/setup.md  # Should return both files
```

## Success Criteria
1. `grep -rn "6\.0\.0" /home/kek/Projects/RAPID/{package.json,.claude-plugin/plugin.json,.planning/config.json,README.md,DOCS.md,technical_documentation.md,CONTRIBUTING.md,docs/setup.md,skills/help/SKILL.md,skills/status/SKILL.md,skills/install/SKILL.md,.github/ISSUE_TEMPLATE/}` returns ONLY the README.md line 135 changelog summary (reserved for Wave 2)
2. `grep -rn "rapidVersion.*6\.0\.0" /home/kek/Projects/RAPID/.planning/STATE.json` returns zero results
3. No `28 commands` remains in README.md, DOCS.md, or skills/help/SKILL.md
4. No `Node.js 20+` remains in CONTRIBUTING.md or docs/setup.md
5. All historical references in .planning/ROADMAP.md, docs/CHANGELOG.md, .planning/archive/, and .planning/research/ are UNTOUCHED

## File Ownership (Wave 1)
- `package.json`
- `.claude-plugin/plugin.json`
- `.planning/config.json`
- `.planning/STATE.json`
- `README.md` (lines 6, 41, 131, 139 only -- line 135 reserved for Wave 2)
- `DOCS.md`
- `technical_documentation.md`
- `skills/help/SKILL.md`
- `skills/status/SKILL.md`
- `skills/install/SKILL.md`
- `.github/ISSUE_TEMPLATE/feature-request.yml`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `CONTRIBUTING.md`
- `docs/setup.md`
