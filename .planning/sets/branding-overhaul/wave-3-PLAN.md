# Wave 3 PLAN: Branding Skill Flow Extension and Final Verification

**Set:** branding-overhaul
**Wave:** 3
**Objective:** Extend the branding skill (SKILL.md) to register artifacts via `branding-artifacts.cjs` at each generation step, producing a sequential artifact flow (theme -> logo -> wireframe -> guidelines). Run final verification against all CONTRACT.json behavioral requirements.

**Depends on:** Wave 1 (branding-artifacts.cjs), Wave 2 (CRUD API, hub page)

---

## Task 1: Extend SKILL.md with Artifact Registration Steps

**Files:** `skills/branding/SKILL.md`

**Action:**

Modify the existing branding skill to integrate artifact registration after each generation step. The skill already generates `BRANDING.md` and `index.html`. The extension adds registration calls so artifacts appear in the hub page card gallery in real-time.

### Changes to Step 5 (Generate BRANDING.md)

After the line `Write '.planning/branding/BRANDING.md' using the Write tool`, add an artifact registration step:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'theme',
  filename: 'BRANDING.md',
  description: 'Project branding guidelines and style tokens'
});
console.log('Registered artifact:', result.id);
"
```

### Changes to Step 6 (Generate Static HTML Branding Page)

After writing `index.html` with the Write tool, add an artifact registration step:

```bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'preview',
  filename: 'index.html',
  description: 'Visual branding reference page with live preview'
});
console.log('Registered artifact:', result.id);
"
```

### New Step 5b: Generate Logo Placeholder (between current Steps 5 and 6)

Add a new step that generates a simple SVG logo placeholder based on the branding interview responses:

Insert after Step 5 and before Step 6:

```markdown
## Step 5b: Generate Logo Artifact

Generate a simple SVG logo for the project based on the branding interview responses. Write it to `.planning/branding/logo.svg` using the Write tool.

The SVG should:
- Be a simple, clean vector graphic (not complex -- this is a placeholder/starting point)
- Use the primary color from the branding guidelines
- Include the project name or initials
- Be viewBox-based for scalability (e.g., `viewBox="0 0 200 200"`)
- Be self-contained (no external references)

After writing the SVG file, register the artifact:

\`\`\`bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'logo',
  filename: 'logo.svg',
  description: 'Project logo (placeholder -- customize or replace)'
});
console.log('Registered artifact:', result.id);
"
\`\`\`
```

### New Step 5c: Generate Wireframe Artifact (between new Step 5b and Step 6)

Insert after Step 5b:

```markdown
## Step 5c: Generate Wireframe Artifact

Generate a simple HTML wireframe that demonstrates the branding guidelines applied to a typical page layout. Write it to `.planning/branding/wireframe.html` using the Write tool.

The wireframe should:
- Be a single self-contained HTML file with inline CSS
- Show a representative page layout for the detected project type:
  - **webapp**: header, sidebar nav, main content area, card grid, footer
  - **cli**: terminal-style output mockup showing help text and sample command output
  - **library**: API documentation layout with code samples
- Apply the color palette, typography, and spacing tokens from BRANDING.md
- Include placeholder content that demonstrates the branding in context

After writing the wireframe, register the artifact:

\`\`\`bash
# (env preamble here)
node -e "
const artifacts = require('./src/lib/branding-artifacts.cjs');
const result = artifacts.createArtifact(process.cwd(), {
  type: 'wireframe',
  filename: 'wireframe.html',
  description: 'Page layout wireframe demonstrating branding guidelines'
});
console.log('Registered artifact:', result.id);
"
\`\`\`
```

### Updated Step 6 note

After the existing `index.html` generation and its artifact registration (added above), the branding server is started. At this point, all 4 artifacts (BRANDING.md, logo.svg, wireframe.html, index.html) should be visible in the hub page card gallery.

### Updated Step 9 (Commit and Summary)

Update the git add command to include new artifacts:

```bash
git add .planning/branding/BRANDING.md .planning/branding/index.html .planning/branding/logo.svg .planning/branding/wireframe.html .planning/branding/artifacts.json
git commit -m "feat(branding-system): generate branding guidelines and artifacts"
```

Update the summary display to list all artifacts:

```
Branding artifacts generated:
- .planning/branding/BRANDING.md -- Authoritative branding guidelines ({line_count} lines)
- .planning/branding/logo.svg -- Project logo placeholder
- .planning/branding/wireframe.html -- Page layout wireframe
- .planning/branding/index.html -- Visual branding reference page
- .planning/branding/artifacts.json -- Artifact manifest ({count} entries)
- Branding server: {running|stopped} (http://localhost:{port})

Branding context will be automatically injected into all future RAPID execution prompts.
```

### Step ordering summary (final)

After this task, the full SKILL.md step flow is:
1. Environment Setup + Banner
2. Codebase Detection
3. Check Existing Branding
4. Branding Interview (4 rounds + anti-patterns)
5. Generate BRANDING.md + register artifact
5b. Generate logo.svg + register artifact
5c. Generate wireframe.html + register artifact
6. Generate index.html + register artifact + start server
7. Display Server URL
8. Server Lifecycle
9. Commit and Summary

### What NOT to do

