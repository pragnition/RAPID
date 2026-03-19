# CONTEXT: planning-refinement

**Set:** planning-refinement
**Generated:** 2026-03-19
**Mode:** interactive

<domain>
## Set Boundary
This set addresses two refinements in the RAPID planning and review pipeline:

1. **F9 - UI/UX emphasis in discuss-set and plan-set:** Strengthen how discuss-set surfaces UI/UX considerations for sets with user-facing components. The plan-set planner should naturally incorporate UI/UX decisions from CONTEXT.md.
2. **F7 - Review file discovery auto-detection:** Fix unit-test, bug-hunt, and uat skills to auto-detect post-merge REVIEW-SCOPE.md without requiring the explicit `--post-merge` flag.

All changes are prompt-engineering modifications to existing skill markdown files. No library code or CLI commands change.
</domain>

<decisions>
## Implementation Decisions

### UI/UX Detection Logic

- The agent should naturally determine whether a set is frontend-relevant from the SET-OVERVIEW.md and other set context (CONTRACT.json, ROADMAP.md description). No explicit keyword matching or file pattern detection is needed.
- The detection guidance lives inline in discuss-set Step 5 as a conditional paragraph, not as a separate pre-step.

### UI/UX Gray Area Slot

- UI/UX should NOT reserve a dedicated slot among the 4 gray areas. Instead, add guidance that UI/UX considerations should be woven into relevant gray areas naturally (e.g., a "state management" gray area might include UI state questions for frontend sets).
- The 4-area structure remains unchanged for all sets.

### Post-merge Path Fallback

- Standard path (`.planning/sets/{id}/REVIEW-SCOPE.md`) takes precedence. If not found, fall back to post-merge path (`.planning/post-merge/{id}/REVIEW-SCOPE.md`).
- The `--post-merge` flag is kept as an explicit override. When the flag is present, it forces the post-merge path directly. When no flag is given, auto-detection tries both paths with standard-first precedence.
- This applies to all three downstream skills: unit-test, bug-hunt, and uat.

### Plan-set UI/UX Section

- No template change to the planner agent prompt. The planner naturally incorporates UI/UX decisions from CONTEXT.md into task descriptions without needing a dedicated section or conditional injection.

### Claude's Discretion

- Exact wording of the inline UI/UX guidance paragraph in discuss-set Step 5
- Exact implementation of the path fallback logic in the three review skills (unit-test, bug-hunt, uat)
</decisions>

<specifics>
## Specific Ideas
- The user noted that the agent "should be able to know whether this is a frontend set from the set overview" -- lean on natural language understanding rather than programmatic detection
</specifics>

<code_context>
## Existing Code Insights

- **discuss-set Step 5** (skills/discuss-set/SKILL.md:150-176): Currently identifies "exactly 4 gray areas" with no UI/UX-specific guidance. The gray area criteria list already includes "User experience decisions are needed" and "UI/UX decisions need to be made" but no conditional activation logic.
- **Review skills Step 1**: All three skills (unit-test, bug-hunt, uat) have identical REVIEW-SCOPE.md loading logic with standard/post-merge path selection based solely on the `--post-merge` flag. The fallback needs to be added to the guard check section of each.
- **plan-set planner prompt** (skills/plan-set/SKILL.md:136-169): No changes needed per user decision -- the planner already receives full CONTEXT.md contents.
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
