# Wave 2 PLAN: Documentation Updates

## Objective

Update all skill docs that reference `review log-issue` to show the correct CLI flag syntax (matching the actual implementation from Wave 1) alongside the existing stdin JSON approach. Fix incorrect `--set-id` flag references to use the actual positional `<set-id>` argument. Add log-issue documentation to the review skill doc.

## Owned Files

| File | Action |
|------|--------|
| `skills/unit-test/SKILL.md` | Modify (log-issue section) |
| `skills/uat/SKILL.md` | Modify (log-issue section) |
| `skills/bug-hunt/SKILL.md` | Modify (log-issue sections) |
| `skills/review/SKILL.md` | Modify (add log-issue section) |

## Task 1: Update unit-test SKILL.md log-issue section

**File:** `skills/unit-test/SKILL.md` (around lines 288-300)

**Current content (incorrect):**
```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "test" \
  --severity "{severity}" \
  --file "{testFile}" \
  --description "{test failure description}" \
  --source "unit-test"
```

**Replace with two usage examples:**

First, show the CLI flag interface (primary, since it is simpler for agents):
```bash
node "${RAPID_TOOLS}" review log-issue "{setId}" \
  --type "test" \
  --severity "{severity}" \
  --file "{testFile}" \
  --description "{test failure description}" \
  --source "unit-test"
```

Then show the stdin JSON alternative:
```bash
echo '{"id":"<uuid>","type":"test","severity":"{severity}","file":"{testFile}","description":"{test failure description}","source":"unit-test","createdAt":"<iso-timestamp>"}' | \
  node "${RAPID_TOOLS}" review log-issue "{setId}"
```

Add a brief note: "The CLI flag interface auto-generates `id` and `createdAt`. The stdin JSON interface requires all fields including `id` and `createdAt`."

**Key changes:**
- Remove `--set-id` flag -- set-id is positional (first argument after `log-issue`)
- Show both interfaces
- Note which fields are auto-generated in flag mode

**Verification:**
```bash
grep -n 'set-id' skills/unit-test/SKILL.md  # Should return no matches (flag removed)
grep -n 'review log-issue' skills/unit-test/SKILL.md  # Should show both interfaces
```

## Task 2: Update uat SKILL.md log-issue section

**File:** `skills/uat/SKILL.md` (around lines 348-356)

**Same pattern as Task 1.** Replace the current `--set-id` flag syntax with:

1. CLI flag interface (positional set-id):
```bash
node "${RAPID_TOOLS}" review log-issue "{setId}" \
  --type "uat" \
  --severity "{severity based on criterion importance}" \
  --file "{primary relevant file}" \
  --description "UAT failure: {scenario name} -- {failure detail}" \
  --source "uat"
```

2. Stdin JSON alternative (same format as Task 1, with type/source adjusted for uat).

3. Brief note about auto-generated fields.

**Verification:**
```bash
grep -n 'set-id' skills/uat/SKILL.md  # Should return no matches
grep -n 'review log-issue' skills/uat/SKILL.md  # Should show both interfaces
```

## Task 3: Update bug-hunt SKILL.md log-issue sections

**File:** `skills/bug-hunt/SKILL.md` (around lines 366-374 and lines 422-428)

There are TWO log-issue code blocks in bug-hunt (one in Step 3.9b and one in the main flow). Update both with the same pattern:

1. CLI flag interface (positional set-id):
```bash
node "${RAPID_TOOLS}" review log-issue "{setId}" \
  --type "bug" \
  --severity "{severity}" \
  --file "{file}" \
  --line {line} \
  --description "{description}" \
  --source "bug-hunt"
```

2. Stdin JSON alternative.

3. Brief note about auto-generated fields.

**Important:** Both occurrences must be updated consistently.

**Verification:**
```bash
grep -n 'set-id' skills/bug-hunt/SKILL.md  # Should return no matches for --set-id flag
grep -c 'review log-issue' skills/bug-hunt/SKILL.md  # Should show count reflecting both interfaces at each location
```

## Task 4: Add log-issue section to review SKILL.md

**File:** `skills/review/SKILL.md`

The review skill doc currently does not mention `log-issue` at all. Add a section documenting the command interface. Place it in a logical location (after any existing command reference sections, or at the end before any notes/footer).

**Content to add:**

```markdown
## Log Issue Command

The `review log-issue` command logs a review issue for a set. It supports two input methods:

**CLI Flags (recommended for agents):**
```bash
node "${RAPID_TOOLS}" review log-issue <set-id> \
  --type <artifact|static|contract|test|bug|uat> \
  --severity <critical|high|medium|low> \
  --file <file-path> \
  --description "<description>" \
  --source <lean-review|unit-test|bug-hunt|uat> \
  [--line <line-number>] \
  [--wave <wave-id>] \
  [--post-merge]
```

Fields `id` and `createdAt` are auto-generated. `status` defaults to `open`.

**Stdin JSON:**
```bash
echo '<json>' | node "${RAPID_TOOLS}" review log-issue <set-id> [<wave-id>] [--post-merge]
```

The JSON object must include all required fields: `id`, `type`, `severity`, `file`, `description`, `source`, `createdAt`.
```

**What NOT to do:**
- Do not rewrite existing content in review SKILL.md. Only add the new section.
- Do not add examples with `--set-id` as a flag. Set-id is always positional.

**Verification:**
```bash
grep -n 'log-issue' skills/review/SKILL.md  # Should now find matches
grep -n 'set-id' skills/review/SKILL.md  # Should NOT find --set-id as a flag
```

## Success Criteria

- [ ] All four skill docs updated with correct positional set-id syntax (no `--set-id` flag)
- [ ] Each doc shows both CLI flag and stdin JSON interfaces
- [ ] Auto-generated field behavior is documented
- [ ] review SKILL.md now includes log-issue command reference
- [ ] No other sections of the skill docs are modified
- [ ] Valid enum values shown for `--type`, `--severity`, and `--source` flags
