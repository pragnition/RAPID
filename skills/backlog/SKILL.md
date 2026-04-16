---
description: Capture out-of-scope feature ideas as backlog items in .planning/backlog/
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read, Write, Glob
args:
  - name: title
    type: string
    description: Short title for the backlog item
    required: true
    maxLength: 200
  - name: description
    type: multi-line
    description: Detailed description of the backlog item
    required: true
    maxLength: 8000
categories: [autonomous]
---

# /rapid:backlog -- Capture Backlog Item

You are the RAPID backlog capture skill. This skill persists out-of-scope feature ideas as individual Markdown files in `.planning/backlog/`. It is a capture-only tool -- no listing, browsing, searching, or management features. Follow these steps IN ORDER.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner backlog 2>/dev/null || echo "--- /rapid:backlog ---"
```

If the `display banner` command is not registered, the fallback echo is sufficient.

---

## Step 1: Parse Arguments

The user invokes this skill in one of three ways:

1. **Full arguments:** `/rapid:backlog "idea title" "description"`
2. **Title only:** `/rapid:backlog "idea title"`
3. **No arguments:** `/rapid:backlog`

### Resolve Title

If a title was provided as the first argument, use it directly.

If no title was provided, use AskUserQuestion (freeform):

> "What feature idea would you like to capture? Provide a short title."

Record the title for use in subsequent steps.

### Resolve Description

If a description was provided as the second argument, use it directly.

If no description was provided, use AskUserQuestion (freeform):

> "Describe this feature idea in 1-3 sentences. What should it do and why would it be valuable?"

Record the description for use in subsequent steps.

---

## Step 2: Generate Backlog Item File

### Create Directory

Ensure the backlog directory exists:

```bash
mkdir -p .planning/backlog
```

### Generate Filename

The filename follows the pattern: `{YYYYMMDD-HHmmss}-{slug}.md`

Generate the timestamp:

```bash
date +%Y%m%d-%H%M%S
```

Generate the slug from the title:
- Lowercase the title
- Replace spaces with hyphens
- Strip all characters that are not alphanumeric or hyphens
- Truncate to 50 characters

```bash
TITLE="<the title from Step 1>"
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-50)
echo "$SLUG"
```

Combine to produce the full filename:

```
FILENAME="${TIMESTAMP}-${SLUG}.md"
```

Example: `20260406-143022-add-priority-field-to-backlog.md`

---

## Step 3: Write Backlog Item File

Write the file to `.planning/backlog/{FILENAME}` using the Write tool. The file format is Markdown with YAML frontmatter:

```markdown
---
title: "{title}"
created: "{ISO 8601 date, e.g. 2026-04-06}"
---

{description}
```

The frontmatter contains only `title` and `created` fields. No source, no priority, no category. The body contains the freeform description exactly as provided.

---

## Step 4: Confirmation

Display a confirmation message:

> Backlog item captured: `.planning/backlog/{FILENAME}`
>
> **Title:** {title}
> **Preview:** {first 80 characters of description}...

Do NOT commit the file. Backlog items are committed alongside set work -- they merge with the worktree's changes naturally.

---

## Anti-Patterns -- Do NOT Do These

- Do NOT add list/browse/search functionality -- this is capture only
- Do NOT add priority or category fields to the frontmatter
- Do NOT add source tracking (which set originated the idea)
- Do NOT validate or deduplicate against existing backlog items
- Do NOT commit the backlog file -- it will be committed with other set work
- Do NOT register the skill anywhere -- skills auto-discover from `skills/*/SKILL.md`

## Key Principles

- **Zero friction:** Capture should never fail. No validation, no dedup, no schema enforcement.
- **Minimal metadata:** Title and created date only. Keep items simple.
- **Dual-mode invocation:** Works with full arguments (for agents) and with interactive prompts (for users).
- **Cross-worktree safe:** Timestamp-based filenames prevent collisions across parallel worktrees.
- **Capture only:** No management features. Users browse `.planning/backlog/` directly; audit-version surfaces items during milestone review.
