# Quick Task 35: Restore "Made with :heart: by @fishjojo1" Banner

## Objective

Restore the "Made with :heart: by @fishjojo1" banner that used to appear near the top of `README.md`. The banner was present in past revisions (commits `389082a` "touched up readme" and `5ba85df` "sub lol"), sitting just below the badges block and above the `[!NOTE]` beta callout, but was dropped during the later onboarding rewrite chain.

## Historical Reference

Two variants existed in git history for `README.md`:

- `389082a:README.md` (plain):
  ```html
  <p align='center'>
  Made with :heart: by @fishjojo1
  </p>
  ```
- `5ba85df:README.md` (polished, linked):
  ```html
  <p align="center">
    <sub>Built with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a></sub>
  </p>
  ```

The user's request explicitly references the **"Made with :love: by @fishjojo1"** wording, which matches the `389082a` variant's verb ("Made with"). Use that verb but upgrade the markup to the polished `<sub>` + hyperlinked form from `5ba85df` so it matches the rest of the README's centered-HTML style and links the handle to GitHub. Final line:

```html
<p align="center">
  <sub>Made with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a></sub>
</p>
```

## Task 1 -- Insert banner block into `README.md`

**Files to modify:**
- `/home/kek/Projects/RAPID/README.md`

**Action:**

Edit `README.md` to insert a new centered banner paragraph between the closing `</p>` of the badges block (the one containing the version / license / Claude_Code / Node.js shields) and the `> [!NOTE]` blockquote that begins the beta notice. Separate the new block from its neighbors with blank lines so Markdown treats it as its own paragraph.

Target insertion point -- current top of file looks like:

```html
<p align="center">
  <img src="https://img.shields.io/badge/version-7.0.0-d3c6aa?style=flat-square&labelColor=2d353b" alt="Version" /> 
  <img src="https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b" alt="License" /> 
  <img src="https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b" alt="Claude Code" /> 
  <img src="https://img.shields.io/badge/Node.js-22%2B-a7c080?style=flat-square&labelColor=2d353b" alt="Node.js" />
</p>

> [!NOTE]
> RAPID is still in beta. ...
```

After edit it should look like:

```html
<p align="center">
  <img src="https://img.shields.io/badge/version-7.0.0-d3c6aa?style=flat-square&labelColor=2d353b" alt="Version" /> 
  <img src="https://img.shields.io/badge/license-MIT-a7c080?style=flat-square&labelColor=2d353b" alt="License" /> 
  <img src="https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square&labelColor=2d353b" alt="Claude Code" /> 
  <img src="https://img.shields.io/badge/Node.js-22%2B-a7c080?style=flat-square&labelColor=2d353b" alt="Node.js" />
</p>

<p align="center">
  <sub>Made with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a></sub>
</p>

> [!NOTE]
> RAPID is still in beta. ...
```

Use a single `Edit` call with `old_string` anchored on the closing `</p>` of the badges block plus the blank line and `> [!NOTE]` line so the insertion point is unambiguous. Do not touch any other content, badges, wording, or the banner image.

**What NOT to do:**
- Do NOT replace the `:heart:` shortcode with an actual emoji -- match the historical shortcode style used elsewhere in the README and in the user's request (they wrote `:love:` colloquially, but the established shortcode is `:heart:` per `389082a`/`5ba85df`).
- Do NOT add the banner above the hero `banner-github.svg` image or above the badges -- keep it directly below the badges as the history shows.
- Do NOT rewrite or shorten the beta `[!NOTE]` callout or any surrounding content.
- Do NOT bump version numbers, changelog entries, or any other docs as part of this quick task.

**Verification command:**
```bash
grep -n 'Made with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a>' /home/kek/Projects/RAPID/README.md
```
Expect exactly one matching line, located between the badges `</p>` closer and the `> [!NOTE]` line. Additional sanity check:
```bash
awk '/<\/p>/{p=NR} /> \[!NOTE\]/{print (NR>p && p>0 ? "OK" : "FAIL"); exit}' /home/kek/Projects/RAPID/README.md | grep -q OK && echo ordering-ok
```
Expect `ordering-ok`.

**Done criteria:**
- `README.md` contains the exact banner line shown above.
- Banner sits between the badges `<p align="center">...</p>` block and the `> [!NOTE]` blockquote, separated from each by a blank line.
- No other lines in `README.md` are modified.
- Both verification commands succeed.

## Task 2 -- Commit the change

**Files to modify:**
- Git index (staging `README.md` only)

**Action:**

Stage and commit the single-file change using the RAPID quick-task commit convention.

```bash
cd /home/kek/Projects/RAPID
git add README.md
git commit -m "quick(readme-made-with-love-banner): restore @fishjojo1 credit banner to README top"
```

**What NOT to do:**
- Do NOT use `git add .` or `git add -A`. The working tree contains many unrelated modifications (see `git status`) that must not be swept into this commit.
- Do NOT amend any prior commit.
- Do NOT push.

**Verification command:**
```bash
git -C /home/kek/Projects/RAPID log -1 --name-only --pretty=format:'%h %s'
```
Expect a single commit whose subject starts with `quick(readme-made-with-love-banner):` and whose only changed file is `README.md`.

**Done criteria:**
- Exactly one new commit on the current branch.
- Commit touches only `README.md`.
- Commit subject follows the `quick(readme-made-with-love-banner): ...` convention.

## Success Criteria (whole task)

- The line `Made with :heart: by <a href="https://github.com/fishjojo1">@fishjojo1</a>` is present in `README.md`, wrapped in a centered `<p>` + `<sub>` block, between the badges block and the `[!NOTE]` beta notice.
- A single new commit records the change with subject `quick(readme-made-with-love-banner): restore @fishjojo1 credit banner to README top`.
- No other files are modified by this task.
