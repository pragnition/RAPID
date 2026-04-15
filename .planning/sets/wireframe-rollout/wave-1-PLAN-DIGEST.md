# Wave 1 Plan Digest

**Objective:** Produce the design-system substrate (primitives library + tokens) for Waves 2/3 and downstream sets; zero feature-surface changes.
**Tasks:** 9 tasks completed (barrel scaffold, atoms, surfaces, data, chat-surface, ThemePicker, hooks, token audit, README).
**Key files:** `web/frontend/src/components/primitives/**` (23 barrel exports — atoms, surfaces, data, chat-surface primitives, ThemePicker, 2 hooks, README), `web/frontend/src/styles/global.css` (audit comment only — zero new tokens needed).
**Approach:** Eager primitive creation per CONTEXT. Tailwind arbitrary values preferred over new tokens (risk R9). Primitives purely presentational — no store/hook imports; Wave 2 wires them.
**Status:** Complete — tsc zero errors, vite build 502ms.
