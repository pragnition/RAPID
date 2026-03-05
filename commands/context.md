---
description: Analyze codebase and generate project context files
allowed-tools: Read, Write, Bash, Glob, Grep, Agent
---

# /rapid:context -- Codebase Analysis and Context Generation

Run the /rapid:context skill to analyze the codebase and generate context files.

This command detects codebase characteristics (languages, frameworks, conventions), performs deep analysis via a subagent, presents findings for review, and generates context files (CLAUDE.md, CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) that agents consume automatically.
