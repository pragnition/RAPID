# PLAN: community-infra / Wave 1

**Objective:** Create all community-facing GitHub infrastructure for RAPID's public open-source release. Every deliverable is a static file with no runtime code changes. This is the only wave -- all tasks are independent.

---

## Task 1: Create `.github/ISSUE_TEMPLATE/bug-report.yml`

**Action:** Copy the bug report YAML form verbatim from `pragnition/prepare-for-oss` branch (commit `675c6ec`).

**File:** `.github/ISSUE_TEMPLATE/bug-report.yml`

**Implementation:**
1. Create the `.github/ISSUE_TEMPLATE/` directory.
2. Run `git show pragnition/prepare-for-oss:.github/ISSUE_TEMPLATE/bug-report.yml > .github/ISSUE_TEMPLATE/bug-report.yml` to copy the file.
3. Verify the file has exactly these fields: name ("Bug Report"), description, labels `["bug", "human-authored"]`, and body containing 6 form elements: version (input), skill (dropdown with 15 options), description (textarea, required), steps (textarea, required), root-cause (textarea, optional), workaround (textarea, optional).

**What NOT to do:**
- Do NOT rename the file to `bug_report.yml` (underscore). The prepare-for-oss branch uses hyphens; keep that convention.
- Do NOT modify the template content -- adopt verbatim as specified in CONTEXT.md.

**Verification:**
```bash
test -f .github/ISSUE_TEMPLATE/bug-report.yml && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'name: Bug Report' .github/ISSUE_TEMPLATE/bug-report.yml && echo "PASS: name field" || echo "FAIL: name field"
grep -q 'human-authored' .github/ISSUE_TEMPLATE/bug-report.yml && echo "PASS: label" || echo "FAIL: label"
```

---

## Task 2: Create `.github/ISSUE_TEMPLATE/feature-request.yml`

**Action:** Copy the feature request YAML form verbatim from `pragnition/prepare-for-oss` branch (commit `675c6ec`).

**File:** `.github/ISSUE_TEMPLATE/feature-request.yml`

**Implementation:**
1. Run `git show pragnition/prepare-for-oss:.github/ISSUE_TEMPLATE/feature-request.yml > .github/ISSUE_TEMPLATE/feature-request.yml` to copy the file.
2. Verify the file has: name ("Feature Request"), description, labels `["enhancement", "human-authored"]`, and body containing 5 form elements: version (input), skill (dropdown with 16 options including "N/A (new skill)"), problem (textarea, required), solution (textarea, required), workaround (textarea, optional).

**What NOT to do:**
- Do NOT rename to `feature_request.yml`. Keep hyphens.
- Do NOT modify the template content.

**Verification:**
```bash
test -f .github/ISSUE_TEMPLATE/feature-request.yml && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'name: Feature Request' .github/ISSUE_TEMPLATE/feature-request.yml && echo "PASS: name field" || echo "FAIL: name field"
grep -q 'human-authored' .github/ISSUE_TEMPLATE/feature-request.yml && echo "PASS: label" || echo "FAIL: label"
```

---

## Task 3: Create `.github/ISSUE_TEMPLATE/bug-report-ai.md`

**Action:** Copy the AI-assisted bug report Markdown template verbatim from `pragnition/prepare-for-oss` branch (commit `675c6ec`).

**File:** `.github/ISSUE_TEMPLATE/bug-report-ai.md`

**Implementation:**
1. Run `git show pragnition/prepare-for-oss:.github/ISSUE_TEMPLATE/bug-report-ai.md > .github/ISSUE_TEMPLATE/bug-report-ai.md` to copy the file.
2. Verify the file has YAML frontmatter with: name ("Bug Report (AI-assisted)"), about description, labels `"bug, ai-authored"`.
3. Verify the HTML table contains a **Human Note** field with the verbatim instruction text requiring users to copy the human's exact words.
4. Verify sections: Bug Description, Steps to Reproduce (with 1/2/3 template), Root Cause / Suggested Fix, Workaround, Related Issues.

**What NOT to do:**
- Do NOT alter the Human Note instruction text. It was deliberately iterated in commit 675c6ec.
- Do NOT convert this to YAML form format -- Markdown templates are intentional for AI-authored issues.

**Verification:**
```bash
test -f .github/ISSUE_TEMPLATE/bug-report-ai.md && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'ai-authored' .github/ISSUE_TEMPLATE/bug-report-ai.md && echo "PASS: label" || echo "FAIL: label"
grep -q 'Human Note' .github/ISSUE_TEMPLATE/bug-report-ai.md && echo "PASS: human note" || echo "FAIL: human note"
```

---

## Task 4: Create `.github/ISSUE_TEMPLATE/feature-request-ai.md`

**Action:** Copy the AI-assisted feature request Markdown template verbatim from `pragnition/prepare-for-oss` branch (commit `675c6ec`).

