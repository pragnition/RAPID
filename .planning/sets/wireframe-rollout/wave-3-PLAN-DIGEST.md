# Wave 3 Plan Digest

**Objective:** Propagate redesign through planning substrate — rewrite 3 pending downstream CONTRACT.json files editorially, scoped edit on merged web-tool-bridge, reconcile `gh→gc` shortcut collision. Zero code.
**Tasks:** 5/5 (Task 5 DEFINITION.md edits no-op — no files existed).
**Key files:** `.planning/sets/{skill-invocation-ui,kanban-autopilot,agents-chats-tabs}/CONTRACT.json` (full rewrites v1.1.0), `.planning/sets/web-tool-bridge/CONTRACT.json` (scoped UI-component-only rewrite, version unchanged, redesign_note warning).
**Approach:** Backend export signatures byte-identical. UI exports cite wireframe artifacts. Two sanctioned renames with `_redesign_rename` metadata (`skill_gallery_page→skill_gallery_component`, `accessibility_primitives→accessibility_hooks`). One new export (`kanban_column_surface`). `agents-chats-tabs` declares `wireframe-rollout` as import source.
**Status:** Complete — all 4 JSON valid, DAG.json untouched, web-tool-bridge warning in both commit body + `behavioral.redesign_note`.
