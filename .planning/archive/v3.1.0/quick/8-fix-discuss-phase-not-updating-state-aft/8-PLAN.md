---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - skills/discuss-set/SKILL.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "After discuss-set completes (interactive or --skip), STATE.json shows the set in 'discussing' status"
    - "plan-set sees 'discussing' status and proceeds without 'not discussed' error"
    - "STATE.json is committed to git alongside CONTEXT.md after discuss-set completes"
  artifacts:
    - path: "skills/discuss-set/SKILL.md"
      provides: "Updated discuss-set skill with reliable state transition"
      contains: "state transition set"
  key_links:
    - from: "skills/discuss-set/SKILL.md"
      to: "skills/plan-set/SKILL.md"
      via: "STATE.json set status 'discussing'"
      pattern: "state transition set.*discussing"
---

<objective>
Fix the discuss-set skill so it reliably transitions the set state from 'pending' to 'discussing' upon completion, ensuring the downstream plan-set skill can detect that discussion is finished.

Purpose: Currently, after discuss-set completes, the set may remain in 'pending' status in STATE.json because the state transition step (Step 7) is placed before CONTEXT.md writing and is easy for the executing agent to skip. The plan-set skill then rejects the set with "not discussed yet." This fix restructures the discuss-set SKILL.md to make the state transition the final action and includes STATE.json in the git commit.

Output: Updated skills/discuss-set/SKILL.md with reliable state transition flow.
</objective>

<context>
@skills/discuss-set/SKILL.md
@skills/plan-set/SKILL.md
@src/lib/state-transitions.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure discuss-set SKILL.md state transition flow</name>
  <files>skills/discuss-set/SKILL.md</files>
  <action>
Modify skills/discuss-set/SKILL.md to fix the state transition reliability. The root cause is that Step 7 (state transition) is placed BEFORE Step 8 (write CONTEXT.md) and Step 9 (commit), making it easy for the LLM agent to skip or not reach. The fix involves restructuring the final steps:

1. **Remove current Step 7 (State Transition) as a standalone step.** Delete the entire "## Step 7: State Transition" section (lines ~209-225).

2. **Update Step 4 (--skip branch):** Change "Skip to Step 7 (State Transition)" to "Skip to Step 8 (Write CONTEXT.md)" since the --skip path writes CONTEXT.md via the agent but still needs Steps 8 and 9. Actually, in --skip mode CONTEXT.md is already written by the agent in Step 4, so the instruction should say: "Skip to Step 9 (State Transition, Commit, and Next Steps)."

3. **Merge old Steps 8 and 9 into a new combined Step 7 "Write CONTEXT.md":** This step writes CONTEXT.md using the Write tool (same content as the old Step 8). Add a note: "In --skip mode, CONTEXT.md was already written by the agent in Step 4. Skip this step."

4. **Create new Step 8 "State Transition and Commit"** that combines the state transition AND git commit into a single step. This makes the state transition the LAST substantive action before showing next steps. The step should:

   a. Transition the set state:
   ```bash
   # (env preamble here)
   node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussing 2>/dev/null || true
   ```
   Use `2>/dev/null || true` to handle both fresh (pending -> discussing) and re-discuss (already discussing) scenarios gracefully.

   b. Commit BOTH CONTEXT.md AND STATE.json together:
   ```bash
   # (env preamble here)
   git add ".planning/sets/${SET_ID}/CONTEXT.md" ".planning/STATE.json"
   git commit -m "discuss-set(${SET_ID}): capture set implementation vision"
   ```

5. **Create new Step 9 "Next Steps"** that displays the next step suggestion and progress breadcrumb (moved from old Step 9). This is display-only, no mutations.

6. **Update Key Principles section** to add: "State transition is the final mutation -- happens AFTER CONTEXT.md is written, ensuring artifacts exist before status changes."

7. **Update the --skip flow reference** in Step 4 item 4 from "Skip to Step 7 (State Transition)" to "Skip to Step 8 (State Transition and Commit)" since in --skip mode CONTEXT.md is already written by the agent.

8. **Renumber all steps consistently** after the restructuring: Steps 1-6 stay the same (Environment, Resolve, Context, --skip branch, Gray Areas, Deep Dive), then Step 7 = Write CONTEXT.md (interactive mode only), Step 8 = State Transition and Commit, Step 9 = Next Steps.

The resulting step flow should be:
- Step 1: Environment Setup + Banner
- Step 2: Resolve Set
- Step 3: Gather Context
- Step 4: --skip Branch (skips to Step 8 since CONTEXT.md written by agent)
- Step 5: Identify 4 Gray Areas
- Step 6: Deep-Dive Selected Areas
- Step 7: Write CONTEXT.md (interactive mode only, skipped in --skip mode)
- Step 8: State Transition and Commit (ALWAYS runs -- transitions state AND commits both CONTEXT.md and STATE.json)
- Step 9: Next Steps (display breadcrumb and next command)

This ensures the state transition is the LAST mutation operation, happens in EVERY code path (interactive and --skip), and STATE.json is committed alongside CONTEXT.md.
  </action>
  <verify>
    <automated>grep -c "state transition set" /home/kek/Projects/RAPID/skills/discuss-set/SKILL.md | grep -q "2" && grep -q "STATE.json" /home/kek/Projects/RAPID/skills/discuss-set/SKILL.md && grep -q "Step 8.*State Transition" /home/kek/Projects/RAPID/skills/discuss-set/SKILL.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>
    - The discuss-set SKILL.md has the state transition as one of the final steps (Step 8), not in the middle (old Step 7)
    - The git commit includes both CONTEXT.md AND STATE.json
    - The --skip path clearly directs to Step 8 (not old Step 7)
    - Both interactive and --skip paths converge on Step 8 for state transition
    - Key Principles updated to reflect state-transition-last pattern
  </done>
</task>

</tasks>

<verification>
1. Read the updated SKILL.md and verify step numbering is consistent (Steps 1-9)
2. Verify the --skip flow in Step 4 references Step 8 (State Transition and Commit)
3. Verify Step 8 includes both `state transition set` and `git add .planning/STATE.json`
4. Verify no orphan references to old Step 7 state transition remain
5. Verify the interactive path (Steps 5->6->7->8->9) includes the state transition
6. Verify the --skip path (Step 4->8->9) includes the state transition
</verification>

<success_criteria>
- The discuss-set SKILL.md has the state transition as the final mutation step (Step 8)
- STATE.json is included in the git commit alongside CONTEXT.md
- Both --skip and interactive paths converge on Step 8 for state transition
- No references to the old Step 7 state transition remain
- Key Principles section documents the state-transition-last pattern
</success_criteria>

<output>
After completion, create `.planning/quick/8-fix-discuss-phase-not-updating-state-aft/8-SUMMARY.md`
</output>
