# Wave 2 PLAN: AskUserQuestion Options Audit

**Set:** ux-improvements
**Wave:** 2
**Objective:** Add pre-filled options to all 22 freeform AskUserQuestion calls across 8 skills (init, new-version, add-set, quick, review, pause, assumptions, cleanup). Every AskUserQuestion call must have at least 2 concrete pre-filled options. Freeform escape hatches go in the LAST position with label "I'll answer in my own words".

---

## Universal Pattern

For every freeform AskUserQuestion that currently asks an open-ended question with no options, add:
1. 2-3 concrete pre-filled approach options (context-appropriate suggestions)
2. "I'll answer in my own words" as the LAST option (escape hatch to freeform)

The escape hatch option format:
```
- "I'll answer in my own words" -- "Type a custom response"
```

When the user selects "I'll answer in my own words", the skill should then present the same question as a freeform AskUserQuestion (no options) to collect their typed response. This preserves the existing freeform behavior while making options the default.

---

## Task 1: Fix init SKILL.md (5 freeform calls)

**File:** `skills/init/SKILL.md`

**Freeform calls to fix:**

### 1a. Step 4A "Other" project name (line ~143)

Current: `ask freeform: "What would you like to name the project?"`

Change to AskUserQuestion with options:
```
- question: "Custom project name"
- Options:
  - "{parent-directory-name}-project" -- "Common naming convention using parent directory"
  - "{detected-framework}-app" -- "Framework-based naming (if detectable from package.json etc.)"
  - "I'll answer in my own words" -- "Type a custom project name"
```

Note: The first two options are dynamic suggestions -- the executor should generate sensible defaults based on context. If no framework is detected, use two reasonable variants of the directory name (e.g., "my-dir-app", "my-dir-service").

### 1b. Step 4B Batch 1 (line ~185)

Current: Freeform AskUserQuestion asking about vision, users, scale.

Add options:
```
- Options:
  - "It's a web application" -- "SaaS, web portal, or browser-based tool for end users"
  - "It's a developer tool / CLI / library" -- "SDK, package, CLI tool, or developer-facing infrastructure"
  - "It's a mobile or desktop app" -- "Native or cross-platform application for phones/tablets/desktop"
  - "I'll answer in my own words" -- "Describe the project in your own words"
```

Keep the full batch question text as the question field. The options provide quick categorization; "I'll answer in my own words" falls through to the existing freeform behavior.

### 1c. Step 4B Batch 2 (line ~199)

Current: Freeform AskUserQuestion asking about features and tech approach.

Add options:
```
- Options:
  - "I have a clear feature list" -- "I know exactly what features I need and can list them"
  - "I have a rough idea" -- "I know the general direction but details are still forming"
  - "I'll answer in my own words" -- "Describe features and tech approach freely"
```

### 1d. Step 4B Batch 3 (line ~212)

Current: Freeform AskUserQuestion asking about scale and integrations.

Add options:
```
- Options:
  - "Small scale, minimal integrations" -- "Hundreds of users, few external services, standard auth"
  - "Medium scale with common integrations" -- "Thousands of users, OAuth/payment/email services"
  - "Large scale with complex infrastructure" -- "Enterprise-grade, many services, strict compliance"
  - "I'll answer in my own words" -- "Describe scale and integration needs in detail"
```

### 1e. Step 4B Batch 4 (line ~225)

Current: Freeform AskUserQuestion asking about context and success criteria.

Add options:
```
- Options:
  - "First project with this stack" -- "Learning as we go, prioritize simplicity and good defaults"
  - "Experienced with this stack" -- "Know the patterns, want best practices and performance focus"
  - "I'll answer in my own words" -- "Share context and success criteria in your own words"
```

### 1f. Step 9 "Request changes" follow-up (line ~640)

Current: `Ask the user freeform: "What changes would you like to make to the roadmap?"`

Add options:
```
- question: "What changes would you like to the roadmap?"
- Options:
  - "Merge some sets" -- "Combine sets that are too small or closely related"
  - "Split a set" -- "Break a large set into smaller, more focused sets"
  - "Change priorities" -- "Reorder sets or adjust scope boundaries"
  - "I'll answer in my own words" -- "Describe the changes you want"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/init/SKILL.md
# Expected: at least 6 (one per freeform call fixed)
```

