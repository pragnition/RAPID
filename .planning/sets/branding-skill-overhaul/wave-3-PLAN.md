# Wave 3 PLAN: Init Delegation Refactor

## Objective

Replace the ~348 lines of duplicated branding interview logic in `skills/init/SKILL.md` (lines 442-789) with ~30 lines of delegation to the branding skill. Init keeps only the opt-in/skip/re-init gate logic and delegates the actual interview and file generation to `/rapid:branding` in delegated mode.

## Owned Files

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Refactor branding section (Step 4B.5) |

## Prerequisites

- Wave 2 must be committed (SKILL.md has dual-mode documentation with delegated mode support).

## Tasks

### Task 1: Replace init branding section with delegation

**File:** `skills/init/SKILL.md`

**What to do:**

1. **Add `Skill` to the frontmatter `allowed-tools`** line. Currently:
   ```yaml
   allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
   ```
   Change to:
   ```yaml
   allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep, Skill
   ```
   The `Skill` tool is required so init can invoke `/rapid:branding`.

2. **Preserve the gate logic (keep these lines).** The following must remain unchanged:
   - The `### 4B.5: Optional Branding Step (Skip by Default)` heading
   - The `[OPTIONAL STEP]` notice
   - The re-init detection block (check if `.planning/branding/BRANDING.md` exists, offer "Keep existing branding" / "Set up new branding")
   - The opt-in question ("Would you like to set up project branding guidelines now?" with "Skip branding" / "Set up branding")
   - The bail-out handling: if user skips, set `brandingStatus = "skipped"` and proceed to Step 4C

3. **Replace everything from "#### Project Type Inference" through "#### Set Branding Status"** (approximately lines 484-789) with delegation logic. The replacement content should be approximately:

   ```markdown
   #### Delegate to Branding Skill

   When the user opts in to branding setup, delegate to the branding skill in delegated mode:

   Invoke the Skill tool with:
   - skill: "branding"

   The branding skill runs in **delegated mode** when invoked from init. In delegated mode, the branding skill:
   - Skips the banner display
   - Runs the full branding interview (codebase detection, interview rounds, artifact generation)
   - Starts the branding server with auto-reload
   - Offers expanded asset generation (guidelines, README template, component library)
   - Skips git commit and footer display (init handles its own commit)

   **After the branding skill completes:**

   Check whether BRANDING.md was created:
   ```bash
   [ -f ".planning/branding/BRANDING.md" ] && echo "CONFIGURED" || echo "SKIPPED"
   ```

   - If `CONFIGURED`: set `brandingStatus = "configured"`
   - If `SKIPPED`: set `brandingStatus = "skipped"` (user may have bailed out during the branding interview)

   Display a brief status line:
   ```
   Branding: {brandingStatus}
   ```

   Then proceed to Step 4C.
   ```

4. **Remove the no-server-during-init contract.** Find and delete the line:
   ```
   **CRITICAL:** Do NOT reference `branding-server.cjs` or `server.start()` anywhere in this step. Do NOT start the branding server. The `no-server-during-init` contract invariant is absolute.
   ```
   This contract is removed per the CONTEXT.md decision: "The no-server-during-init contract is removed. When init delegates to branding, the server starts normally."

5. **Update the git add command in init's commit step.** Find the git add command in init's final commit step that adds branding files. Since the branding skill now handles its own artifact creation, init only needs to ensure the branding directory files are included. The existing git add pattern should still work since it uses glob patterns, but verify it includes `.planning/branding/` files.

**What NOT to do:**
- Do not modify any other step in init SKILL.md (Steps 1-4B.4, 4C, 5, 6, etc.).
- Do not change the AskUserQuestion budget for init (it has its own 7-call budget).
- Do not modify the branding skill files (those are Wave 2's responsibility).
- Do not remove the "Branding is FULLY OPTIONAL" principle -- the gate logic preserves this.
- Do not change the `### 4C: Granularity Preference` section or anything after it.

**Verification:**
```bash
# Verify Skill is in allowed-tools
cd /home/kek/Projects/RAPID && head -5 skills/init/SKILL.md | grep -o "Skill"

# Verify delegation reference exists
cd /home/kek/Projects/RAPID && grep "branding.*skill\|delegated mode\|Skill tool" skills/init/SKILL.md | head -5

# Verify duplicated interview is removed
cd /home/kek/Projects/RAPID && grep -c "Round 1\|Round 2\|Round 3\|Round 4\|Round 5" skills/init/SKILL.md
# Expected: 0 (all rounds removed, delegation handles them)

# Verify gate logic preserved
cd /home/kek/Projects/RAPID && grep "Skip branding\|Set up branding\|Keep existing branding" skills/init/SKILL.md | head -5

# Verify no-server-during-init contract removed
cd /home/kek/Projects/RAPID && grep "no-server-during-init\|Do NOT start the branding server" skills/init/SKILL.md | wc -l
# Expected: 0

# Verify line count reduction
cd /home/kek/Projects/RAPID && wc -l skills/init/SKILL.md
# Expected: approximately 330 fewer lines than before (~1150 -> ~820)
```

## Success Criteria

1. Init SKILL.md frontmatter includes `Skill` in allowed-tools.
2. The branding section (Step 4B.5) preserves the opt-in/skip/re-init gate logic.
3. The branding section delegates to `/rapid:branding` via the Skill tool instead of duplicating interview logic.
4. No branding interview rounds (Round 1-5) remain in init SKILL.md.
5. The `no-server-during-init` contract line is removed.
6. After delegation, init checks whether BRANDING.md was created and sets brandingStatus accordingly.
7. Init's overall structure remains intact (Steps 1-6 with all non-branding sections unchanged).
8. The file is approximately 300-350 lines shorter than the current version.