**File:** `.github/ISSUE_TEMPLATE/feature-request-ai.md`

**Implementation:**
1. Run `git show pragnition/prepare-for-oss:.github/ISSUE_TEMPLATE/feature-request-ai.md > .github/ISSUE_TEMPLATE/feature-request-ai.md` to copy the file.
2. Verify the file has YAML frontmatter with: name ("Feature Request (AI-assisted)"), about description, labels `"enhancement, ai-authored"`.
3. Verify the HTML table contains a **Human Note** field with the same verbatim instruction pattern.
4. Verify sections: Problem Statement, Proposed Solution, Current Workaround, Related Issues.

**What NOT to do:**
- Do NOT modify the Human Note field text.
- Do NOT convert to YAML form format.

**Verification:**
```bash
test -f .github/ISSUE_TEMPLATE/feature-request-ai.md && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'ai-authored' .github/ISSUE_TEMPLATE/feature-request-ai.md && echo "PASS: label" || echo "FAIL: label"
grep -q 'Human Note' .github/ISSUE_TEMPLATE/feature-request-ai.md && echo "PASS: human note" || echo "FAIL: human note"
```

---

## Task 5: Create `.github/ISSUE_TEMPLATE/config.yml`

**Action:** Create the GitHub issue template chooser configuration. This file does NOT exist on any branch and must be authored from scratch.

**File:** `.github/ISSUE_TEMPLATE/config.yml`

**Implementation:**
Create the file with the following exact content:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Questions & Discussion
    url: https://github.com/pragnition/RAPID/discussions
    about: Ask questions and share ideas that don't fit a bug report or feature request.
```

Key design decisions:
- `blank_issues_enabled: false` -- forces contributors to use the structured templates (4 options will appear: 2 human YAML forms + 2 AI Markdown templates).
- Contact link points to GitHub Discussions as an escape hatch for questions that don't fit bug/feature categories.

**What NOT to do:**
- Do NOT add additional contact links (e.g., Discord, email). The project uses GitHub Discussions only.
- Do NOT set `blank_issues_enabled: true` -- the whole point is to channel contributors into structured templates.

**Verification:**
```bash
test -f .github/ISSUE_TEMPLATE/config.yml && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'blank_issues_enabled: false' .github/ISSUE_TEMPLATE/config.yml && echo "PASS: blank issues disabled" || echo "FAIL: blank issues config"
grep -q 'discussions' .github/ISSUE_TEMPLATE/config.yml && echo "PASS: discussions link" || echo "FAIL: discussions link"
```

---

## Task 6: Create `.github/PULL_REQUEST_TEMPLATE.md`

**Action:** Create the PR template with moderate-depth checklist. This file does NOT exist on any branch and must be authored from scratch.

**File:** `.github/PULL_REQUEST_TEMPLATE.md`

**Implementation:**
Create the file with the following structure and content:

```markdown
## What changed

<!-- Describe what this PR does in 1-3 sentences. -->

## Why

<!-- What problem does this solve? Link to issues if applicable. -->

## Testing

<!-- How did you verify this works? Include commands or test output. -->

## Breaking changes

<!-- List any breaking changes, or write "None". -->

## Related issues

<!-- Link related issues: Fixes #123, Closes #456, Related to #789 -->

## Checklist

- [ ] Tests pass (`node --test 'src/**/*.test.cjs'`)
- [ ] No lint errors
- [ ] Commit messages follow `type(scope): description` format
- [ ] Documentation updated (if applicable)
- [ ] AI-assisted (check if this PR was authored or substantially written by AI)
```

Key design decisions:
- 5 content sections (What, Why, Testing, Breaking changes, Related issues) + 1 checklist section with 5 items.
- Single template with an AI-assisted checkbox rather than a separate AI PR template (GitHub doesn't support PR template choosers).
- The checklist references the actual test command from package.json.

**What NOT to do:**
- Do NOT add a "Screenshots" section -- RAPID is a CLI plugin with no visual UI.
- Do NOT create multiple PR templates in a `.github/PULL_REQUEST_TEMPLATE/` directory -- single template is the design decision.

**Verification:**
```bash
test -f .github/PULL_REQUEST_TEMPLATE.md && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'What changed' .github/PULL_REQUEST_TEMPLATE.md && echo "PASS: what section" || echo "FAIL: what section"
grep -q 'AI-assisted' .github/PULL_REQUEST_TEMPLATE.md && echo "PASS: AI checkbox" || echo "FAIL: AI checkbox"
grep -q "node --test" .github/PULL_REQUEST_TEMPLATE.md && echo "PASS: test command" || echo "FAIL: test command"
```

---

## Task 7: Create `CONTRIBUTING.md`

**Action:** Author the community contribution guide from scratch. This is the most substantive deliverable -- a new Markdown file at the repository root.

**File:** `CONTRIBUTING.md`

**Implementation:**
Create the file with these sections in order. Keep each section to 3-5 sentences maximum. Use direct, no-nonsense tone matching RAPID's existing documentation style.

### Section 1: What is RAPID
- 3-5 sentence blurb explaining that RAPID is a Claude Code plugin for team-based parallel development.
- Mention the core workflow: init, plan, execute, review, merge.
- Link to `.planning/context/ARCHITECTURE.md` for the full system design.

### Section 2: Development Setup
- Prerequisites: Node.js 18+, Git
- Clone: `git clone https://github.com/pragnition/RAPID.git`
- Install: `npm install`
- Run setup: `./setup.sh` (configures plugin environment)
- Verify: `node --test 'src/**/*.test.cjs'`

