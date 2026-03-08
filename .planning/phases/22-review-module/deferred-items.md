# Phase 22: Deferred Items

## Pre-existing Issues (Out of Scope)

1. **assembler.test.cjs: assembled planner agent size test fails (20.6KB > 15KB threshold)**
   - The `assembled agent size` test expects the planner agent to be under 15KB, but it is currently 20.6KB.
   - This failure pre-dates Phase 22 changes -- it was already failing before any review module work.
   - The planner's core modules have grown over time beyond the original 15KB threshold.
   - Fix options: increase the threshold, or trim core module content.
   - Discovered during: Phase 22, Plan 02, Task 2
