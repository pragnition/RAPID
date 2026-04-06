# PLAN: agent-namespace-enforcement -- Wave 1

## Objective

Rewrite the Namespace Isolation section in `src/modules/core/core-identity.md` with imperative MUST/MUST NOT enforcement language, a general deny-list rule (no concrete examples), and a user-override escape hatch. This is the single source of truth that propagates to all agents via build-agents assembly.

## Owned Files

| File | Action |
|------|--------|
| `src/modules/core/core-identity.md` | Modify lines 39-41 (Namespace Isolation section) |

## Tasks

### Task 1: Rewrite Namespace Isolation section

**File:** `src/modules/core/core-identity.md`

**Current text (lines 39-41):**
```markdown
## Namespace Isolation

You are a RAPID agent. Only use `rapid:*` skills and commands. Your system context may list skills from other plugins (e.g., `gsd:*`, `p-research:*`). **Ignore them entirely.** Never invoke, reference, or suggest any skill or command that does not have the `rapid:` namespace prefix. If a user's task maps to a non-RAPID skill, find the equivalent `rapid:*` command or report BLOCKED.
```

**Replace with the following (keep the `## Namespace Isolation` heading, expand the body):**

The new section MUST include these elements in order:

1. **Opening declaration** -- "You are a RAPID agent." (keep this)
2. **General deny-list rule** -- A single imperative statement: agents MUST NOT invoke any skill, command, or subagent outside the `rapid:` namespace. No concrete namespace examples in the deny-list itself.
3. **Existing context awareness** -- The system context may list non-RAPID skills. Agents MUST ignore them entirely.
4. **Positive guidance** -- Only use `rapid:*` skills and `rapid-*` agents. If a task maps to a non-RAPID capability, find the equivalent `rapid:*` command or report BLOCKED.
5. **BLOCKED format** -- When reporting BLOCKED due to namespace violation, include the rejected skill/agent name for transparency (e.g., "BLOCKED: skill `gsd:status` is outside the `rapid:` namespace").
6. **Subagent rule** -- NEVER call or reference subagents without the `rapid:` or `rapid-` prefix. When referring to other agents in outputs or handoffs, always use their full prefixed name (e.g., `rapid-executor`, not "the executor").
7. **User-override escape hatch** -- When explicit user intent is passed through the skill prompt, agents MAY comply with non-RAPID skill requests. This exception applies only when the user's direct instruction names a specific non-RAPID capability.

**Imperative language requirements:**
- Use MUST, MUST NOT, NEVER -- not "should", "ignore", or advisory phrasing
- Bold the key directives for visual scanning

**What NOT to do:**
- Do NOT add concrete deny-list examples (no `gsd:*`, `p-research:*` examples in the deny-list rule itself). The `(e.g., ...)` parenthetical in the context awareness line is acceptable as it illustrates what "non-RAPID skills" look like, but the deny-list rule itself must be general.
- Do NOT change anything outside the Namespace Isolation section (lines 39-41). The heading stays on line 39, the blank line stays on line 40, the body starts on line 41.
- Do NOT add subsection headings within Namespace Isolation -- keep it as a single section with a paragraph or short bullet list.

**Verification:**
```bash
# Confirm the section exists and uses imperative language
grep -n "MUST NOT" src/modules/core/core-identity.md
grep -n "NEVER" src/modules/core/core-identity.md
grep -n "Namespace Isolation" src/modules/core/core-identity.md
# Confirm no other sections were modified
git diff src/modules/core/core-identity.md | head -80
```

## Success Criteria

1. The Namespace Isolation section uses MUST/MUST NOT/NEVER language (imperative, not advisory)
2. The deny-list is a general rule, not a list of concrete namespace examples
3. A user-override escape hatch is present
4. The BLOCKED format includes the rejected skill/agent name
5. A subagent naming rule requires the `rapid:` or `rapid-` prefix
6. No other sections in the file are modified
7. The file remains valid Markdown with no formatting errors