### Section 3: Making Changes
- Fork the repo, create a feature branch
- Branch naming: `feat/description` or `fix/description` (not `rapid/` -- that prefix is reserved for RAPID's internal set branches)
- Run tests before submitting: `node --test 'src/**/*.test.cjs'`
- Commit format: `type(scope): description` (types: feat, fix, docs, refactor, chore, test)

### Section 4: Pull Requests
- Submit PRs against `main`
- Fill out the PR template completely
- One logical change per PR
- Reference related issues

### Section 5: Code Style
- Brief summary: CommonJS (.cjs), 2-space indent, single quotes, semicolons required
- Node.js built-in `node:test` for testing, `assert/strict` for assertions
- Link to `.planning/context/CONVENTIONS.md` for full naming and module conventions
- Link to `.planning/context/STYLE_GUIDE.md` for detailed formatting rules

### Section 6: Reporting Issues
- Point to the issue templates (bug report, feature request)
- Mention the AI-assisted templates for contributors using AI tooling
- Link to GitHub Discussions for questions

### Section 7: License
- State the project is MIT licensed
- Link to `LICENSE` file

**What NOT to do:**
- Do NOT include a Code of Conduct section (no CODE_OF_CONDUCT.md exists yet).
- Do NOT duplicate the full contents of CONVENTIONS.md or STYLE_GUIDE.md -- link to them.
- Do NOT use corporate boilerplate ("We appreciate your interest in contributing..."). Be direct.
- Do NOT include a "Getting Help" section separate from the Issues section.

**Verification:**
```bash
test -f CONTRIBUTING.md && echo "PASS: file exists" || echo "FAIL: file missing"
grep -q 'ARCHITECTURE.md' CONTRIBUTING.md && echo "PASS: architecture link" || echo "FAIL: architecture link"
grep -q 'CONVENTIONS.md' CONTRIBUTING.md && echo "PASS: conventions link" || echo "FAIL: conventions link"
grep -q 'STYLE_GUIDE.md' CONTRIBUTING.md && echo "PASS: style guide link" || echo "FAIL: style guide link"
grep -q 'node --test' CONTRIBUTING.md && echo "PASS: test command" || echo "FAIL: test command"
grep -q 'MIT' CONTRIBUTING.md && echo "PASS: license mention" || echo "FAIL: license mention"
# Tone check: should NOT contain fluffy corporate phrasing
grep -qi 'we appreciate' CONTRIBUTING.md && echo "FAIL: corporate tone detected" || echo "PASS: tone is direct"
grep -qi 'thank you for' CONTRIBUTING.md && echo "FAIL: corporate tone detected" || echo "PASS: tone is direct"
```

---

## Task 8: Add `repository` and `homepage` fields to `package.json`

**Action:** Add two fields to the existing `package.json`. This is the only file modification (all other tasks create new files).

**File:** `package.json`

**Implementation:**
Add the following two fields after the `"private": true` line:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/pragnition/RAPID.git"
},
"homepage": "https://github.com/pragnition/RAPID#readme",
```

The public-facing repository is `pragnition/RAPID` (not `fishjojo1/RAPID` which is the origin remote for development).

**What NOT to do:**
- Do NOT change the `"private": true` field.
- Do NOT use the shorthand string format for repository (`"repository": "pragnition/RAPID"`). Use the object format with `type` and `url` for maximum compatibility.
- Do NOT change any other fields (name, version, scripts, dependencies).
- Do NOT use `fishjojo1/RAPID` -- that is the development fork, not the public repo.

**Verification:**
```bash
node -e "const p = require('./package.json'); console.log(p.repository?.url === 'https://github.com/pragnition/RAPID.git' ? 'PASS: repository URL' : 'FAIL: repository URL')"
node -e "const p = require('./package.json'); console.log(p.homepage === 'https://github.com/pragnition/RAPID#readme' ? 'PASS: homepage URL' : 'FAIL: homepage URL')"
node -e "const p = require('./package.json'); console.log(p.private === true ? 'PASS: private unchanged' : 'FAIL: private changed')"
node -e "try { JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('PASS: valid JSON') } catch(e) { console.log('FAIL: invalid JSON') }"
```

---

## Success Criteria

All 8 tasks complete when:

1. **8 files exist:** `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug-report.yml`, `.github/ISSUE_TEMPLATE/feature-request.yml`, `.github/ISSUE_TEMPLATE/bug-report-ai.md`, `.github/ISSUE_TEMPLATE/feature-request-ai.md`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, and `package.json` (modified).
2. **Issue templates match prepare-for-oss:** The 4 issue template files are byte-identical to their counterparts on `pragnition/prepare-for-oss` at commit `675c6ec`.
3. **CONTRIBUTING.md is concise:** No section exceeds 5 sentences. Links to CONVENTIONS.md, STYLE_GUIDE.md, and ARCHITECTURE.md are present. No corporate boilerplate.
4. **package.json is valid JSON** with `repository.url` pointing to `https://github.com/pragnition/RAPID.git` and `homepage` pointing to `https://github.com/pragnition/RAPID#readme`.
5. **All verification commands pass** for every task.

