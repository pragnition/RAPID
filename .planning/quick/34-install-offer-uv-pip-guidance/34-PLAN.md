# Quick Task 34: Install -- Offer uv/pip Installation Guidance

## Objective

The RAPID install currently fails or silently skips the web-backend setup on machines where `uv` (Astral's Python package manager) is not installed. `setup.sh` only prints an INFO line when `uv` is missing (lines 57-62) and then silently `[skip]`s the backend venv creation in Step 6 (lines 130-145). The `/rapid:install` skill never surfaces this gap interactively, so users end up with a "working" install that cannot run Mission Control.

This task adds a prerequisite detection and guidance layer so that when `uv` (and by extension `python3`/`pip`) are missing:

1. The install flow detects the missing tool early.
2. The user is offered an automated install of `uv` via Astral's official installer (`curl -LsSf https://astral.sh/uv/install.sh | sh`).
3. If the user declines or the auto-install fails, the user is given a clear manual install command and URL for their platform.

Scope is intentionally narrow -- **only `uv` is a required tool for RAPID**. `python3` and `pip` are only relevant insofar as `uv` needs a Python interpreter; when `uv` installs itself it also ensures a usable Python. We therefore gate all guidance on `uv` detection and delegate Python/pip handling to `uv itself`.

## Context -- What exists today

**`setup.sh`:**

- Line 34-55: hard-fails on missing `node`, `git`, `npm` (required tools).
- Line 57-62: soft-detects `uv` -- prints `INFO: uv not found (optional, needed for web backend)` and the install URL, but does NOT halt or prompt.
- Line 130-145: Step 6 `[skip]`s backend venv creation when `uv` is missing. User gets a silent skip line and a manual command.

**`skills/install/SKILL.md`:**

- Step 1: runs `setup.sh`; on failure uses `AskUserQuestion` with Retry / Show manual steps / Cancel.
- No pre-setup prereq probe. No `uv`-specific handling. Step 4.5 (optional Mission Control) assumes `rapid-web` binary exists but does not tie it back to `uv`.

**`src/bin/rapid-tools.cjs prereqs`:**

- Checks `git`, `Node.js`, `jq` only. Does NOT check `uv`, `python3`, or `pip`.

The cleanest insertion points are (a) `setup.sh` Step 1 -- make the `uv` check louder and offer an auto-install path via a non-interactive env flag, and (b) `/rapid:install` SKILL.md -- add an interactive pre-flight that probes `uv` and offers auto-install via `AskUserQuestion` before running setup.sh.

## Tasks

### Task 1: Add `uv` auto-install support to `setup.sh`

**Files to modify:**

- `/home/kek/Projects/RAPID/setup.sh` (Step 1, Step 6)

**Action:**

Enhance `setup.sh` so that:

1. In Step 1 (line 57-62), when `uv` is not found, check the env var `RAPID_INSTALL_UV` (set by the skill). The three valid values are:
   - `auto` -- run `curl -LsSf https://astral.sh/uv/install.sh | sh`, then re-probe `PATH` (source `~/.cargo/env` or `~/.local/bin` hints as documented by Astral), echo `OK: uv installed` or `ERROR: uv auto-install failed` with the manual command.
   - `skip` -- print the existing INFO line and continue (current behavior). Keep backend-skip in Step 6 unchanged.
   - unset / any other value -- fall back to current behavior (print INFO line and continue) for backwards compat when `setup.sh` is run standalone without the skill.
2. In Step 6, if `uv` is still missing after Step 1 and `RAPID_INSTALL_UV=auto` was requested, promote the `[skip]` to a `WARNING:` that points the user at the manual install URL and the follow-up backend command. Do NOT halt the script -- the rest of install (frontend, systemd template generation) is still useful.
3. Do NOT touch the required-tool checks for `node`, `git`, `npm` -- those already hard-fail correctly.
4. Preserve `set -euo pipefail`. The `curl | sh` invocation must be wrapped so that a failed install is caught and reported, not aborted silently.

**Reference snippet (illustrative -- do not paste verbatim, adapt to existing style):**

```bash
if command -v uv &>/dev/null; then
    echo "  OK: uv $(uv --version | awk '{print $2}')"
else
    case "${RAPID_INSTALL_UV:-}" in
        auto)
            echo "  INFO: uv not found -- attempting auto-install via astral.sh installer"
            if curl -LsSf https://astral.sh/uv/install.sh | sh; then
                # Astral installer drops uv in ~/.local/bin or ~/.cargo/bin
                export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
                if command -v uv &>/dev/null; then
                    echo "  OK: uv $(uv --version | awk '{print $2}') installed"
                else
                    echo "  WARNING: uv installer ran but 'uv' not on PATH -- restart your shell or add ~/.local/bin to PATH"
                fi
            else
                echo "  WARNING: uv auto-install failed. Install manually: curl -LsSf https://astral.sh/uv/install.sh | sh"
            fi
            ;;
        skip|"")
            echo "  INFO: uv not found (optional, needed for web backend)"
            echo "  Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
            ;;
    esac
fi
```

**Verification:**

```bash
# 1. Style/lint
bash -n /home/kek/Projects/RAPID/setup.sh

# 2. Simulate missing uv (shadow it) and run setup.sh with RAPID_INSTALL_UV=skip
PATH_BACKUP="$PATH"
mkdir -p /tmp/rapid-noop
export PATH="/tmp/rapid-noop:$PATH"  # no uv on PATH
RAPID_INSTALL_UV=skip bash -c 'set -e; source /home/kek/Projects/RAPID/setup.sh' 2>&1 | grep -E "uv not found" && echo "SKIP path OK"
export PATH="$PATH_BACKUP"

# 3. With uv present, current behavior preserved (should print "OK: uv <version>")
bash /home/kek/Projects/RAPID/setup.sh 2>&1 | grep -E "OK: uv " && echo "PRESENT path OK"
```

**Done criteria:**

- `bash -n setup.sh` passes (syntax clean).
- When `uv` is present and `RAPID_INSTALL_UV` is unset, output is byte-identical to prior behavior for the `uv` line.
- When `uv` is missing and `RAPID_INSTALL_UV=skip`, output matches the existing INFO message (backwards compat).
- When `uv` is missing and `RAPID_INSTALL_UV=auto`, the script attempts `curl | sh`, surfaces success/failure clearly, and does NOT abort the rest of the install.
- Step 6 backend setup still skips gracefully (with a WARNING, not a silent skip) when `uv` remains unavailable after auto-install attempt.

---

### Task 2: Add interactive `uv` pre-flight to the `/rapid:install` skill

**Files to modify:**

- `/home/kek/Projects/RAPID/skills/install/SKILL.md` (insert a new Step 0.5 between current Step 0 "Detect Installation Location" and Step 1 "Run Non-Interactive Bootstrap")

**Action:**

Insert a new section `## Step 0.5: Probe Optional Prerequisites (uv)` that:

1. Runs a bash probe for `uv`:
   ```bash
   if command -v uv &>/dev/null; then echo "UV=present"; else echo "UV=missing"; fi
   ```
2. If `UV=missing`, uses `AskUserQuestion`:
   - Header: `"uv not found -- install now?"`
   - Text: `"The 'uv' Python package manager is required for the RAPID web backend (Mission Control). It's not currently on your PATH. Astral provides a one-line installer: curl -LsSf https://astral.sh/uv/install.sh | sh"`
   - Options:
     - `"Yes, auto-install uv"` -- description: `"Run the Astral installer now. RAPID setup will continue after uv is installed."`
     - `"Skip -- I'll install it later"` -- description: `"Continue install without uv. Mission Control and backend features won't work until you install uv and re-run /rapid:install."`
     - `"Show manual install instructions"` -- description: `"Display platform-specific install commands (homebrew, pip, curl) so you can install outside Claude Code."`
3. Map the three answers:
   - **Yes, auto-install**: set `RAPID_INSTALL_UV=auto` in the env used to invoke `setup.sh` in Step 1 (change the Step 1 bash block to `RAPID_INSTALL_UV=auto bash "${CLAUDE_SKILL_DIR}/../../setup.sh"`).
   - **Skip**: set `RAPID_INSTALL_UV=skip` when invoking setup.sh (matches existing behavior, but explicit).
   - **Show manual**: display a code block with three platform-specific install routes, then re-prompt with the same question (do not loop infinitely -- cap at two re-prompts, after which proceed as "Skip"):
     ```
     # macOS (Homebrew)
     brew install uv

     # Linux / macOS (Astral installer)
     curl -LsSf https://astral.sh/uv/install.sh | sh

     # Windows (PowerShell)
     powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

     # Python users with pipx
     pipx install uv
     ```
4. If `UV=present`, display `"uv $(uv --version) found -- continuing."` and proceed to Step 1 with `RAPID_INSTALL_UV` unset.
5. Update Step 1's bash invocation to honor the env var:
   ```bash
   RAPID_INSTALL_UV="${RAPID_INSTALL_UV:-}" bash "${CLAUDE_SKILL_DIR}/../../setup.sh"
   ```

**Verification:**

```bash
# 1. Markdown/skill structure sanity -- confirm the new section is before Step 1 and the existing Step 1 bash invocation passes through the env var
grep -n "Step 0.5" /home/kek/Projects/RAPID/skills/install/SKILL.md
grep -n "RAPID_INSTALL_UV" /home/kek/Projects/RAPID/skills/install/SKILL.md

# 2. Ensure Step 1's setup.sh call is updated (env var forwarded)
grep -A 2 "Step 1:" /home/kek/Projects/RAPID/skills/install/SKILL.md | grep -E "RAPID_INSTALL_UV|setup\.sh"

# 3. No broken section numbering -- current step ordering is 0 -> 1 -> 2 -> 3 -> 4 -> 4.5 -> 5 -> 6. Inserting 0.5 should not renumber anything else.
grep -E "^## Step " /home/kek/Projects/RAPID/skills/install/SKILL.md
```

**Done criteria:**

- New `## Step 0.5: Probe Optional Prerequisites (uv)` section exists between Step 0 and Step 1.
- The section references `AskUserQuestion` with the three options (Yes / Skip / Show manual).
- Step 1's bash block forwards `RAPID_INSTALL_UV` to `setup.sh`.
- Existing step numbers (1, 2, 3, 4, 4.5, 5, 6) are unchanged.
- The "Show manual install instructions" branch includes at minimum: brew, curl installer, pipx.
- `grep -E "^## Step " SKILL.md` shows exactly one new step (0.5) and no duplicated or missing existing steps.

---

### Task 3: Surface `uv` status in `rapid-tools.cjs prereqs` (optional warning)

**Files to modify:**

- `/home/kek/Projects/RAPID/src/commands/prereqs.cjs` (or wherever the prereqs probe list is defined)

**Action:**

Add `uv` to the prereqs probe list as an **optional** tool (same tier as `jq`):

- `name`: `"uv"`
- `minVersion`: `"0.4"` (the version in which `uv venv` and `uv pip install` stabilized -- adjust if Context7 docs point to a different floor; do NOT invent -- if unsure, use `"0.1"` as a permissive floor)
- `required`: `false`
- `reason`: `"needed for web backend (Mission Control)"`
- Probe command: `uv --version` -- parse the second whitespace token (matching the pattern used for git/node in the existing file).

If `uv` is missing, the summary should include a new `hasWarnings: true` entry (do NOT flip `hasBlockers` -- it's optional). The install skill already calls `node "$RAPID_TOOLS" prereqs` in Step 4 as post-install verification; adding `uv` here means users get a clear "missing optional tool" line if they skipped auto-install.

Before starting, query Context7 for the canonical minimum version of `uv` that supports `uv venv` and `uv pip install -e .` (both are used in `setup.sh` Step 6). Use the returned version as `minVersion`. If Context7 has no answer, fall back to `"0.1"`.

**Verification:**

```bash
# 1. prereqs command still exits 0 when uv is missing (optional tool)
PATH="/tmp/no-uv:$PATH" node /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs prereqs; echo "exit=$?"

# 2. JSON output includes uv entry
node /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs prereqs --json | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const uv = data.results.find(r => r.name === "uv");
  if (!uv) { console.error("FAIL: uv not in results"); process.exit(1); }
  if (uv.required !== false) { console.error("FAIL: uv must be optional"); process.exit(1); }
  console.log("OK: uv entry present, required=false, status=" + uv.status);
'

# 3. Table output includes a uv row
node /home/kek/Projects/RAPID/src/bin/rapid-tools.cjs prereqs --json | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (!data.summary.table.includes("uv")) { console.error("FAIL: uv not in table"); process.exit(1); }
  console.log("OK");
'
```

**Done criteria:**

- `prereqs --json` output includes a new `uv` entry in `results`.
- `uv` is marked `required: false` -- missing `uv` MUST NOT flip `hasBlockers` to true.
- When `uv` is missing, `hasWarnings` becomes true (if the existing code supports that flag -- otherwise skip this sub-requirement and document in the commit message).
- Table summary renders a row for `uv` with pass/warn status.
- Existing `git` / `Node.js` / `jq` entries are unchanged.
- Unit test coverage: add or extend a unit test for the prereqs command that shadows `uv` on PATH and asserts the warning entry is produced. Test file should live next to existing prereqs tests -- search with `grep -r "prereqs" test/ spec/ __tests__/` to find the right location before writing.

---

## What NOT to do

- Do NOT add `python3` or `pip` as separate prereq entries. `uv` supersedes both; Astral's installer handles Python provisioning.
- Do NOT make `uv` a required (blocking) prereq. Solo-mode RAPID users who don't use the web backend must not be blocked.
- Do NOT change the behavior of `setup.sh` when `uv` is present -- the current "OK: uv <version>" line must remain byte-identical to avoid breaking downstream parsing.
- Do NOT embed the Astral install script verbatim in the repo. Always curl it live -- this is how Astral ships it and the URL is the canonical source.
- Do NOT add a prompt to `setup.sh`. `setup.sh` is non-interactive by contract. Interactive prompts live in the skill.
- Do NOT alter Step 4.5 (Mission Control) flow beyond verifying it benefits from the new `uv` presence after Step 0.5.

## Success criteria

- User running `/rapid:install` on a fresh box without `uv` sees a clear `AskUserQuestion` prompt offering auto-install, skip, or manual instructions.
- Choosing auto-install runs the Astral script and continues setup without manual intervention.
- Choosing skip preserves current behavior (backend `[skip]`, rest of install succeeds).
- `node rapid-tools.cjs prereqs` lists `uv` as an optional tool with a pass/warn line.
- `bash -n setup.sh` passes; running `setup.sh` standalone (without the skill, without `RAPID_INSTALL_UV`) is unchanged.
- Commit message format: `feat(quick-34): offer uv auto-install during /rapid:install` (one commit per task is fine -- three total commits expected).
