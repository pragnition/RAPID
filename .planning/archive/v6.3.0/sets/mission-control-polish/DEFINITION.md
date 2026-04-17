# Set: mission-control-polish

**Created:** 2026-04-09 (via /add-set)
**Milestone:** v6.3.0

## Scope
Fix multiple visual and functional issues in the Mission Control web dashboard:
1. Bad color schemes on graphs (poor contrast, ugly palette)
2. Bad default zoom level on graph views
3. Poor syntax highlighting quality
4. Set DAG visualization broken — returns "Failed to load DAG data. Check that the backend is running and try again."

## Key Deliverables
- Improved graph color scheme with better contrast and aesthetics
- Sensible default zoom level for graph views
- Better syntax highlighting theme/implementation
- Working set DAG endpoint and visualization

## Dependencies
None

## Files and Areas
- `web/frontend/` — React frontend components for graph rendering, syntax highlighting, zoom controls
- `web/backend/` — DAG data endpoint that's returning errors