## Full Verification Script

Run this single script to validate all deliverables:

```bash
echo "=== community-infra wave-1 verification ==="
PASS=0; FAIL=0

# File existence
for f in CONTRIBUTING.md .github/ISSUE_TEMPLATE/bug-report.yml .github/ISSUE_TEMPLATE/feature-request.yml .github/ISSUE_TEMPLATE/bug-report-ai.md .github/ISSUE_TEMPLATE/feature-request-ai.md .github/ISSUE_TEMPLATE/config.yml .github/PULL_REQUEST_TEMPLATE.md; do
  if test -f "$f"; then echo "PASS: $f exists"; PASS=$((PASS+1)); else echo "FAIL: $f missing"; FAIL=$((FAIL+1)); fi
done

# Issue template verbatim check (diff against branch)
for f in bug-report.yml feature-request.yml bug-report-ai.md feature-request-ai.md; do
  if diff <(git show pragnition/prepare-for-oss:.github/ISSUE_TEMPLATE/$f) .github/ISSUE_TEMPLATE/$f > /dev/null 2>&1; then
    echo "PASS: $f matches prepare-for-oss"; PASS=$((PASS+1))
  else
    echo "FAIL: $f differs from prepare-for-oss"; FAIL=$((FAIL+1))
  fi
done

# config.yml checks
grep -q 'blank_issues_enabled: false' .github/ISSUE_TEMPLATE/config.yml && { echo "PASS: blank issues disabled"; PASS=$((PASS+1)); } || { echo "FAIL: blank issues config"; FAIL=$((FAIL+1)); }

# PR template checks
grep -q 'AI-assisted' .github/PULL_REQUEST_TEMPLATE.md && { echo "PASS: AI checkbox in PR template"; PASS=$((PASS+1)); } || { echo "FAIL: AI checkbox missing"; FAIL=$((FAIL+1)); }

# CONTRIBUTING.md checks
grep -q 'CONVENTIONS.md' CONTRIBUTING.md && { echo "PASS: conventions link"; PASS=$((PASS+1)); } || { echo "FAIL: conventions link"; FAIL=$((FAIL+1)); }
grep -q 'STYLE_GUIDE.md' CONTRIBUTING.md && { echo "PASS: style guide link"; PASS=$((PASS+1)); } || { echo "FAIL: style guide link"; FAIL=$((FAIL+1)); }
grep -q 'ARCHITECTURE.md' CONTRIBUTING.md && { echo "PASS: architecture link"; PASS=$((PASS+1)); } || { echo "FAIL: architecture link"; FAIL=$((FAIL+1)); }
grep -qi 'we appreciate\|thank you for' CONTRIBUTING.md && { echo "FAIL: corporate tone"; FAIL=$((FAIL+1)); } || { echo "PASS: no corporate tone"; PASS=$((PASS+1)); }

# package.json checks
node -e "const p=require('./package.json'); process.exit(p.repository?.url==='https://github.com/pragnition/RAPID.git'?0:1)" && { echo "PASS: repo URL"; PASS=$((PASS+1)); } || { echo "FAIL: repo URL"; FAIL=$((FAIL+1)); }
node -e "const p=require('./package.json'); process.exit(p.homepage==='https://github.com/pragnition/RAPID#readme'?0:1)" && { echo "PASS: homepage"; PASS=$((PASS+1)); } || { echo "FAIL: homepage"; FAIL=$((FAIL+1)); }
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && { echo "PASS: valid JSON"; PASS=$((PASS+1)); } || { echo "FAIL: invalid JSON"; FAIL=$((FAIL+1)); }

echo "=== Results: $PASS passed, $FAIL failed ==="
```
