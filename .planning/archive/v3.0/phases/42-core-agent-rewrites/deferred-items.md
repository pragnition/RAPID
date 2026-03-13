# Deferred Items -- Phase 42

## Pre-existing Test Failures

### merge.test.cjs:2300 -- set-merger git core module assertion
- **File:** `src/lib/merge.test.cjs` line 2309
- **Issue:** Test asserts `content.includes('<git>')` but Phase 39 replaced the `<git>` tag with `<conventions>`. The test expects the old tag name.
- **Fix:** Change assertion from `'<git>'` to `'<conventions>'` at line 2309
- **Discovered during:** 42-03-PLAN execution
- **Not fixed because:** Out of scope -- pre-existing failure not caused by this plan's changes
