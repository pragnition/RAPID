# Wave 2 PLAN: init-branding-integration

## Objective

Add branding status to the Step 4D summary confirmation and inject branding context into the UX research agent prompt. This wave completes the integration by ensuring branding state flows through to downstream consumers. Also verify the complete flow end-to-end.

## Prerequisites

Wave 1 must be complete. The `brandingStatus` variable and `### 4B.5` section must exist in `skills/init/SKILL.md`.

## Owned Files

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Modify -- two targeted insertions at Step 4D and Step 7 UX researcher |

## Task 1: Add branding status line to Step 4D summary

**File:** `skills/init/SKILL.md`

**Context:** Step 4D (currently at line ~462, shifted down by the 4B.5 insertion from Wave 1) displays a summary before the user confirms. The summary currently shows the full project brief followed by the granularity preference:

```
PROJECT BRIEF
=============
{full compiled project brief}

Granularity Preference: {targetSetCount value and label}
```

**Action:** Insert a `Branding:` line immediately after the `Granularity Preference:` line in the summary display template. The line should read:

```
Branding: {brandingStatus}
```

Where `brandingStatus` is one of:
- `"configured"` -- branding interview completed, artifacts written
- `"configured (preserved)"` -- existing branding was kept during re-init
- `"skipped"` -- user chose to skip branding

The insertion point is inside the code block that shows the summary template. Find the line:
```
Granularity Preference: {targetSetCount value and label}
```
and add immediately after it:
```
Branding: {brandingStatus}
```

**What NOT to do:**
- Do NOT change the AskUserQuestion confirmation prompt text
- Do NOT change the acceptance criteria generation logic
- Do NOT modify anything outside the summary display template code block

**Verification:**
```bash
# Check branding line exists in summary
grep -A 1 "Granularity Preference:" skills/init/SKILL.md | grep "Branding:"
```

## Task 2: Inject branding context into UX research agent prompt

**File:** `skills/init/SKILL.md`

**Context:** Step 7 spawns 6 research agents. The UX researcher (agent 6) is spawned with a prompt that includes the project brief, model selection, brownfield context, and optional spec content. The prompt currently ends with:

```
## Working Directory
{projectRoot}

## Instructions
Use Context7 MCP for documentation lookups when available. If Context7 is not accessible, use WebFetch or WebSearch as fallback.
Write output to .planning/research/UX.md
```

**Action:** Insert a conditional branding context block between the spec content section (the `{end if}` line after spec content) and the `## Working Directory` line. The insertion should be:

```markdown
{if brandingStatus === "configured" or brandingStatus === "configured (preserved)":}
## Branding Context
The following branding guidelines have been configured for this project. Factor these into your UX research -- recommend patterns that align with the established branding direction and flag any conventions that would conflict.

{full contents of .planning/branding/BRANDING.md}
{end if}
```

This is a conditional block: it only appears in the UX researcher prompt when branding was configured. When branding was skipped, the UX researcher prompt is unchanged.

**Important:** This injection applies ONLY to the UX researcher (agent 6 of 6). The other 5 research agents (architecture, features, stack, pitfalls, oversights) must NOT receive branding context. Do NOT modify any of their prompt templates.

**What NOT to do:**
- Do NOT inject branding context into any researcher other than UX
- Do NOT add branding context after the `## Instructions` section -- it goes before `## Working Directory`
- Do NOT read BRANDING.md at the top of the step and pass it through -- the conditional read should happen inline when building the UX researcher's prompt
- Do NOT use a summary of BRANDING.md -- include the full file content as specified in CONTEXT.md

**Verification:**
```bash
# Check branding context injection exists
grep "Branding Context" skills/init/SKILL.md

# Check it appears near the UX researcher section
grep -B 5 "Branding Context" skills/init/SKILL.md | grep -i "ux\|research"

# Check other researchers are NOT affected
# The branding context block should appear exactly once in the file
grep -c "Branding Context" skills/init/SKILL.md
# Expected: 1
```

## Task 3: End-to-end flow verification

This is a verification-only task. No file modifications.

**Action:** Read through the complete init SKILL.md flow and verify:

1. **Step ordering is correct:** Steps proceed as 4A -> 4B -> 4B.5 -> 4C -> 4D -> 5 -> 6 -> 7 with no gaps or duplications
2. **brandingStatus variable flows through:** Set in 4B.5, consumed in 4D summary
3. **Skip path is clean:** When branding is skipped in 4B.5, no branding-related content appears in 4D (shows "Branding: skipped") and no branding context is injected into the UX researcher (conditional block evaluates to false)
4. **Configure path is complete:** When branding is configured in 4B.5, BRANDING.md exists for 4D to show "Branding: configured" and for the UX researcher to read
5. **No server references:** Zero mentions of branding-server or server.start in the entire 4B.5 section
6. **Budget accounting:** Maximum AskUserQuestion calls from branding: 1 (re-init) + 1 (opt-in) + 5 (interview rounds, with Round 3 potentially having a follow-up) = 7 max. The follow-up for terminology is an edge case that pushes to 8, but since it is part of Round 3 (not a separate round), it is acceptable per the branding skill's convention.
7. **No file ownership violations:** Only `skills/init/SKILL.md` is modified

**Verification:**
```bash
# Full section ordering check
grep "^### 4" skills/init/SKILL.md

# brandingStatus references
grep "brandingStatus" skills/init/SKILL.md

# Server reference check (should be 0 in 4B.5 section)
grep -n "branding-server\|server\.start\|server\.stop" skills/init/SKILL.md

# Question budget -- count AskUserQuestion mentions in 4B.5 section
# (manual review needed -- executor should count between "### 4B.5" and "### 4C")

# File ownership -- only init SKILL.md was modified
git diff --name-only
```

## Success Criteria

1. Step 4D summary includes a `Branding: {brandingStatus}` line after the granularity preference
2. UX researcher prompt (and ONLY the UX researcher) includes a conditional branding context injection with the full BRANDING.md content
3. The 5 non-UX research agents are completely unmodified
4. End-to-end flow verification passes all 7 checks
5. No references to branding server anywhere in the modified sections
6. `skills/init/SKILL.md` is the only file modified in this wave

## Verification Summary

```bash
# All verification commands from Tasks 1-3 in sequence:
echo "=== Task 1: 4D Summary ===" && \
grep -A 1 "Granularity Preference:" skills/init/SKILL.md | grep "Branding:" && \
echo "=== Task 2: UX Researcher ===" && \
grep -c "Branding Context" skills/init/SKILL.md && \
echo "=== Task 3: Section Ordering ===" && \
grep "^### 4" skills/init/SKILL.md && \
echo "=== No Server References ===" && \
grep -c "branding-server" skills/init/SKILL.md && \
echo "=== VERIFICATION COMPLETE ==="
```
