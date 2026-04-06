# Gaps: scaffold-overhaul

## Gap 1: Shared stub branch management (rapid/stubs)

**ROADMAP criterion:** Shared stub branch management (rapid/stubs)
**Status:** Resolved
**Detail:** The ROADMAP mentioned a `rapid/stubs` shared branch for stub management. The actual implementation manages stubs per-worktree in `.rapid-stubs/` directories, which serves the same functional purpose (stubs are generated, verified, and cleaned up) but without a dedicated shared git branch. The per-worktree approach was the one specified in all three wave plans and is consistent with the existing worktree isolation model.
**Severity:** Low -- the per-worktree approach achieves the same end goal and is architecturally consistent with the existing isolation model.
