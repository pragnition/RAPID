# PLAN: init-config -- Wave 2

## Objective

Add four configuration and environment improvements to the init/start-set pipeline: (1) DEFINITION.md generation during init, (2) project-wide solo mode config, (3) worktree dependency installation, and (4) auto-commit of planning artifacts after init. These are all additive features that build on the Wave 1 foundation (graceful loadSet).

## Tasks

### Task 1: Add DEFINITION.md generation to the init skill

**Files:**
- `skills/init/SKILL.md` (modify)
- `src/modules/roles/role-roadmapper.md` (modify)

**Action:** The roadmapper agent returns `contracts` but NOT definitions. The init SKILL.md (Step 9, "Accept roadmap" section around lines 619-636) writes CONTRACT.json per set but never generates DEFINITION.md. Fix this gap by having the init skill generate DEFINITION.md alongside CONTRACT.json.

**Implementation approach -- Skill layer generation (not CLI):**

In `skills/init/SKILL.md`, after the section that writes CONTRACT.json files (around line 631), add a new step that generates DEFINITION.md for each set. The definition should be created from the roadmapper's output data:

1. In the roadmapper module (`src/modules/roles/role-roadmapper.md`), extend the `contracts` array output to include definition metadata per set: `{ setId, contract, definition: { scope, ownedFiles, tasks } }`. The roadmapper already knows the scope and file ownership for each set -- it just does not currently export them in a structured way.

2. In `skills/init/SKILL.md`, after writing each CONTRACT.json, use the Write tool to write a DEFINITION.md file. The DEFINITION.md content should follow the format produced by `generateDefinition()` in `src/lib/plan.cjs` (lines 141-180):

```markdown
# Set: {setId}

## Scope
{scope from roadmapper}

## File Ownership
Files this set owns (exclusive write access):
- {file1}
- {file2}

## Tasks
1. {task description}

## Interface Contract
See: CONTRACT.json (adjacent file)

## Wave Assignment
Wave: (assigned during plan-set)

## Acceptance Criteria
- All tasks complete with passing tests
- CONTRACT.json satisfied
```

3. The roadmapper module is auto-generated from `src/modules/` -- edit the source module at `src/modules/roles/role-roadmapper.md`, NOT the generated agent file at `agents/rapid-roadmapper.md`.

**What NOT to do:**
- Do NOT call `plan.createSet()` from the skill -- the skill does not have access to the Node.js library directly (it operates through CLI commands and Write tool)
- Do NOT add a new CLI subcommand for this -- the Write tool in SKILL.md is sufficient
- Do NOT edit `agents/rapid-roadmapper.md` -- it is auto-generated from modules

**Verification:**
- Manual: Run `/rapid:init` on a test project and verify each set directory contains both CONTRACT.json and DEFINITION.md
- Structural: Read the modified SKILL.md and confirm the DEFINITION.md write step exists after CONTRACT.json

---

### Task 2: Add solo mode config to generateConfigJson() and write-config CLI

**Files:**
- `src/lib/init.cjs` (modify, lines 177-189)
- `src/lib/init.test.cjs` (modify)
- `src/commands/init.cjs` (modify, lines 71-110)

**Action:**

#### 2a: Extend generateConfigJson() in init.cjs

Add a `solo` field to the config output. The field defaults to `false` unless the team size is 1:

```javascript
function generateConfigJson(opts = {}) {
  const config = {
    project: {
      name: opts.name || '',
      version: '0.1.0',
    },
    model: opts.model || 'sonnet',
    planning: {
      max_parallel_sets: Math.max(1, Math.floor((opts.teamSize || 1) * 1.5)),
    },
    solo: (opts.teamSize || 1) === 1,
  };
  return JSON.stringify(config, null, 2);
}
```

#### 2b: Extend write-config CLI to accept --solo flag

In `src/commands/init.cjs`, the `write-config` subcommand (line 71) already parses `--model`, `--team-size`, and `--name`. Add `--solo` as an explicit boolean override:

```javascript
case '--solo':
  opts.solo = true;
  break;
```

Then pass `opts.solo` to `generateConfigJson()`. In `generateConfigJson()`, if `opts.solo` is explicitly provided, use it; otherwise derive from team size.

