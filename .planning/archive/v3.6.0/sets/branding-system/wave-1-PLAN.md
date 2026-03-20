# Wave 1 PLAN: branding-system -- Foundation

**Objective:** Create all new files for the branding system: the `/rapid:branding` skill definition (SKILL.md) and the `role-branding.md` agent role module. These are standalone new files with no dependencies on other code changes.

**Owned files this wave:**
- `skills/branding/SKILL.md` (new)
- `src/modules/roles/role-branding.md` (new)

---

## Task 1: Create `src/modules/roles/role-branding.md`

**Action:** Create the branding interviewer role module following existing conventions (see `role-executor.md`, `role-planner.md` for format reference).

**File:** `src/modules/roles/role-branding.md`

**Content requirements:**
- Title: `# Role: Branding Interviewer`
- One-sentence purpose line explaining this role conducts structured branding interviews
- **Responsibilities** section with these bullets:
  - Conduct a structured 4-dimension branding interview via AskUserQuestion
  - Cover: Tone & Voice, Terminology & Naming, Output Style, Project Identity
  - Ask 3-4 focused questions per session with prefilled options (always include "Other" for custom input)
  - Keep the interview under 2 minutes
  - Generate a concise BRANDING.md artifact (50-150 lines) with XML-tagged sections
  - Generate a self-contained `index.html` static branding guidelines page
  - On re-run: display current summary, ask which sections to update, preserve unchanged sections
- **BRANDING.md Format** section documenting the output artifact structure:
  - XML-tagged sections: `<identity>`, `<tone>`, `<terminology>`, `<output>`
  - An anti-patterns / "do not" section listing explicit things agents should avoid
  - Budget: 50-150 lines
  - Storage path: `.planning/branding/BRANDING.md`
- **Injection Scope** section documenting where branding context gets injected:
  - ALL lifecycle phases: discuss, plan, execute
  - Branding SHOULD influence: documentation/READMEs, code comments/naming (using project terminology)
  - Branding should NOT influence: commit messages, CLI/banner output, RAPID's own internal output
- **Constraints** section:
  - Never modify files outside the branding skill's scope
  - BRANDING.md must stay within 50-150 line budget
  - The static HTML page must be fully self-contained (inline CSS/JS, no external dependencies)
  - Auto-open the HTML file after generation (`xdg-open` on Linux, `open` on macOS, wrapped in try/catch)

**Verification:**
```bash
test -f src/modules/roles/role-branding.md && echo "PASS: role-branding.md exists" || echo "FAIL"
grep -q "Role: Branding" src/modules/roles/role-branding.md && echo "PASS: has title" || echo "FAIL"
grep -q "BRANDING.md" src/modules/roles/role-branding.md && echo "PASS: references BRANDING.md" || echo "FAIL"
```

**Commit:** `feat(branding-system): create role-branding.md agent role module`

---

## Task 2: Create `skills/branding/SKILL.md`

**Action:** Create the SKILL.md for the `/rapid:branding` skill. Follow the conventions of `skills/discuss-set/SKILL.md` for structure (YAML frontmatter, numbered steps, environment setup, AskUserQuestion usage).

**File:** `skills/branding/SKILL.md`

**Content requirements:**

### YAML Frontmatter
```yaml
---
description: Conduct a structured branding interview and generate project tone/style guidelines
allowed-tools: Bash(rapid-tools:*), Read, Write, AskUserQuestion, Glob, Grep
---
```

### Step-by-Step Structure

**Step 1: Environment Setup + Banner**
- Standard RAPID_TOOLS environment loading preamble (same as discuss-set)
- Display banner: `node "${RAPID_TOOLS}" display banner branding`

**Step 2: Check Existing Branding**
- Check if `.planning/branding/BRANDING.md` already exists
- If it exists (re-run):
  - Read and display current BRANDING.md summary
  - Use AskUserQuestion: "BRANDING.md already exists. What would you like to do?"
    - Options: "Update specific sections", "Start fresh", "View current and exit"
  - If "Update specific sections": use AskUserQuestion to ask which sections to update (identity, tone, terminology, output, anti-patterns), then only ask questions for selected sections, preserve unchanged sections
  - If "Start fresh": continue to Step 3
  - If "View current and exit": display BRANDING.md and STOP
- If it does not exist: continue to Step 3

**Step 3: Branding Interview**
- Conduct the interview in 4 rounds, one per dimension. For each dimension, use ONE AskUserQuestion call with 3-4 prefilled options plus "Other" for custom input:

- **Round 1 -- Project Identity:**
  - Question about project personality/character (e.g., "How would you describe your project's personality?")
  - Options like: "Professional & authoritative", "Friendly & approachable", "Technical & precise", "Other"

