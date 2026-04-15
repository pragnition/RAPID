# Wave 3 Plan Digest

**Objective:** Wire up two new REST endpoints (code-graph and file-content), implement path-traversal security, add integration and unit tests, and document deferred polling interval task.
**Tasks:** 7 tasks completed
**Key files:** web/backend/app/routers/views.py, web/backend/tests/test_views_api.py, web/backend/tests/test_codebase_service.py, .planning/sets/code-graph-backend/DEFERRED.md
**Approach:** Added GET /api/projects/{id}/code-graph endpoint using get_codebase_graph() service. Added GET /api/projects/{id}/file endpoint with 6-layer path traversal security (reject .., resolve+validate, reject symlinks, check existence, size limit, binary detection). Added 21 tests: 5 code-graph integration, 8 file endpoint integration (including security tests), 8 import extraction/resolution unit tests. Documented polling interval deferral.
**Status:** Complete
