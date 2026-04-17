# Wave 3 Digest -- agents-chats-tabs

- **Status**: COMPLETE -- all 10 tasks, 10 commits, 88 tests passing (31 new)
- **Key decisions**: StatCard uses `accent/orange/warning/info` tones; two-step launcher (gallery -> launcher modal); SlashAutocompleteItem imported directly from component
- **Files**: 10 new files (2 pages, 3 empty-states, 1 hook, 4 test files), 8 modified (2 page rewrites, router, package.json, types, 2 test rewrites)
- **Nav fix shipped**: Pre-existing bug routing all runs to `/chats/{runId}` is fixed; routing now based on skill category
- **Blocker noted**: Backend `GET /agents/runs?project_id=X` list endpoint does not exist; AgentsPage DataTable will show no data until implemented
- **All contract invariants verified**: no_composer_on_run_detail, status_pill_color_and_label, prefers_reduced_motion, keyboard_accessibility, empty_state_onboarding, auto_scroll_opt_out, adopts_wireframe_primitives