**Done when:** All 6 freeform calls in init have pre-filled options with "I'll answer in my own words" as the last option.

---

## Task 2: Fix new-version SKILL.md (4 freeform calls)

**File:** `skills/new-version/SKILL.md`

**Freeform calls to fix:**

### 2a. Step 2B milestone name (line ~74)

Current: `Ask freeform: "Give a short name or description for this milestone"`

Change to AskUserQuestion with options:
```
- question: "Milestone name"
- Options:
  - "Performance & Optimization" -- "Focus on speed, efficiency, and resource usage"
  - "Feature Expansion" -- "New capabilities and user-facing features"
  - "Stability & Maintenance" -- "Bug fixes, refactoring, tech debt reduction"
  - "I'll answer in my own words" -- "Type a custom milestone name"
```

### 2b. Step 2C milestone goals (line ~78)

Current: `Ask freeform: "Describe the goals for this milestone."`

Change to AskUserQuestion with options:
```
- question: "Milestone goals"
- Options:
  - "Incremental improvement" -- "Build on existing foundation with targeted enhancements"
  - "Major new capability" -- "Add a significant new feature or system component"
  - "Rewrite or migration" -- "Replace or significantly restructure existing code"
  - "I'll answer in my own words" -- "Describe goals in detail"
```

### 2c. Step 2A "Other" version follow-up (line ~70)

Current: `ask freeform: "What version/ID should the new milestone have?"`

Change to AskUserQuestion with options:
```
- question: "Custom milestone version"
- Options:
  - "{next-patch}" -- "Patch version bump (e.g., v1.0.1)"
  - "{next-minor}" -- "Minor version bump (e.g., v1.1.0)"
  - "{next-major}" -- "Major version bump (e.g., v2.0.0)"
  - "I'll answer in my own words" -- "Type a custom version string"
```

Note: The version suggestions should be computed dynamically from the current milestone version. The executor should parse the current version and generate appropriate semver bumps.

### 2d. Step 8 "Revise" follow-up (line ~438)

Current: `Ask freeform: "What changes would you like to the roadmap?"`

Change to AskUserQuestion with options:
```
- question: "What changes would you like to the roadmap?"
- Options:
  - "Merge some sets" -- "Combine sets that are too small or closely related"
  - "Split a set" -- "Break a large set into smaller, more focused sets"
  - "Change priorities" -- "Reorder sets or adjust scope boundaries"
  - "I'll answer in my own words" -- "Describe the changes you want"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/new-version/SKILL.md
# Expected: at least 4
```

**Done when:** All 4 freeform calls in new-version have pre-filled options.

---

## Task 3: Fix add-set SKILL.md (4 freeform calls)

**File:** `skills/add-set/SKILL.md`

**Freeform calls to fix:**

### 3a. Step 2 Question 1 -- set scope (line ~66-68)

Current: `Use AskUserQuestion (freeform): "What should this new set accomplish?"`

Change to AskUserQuestion with options:
```
- question: "What should this new set accomplish? Describe the scope, goals, and key deliverables."
- Options:
  - "New feature" -- "Add a new user-facing feature or capability"
  - "Bug fix / tech debt" -- "Fix issues or clean up existing code"
  - "Infrastructure / tooling" -- "Build internal tools, CI/CD, or system infrastructure"
  - "I'll answer in my own words" -- "Describe the scope in detail"
```

### 3b. Step 2 Question 2 -- files and dependencies (line ~72-74)

Current: `Use AskUserQuestion (freeform): "What files or areas of the codebase will this set modify?"`

Change to AskUserQuestion with options:
```
- question: "What files or areas of the codebase will this set modify? Are there dependencies on existing sets?"
- Options:
  - "Mostly new files" -- "Creating new modules/components with minimal changes to existing code"
  - "Modifying existing code" -- "Changes to existing files with some new additions"
  - "No dependencies on other sets" -- "This set is fully independent"
  - "I'll answer in my own words" -- "Describe files and dependencies in detail"
```

### 3c. Step 3 "Custom ID" follow-up (line ~97)

