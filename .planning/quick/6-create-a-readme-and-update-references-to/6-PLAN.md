---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "README.md exists at repo root with correct RAPID acronym"
    - "README explains what RAPID is, how to install, and how to use it"
    - "All references use Rapid Agentic Parallelizable and Isolatable Development"
  artifacts:
    - path: "README.md"
      provides: "GitHub landing page for the RAPID plugin"
      contains: "Rapid Agentic Parallelizable and Isolatable Development"
  key_links: []
---

<objective>
Create a README.md for the RAPID repository that serves as the GitHub landing page.

Purpose: The repo currently has DOCS.md (detailed plugin documentation) but no README.md. GitHub needs a README for the repo landing page. The README should be concise, link to DOCS.md for details, and use the correct recursive acronym: Rapid Agentic Parallelizable and Isolatable Development.

Note: Quick task 4 already corrected all acronym references across the codebase. Grep confirms no incorrect references remain. This task focuses on creating the missing README.md.

Output: README.md at repo root
</objective>

<context>
@DOCS.md
@.planning/PROJECT.md
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create README.md</name>
  <files>README.md</files>
  <action>
Create README.md at repo root as a concise GitHub landing page. Structure:

1. **Title and tagline**: "# RAPID" with subtitle "Rapid Agentic Parallelizable and Isolatable Development" (recursive acronym). One-sentence description: a Claude Code plugin for team-based parallel development using isolated git worktrees and interface contracts.

2. **What it does** (3-4 bullet points): Decomposes work into parallel sets, isolates in git worktrees, validates with interface contracts, merges through automated review pipeline.

3. **Quick Start** (brief):
   - Installation via `claude plugin add fishjojo1/RAPID` then `/rapid:install`
   - Alternative: git clone + `./setup.sh`
   - Prerequisites: Node.js 18+, git 2.30+

4. **Workflow Overview** (numbered list, one line each):
   `/rapid:init` -> `/rapid:context` -> `/rapid:plan` -> `/rapid:execute` -> `/rapid:status` -> `/rapid:merge` -> `/rapid:cleanup`

5. **Documentation**: Link to DOCS.md for full command reference and architecture details.

6. **License**: MIT, link to LICENSE file.

Keep it under 80 lines. Do NOT duplicate the full command documentation from DOCS.md -- just link to it. The README is a quick overview, DOCS.md is the reference.
  </action>
  <verify>
    <automated>test -f README.md && grep -q "Rapid Agentic Parallelizable and Isolatable Development" README.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>README.md exists at repo root, contains correct recursive acronym, provides concise overview with link to DOCS.md, under 80 lines</done>
</task>

</tasks>

<verification>
- README.md exists at repo root
- Contains "Rapid Agentic Parallelizable and Isolatable Development" (correct acronym)
- Does NOT contain any incorrect acronym variants
- Links to DOCS.md for detailed documentation
- Links to LICENSE
</verification>

<success_criteria>
- README.md serves as a clear, concise GitHub landing page
- Correct recursive acronym used throughout
- Under 80 lines, links to DOCS.md for details
</success_criteria>

<output>
After completion, create `.planning/quick/6-create-a-readme-and-update-references-to/6-SUMMARY.md`
</output>
