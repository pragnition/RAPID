# Phase 29: Discuss Phase Optimization - Research

**Researched:** 2026-03-09
**Domain:** RAPID plugin discuss skill UX -- question batching, round-based discussion, delegation model
**Confidence:** HIGH

## Summary

Phase 29 is a targeted Markdown-only modification to a single RAPID skill file (`skills/discuss/SKILL.md`). The goal is to replace the current 4-question-per-gray-area deep-dive loop (Step 5) with a 2-round batching model that halves the number of sequential user interactions per gray area. A secondary change adds a "Let Claude decide all" master toggle to the gray area selection step (Step 4). No JavaScript code changes, no new libraries, no new files -- this is a pure skill instruction rewrite.

The current discuss skill presents 5-8 gray areas for selection (Step 4), then loops through 4 sequential AskUserQuestion calls per selected area (Step 5): approach, edge cases, specifics, confirmation. For 4 selected areas, that is 16 interactions. The new model organizes these into 2 rounds: Round 1 (approach + edge case context, batched across all areas) and Round 2 (specifics + confirmation, batched across all areas). For 4 selected areas, that is 8 interactions -- a 50% reduction.

The implementation is straightforward because AskUserQuestion is already well-understood (used 100+ times across 17 skills). The two-part prompt format (context in the question text, choices in options) is already the standard pattern. The only architectural change is replacing the per-area 4-question loop with a per-round all-areas loop, plus adding one option to the existing Step 4 multiSelect.

**Primary recommendation:** Execute as a single plan with 2 tasks: (1) update Step 4 to add the master delegation toggle, (2) rewrite Step 5 from a 4-question per-area loop to a 2-round all-areas structure. Additionally, remove the STATE.md blocker note about "AskUserQuestion batching behavior needs empirical spike" as part of the implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Batching strategy:** Collapse 4 questions per gray area into 2 interactions using merged pairs. Interaction 1 (approach + edge cases): Two-part prompt -- AskUserQuestion presents approach options, plus a second paragraph in the question text describing a key edge case or tradeoff. User picks approach via option selection. Interaction 2 (specifics + confirmation): Summary of decisions so far, then 1-2 specific detail options. "Looks good" locks everything; "Revise" loops back to Interaction 1 for that area.
- **Round structure:** Round 1: All approach selections (Interaction 1) for every selected gray area, presented back-to-back. No specifics mid-round. Round 2: All specifics/confirmations (Interaction 2) for every selected gray area, presented back-to-back. Always 2 interactions per area -- no skipping, even if Interaction 1 seems sufficient. For 4 selected gray areas: 4 approach + 4 specifics = 8 total interactions, down from 16 (4x4).
- **"Let Claude decide" granularity:** Master toggle in gray area selection (Step 4): "Let Claude decide all" option alongside the gray area multi-select. If selected, skips both rounds entirely. Per-area delegation available as an option in Round 1 approach questions. User can delegate individual gray areas while deciding others. Round 2 inheritance: If approach was delegated in Round 1, Interaction 2 still shows summary but marks everything as Claude's discretion. Always runs.
- **Spike approach:** No spike task needed -- AskUserQuestion behavior is well-understood from prior phases. Remove the blocker note about "empirical spike" from STATE.md as part of implementation.