#### 2c: Add tests for solo config

In `src/lib/init.test.cjs`, add tests:

1. **Test: generateConfigJson with teamSize=1 sets solo: true**
2. **Test: generateConfigJson with teamSize=3 sets solo: false**
3. **Test: generateConfigJson with explicit solo override**

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/init.test.cjs 2>&1 | tail -20
```

---

### Task 3: Add solo config check to start-set skill and set-init CLI

**Files:**
- `skills/start-set/SKILL.md` (modify)
- `src/commands/set-init.cjs` (modify)

**Action:**

#### 3a: Modify start-set SKILL.md to check config.json for solo mode

In `skills/start-set/SKILL.md`, after the "Check for --solo Flag" section (around line 58), add a config-based solo detection step. Before the worktree/solo decision, if `--solo` was NOT explicitly passed:

1. Read `.planning/config.json` using the Read tool
2. Parse the JSON and check for `solo: true`
3. If `solo: true` in config, set `SOLO_MODE=true` (same effect as `--solo` flag)
4. Log: "Solo mode enabled from project config (.planning/config.json)"

The `--solo` flag remains the explicit override. If config says `solo: true`, the skill behaves as if `--solo` was passed. If user does NOT pass `--solo` and config does NOT have `solo: true`, normal worktree mode is used.

#### 3b: Modify set-init CLI to accept config-based solo

In `src/commands/set-init.cjs`, the `create` subcommand currently checks `args.includes('--solo')` (line 13). Add a fallback check:

After checking for `--solo` in args, if not present, read `.planning/config.json` from `cwd`:

```javascript
let isSolo = args.includes('--solo');
if (!isSolo) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.solo === true) {
      isSolo = true;
    }
  } catch {
    // Graceful -- config.json may not exist
  }
}
```

**What NOT to do:**
- Do NOT use core.cjs `loadConfig()` -- that reads root `config.json` (plugin infra), not `.planning/config.json` (project config)
- Do NOT add a `--no-solo` flag -- normal behavior when config says solo but user omits `--solo` is to use the config value

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/commands/set-init.cjs 2>&1 | tail -20
```

---

### Task 4: Add dependency installation to createWorktree()

**Files:**
- `src/lib/worktree.cjs` (modify, lines 72-95)
- `src/lib/worktree.test.cjs` (modify)

**Action:**

#### 4a: Add package manager detection and install to createWorktree()

After the worktree is created (line 93, before the `return` on line 94), add dependency installation:

1. **Detect package manager** by checking for lockfiles in the worktree path (they come from HEAD):
   - `pnpm-lock.yaml` exists -> use `pnpm install`
   - `yarn.lock` exists -> use `yarn install`
   - `package-lock.json` exists -> use `npm ci` (prefer ci over install for lockfile-based install)
   - `package.json` exists but no lockfile -> use `npm install`
   - No `package.json` -> skip install entirely

2. **Run install** using `execSync` (already imported at line 3):
   ```javascript
   try {
     execSync(installCmd, { cwd: worktreePath, stdio: 'pipe', timeout: 120000 });
   } catch (err) {
     // Warn but do not fail -- worktree is still usable without deps
     console.error(`[RAPID] Warning: dependency install failed in worktree "${setName}": ${err.message}`);
   }
   ```

3. **Return result** should include a `depsInstalled` boolean field:
   ```javascript
   return { branch, path: worktreePath, depsInstalled };
   ```

**Important:** The `setInit()` function (line 363) calls `createWorktree()` and destructures `{ branch, path: worktreePath }`. Update the destructuring to ignore the new field (it already works since extra properties are ignored in destructuring).

#### 4b: Extract a helper function

Create a `detectPackageManager(dir)` helper function that returns `{ manager: string|null, command: string|null }`:

```javascript
function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return { manager: 'pnpm', command: 'pnpm install' };
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return { manager: 'yarn', command: 'yarn install' };
  if (fs.existsSync(path.join(dir, 'package-lock.json'))) return { manager: 'npm', command: 'npm ci' };
  if (fs.existsSync(path.join(dir, 'package.json'))) return { manager: 'npm', command: 'npm install' };
  return { manager: null, command: null };
}
```

#### 4c: Add tests

