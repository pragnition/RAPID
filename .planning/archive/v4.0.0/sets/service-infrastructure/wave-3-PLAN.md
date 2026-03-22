# PLAN: service-infrastructure — Wave 3 (Sync Engine & Operations)

## Objective

Implement the SyncEngine for write-through SQLite to `.rapid-web/` synchronization with bootstrap-from-disk support, and create systemd/launchd service templates. After this wave, all contract exports are delivered and the service is production-ready.

## Prerequisites

- Wave 1 complete: database models, config, logging all working
- Wave 2 complete: FastAPI app factory, health endpoints functional

## Tasks

### Task 1: Create SyncEngine

**File:** `web/backend/app/sync_engine.py`
**Action:** Implement the write-through sync engine that maintains `.rapid-web/` as a filesystem mirror of SQLite data.

**Class `SyncEngine`:**

Constructor: `__init__(self, project_path: Path, session: Session)`
- `project_path`: The project root (where `.rapid-web/` lives)
- `session`: An active SQLModel Session
- Compute `self.web_dir = project_path / ".rapid-web"`
- Create subdirectories on init: `.rapid-web/projects/`, `.rapid-web/notes/`, `.rapid-web/kanban/`
- Logger via `get_logger("sync_engine")`

**Method `sync_to_disk(self, entity_type: str, entity_id: str, data: dict) -> Path`:**
- Write a single entity to disk as JSON
- Map entity_type to subdirectory: "project" -> "projects/", "note" -> "notes/", "kanban" -> "kanban/"
- Write to `self.web_dir / subdir / f"{entity_id}.json"` with `json.dumps(data, indent=2, default=str)`
- Update the SyncState checksums for this project
- Return the path written
- Log the write at DEBUG level

**Method `sync_from_disk(self) -> dict[str, int]`:**
- Bootstrap: read all JSON files from `.rapid-web/` subdirectories and import into the database
- For each entity type subdirectory, read each `.json` file
- Parse the JSON, create the corresponding SQLModel instance, merge into session
- Use `session.merge()` (upsert semantics) to handle both new and existing records
- Return a summary dict: `{"projects": N, "notes": N, "kanban": N}` with counts imported
- Log import summary at INFO level
- This is used on first startup when `.rapid-web/` comes from a git clone but the DB is fresh

**Method `delete_from_disk(self, entity_type: str, entity_id: str) -> bool`:**
- Remove a single entity JSON file from disk
- Return True if file existed and was deleted, False if not found

**Method `compute_checksums(self) -> dict[str, str]`:**
- Walk all JSON files in `.rapid-web/` subdirectories
- Compute MD5 hash of each file's contents
- Return dict mapping relative path to hex digest
- Used by the polling change detection (consumers in other sets will call this)

**Method `needs_bootstrap(self, project_id: str) -> bool`:**
- Query `SyncState` for this project_id
- If no SyncState record exists or `last_sync_at` is None, return True
- If `.rapid-web/` directory has files but DB has no corresponding records, return True
- Otherwise return False

**Method `update_sync_state(self, project_id: str, commit_hash: str | None = None) -> None`:**
- Upsert `SyncState` record: set `last_sync_at` to now, `last_commit_hash` to commit_hash if provided
- Compute and store current checksums as JSON string

**What NOT to do:**
- Do not implement a background polling loop in this class -- that responsibility belongs to a higher-level service (project-registry set will own the FileWatcherService)
- Do not write to `.rapid-web/` from anywhere other than SyncEngine methods -- this class is the single authority
- Do not use `os.path` -- use `pathlib.Path` throughout
- Do not catch and swallow exceptions during sync -- let them propagate so callers can handle errors
- Do not implement bidirectional conflict resolution -- DB always wins (write-through pattern)

**Verification:**
```bash
cd web/backend && uv run python -c "
from app.sync_engine import SyncEngine
from app.database import get_engine, Project, SyncState
from sqlmodel import SQLModel, Session
import tempfile, json
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone

with tempfile.TemporaryDirectory() as d:
    db = Path(d) / 'test.db'
    proj_dir = Path(d) / 'myproject'
    proj_dir.mkdir()
    engine = get_engine(db)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        se = SyncEngine(proj_dir, session)

        # Test sync_to_disk
        pid = str(uuid4())
        data = {'id': pid, 'name': 'Test', 'path': '/tmp/test', 'status': 'active'}
        path = se.sync_to_disk('project', pid, data)
        assert path.exists()
        assert json.loads(path.read_text())['name'] == 'Test'

        # Test compute_checksums
        checksums = se.compute_checksums()
        assert len(checksums) == 1

        # Test needs_bootstrap
        assert se.needs_bootstrap(pid) == True

        # Test delete_from_disk
        assert se.delete_from_disk('project', pid) == True
        assert not path.exists()

    print('OK: SyncEngine working')
"
```

### Task 2: Create systemd Service Template

**File:** `web/backend/service/rapid-web.service`
**Action:** Create a systemd user unit file template.

Contents:
```ini
[Unit]
Description=RAPID Web Dashboard Service
After=network.target
Documentation=https://github.com/fishjojo1/RAPID

[Service]
Type=simple
ExecStart=%h/.local/bin/rapid-web
Environment=RAPID_WEB=true
Environment=RAPID_WEB_PORT=8998
Environment=RAPID_WEB_HOST=127.0.0.1
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

Notes:
- `%h` expands to the user's home directory in systemd user units
- This goes in `~/.config/systemd/user/` when installed (but the template lives in the repo)
- `Type=simple` because uvicorn runs in the foreground
- `Restart=on-failure` with 5s delay for resilience
- The ExecStart path assumes the package is installed via `uv tool install` or `pipx`

**Verification:**
```bash
test -f web/backend/service/rapid-web.service && grep -q "ExecStart" web/backend/service/rapid-web.service && echo "OK: systemd unit exists"
```

### Task 3: Create launchd plist Template

**File:** `web/backend/service/com.rapid.web.plist`
**Action:** Create a macOS launchd plist template.

Contents:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rapid.web</string>
    <key>ProgramArguments</key>
    <array>
        <string>__RAPID_WEB_BIN__</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>RAPID_WEB</key>
        <string>true</string>
        <key>RAPID_WEB_PORT</key>
        <string>8998</string>
        <key>RAPID_WEB_HOST</key>
        <string>127.0.0.1</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>__HOME__/.rapid/logs/rapid-web-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>__HOME__/.rapid/logs/rapid-web-stderr.log</string>
</dict>
</plist>
```

Notes:
- `__RAPID_WEB_BIN__` and `__HOME__` are placeholders to be replaced during installation by the CLI integration set
- `KeepAlive` with `SuccessfulExit=false` restarts on crash but not on clean exit
- This goes in `~/Library/LaunchAgents/` when installed

**Verification:**
```bash
test -f web/backend/service/com.rapid.web.plist && grep -q "com.rapid.web" web/backend/service/com.rapid.web.plist && echo "OK: launchd plist exists"
```

## File Ownership Summary

| File | Action |
|------|--------|
| `web/backend/app/sync_engine.py` | Create |
| `web/backend/service/rapid-web.service` | Create |
| `web/backend/service/com.rapid.web.plist` | Create |

## Success Criteria

1. SyncEngine writes entity JSON files to `.rapid-web/` subdirectories
2. SyncEngine reads from `.rapid-web/` and imports into database (bootstrap)
3. SyncEngine computes file checksums for change detection
4. SyncEngine tracks sync state per project
5. systemd unit template has correct ExecStart, restart policy, and environment
6. launchd plist template has correct label, keep-alive, and log paths
7. All contract exports from this set are now implemented and importable