### Claude's Discretion
- Exact wording of the two-part prompt format for Interaction 1
- How to present the summary in Interaction 2 (bullet list, table, prose)
- Edge case selection per gray area -- which edge case to surface in the Interaction 1 prompt
- How "Revise" in Round 2 flows back to Round 1 (re-present just that area's Interaction 1, or full Round 1)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-05 | Discuss phase batches related questions into 2 interactions per gray area instead of 4 | Step 5 rewrite from 4-question loop to 2-round structure; Step 4 master toggle addition; STATE.md blocker removal |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AskUserQuestion | Claude Code built-in | All user interactions in discuss skill | Required by PROJECT.md constraint; already used in both Step 4 and Step 5 |
| skills/discuss/SKILL.md | Internal | Skill instruction file being modified | Direct target of this phase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| .planning/STATE.md | Internal | Project state file | Remove spike blocker note |

### Alternatives Considered
None -- this phase modifies existing internal skill instructions. No external dependencies involved.

**Installation:**
No new packages required. Zero code changes to JavaScript modules.

## Architecture Patterns

### Recommended Project Structure
No new files created. Changes are to existing files only:
```
skills/
  discuss/
    SKILL.md          # Rewrite Step 4 (add master toggle) and Step 5 (2-round structure)
.planning/
  STATE.md            # Remove spike blocker note
```

### Pattern 1: Two-Round Discussion Structure
**What:** Replace the per-area 4-question deep-dive loop with two rounds that iterate across all selected areas
**When to use:** Step 5 of the discuss skill

Current structure (to be replaced):
```
For EACH selected gray area:
  Q1: Approach selection         (AskUserQuestion)
  Q2: Edge case probing          (AskUserQuestion)
  Q3: Specifics clarification    (AskUserQuestion)
  Q4: Confirmation/revision      (AskUserQuestion)
```

New structure:
```
Round 1 -- Approach Selection (all areas):
  For EACH selected gray area:
    Interaction 1: Approach + edge case context (AskUserQuestion)
      - Question text: approach options + edge case paragraph
      - Options: approach choices + "Let Claude decide"
      - If delegated: record as Claude's discretion, still include in Round 2

Round 2 -- Specifics & Confirmation (all areas):
  For EACH selected gray area:
    Interaction 2: Summary + specifics (AskUserQuestion)
      - Question text: summary of Round 1 decision + 1-2 specific detail questions
      - Options: specific choices + "Looks good" + "Revise"
      - If "Revise": loop back to Interaction 1 for ONLY that area, then re-enter Round 2
      - If delegated in Round 1: still show summary, mark as Claude's discretion
```

**Key behavioral differences from current:**
- Users answer all approach questions before any specifics questions (cognitive batching)
- Edge cases are folded into the approach question text rather than being a separate question
- Specifics and confirmation are merged into a single interaction
- "Revise" loops back to only that area's Interaction 1, not the entire Round 1

### Pattern 2: Master Delegation Toggle (Step 4)
**What:** Add a "Let Claude decide all" option to the existing gray area multiSelect in Step 4
**When to use:** Gray area selection before deep-dive

Current Step 4 pattern:
```
"Select which to discuss (select none to let me decide all):"
Options:
1. "{Gray area}" -- "{description}"
2. ...
```

New Step 4 pattern:
```
"Select which areas to discuss:"
Options:
1. "Let Claude decide all" -- "Skip discussion, I'll make all decisions based on codebase patterns"
2. "{Gray area}" -- "{description}"
3. "{Gray area}" -- "{description}"
...
```

**Key difference:** "Let Claude decide all" is now an explicit labeled option rather than relying on selecting none. Selecting it skips both rounds entirely and documents all areas as Claude's discretion.

### Pattern 3: Two-Part Prompt Format (Interaction 1)
**What:** AskUserQuestion with approach options in the options list and edge case context in the question body
**When to use:** Each gray area's Interaction 1 in Round 1

```
AskUserQuestion:
  question: "How do you want to handle '{gray area title}'?

    Context: {2-3 sentences explaining the tradeoffs}

    Edge case to consider: {1 key edge case or tradeoff that affects the approach choice}"

  options:
    - "{Approach A}" -- "{Brief description}"
    - "{Approach B}" -- "{Brief description}"
    - "Let Claude decide" -- "I'll choose based on codebase patterns and contracts"
```

This merges the old Q1 (approach) and Q2 (edge cases) into a single interaction. The edge case is informational context that helps the user make a more informed approach selection, rather than requiring a separate interaction.

### Pattern 4: Summary-and-Confirm Format (Interaction 2)
**What:** AskUserQuestion with decision summary and specific detail options
**When to use:** Each gray area's Interaction 2 in Round 2

```
AskUserQuestion:
  question: "'{Gray area title}' -- decisions so far:
    - Approach: {chosen approach from Round 1}

    Remaining detail: {1-2 specific implementation questions}"

  options:
    - "{Specific choice A}" -- "{Description}"
    - "{Specific choice B}" -- "{Description}"
    - "Looks good" -- "Lock all decisions for this area"
    - "Revise" -- "Go back and change the approach"
```

This merges the old Q3 (specifics) and Q4 (confirmation) into a single interaction. "Looks good" serves as both acceptance of the specific detail and confirmation of the overall area decisions.

### Anti-Patterns to Avoid
- **Skipping Interaction 2 for delegated areas:** The locked decision explicitly states Round 2 always runs -- even if the user selected "Let Claude decide" in Round 1. Show the summary with Claude's chosen approach and mark as discretion.
- **Mixing rounds:** Do NOT present any Interaction 2 (specifics/confirmation) during Round 1. All approach questions first, then all specifics/confirmations.
- **Variable interaction count:** Always exactly 2 interactions per gray area. Do not add a 3rd interaction or skip to 1. The only exception is the "Revise" loop, which re-presents Interaction 1 and then Interaction 2 for that specific area.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User interaction | Custom prompt parsing | AskUserQuestion tool | Required by PROJECT.md; already the standard across all skills |
| Multi-select | Custom selection logic | AskUserQuestion with `multiSelect: true` | Already proven in Step 4; built-in to the tool |
| Decision tracking | External state store | In-memory tracking within skill execution | The skill runs in a single session; WAVE-CONTEXT.md is the persistent artifact |

**Key insight:** This phase changes ONLY the Markdown instructions that guide the AI agent's behavior during the discuss skill. There is zero JavaScript code to write. AskUserQuestion is the same tool used before -- just invoked fewer times with richer prompts.

## Common Pitfalls

### Pitfall 1: Ambiguous "Revise" Flow
**What goes wrong:** The "Revise" option in Interaction 2 sends the user back, but it is unclear whether they re-enter just that area or the full Round 1.
**Why it happens:** The locked decision says "loops back to Interaction 1 for that area" but the discretion section says the exact flow is Claude's choice.
**How to avoid:** The skill instructions should specify: "Revise" re-presents ONLY that area's Interaction 1 (not the entire Round 1). After the user re-answers, re-present ONLY that area's Interaction 2. Then continue with the remaining Round 2 areas.
**Warning signs:** After "Revise", the user being asked about areas they already confirmed.

### Pitfall 2: "Let Claude Decide" in Round 1 vs Master Toggle Confusion
**What goes wrong:** The per-area "Let Claude decide" option in Round 1 and the master "Let Claude decide all" in Step 4 have different scopes but similar wording.
**Why it happens:** Both use similar language for different granularities.
**How to avoid:** Make the distinction clear in the skill instructions:
- Step 4 master toggle: "Let Claude decide all" -- skips BOTH rounds entirely for ALL areas
- Round 1 per-area: "Let Claude decide" -- delegates ONE area, still shows it in Round 2 as Claude's discretion
**Warning signs:** User selecting "Let Claude decide" per-area and the skill skipping the entire discussion.

### Pitfall 3: Empty Round 2 After Full Delegation
**What goes wrong:** If the user delegates ALL areas individually in Round 1 (not via master toggle), Round 2 still needs to run with all areas marked as Claude's discretion.
**Why it happens:** It seems unnecessary to show summaries for areas the user explicitly delegated.
**How to avoid:** The locked decision is clear: "Round 2 inheritance: If approach was delegated in Round 1, Interaction 2 still shows summary but marks everything as Claude's discretion. Always runs." Even if every area was delegated, Round 2 shows the summaries.
**Warning signs:** Round 2 being skipped when all areas are individually delegated.

### Pitfall 4: Losing the "select none" Backward Compatibility
**What goes wrong:** Adding "Let Claude decide all" as an explicit option but removing the old "select none to let me decide all" behavior.
**Why it happens:** The current instruction says "select none" = delegate all. Adding the master toggle option is additive, but the "select none" behavior should remain as a fallback.
**How to avoid:** Keep both paths: selecting "Let Claude decide all" explicitly OR selecting no areas both result in skipping to Step 6 with all areas at Claude's discretion. The explicit option makes the capability visible; the empty selection preserves backward compatibility.
**Warning signs:** User selecting no gray areas and the skill treating it as an error.

### Pitfall 5: Steps 1-3 and 6-8 Accidentally Modified
**What goes wrong:** Unintended changes to steps outside the scope of this phase.
**Why it happens:** The skill is one long Markdown file. Editing Step 4 and 5 requires careful scoping.
**How to avoid:** Verify before/after that Steps 1-3, 6, 7, and 8 are identical. The only change outside Steps 4-5 is the update to the skill preamble text (line 8) which mentions "4-question loop" -- this should be updated to reflect the new "2-round" structure.
**Warning signs:** Line count changes in sections outside Steps 4 and 5.

### Pitfall 6: STATE.md Blocker Note Not Removed
**What goes wrong:** The STATE.md still references the empirical spike blocker after the phase is complete.
**Why it happens:** It is easy to focus on the skill file and forget the STATE.md cleanup.
**How to avoid:** Include STATE.md blocker removal as an explicit task in the plan.
**Warning signs:** `grep "empirical spike" .planning/STATE.md` returning matches after phase completion.

## Code Examples

Verified patterns from the existing codebase:

### Current Step 4 (to be modified -- add master toggle)
```markdown
Present gray areas using AskUserQuestion with `multiSelect: true`:

"I've analyzed the wave context and identified these areas that would benefit from your input. Select which to discuss (select none to let me decide all):"

Options (each as a selectable item):
1. "{Gray area title}" -- "{Brief 1-sentence description of why this needs input}"
2. "{Gray area title}" -- "{Brief description}"
3. ...up to 8 areas

If the user selects none: Document that all areas are at Claude's discretion and skip to Step 6.
```
Source: `skills/discuss/SKILL.md` lines 161-174

### Current Step 5 (to be replaced entirely)
```markdown
For EACH selected gray area, run a 4-question discussion loop. Track all decisions made.

### Question 1: Open-ended exploration
Use AskUserQuestion:
"How do you want to handle '{gray area title}'?
Context: {2-3 sentences explaining the tradeoffs}
Options:
- "{Approach A}" -- "{Brief description}"
- "{Approach B}" -- "{Brief description}"
- "Let Claude decide" -- "I'll choose based on the codebase patterns and contracts"

### Question 2: Follow-up probing
...
### Question 3: Specifics clarification
...
### Question 4: Confirmation or revision
...
```
Source: `skills/discuss/SKILL.md` lines 178-252

### Existing multiSelect Pattern (Step 4 -- reuse for master toggle)
```markdown
Present gray areas using AskUserQuestion with `multiSelect: true`:
```
Source: `skills/discuss/SKILL.md` line 161. The "Let Claude decide all" option is added as the first option in this existing multiSelect. AskUserQuestion already supports `multiSelect: true` -- no new tool capabilities needed.

### Existing "Let Claude decide" Per-Question Pattern
```markdown
- "Let Claude decide" -- "I'll choose based on the codebase patterns and contracts"
```
Source: `skills/discuss/SKILL.md` line 194. This same option text is reused in Interaction 1. The pattern is already established.

### STATE.md Blocker to Remove
```markdown
- AskUserQuestion batching behavior (Phase 29): spike deemed unnecessary -- standard AskUserQuestion usage, no exotic batching
```
Source: `.planning/STATE.md` line 106. This line should be removed (or the full blocker entry cleaned up) as part of this phase.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4-question loop per gray area | 2-round batched interactions per gray area | Phase 29 | 50% fewer sequential interactions |
| "Select none" as implicit delegation | Explicit "Let Claude decide all" master toggle | Phase 29 | Visible, discoverable delegation option |
| Separate approach, edge case, specifics, confirmation | Merged approach+edge (Interaction 1) and specifics+confirmation (Interaction 2) | Phase 29 | Cognitive batching -- approach mode, then refinement mode |

**Deprecated/outdated after this phase:**
- 4-question per-area deep-dive loop in Step 5
- Implicit "select none" as the only delegation mechanism (still works but no longer primary)
- "AskUserQuestion batching behavior needs empirical spike" blocker in STATE.md

## Open Questions

1. **"Revise" re-entry flow**
   - What we know: "Revise" in Round 2 goes back to Interaction 1 for that area only. After re-answering, Interaction 2 is re-presented for that area only.
   - What's unclear: Whether the user should re-enter at their current position in Round 2 after the revision, or whether Round 2 restarts from the beginning.
   - Recommendation: Re-enter at the current position. The user has already confirmed other areas -- do not re-ask those. Present only the revised area's Interaction 2, then continue with any remaining un-confirmed areas.

2. **"Let Claude decide all" and multiSelect interaction**
   - What we know: "Let Claude decide all" is an option in the multiSelect. If the user selects it alongside specific gray areas, the intent is ambiguous.
   - What's unclear: Does selecting "Let Claude decide all" plus specific areas mean "decide all" or "decide the ones I selected plus delegate the rest"?
   - Recommendation: If "Let Claude decide all" is selected, it takes precedence regardless of other selections. Skip both rounds entirely. This is the simplest and most predictable behavior.

3. **Edge case selection for Interaction 1**
   - What we know: The old Q2 was a dedicated edge case question. In the new model, one key edge case is folded into the Interaction 1 question text.
   - What's unclear: How does the AI agent choose which edge case to surface? (This is flagged as Claude's discretion.)
   - Recommendation: Instruct the AI agent to select the edge case most likely to affect the approach choice. The goal is to surface information that changes the decision, not just to inform.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 18+) |