In `src/lib/worktree.test.cjs`, add a `describe('detectPackageManager', ...)` block and a test within the existing `createWorktree` describe block:

1. **Test: detectPackageManager returns npm for package-lock.json**
2. **Test: detectPackageManager returns pnpm for pnpm-lock.yaml**
3. **Test: detectPackageManager returns yarn for yarn.lock**
4. **Test: detectPackageManager returns null for no package.json**
5. **Test: createWorktree returns depsInstalled field** (integration test using a real temp git repo with a package.json)

**What NOT to do:**
- Do NOT use `--prefer-offline` or symlink strategies -- keep it simple with standard full install
- Do NOT install deps in solo mode (`setInitSolo` does not call `createWorktree`)
- Do NOT let install failure prevent worktree creation from succeeding

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/worktree.test.cjs 2>&1 | tail -30
```

---

### Task 5: Add auto-commit step to init skill

**File:** `skills/init/SKILL.md` (modify)

**Action:**

Add a new step between the current Step 10 (Completion) and Step 11 (Next Step). Call it "Step 10.5: Auto-Commit Planning Artifacts" or renumber as needed.

**Step content:**

```markdown
## Step 10: Auto-Commit Planning Artifacts

Before displaying the completion summary, auto-commit all generated planning artifacts.

First, check if there are uncommitted changes outside `.planning/`:

\```bash
OUTSIDE_CHANGES=$(git status --porcelain | grep -v '^\?\? ' | grep -v '.planning/' | head -5)
if [ -n "$OUTSIDE_CHANGES" ]; then
  echo "WARNING: Uncommitted changes exist outside .planning/. These will NOT be included in the auto-commit."
fi
\```

If there are changes outside `.planning/`, warn the user but proceed with the scoped commit.

Then stage and commit only `.planning/` files:

\```bash
git add .planning/
# Check if there are staged changes
if git diff --cached --quiet; then
  echo "No planning artifacts to commit."
else
  git commit -m "rapid:init({project-name}): initialize project planning artifacts"
fi
\```

Replace `{project-name}` with the actual project name from Step 4A.

Display the commit result: "Committed planning artifacts: {commit hash}"
```

**Renumber existing steps:** Current Step 10 (Completion) becomes Step 11, Step 11 (Next Step) becomes Step 12, Step 12 (Progress Breadcrumb) becomes Step 13.

**What NOT to do:**
- Do NOT use `git add .` or `git add -A` -- only `git add .planning/`
- Do NOT commit if there are no staged changes (use `git diff --cached --quiet` check)
- Do NOT include source files, .env, or anything outside `.planning/`
- Do NOT fail the init if the commit fails (warn and continue)

**Verification:**
- Manual: Run `/rapid:init` and check `git log -1` shows the auto-commit
- Structural: Read the modified SKILL.md and confirm the auto-commit step exists

---

## Success Criteria

1. After `/rapid:init`, every set directory contains both CONTRACT.json and DEFINITION.md
2. `generateConfigJson()` produces `solo: true` when teamSize is 1
3. `start-set` skill and `set-init create` CLI check `.planning/config.json` for solo mode when `--solo` flag is not passed
4. `createWorktree()` detects the package manager and runs install (or warns on failure)
5. Init skill auto-commits `.planning/` artifacts after roadmap acceptance
6. All existing tests continue to pass
7. New tests pass for solo config and package manager detection

## File Ownership

| File | Action |
|------|--------|
| `skills/init/SKILL.md` | Modify (DEFINITION.md generation + auto-commit step) |
| `skills/start-set/SKILL.md` | Modify (solo config check) |
| `src/modules/roles/role-roadmapper.md` | Modify (add definition metadata to output) |
| `src/lib/init.cjs` | Modify (solo field in generateConfigJson) |
| `src/lib/init.test.cjs` | Modify (add solo config tests) |
| `src/commands/init.cjs` | Modify (--solo flag for write-config) |
| `src/commands/set-init.cjs` | Modify (config-based solo fallback) |
| `src/lib/worktree.cjs` | Modify (createWorktree deps install + detectPackageManager) |
| `src/lib/worktree.test.cjs` | Modify (add detectPackageManager + deps tests) |
