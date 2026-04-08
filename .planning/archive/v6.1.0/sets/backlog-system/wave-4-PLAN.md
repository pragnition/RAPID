<!-- gap-closure: true -->
# Wave 4 Plan: Backlog Capture Hints in Hand-Written Agent Files

## Objective

Close Gap 1 (HIGH severity) from the backlog-system verification report. The source role files at `src/modules/roles/` were updated with Backlog Capture sections during Wave 3, but the hand-written agent files in `agents/` -- which are the files that actually run during execution -- were not updated. Since these agents are marked `<!-- CORE: Hand-written agent -- do not overwrite with build-agents -->`, they must be updated manually.

## Gap Reference

- **Gap 1**: Hand-managed agent files not updated (W3.4)
- **Severity**: HIGH
- **Files affected**: `agents/rapid-executor.md`, `agents/rapid-planner.md`

---

## Task 1: Add Backlog Capture section to rapid-executor agent

**File**: `agents/rapid-executor.md`

**Action**: Insert a new `## Backlog Capture` section after the last bullet of the `## Constraints` section (line 165: `- Never modify .planning/ files directly -- use rapid-tools.cjs CLI for state transitions`) and before the `</role>` closing tag (line 166).

**Insertion point** -- find this exact text:

```
- Never modify .planning/ files directly -- use rapid-tools.cjs CLI for state transitions
</role>
```

**Replace with**:

```
- Never modify .planning/ files directly -- use rapid-tools.cjs CLI for state transitions

## Backlog Capture
When you encounter a feature idea or improvement outside your current set's scope:
- Do not implement it -- stay within your set's file ownership
- Do not silently drop it -- invoke `/rapid:backlog` with a title and description
- Backlog items are reviewed during milestone audits and promoted to sets or deferred
</role>
```

**What NOT to do**:
- Do not modify any other section of the file
- Do not add the section outside the `<role>` block -- it must remain inside `<role>...</role>`
- Do not duplicate content that already exists in other sections

**Verification**:
```bash
grep -c "Backlog Capture" agents/rapid-executor.md
# Expected output: 1
grep -A 4 "## Backlog Capture" agents/rapid-executor.md
# Expected: the 4-line section with the three bullet points
```

---

## Task 2: Add Backlog Capture section to rapid-planner agent

**File**: `agents/rapid-planner.md`

**Action**: Insert a new `## Backlog Capture` section after the last bullet of the `## Constraints` section (line 180: `- Do not spawn subagents -- you are a leaf agent dispatched by the plan-set skill`) and before the `</role>` closing tag (line 181).

**Insertion point** -- find this exact text:

```
- Do not spawn subagents -- you are a leaf agent dispatched by the plan-set skill
</role>
```

**Replace with**:

```
- Do not spawn subagents -- you are a leaf agent dispatched by the plan-set skill

## Backlog Capture
When you discover a feature idea or improvement outside the current set's scope during planning:
- Do not expand the plan to include it -- keep within set boundaries
- Do not silently drop it -- invoke `/rapid:backlog` with a title and description
- Backlog items are reviewed during milestone audits and promoted to sets or deferred
</role>
```

**What NOT to do**:
- Do not modify any other section of the file
- Do not add the section outside the `<role>` block -- it must remain inside `<role>...</role>`
- Do not duplicate content that already exists in other sections

**Verification**:
```bash
grep -c "Backlog Capture" agents/rapid-planner.md
# Expected output: 1
grep -A 4 "## Backlog Capture" agents/rapid-planner.md
# Expected: the 4-line section with the three bullet points
```

---

## Success Criteria

1. Both `agents/rapid-executor.md` and `agents/rapid-planner.md` contain a `## Backlog Capture` section inside their `<role>` blocks
2. The content matches the condensed hints specified above (executor uses "encounter", planner uses "discover ... during planning")
3. No other sections of either file are modified
4. Combined verification:

```bash
grep -l "## Backlog Capture" agents/rapid-executor.md agents/rapid-planner.md | wc -l
# Expected output: 2
```
