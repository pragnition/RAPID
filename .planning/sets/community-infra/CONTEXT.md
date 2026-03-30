# CONTEXT: community-infra

**Set:** community-infra
**Generated:** 2026-03-30
**Mode:** interactive

<domain>
## Set Boundary
Create all community-facing GitHub infrastructure for RAPID's public open-source release: CONTRIBUTING.md, YAML issue templates (bug report, feature request), AI-assisted Markdown issue templates, config.yml template chooser, PR template, and package.json repository/homepage fields. All deliverables are static files with no runtime code changes. The downstream `readme-migration` set depends on CONTRIBUTING.md existing at the expected path.
</domain>

<decisions>
## Implementation Decisions

### CONTRIBUTING.md Scope & Cross-Referencing
- **Hybrid approach**: Self-contained for essentials (dev install, PR workflow, basic code style) with links to `.planning/context/` docs (CONVENTIONS.md, STYLE_GUIDE.md, ARCHITECTURE.md) for deep dives.
- **Rationale:** External contributors need a one-stop guide for the basics without navigating unfamiliar internal directories, but duplicating all style/convention details would create drift. Linking to .planning/ for deep dives keeps CONTRIBUTING.md concise while maintaining a single source of truth.

### CONTRIBUTING.md Orientation
- **Brief 3–5 sentence "How RAPID works" blurb** at the top, linking to full architecture docs.
- **Rationale:** RAPID's plugin/agent architecture is unusual enough that contributors need a basic mental model to file useful bug reports and feature requests. A short blurb is lightweight enough to not intimidate newcomers.

### Issue Template Field Design
- **Use existing templates from `pragnition/prepare-for-oss` branch** (commit 675c6ec) as the reference design.
- Bug report: 6-field YAML form (version, affected skill dropdown, description, repro steps, root cause, workaround) + AI Markdown variant with Human Note requirement.
- Feature request: 5-field YAML form (version, skill dropdown, problem statement, proposed solution, workaround) + AI Markdown variant with Human Note requirement.
- **Rationale:** The user has already designed and iterated on these templates. The dual human/AI template pattern with `human-authored`/`ai-authored` labels is a deliberate design choice for triage. Adopting them as-is avoids rework.

### Template Chooser Strategy
- **Disable blank issues** via config.yml `blank_issues_enabled: false`.
- **Add contact link** to GitHub Discussions for questions and general feedback that don't fit bug/feature templates.
- **Rationale:** With 4 templates (2 human YAML + 2 AI Markdown) covering the main use cases, blank issues would bypass the structure. A Discussions link provides an escape hatch for edge cases without undermining template adoption.

### PR Template
- **Moderate depth (5–6 items)**: What changed, Why, Testing approach, Breaking changes, Related issues, Checklist (tests pass, no lint errors).
- **Single template with optional "AI-assisted" checkbox** — no separate AI PR template since GitHub doesn't support PR template choosers and Co-Authored-By metadata already signals AI involvement.
- **Rationale:** Moderate depth balances guidance with friction. The AI checkbox aligns with the issue template pattern of distinguishing human vs AI authorship without requiring a separate file.

### Claude's Discretion
- Exact wording and section ordering within CONTRIBUTING.md
- config.yml contact link text and URL format
- PR template checkbox placement and phrasing
- package.json field formatting (repository object vs string)
</decisions>

<specifics>
## Specific Ideas
- Adopt the 4 existing issue templates from `pragnition/prepare-for-oss` (675c6ec) verbatim — bug-report.yml, feature-request.yml, bug-report-ai.md, feature-request-ai.md
- The AI templates use a "Human Note" field that must be copied verbatim from the human — this is an iterated design, not first-draft
- The skill dropdown in issue templates lists: init, start-set, discuss-set, plan-set, execute-set, review, unit-test, bug-hunt, uat, merge, status, quick, resume, pause, Other
- CONTRIBUTING.md should reference `.planning/context/CONVENTIONS.md` and `.planning/context/STYLE_GUIDE.md` for detailed code style rules
</specifics>

<code_context>
## Existing Code Insights
- `package.json` currently has no `repository` or `homepage` fields — needs both added pointing to pragnition/RAPID
- No `.github/` directory exists on main — all template files are net-new
- No `CONTRIBUTING.md` exists on main — net-new file
- The `pragnition/prepare-for-oss` branch has 4 issue templates already designed and iterated (the AI template Human Note field was refined in 675c6ec)
- `.planning/context/CONVENTIONS.md` and `.planning/context/STYLE_GUIDE.md` exist and can be cross-referenced from CONTRIBUTING.md
</code_context>

<deferred>
## Deferred Ideas
- Enable GitHub Discussions on pragnition/RAPID (operational prerequisite for config.yml contact link)
- AI-assisted templates from prepare-for-oss branch expand CONTRACT.json scope beyond original 6 deliverables to 8
</deferred>
