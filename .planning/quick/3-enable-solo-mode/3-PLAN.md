# Plan: Enable Solo Mode

## Objective
Add `"solo": true` as a top-level key in `.planning/config.json` to put the project into solo mode.

## Task 1: Add solo key to config.json

- **Files**: `.planning/config.json`
- **Action**: Add `"solo": true` as a top-level key in the JSON object. Place it after the `"model"` key and before the `"planning"` key for logical grouping (project metadata, then mode flags, then planning config). The resulting file must be valid JSON with consistent 2-space indentation.
- **Expected result**:
  ```json
  {
    "project": {
      "name": "RAPID",
      "version": "4.0.0"
    },
    "model": "opus",
    "solo": true,
    "planning": {
      "max_parallel_sets": 3
    }
  }
  ```
- **Verification**:
  ```bash
  node -e "const c = require('./.planning/config.json'); if (c.solo !== true) { console.error('FAIL: solo is not true'); process.exit(1); } console.log('PASS: solo mode enabled');"
  ```
- **Done when**: `node -e "console.log(require('./.planning/config.json').solo)"` prints `true`.
