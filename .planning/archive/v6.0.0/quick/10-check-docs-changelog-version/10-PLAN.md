# Quick Task 10: Audit Documentation & Changelog for v6.0.0 Accuracy

## Objective

Fix documentation discrepancies found during a version-accuracy audit. The v6.0.0 version bump (set `docs-version-bump`) missed several files, and the CHANGELOG is missing two shipped milestones. This plan addresses all identified issues.

## Summary of Findings

1. **Stale Node.js version references (18+ instead of 20+):** The v6.0.0 changelog itself documents "Node.js minimum bumped from 18 to 20+" but 4 files still say 18+:
   - `DOCS.md` line 53: "Node.js 18+"
   - `docs/setup.md` line 9: "Node.js 18+"
   - `CONTRIBUTING.md` line 9: "Node.js 18+"
   - `skills/install/SKILL.md` line 208: "Must be v18+"

2. **Stale version in `technical_documentation.md`:** Three references to "v5.0" that should be "v6.0.0":
   - Line 3: "RAPID v5.0"
   - Line 73: "RAPID v5.0 uses 27 specialized agents"
   - Line 96: "RAPID v5.0 tracks state at the set level"

3. **Missing CHANGELOG entries:** Two shipped milestones have no CHANGELOG entries:
   - `v4.5 Developer Experience II` (shipped 2026-03-26, 4 sets)
   - `v5.0 OSS Presentation` (shipped 2026-03-31, 5 sets)

4. **Confirmed accurate (no action needed):**
   - `package.json` version: 6.0.0 (correct)
   - README.md version badge: 6.0.0 (correct), Node.js badge: 20+ (correct)
   - DOCS.md version header: 6.0.0 (correct)
   - Skill count "28 commands": 28 skill directories confirmed
   - Agent count "27 agents": 27 agent .md files confirmed
   - All branding SVGs referenced in README exist
   - All doc links (DOCS.md, technical_documentation.md, docs/) resolve

---

## Task 1: Fix stale Node.js version references (18+ to 20+)

**Files to modify:**
- `/home/kek/Projects/RAPID/DOCS.md`
- `/home/kek/Projects/RAPID/docs/setup.md`
- `/home/kek/Projects/RAPID/CONTRIBUTING.md`
- `/home/kek/Projects/RAPID/skills/install/SKILL.md`

**Action:**
Replace all "Node.js 18+" / "v18+" references with "Node.js 20+" / "v20+" in the 4 files listed above. The changelog for v6.0.0 explicitly states "Node.js minimum bumped from 18 to 20+ in prereqs.cjs and package.json engines" -- these files were missed during that bump.

Specific changes:
- `DOCS.md` line 53: `Node.js 18+` -> `Node.js 20+`
- `docs/setup.md` line 9: `Node.js 18+` -> `Node.js 20+`
- `CONTRIBUTING.md` line 9: `Node.js 18+` -> `Node.js 20+`
- `skills/install/SKILL.md` line 208: `Must be v18+` -> `Must be v20+`

**What NOT to do:**
- Do not change `package.json` `engines` field -- it already says `>=20`
- Do not change README.md Node.js badge -- it already says `20%2B`
- Do not change historical references in `.planning/` research/plan files

**Verification:**
```bash
# Should return 0 matches (excluding node_modules, .planning, .rapid-worktrees, .archive)
grep -r "Node\.js 18\|v18+" --include="*.md" --exclude-dir=node_modules --exclude-dir=.planning --exclude-dir=.rapid-worktrees --exclude-dir=.archive . | grep -v "bumped from 18"
```

**Done when:** Zero non-historical references to Node.js 18+ remain in user-facing documentation.

---

## Task 2: Fix stale v5.0 references in technical_documentation.md

**Files to modify:**
- `/home/kek/Projects/RAPID/technical_documentation.md`

**Action:**
Replace all 3 instances of "v5.0" with "v6.0.0" in `technical_documentation.md`. These were missed during the docs-version-bump set.

Specific changes:
- Line 3: "RAPID v5.0 (Rapid Agentic..." -> "RAPID v6.0.0 (Rapid Agentic..."
- Line 73: "RAPID v5.0 uses 27 specialized agents" -> "RAPID v6.0.0 uses 27 specialized agents"
- Line 96: "RAPID v5.0 tracks state at the set level" -> "RAPID v6.0.0 tracks state at the set level"

**What NOT to do:**
- Do not change any content beyond the version string -- the surrounding text is accurate
- Do not touch version references inside `.planning/` artifacts (those are historical)

**Verification:**
```bash
# Should return 0 matches
grep "v5\.0" technical_documentation.md
```

**Done when:** `technical_documentation.md` contains zero references to v5.0; all version references say v6.0.0.

---

## Task 3: Add missing CHANGELOG entries for v4.5 and v5.0

**Files to modify:**
- `/home/kek/Projects/RAPID/docs/CHANGELOG.md`

**Action:**
Add two missing milestone entries to `docs/CHANGELOG.md` between the existing `[v4.4.0]` and `[v6.0.0]` entries. Source the content from the ROADMAP.md completed milestone details.

Insert the following entries after the `[v4.4.0]` section (line 53) and before line 47 (the v4.4.0 header), so they appear in reverse-chronological order:

**v5.0 entry** (insert between v6.0.0 and v4.5):
```markdown
## [v5.0] OSS Presentation (shipped 2026-03-31)

### Added
- Branding assets: SVG banner, lifecycle flow diagram, agent dispatch diagram, social preview image (`branding-assets`)
- Community infrastructure: CONTRIBUTING.md, GitHub issue templates (bug report, feature request -- standard and AI variants), PR template (`community-infra`)

### Changed
- README overhaul and reference migration to pragnition/RAPID with version bump (`readme-migration`)
- README polish pass for conciseness, scannability, and enlarged SVGs (`readme-polish`)
```

**v4.5 entry** (insert between v5.0 and v4.4.0):
```markdown
## [v4.5] Developer Experience II (shipped 2026-03-26)

### Added
- Human-only UAT workflow separating automated checks from manual verification steps (`uat-workflow`)
- `--uat` flag for `/rapid:bug-fix` enabling automatic UAT failure fixing from UAT-FAILURES.md (`bugfix-uat`)
- Branding preview server for live BRANDING.md rendering (`branding-server`)

### Changed
- Generous set planning with expanded task granularity and coverage (`generous-planning`)
```

**What NOT to do:**
- Do not modify the existing v6.0.0 or v4.4.0 entries
- Do not remove the "Generated by /rapid:documentation" comment
- Do not change the changelog format -- match the existing Keep a Changelog style

**Verification:**
```bash
# Should show all versions in order: v6.0.0, v5.0, v4.5, v4.4.0, v4.3.0, ...
grep "^## \[v" docs/CHANGELOG.md
```

**Done when:** All shipped milestones from ROADMAP.md have corresponding CHANGELOG entries, with no version gaps between v4.4.0 and v6.0.0.