- **Round 2 -- Tone & Voice:**
  - Question about communication style for documentation and comments
  - Options like: "Formal/third-person", "Conversational/second-person", "Terse/minimal", "Other"

- **Round 3 -- Terminology & Naming:**
  - Question about naming conventions and domain-specific terminology
  - Include a sub-question about terms to always/never use
  - Options plus free-form for terminology table entries

- **Round 4 -- Output Style:**
  - Question about documentation style preferences
  - Options like: "Detailed with examples", "Concise bullet points", "Code-first minimal prose", "Other"

- After all 4 rounds, ask one final AskUserQuestion about anti-patterns:
  - "What should agents explicitly avoid?" with options like: "No emojis", "No marketing language", "No filler words", "Other"

**Step 4: Generate BRANDING.md**
- Create `.planning/branding/` directory if it does not exist
- Write `.planning/branding/BRANDING.md` using the Write tool
- Format with XML-tagged sections:
```markdown
# Project Branding Guidelines

<identity>
## Project Identity
{identity answers}
</identity>

<tone>
## Tone & Voice
{tone answers}
</tone>

<terminology>
## Terminology & Naming

| Preferred Term | Instead Of | Context |
|---------------|-----------|---------|
{terminology table rows}
</terminology>

<output>
## Output Style
{output style answers}
</output>

<anti-patterns>
## Anti-Patterns (Do NOT)
- {anti-pattern 1}
- {anti-pattern 2}
...
</anti-patterns>
```
- Validate line count is between 50-150 lines. If over, trim less critical examples. If under, add more specific guidance.

**Step 5: Generate Static HTML Branding Page**
- Write `.planning/branding/index.html` -- a single self-contained HTML file with inline CSS and JS
- Content: visual display of all branding guidelines (identity summary, tone examples, terminology table, output style, anti-patterns in a "danger" callout)
- Design: clean, readable, uses the project's own color/style preferences if captured
- No external dependencies (no CDN links, no build step)

**Step 6: Auto-Open HTML Page**
- Detect platform: `process.platform` equivalent via bash `uname`
- Linux: `xdg-open .planning/branding/index.html`
- macOS: `open .planning/branding/index.html`
- Wrap in try/catch (do not fail if browser cannot open)

**Step 7: Commit and Summary**
- Commit the branding artifacts:
```bash
git add .planning/branding/BRANDING.md .planning/branding/index.html
git commit -m "feat(branding-system): generate branding guidelines"
```
- Display summary of what was generated
- Show hint: "Branding context will be automatically injected into all future RAPID execution prompts."

### Error Handling
- If RAPID_TOOLS is not set: show error and suggest `/rapid:install`
- If AskUserQuestion fails: gracefully fall back to defaults with a warning
- All errors should be descriptive with clear next steps

### Key Principles
- Branding is FULLY OPTIONAL -- this skill should never be required for any other RAPID workflow
- Keep the interview quick (under 2 minutes, 4-5 questions total)
- BRANDING.md is the authoritative artifact; index.html is for human review
- Each AskUserQuestion must have 3-4 prefilled options with clear descriptions
- The "Other" option on every question allows full customization

### Anti-Patterns for the Skill Itself
- Do NOT ask more than 5 AskUserQuestion calls in total (keep it fast)
- Do NOT generate BRANDING.md longer than 150 lines (prompt budget discipline)
- Do NOT reference or modify any RAPID internals (execute.cjs, display.cjs, etc.) -- that is the integration wave's job
- Do NOT add external dependencies to the HTML page

**Verification:**
```bash
test -f skills/branding/SKILL.md && echo "PASS: SKILL.md exists" || echo "FAIL"
grep -q "description:" skills/branding/SKILL.md && echo "PASS: has frontmatter" || echo "FAIL"
grep -q "AskUserQuestion" skills/branding/SKILL.md && echo "PASS: uses AskUserQuestion" || echo "FAIL"
grep -q "BRANDING.md" skills/branding/SKILL.md && echo "PASS: references BRANDING.md" || echo "FAIL"
grep -q ".planning/branding/" skills/branding/SKILL.md && echo "PASS: uses branding subdirectory" || echo "FAIL"
```

**Commit:** `feat(branding-system): create branding skill SKILL.md with interview flow`

---

## Success Criteria

1. `src/modules/roles/role-branding.md` exists and follows existing role module conventions
2. `skills/branding/SKILL.md` exists with valid YAML frontmatter and step-by-step interview flow
3. Both files reference `.planning/branding/BRANDING.md` as the output artifact path
4. SKILL.md uses AskUserQuestion with prefilled options for all 4 branding dimensions
5. SKILL.md includes re-run UX (detect existing BRANDING.md, offer update/fresh/view options)
6. SKILL.md includes static HTML generation and auto-open steps
7. Neither file modifies any existing RAPID source code