- Do NOT change the interview questions or flow (Steps 1-4) -- only extend Steps 5-9.
- Do NOT make artifact registration blocking or error-fatal -- if registration fails, log a warning but continue. The branding artifacts (BRANDING.md, index.html) must still be generated even if the registry is unavailable.
- Do NOT add `artifacts.json` to `.gitignore` -- it should be committed.
- Do NOT change the BRANDING.md format or content -- only add registration after generation.

**Verification:**

```bash
# Verify SKILL.md contains artifact registration steps
grep -c 'branding-artifacts.cjs' skills/branding/SKILL.md
# Should return 4 (one per artifact registration)

# Verify SKILL.md mentions all artifact types
grep -c "type: 'theme'\|type: 'logo'\|type: 'wireframe'\|type: 'preview'" skills/branding/SKILL.md
# Should return 4
```

**Done when:** SKILL.md contains 4 artifact registration steps (theme, logo, wireframe, preview), new Steps 5b and 5c are properly positioned, Step 9 commits all artifacts.

---

## Task 2: Final CONTRACT.json Verification

**Files:** No file modifications -- verification only.

**Action:**

Run a comprehensive verification pass against all CONTRACT.json requirements. This is a checklist task.

### Behavioral contract checks

1. **sse-connection-cleanup:** Verify `stop()` calls `_closeAllSSEClients()` and `_stopFileWatcher()`. Run the existing test that verifies stop closes SSE connections.

```bash
cd /home/kek/Projects/RAPID && node --test --test-name-pattern="stop.*closes all SSE" src/lib/branding-server.test.cjs
```

2. **fs-watch-debounce:** Verify the debounce timer is between 200-500ms. Check the `DEBOUNCE_MS` constant.

```bash
node -e "const s = require('./src/lib/branding-server.cjs'); const ms = s.DEBOUNCE_MS || 300; console.log('Debounce MS:', ms); if (ms < 200 || ms > 500) { console.error('FAIL: debounce out of 200-500ms range'); process.exit(1); } console.log('OK')"
```

3. **xss-prevention:** Run the XSS test that creates an artifact with script tags in the filename.

```bash
cd /home/kek/Projects/RAPID && node --test --test-name-pattern="escapes HTML" src/lib/branding-server.test.cjs
```

4. **zero-new-dependencies:** Verify package.json has not changed.

```bash
cd /home/kek/Projects/RAPID && git diff package.json | head -5
# Should show no changes (empty output)
```

### Export contract checks

5. **notifyClients function:** Verify it is exported and callable.

```bash
node -e "const s = require('./src/lib/branding-server.cjs'); if (typeof s.notifyClients !== 'function') { console.error('FAIL: notifyClients not exported'); process.exit(1); } console.log('OK: notifyClients exported')"
```

6. **branding-artifacts module:** Verify all expected functions are exported.

```bash
node -e "
const a = require('./src/lib/branding-artifacts.cjs');
const expected = ['getManifestPath', 'loadManifest', 'saveManifest', 'createArtifact', 'listArtifacts', 'getArtifact', 'deleteArtifact', 'listUntrackedFiles'];
const missing = expected.filter(f => typeof a[f] !== 'function');
if (missing.length) { console.error('FAIL: missing exports:', missing); process.exit(1); }
console.log('OK: all artifact functions exported');
"
```

7. **artifact-crud-api:** Verify all three endpoints respond correctly.

```bash
cd /home/kek/Projects/RAPID && node --test --test-name-pattern="CRUD" src/lib/branding-server.test.cjs
```

8. **sse-endpoint:** Verify the SSE endpoint is functional.

```bash
cd /home/kek/Projects/RAPID && node --test --test-name-pattern="SSE endpoint" src/lib/branding-server.test.cjs
```

9. **hub-page:** Verify the hub page renders artifact cards.

```bash
cd /home/kek/Projects/RAPID && node --test --test-name-pattern="hub page" src/lib/branding-server.test.cjs
```

### Full test suite

10. **Run all tests for both files:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/branding-artifacts.test.cjs src/lib/branding-server.test.cjs
```

### Export DEBOUNCE_MS

If `DEBOUNCE_MS` is not already exported from `branding-server.cjs`, add it to the exports so the behavioral contract check (step 2 above) can verify it. This is a minor modification to `src/lib/branding-server.cjs` -- add `DEBOUNCE_MS` to the `module.exports` object.

**Done when:** All 10 verification checks pass. The set is ready for review.

---

## Success Criteria

- [ ] SKILL.md has 4 artifact registration steps in correct order (theme, logo, wireframe, preview)
- [ ] Steps 5b (logo) and 5c (wireframe) are properly positioned between existing Steps 5 and 6
- [ ] Step 9 commits all 5 branding files including artifacts.json
- [ ] All CONTRACT.json behavioral contracts verified (SSE cleanup, debounce, XSS, zero deps)
- [ ] All CONTRACT.json export contracts verified (notifyClients, branding-artifacts module, CRUD API, SSE endpoint, hub page)
- [ ] Full test suite passes: `node --test src/lib/branding-artifacts.test.cjs src/lib/branding-server.test.cjs` exits 0
- [ ] No new npm dependencies in package.json
