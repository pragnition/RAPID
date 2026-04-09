# Wave 2 PLAN: Expanded Branding Flow + SKILL.md Overhaul

## Objective

Rewrite `skills/branding/SKILL.md` to add the expanded creative capabilities (guidelines page, README template, component library page), dual-mode operation (standalone vs. delegated from init), hub gallery as primary entry point, and remove the AskUserQuestion budget cap. This is the core prompt engineering wave.

## Owned Files

| File | Action |
|------|--------|
| `skills/branding/SKILL.md` | Major rewrite |
| `skills/branding/SKILL.test.cjs` | Update structural tests for new flow |

## Prerequisites

- Wave 1 must be committed (hub page badge colors exist for new artifact types).

## Tasks

### Task 1: Rewrite SKILL.md with dual-mode and expanded flow

**File:** `skills/branding/SKILL.md`

**What to do:**

Rewrite the entire SKILL.md. The new structure must be:

#### Frontmatter
Keep the existing frontmatter format but update description:
```yaml
---
description: Conduct a structured branding interview with codebase-aware visual/UX brand guidelines, artifact gallery, and live-reloading webserver
allowed-tools: Bash(rapid-tools:*), Read, Write, AskUserQuestion, Glob, Grep
---
```

#### Mode Documentation Section (NEW -- add immediately after the top-level heading)

Add a section explaining the two modes:

**Standalone mode** (default): The full branding experience. Runs banner, interview, artifact generation, server startup, commit, and footer. This is what happens when a user runs `/rapid:branding` directly.

**Delegated mode**: When invoked from `/rapid:init`. In delegated mode, the skill MUST skip: banner display (Step 1), git commit (Step 10), and footer display (Step 10). Everything else runs normally, including the server. The calling code (init) passes `mode=delegated` context.

#### Step Numbering (renumber to sequential)

The new step sequence must be:
1. Environment Setup + Banner (skip banner in delegated mode)
2. Codebase Detection -- Project Type Analysis (unchanged logic from current Step 2)
3. Check Existing Branding (unchanged logic from current Step 3)
4. Branding Interview (unchanged logic from current Step 4, but REMOVE the 5-call AskUserQuestion budget cap -- the decision explicitly says "No hard limit on AskUserQuestion calls")
5. Generate BRANDING.md (unchanged logic from current Step 5)
6. Generate Logo Artifact (unchanged logic from current Step 5b)
7. Generate Wireframe Artifact (unchanged logic from current Step 5c)
8. Expanded Asset Generation (NEW)
9. Start Server + Display Hub URL
10. Server Lifecycle, Commit, and Summary (skip commit/footer in delegated mode)

#### Step 8: Expanded Asset Generation (NEW -- the core addition)

After the wireframe is generated (Step 7), present a single multi-select prompt using AskUserQuestion:

```
"Which additional branding assets would you like to generate?"
Options:
- "Guidelines page" -- "Comprehensive design system reference with usage rules, do/don't examples, copy-paste snippets, accessibility guidelines, and brand voice examples (guidelines.html)"
- "README template" -- "Branded README.md template applying your project's terminology and tone guidelines (readme-template.md)"
- "Component library" -- "Interactive HTML page with buttons, forms, cards using your branding tokens (components.html)"
- "All of the above" -- "Generate all three additional assets"
- "Skip" -- "Continue without additional assets"
```

For each selected asset type, generate the artifact and register it:

**Guidelines page (`guidelines.html`):**
- Self-contained HTML file with inline CSS
- Sections: Design Tokens Reference, Usage Rules (do/don't examples), Copy-Paste Code Snippets (CSS custom properties, utility classes), Accessibility Guidelines (contrast ratios, focus states, screen reader considerations), Brand Voice & Tone Examples (writing samples for documentation, error messages, UI copy)
- Apply the project's branding tokens from BRANDING.md
- Register as artifact with type `guidelines`

**README template (`readme-template.md`):**
- Markdown file following the project's terminology and tone from BRANDING.md
- Include placeholders for: project name, description, installation, usage, contributing, license
- Apply the anti-patterns list (e.g., if "no emojis" was selected, the template avoids emojis)
- Register as artifact with type `readme-template`

**Component library (`components.html`):**
- Self-contained HTML file with inline CSS and JS
- Interactive examples: buttons (primary, secondary, outline), form inputs (text, select, checkbox), cards (basic, with image placeholder, with action), alert/notification components
- All components use the branding color palette, typography, and spacing tokens
- Register as artifact with type `component-library`

Each artifact registration follows the same pattern as Step 5/5b/5c:
```bash
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: '{type}',
  filename: '{filename}',
  description: '{description}'
});
console.log('Registered artifact:', result.id);
"
```

#### Step 9: Server Startup + Hub URL (modify existing Steps 6-7)

After all artifacts are generated, start the branding server. The hub page at `/` (root URL) is now the primary entry point -- display this URL prominently, not `/index.html`.

Change the display message to:
```
Branding hub available at: http://localhost:{port}

Open this URL in your browser to browse all branding artifacts.
The server auto-reloads when artifacts change.
```

Remove the old "Visual Preview" emphasis -- the hub IS the primary view now. The hub page still links to `index.html` for the visual preview, but the hub gallery is what the user sees first.

#### Step 10: Lifecycle, Commit, Summary (modify existing Steps 8-9)

Merge the server lifecycle question and commit/summary into one step. In delegated mode, skip the git commit and footer display. The init skill handles its own commit.

Update the git add command to include new artifact files:
```bash
git add .planning/branding/BRANDING.md .planning/branding/index.html .planning/branding/logo.svg .planning/branding/wireframe.html .planning/branding/artifacts.json .planning/branding/guidelines.html .planning/branding/readme-template.md .planning/branding/components.html 2>/dev/null
```
(The `2>/dev/null` handles cases where optional files were not generated.)

Update the summary to list all generated artifacts dynamically rather than hardcoding filenames.

#### Anti-Patterns Section Update

Remove these two anti-patterns that conflict with the new design:
- "Do NOT ask more than 5 AskUserQuestion calls in total" (budget cap removed per decision)
- The existing `## Step 5b` and `## Step 5c` sub-step numbering (renumbered to Steps 6 and 7)

Keep all other anti-patterns intact.

#### Key Principles Update

- Remove the "Under 2 minutes, 4-5 AskUserQuestion calls total" line.
- Add: "Hub gallery at / is the primary branding URL. All artifacts are browseable from there."
- Keep all other principles intact.

**What NOT to do:**
- Do not change the branding interview logic (Steps 2-4) beyond removing the budget cap.
- Do not change the BRANDING.md generation format (Step 5).
- Do not change the logo or wireframe generation logic (Steps 6-7, formerly 5b/5c).
- Do not reference or modify `branding-server.cjs` or `branding-artifacts.cjs` -- those are Wave 1 files.
- Do not add `Skill` to the allowed-tools frontmatter (branding does not invoke other skills).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && head -5 skills/branding/SKILL.md
cd /home/kek/Projects/RAPID && grep -c "## Step" skills/branding/SKILL.md
cd /home/kek/Projects/RAPID && grep -c "AskUserQuestion" skills/branding/SKILL.md
cd /home/kek/Projects/RAPID && grep "guidelines.html\|readme-template.md\|components.html" skills/branding/SKILL.md | head -5
cd /home/kek/Projects/RAPID && grep "delegated\|standalone" skills/branding/SKILL.md | head -5
```

### Task 2: Update SKILL.test.cjs for new structure

**File:** `skills/branding/SKILL.test.cjs`

**What to do:**

Update the structural tests to match the new SKILL.md structure:

1. **Test 6 (interview rounds):** Keep as-is -- the 4 interview rounds and their headings are unchanged.

2. **Test 8 (prefilled options):** Keep as-is -- each round still has 3-4 prefilled options.

3. **Test 12 (auto-open step):** REMOVE or rewrite this test. The old SKILL.md had `xdg-open`/`Darwin` references which were already removed. Replace with a test that verifies the hub URL display mentions `http://localhost`.

4. **Test 15 (step ordering):** Update to expect Steps 1 through 10 (was 1-9 with sub-steps). The new numbering is strictly sequential with no sub-steps.

5. **Add new test: dual-mode documentation exists.** Verify SKILL.md contains both "standalone" and "delegated" mode references.

6. **Add new test: expanded asset types referenced.** Verify SKILL.md references `guidelines.html`, `readme-template.md`, and `components.html`.

7. **Add new test: hub as primary entry point.** Verify SKILL.md contains text about the hub being the primary URL (e.g., "hub" and "primary" appear in proximity).

8. **Add new test: no AskUserQuestion budget cap.** Verify SKILL.md does NOT contain the string "5 AskUserQuestion" or "5-call budget" (the cap is removed).

**What NOT to do:**
- Do not remove tests 1-5, 6-7, 8-11, 13-14, 16-17 unless they directly conflict with the new structure.
- Do not add tests for server behavior -- those are in `branding-server.test.cjs`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test skills/branding/SKILL.test.cjs 2>&1 | tail -20
```

## Success Criteria

1. SKILL.md has 10 sequential steps (## Step 1 through ## Step 10) with no sub-steps.
2. SKILL.md contains dual-mode documentation (standalone and delegated sections).
3. SKILL.md contains the expanded asset generation step with multi-select prompt.
4. SKILL.md references all three new artifact types: guidelines.html, readme-template.md, components.html.
5. SKILL.md does not contain the 5-call AskUserQuestion budget cap.
6. Hub gallery at `/` is described as the primary branding URL.
7. All SKILL.test.cjs tests pass.
8. The file is well-structured and under 800 lines (the expanded flow adds ~100 lines but step renumbering removes sub-step overhead).