Current: `Use AskUserQuestion (freeform): "Enter your preferred set ID (kebab-case):"`

Change to AskUserQuestion with options:
```
- question: "Enter your preferred set ID"
- Options:
  - "{alternative-slug-1}" -- "Alternative derived from scope description"
  - "{alternative-slug-2}" -- "Shorter variant of the proposed ID"
  - "I'll answer in my own words" -- "Type a custom kebab-case set ID"
```

Note: The executor should generate 2 dynamic alternative slug suggestions based on the user's scope description from Question 1.

### 3d. Step 3 duplicate resolution (line ~111)

Current: `Use AskUserQuestion (freeform) to get a new ID`

Change to AskUserQuestion with options:
```
- question: "Set ID '{SET_ID}' already exists. Choose a different ID."
- Options:
  - "{SET_ID}-2" -- "Append a number to differentiate"
  - "{SET_ID}-alt" -- "Add '-alt' suffix"
  - "I'll answer in my own words" -- "Type a completely different set ID"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/add-set/SKILL.md
# Expected: at least 4
```

**Done when:** All 4 freeform calls in add-set have pre-filled options.

---

## Task 4: Fix quick SKILL.md (1 freeform call)

**File:** `skills/quick/SKILL.md`

**Freeform call to fix:**

### 4a. Step 1 task description (line ~35-38)

Current:
```
Use AskUserQuestion (freeform):
> "Describe what you'd like to do. Be specific about the changes needed -- files, behavior, constraints."
```

Change to AskUserQuestion with options:
```
- question: "Describe what you'd like to do. Be specific about the changes needed -- files, behavior, constraints."
- Options:
  - "Fix a bug" -- "Something is broken and needs to be corrected"
  - "Add a small feature" -- "A contained addition that doesn't need full set lifecycle"
  - "Refactor / cleanup" -- "Improve code quality without changing behavior"
  - "Update documentation" -- "Fix or add documentation, comments, or READMEs"
  - "I'll answer in my own words" -- "Describe the task in detail"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/quick/SKILL.md
# Expected: at least 1
```

**Done when:** The single freeform call in quick has pre-filled options.

---

## Task 5: Fix review SKILL.md (2 freeform calls)

**File:** `skills/review/SKILL.md`

**Freeform calls to fix:**

### 5a. Step 4a.2 "Modify" follow-up (line ~335)

Current: `Use AskUserQuestion to collect the user's modifications.`

Change to AskUserQuestion with options:
```
- question: "What changes to the test plan?"
- Options:
  - "Add more edge cases" -- "Include boundary conditions and error scenarios"
  - "Remove redundant tests" -- "Trim overlapping or low-value test cases"
  - "Focus on critical paths" -- "Prioritize tests for the most important user flows"
  - "I'll answer in my own words" -- "Describe specific modifications"
```

### 5b. Step 4c.4 "Modify tags" follow-up (line ~835)

Current: `Use AskUserQuestion to collect modifications.`

Change to AskUserQuestion with options:
```
- question: "How should test tags be modified?"
- Options:
  - "Make all automated" -- "Convert human-tagged steps to automated where possible"
  - "Make all human" -- "Convert automated steps to human verification"
  - "I'll answer in my own words" -- "Specify which steps to change"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/review/SKILL.md
# Expected: at least 2
```

**Done when:** Both freeform follow-up calls in review have pre-filled options.

---

## Task 6: Fix pause SKILL.md (1 freeform call)

**File:** `skills/pause/SKILL.md`

**Freeform call to fix:**

### 6a. Step 3 "Add notes" follow-up (line ~70)

Current: `Ask freeform: "What notes should the next session see when resuming?"`

Change to AskUserQuestion with options:
```
- question: "What notes should the next developer see when resuming this set?"
- Options:
  - "Blocked on dependency" -- "Waiting for another set or external resource"
  - "Partial progress" -- "Some tasks done, resuming from a specific point"
  - "Context switch" -- "Pausing to work on something else, will return later"
  - "I'll answer in my own words" -- "Write custom notes for the next session"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/pause/SKILL.md
# Expected: at least 1
```

**Done when:** The freeform notes call in pause has pre-filled options.

---