| Config file | None -- uses node --test directly |
| Quick run command | `node --test ~/Projects/RAPID/src/lib/*.test.cjs` |
| Full suite command | `node --test ~/Projects/RAPID/src/lib/*.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-05 | Step 4 has "Let Claude decide all" master toggle option | manual-only | Verify SKILL.md contains the master toggle instruction | N/A -- Markdown-only change |
| UX-05 | Step 5 uses 2-round structure instead of 4-question loop | manual-only | Verify SKILL.md Step 5 describes Round 1 and Round 2 | N/A -- Markdown-only change |
| UX-05 | Each gray area gets exactly 2 interactions | manual-only | Verify SKILL.md instructions specify 2 interactions per area | N/A -- Markdown-only change |
| UX-05 | Round 2 always runs even for delegated areas | manual-only | Verify SKILL.md explicitly states Round 2 runs for delegated areas | N/A -- Markdown-only change |
| UX-05 | STATE.md spike blocker removed | manual-only | `grep "empirical spike" .planning/STATE.md` should return no matches | N/A |

### Sampling Rate
- **Per task commit:** `grep -c "Round 1\|Round 2\|Interaction 1\|Interaction 2" ~/Projects/RAPID/skills/discuss/SKILL.md` (verify round structure exists)
- **Per wave merge:** Manual review of SKILL.md structure
- **Phase gate:** Full SKILL.md read-through verifying all 8 steps are intact and Step 5 uses the 2-round model

### Wave 0 Gaps
None -- this phase has no automated tests because the changes are purely Markdown instruction files. Verification is structural (grep for expected content) and manual (read-through).

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `skills/discuss/SKILL.md` -- current Step 4 (lines 149-174) and Step 5 (lines 178-252)
- Direct code inspection of `.planning/STATE.md` -- blocker note at line 106
- 29-CONTEXT.md locked decisions -- batching strategy, round structure, delegation model
- AskUserQuestion usage across 17 skills (100+ invocations) -- tool behavior well-understood

### Secondary (MEDIUM confidence)
- Phase 28 research and plans -- reference for skill modification patterns and plan structure
- PROJECT.md constraints -- AskUserQuestion requirement for all user interactions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero external dependencies, single Markdown file modification
- Architecture: HIGH -- two-round structure directly specified by locked decisions, AskUserQuestion tool well-understood
- Pitfalls: HIGH -- derived from direct inspection of the skill file and analysis of the locked decision edge cases
- Validation: HIGH -- structural verification via grep, manual read-through

**Research date:** 2026-03-09
**Valid until:** Indefinite (internal skill file, no external dependency drift)
