# CONTEXT: documentation

**Set:** documentation
**Generated:** 2026-03-25
**Mode:** interactive

<domain>
## Set Boundary
Prepare comprehensive human-readable documentation for open-sourcing RAPID. Covers three deliverables: (1) README.md rewrite as the open-source front door, (2) DOCS.md rewrite covering the canonical workflow for all 28 skills, and (3) updated docs/ reference files for all commands including those added since v3.5.0. This is documentation-only — no code changes.
</domain>

<decisions>
## Implementation Decisions

### README Scope & Depth
- Rich overview: comprehensive README with architecture summary, agent overview, full feature description so users can evaluate RAPID without leaving the page
- Include a Mermaid lifecycle flowchart (init→start→discuss→plan→execute→review→merge) showing each stage and what it produces
- **Rationale:** A rich README lets technical evaluators assess RAPID's value from a single page. Mermaid renders natively on GitHub and is easy to maintain as text.

### DOCS.md Organization
- Workflow-ordered: commands organized in lifecycle order (init→merge) with auxiliary commands woven in at logical points
- Summary + link hub: 2-3 sentence description + usage example per command, linking to docs/ files for full details
- **Rationale:** Workflow ordering matches how users actually use RAPID and provides a natural learning path. Hub-style keeps DOCS.md scannable while docs/ files hold the depth.

### docs/ Hierarchy Structure
- Topic-based files preserved: keep current structure (planning.md, execution.md, review.md, etc.) and expand to cover all 28 commands
- New auxiliary.md file for non-lifecycle commands: branding, scaffold, audit-version, migrate, pause, resume, register-web, bug-fix, quick, add-set
- **Rationale:** Topic-based files preserve workflow narrative (planning covers init+discuss+plan as a cohesive story). A dedicated auxiliary.md gives non-lifecycle commands a clean home without awkward fits into existing files.

### Code Examples Strategy
- Command syntax + brief behavioral description: each command shows syntax plus 1-2 sentences describing what happens (e.g., "Spawns 6 parallel researchers, then generates ROADMAP.md")
- No multi-command workflow transcripts: README quickstart is sufficient for showing the end-to-end flow
- **Rationale:** Behavioral descriptions give users enough context without fragile output samples that go stale. The quickstart in README already demonstrates the full lifecycle.

### Target Audience
- Primary audience: technical evaluator (team lead or architect evaluating RAPID for their org)
- Tone: architecture-forward, integration-focused, emphasizing scalability and parallel development benefits
- Assume basic Claude Code usage: reader knows slash commands and plugins, but RAPID-specific concepts (sets, waves, contracts) are fully explained
- **Rationale:** User explicitly chose technical evaluator over new adopter. Documentation should demonstrate architectural value and coordination capabilities that drive adoption decisions at the team/org level.

### Architecture Visualization
- Lifecycle flowchart in README using Mermaid: linear flow from init to merge showing each stage and its outputs
- **Rationale:** The lifecycle is the #1 mental model new evaluators need. Mermaid renders natively on GitHub with zero dependencies.

### Version History Approach
- Highlights-only changelog in docs/CHANGELOG.md: major features per version with 2-3 bullet points per milestone
- **Rationale:** Shows active development and major capabilities without overwhelming detail. 17 milestones × full set listings would be unreadable.

### Cross-Referencing Strategy
- Hub-and-spoke from DOCS.md: DOCS.md serves as central index linking to all docs/ files, each docs/ file links back to DOCS.md
- Breadcrumb header in each docs/ file: one-line breadcrumb like "[DOCS.md](../DOCS.md) > Planning" for orientation
- **Rationale:** Simple mental model — DOCS.md is always the entry point. Breadcrumbs help readers who land on a docs/ file from search engines or GitHub links.

### Claude's Discretion
- No areas were left to Claude's discretion — all 8 gray areas were discussed and decided.
</decisions>

<specifics>
## Specific Ideas
- README should include a "The Problem" section explaining why parallel AI-assisted development needs coordination (already exists in current README and resonates well)
- The 28 skills should be enumerated from the skills/ directory as the source of truth for coverage auditing
- SKILL.md files in each skill directory are the canonical source for command descriptions
- docs/auxiliary.md is a new file that needs to be created (not in CONTRACT.json ownedFiles — add during planning)
</specifics>

<code_context>
## Existing Code Insights
- Current README references "v3.0" and "26 specialized agents" — needs updating to v4.4.0 and current agent count
- Current DOCS.md header says "Version: 3.5.0" and references only 17 commands (7 core + 4 auxiliary + 6 utility)
- 28 skills exist in skills/ directory: add-set, assumptions, audit-version, branding, bug-fix, bug-hunt, cleanup, context, discuss-set, documentation, execute-set, help, init, install, merge, migrate, new-version, pause, plan-set, quick, register-web, resume, review, scaffold, start-set, status, uat, unit-test
- docs/ currently has 10 files matching the CONTRACT.json ownedFiles list (minus CHANGELOG.md which also exists)
- Each skill has a SKILL.md file that serves as the canonical description source
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