## Task 7: Fix assumptions SKILL.md (3 freeform calls)

**File:** `skills/assumptions/SKILL.md`

**Freeform calls to fix:**

### 7a. Step 1 "Other" set selection (line ~55)

Current: `ask them in plain text: "Which set would you like to review?"`

Change to AskUserQuestion with options. Since this is a fallback when >4 sets exist and user picks "Other", provide:
```
- question: "Which set would you like to review?"
- Options:
  - "{first-unlisted-set}" -- "Set not shown in the selection above"
  - "I'll answer in my own words" -- "Type the set name manually"
```

Note: Dynamically include the first few set names that were not in the initial option list.

### 7b. Step 1 ">4 sets" text input (line ~57-65)

Current: Asks user to type set name or number via plain text after showing numbered list.

Change to AskUserQuestion with options that include the first 4 sets from the list plus escape hatch:
```
- question: "Which set would you like to review assumptions for?"
- Options:
  - "{set-1}" -- "Set 1 from the list"
  - "{set-2}" -- "Set 2 from the list"
  - "{set-3}" -- "Set 3 from the list"
  - "{set-4}" -- "Set 4 from the list"
  - "I'll answer in my own words" -- "Type a set name or number"
```

Note: Dynamically populate options with the first 4 set names. If there are 5+ sets, the escape hatch covers the rest.

### 7c. Step 4 "Correct assumptions" follow-up (line ~128)

Current: `Ask in plain text: "What specifically needs to change about these assumptions?"`

Change to AskUserQuestion with options:
```
- question: "What specifically needs to change about these assumptions?"
- Options:
  - "Scope is wrong" -- "The set's scope or boundary is misunderstood"
  - "Dependencies are incorrect" -- "Wrong assumptions about what this set depends on or provides"
  - "File ownership conflict" -- "Files listed conflict with another set's ownership"
  - "I'll answer in my own words" -- "Describe the specific corrections needed"
```

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/assumptions/SKILL.md
# Expected: at least 3
```

**Done when:** All 3 freeform calls in assumptions have pre-filled options.

---

## Task 8: Fix cleanup SKILL.md (1 freeform call)

**File:** `skills/cleanup/SKILL.md`

**Freeform call to fix:**

### 8a. Step 3 ">4 worktrees" text input (line ~59)

Current: `ask the developer to type the set name via freeform input`

Change to AskUserQuestion with options that dynamically include the first 4 worktree names:
```
- question: "Which worktree would you like to clean up?"
- Options:
  - "{worktree-1}" -- "{status of worktree 1}"
  - "{worktree-2}" -- "{status of worktree 2}"
  - "{worktree-3}" -- "{status of worktree 3}"
  - "{worktree-4}" -- "{status of worktree 4}"
  - "I'll answer in my own words" -- "Type the set name manually"
```

Note: Dynamically populate with the first 4 worktree set names and their status descriptions. The remaining worktrees are accessible via the escape hatch.

**Verification:**
```bash
grep -c "I'll answer in my own words" skills/cleanup/SKILL.md
# Expected: at least 1
```

**Done when:** The freeform worktree selection in cleanup has pre-filled options.

---

## Success Criteria

- [ ] Every AskUserQuestion call across all 8 skills has at least 2 pre-filled options
- [ ] "I'll answer in my own words" appears as the LAST option on every freeform AskUserQuestion
- [ ] No AskUserQuestion call is purely freeform without options (the "I'll answer in my own words" option handles the freeform fallback)
- [ ] Existing behavior is preserved: when users select the escape hatch, they get the same freeform experience as before
- [ ] Total count of "I'll answer in my own words" across all 8 skills: at least 22

## What NOT To Do

- Do NOT modify `skills/discuss-set/SKILL.md` -- that is Wave 3's exclusive scope
- Do NOT change the question text or the behavior when a specific option is selected -- only ADD options to existing freeform calls
- Do NOT add options to calls that already have proper option arrays (the compliant skills)
- Do NOT change AskUserQuestion calls that are already structured with options (e.g., "Retry"/"Skip"/"Cancel" patterns)
- Do NOT modify `src/lib/display.cjs` or `src/lib/display.test.cjs` -- those are Wave 1's exclusive scope
