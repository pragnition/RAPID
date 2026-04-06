# Wave 1 PLAN: Core Backlog Skill

**Set:** backlog-system
**Wave:** 1 of 3
**Objective:** Create the `/rapid:backlog` skill that captures out-of-scope feature ideas as individual Markdown files in `.planning/backlog/`. This wave establishes the file format, naming convention, and the SKILL.md that users and agents invoke.

## File Ownership

| File | Action |
|------|--------|
| `skills/backlog/SKILL.md` | Create |

## Task 1: Create `skills/backlog/SKILL.md`

Create the file `skills/backlog/SKILL.md` that defines the `/rapid:backlog` skill.

### Frontmatter

```yaml
---
description: Capture out-of-scope feature ideas as backlog items in .planning/backlog/
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read, Write, Glob
---
```

### Skill Structure

The SKILL.md must follow this structure (model it after existing skills like `skills/quick/SKILL.md` for style):

**Step 0: Environment Setup + Banner**
- Standard RAPID_TOOLS env preamble (same as all other skills)
- Display banner: `node "${RAPID_TOOLS}" display banner backlog`
- Note: The banner command may not have a registered entry yet. If so, use a simple echo-based banner: `echo "--- /rapid:backlog ---"`

**Step 1: Parse Arguments**
- The user invokes as: `/rapid:backlog "idea title"` or `/rapid:backlog "idea title" "description"` or `/rapid:backlog` (no args)
- If a title is provided as first argument, use it directly
- If no title is provided, use AskUserQuestion (freeform) to prompt: "What feature idea would you like to capture? Provide a short title."
- If a description is provided as second argument, use it directly
- If no description is provided, use AskUserQuestion (freeform) to prompt: "Describe this feature idea in 1-3 sentences. What should it do and why would it be valuable?"

**Step 2: Generate Backlog Item File**
- Create the `.planning/backlog/` directory if it does not exist: `mkdir -p .planning/backlog`
- Generate a filename using the pattern: `{YYYYMMDD-HHmmss}-{slug}.md`
  - Timestamp from current date/time for cross-worktree uniqueness
  - Slug derived from the title: lowercase, spaces replaced with hyphens, non-alphanumeric characters removed, truncated to 50 characters
  - Example: `20260406-143022-add-priority-field-to-backlog.md`
- Use bash to generate the timestamp: `date +%Y%m%d-%H%M%S`
- Use bash to generate the slug: lowercase the title, replace spaces with hyphens, strip non-alphanumeric (keeping hyphens), truncate to 50 chars

**Step 3: Write Backlog Item File**
- Write the file to `.planning/backlog/{filename}` using the Write tool
- File format is Markdown with YAML frontmatter:

```markdown
---
title: "{title}"
created: "{ISO 8601 date, e.g. 2026-04-06}"
---

{description}
```

- The frontmatter contains only `title` and `created` fields (no source, no priority, no category -- per CONTEXT.md decisions)
- The body contains the freeform description

**Step 4: Confirmation**
- Display confirmation: "Backlog item captured: `.planning/backlog/{filename}`"
- Display the item title and a truncated description preview (first 80 chars)
- Do NOT commit the file. Backlog items are committed alongside set work (per CONTEXT.md decision on cross-worktree persistence).

### What NOT to Do
- Do NOT add any list/browse/search functionality -- capture only in v1
- Do NOT add priority or category fields to the frontmatter
- Do NOT add source tracking (which set originated the idea)
- Do NOT validate or deduplicate against existing backlog items
- Do NOT commit the backlog file -- it will be committed with other set work
- Do NOT register the skill anywhere -- skills auto-discover from `skills/*/SKILL.md`

### Verification

```bash
# Verify SKILL.md exists and has correct frontmatter
test -f skills/backlog/SKILL.md && echo "PASS: SKILL.md exists" || echo "FAIL: SKILL.md missing"
head -4 skills/backlog/SKILL.md | grep -q "description:" && echo "PASS: Has frontmatter" || echo "FAIL: Missing frontmatter"
head -4 skills/backlog/SKILL.md | grep -q "allowed-tools:" && echo "PASS: Has allowed-tools" || echo "FAIL: Missing allowed-tools"
```

## Success Criteria

1. `skills/backlog/SKILL.md` exists with valid frontmatter (`description` and `allowed-tools`)
2. The skill handles three invocation patterns: full args, title-only, no args (with AskUserQuestion fallback prompts)
3. The skill generates unique filenames using `{YYYYMMDD-HHmmss}-{slug}.md` format
4. The skill writes Markdown files with YAML frontmatter containing `title` and `created` fields
5. The skill creates `.planning/backlog/` directory on first use
6. The skill does NOT commit files, list items, or include any management features
