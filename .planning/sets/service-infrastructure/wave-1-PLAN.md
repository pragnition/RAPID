# PLAN: service-infrastructure — Wave 1 (Foundation)

## Objective

Establish the Python project structure, configuration system, structured logging, database engine with WAL mode, and Alembic migration infrastructure with the initial schema. After this wave, the database is operational and all subsequent waves can import `config`, `database`, and `logging_config` modules.

## Prerequisites

- Python 3.12+ available on system
- `uv` package manager installed (confirmed v0.10.3)

## Tasks

### Task 1: Create pyproject.toml

**File:** `web/backend/pyproject.toml`
**Action:** Create the Python project manifest with all dependencies.

- Project name: `rapid-web`
- `requires-python = ">=3.12"`
- Dependencies:
  - `fastapi[standard]>=0.135,<1.0`
  - `sqlmodel>=0.0.37,<1.0`
  - `alembic>=1.18,<2.0`
  - `pydantic-settings>=2.13,<3.0`
  - `python-json-logger>=3.0,<4.0`
  - `uvicorn[standard]>=0.34,<1.0`
- Dev dependencies group `[dependency-groups]`:
  - `dev = ["pytest>=8.0", "httpx>=0.28", "pytest-asyncio>=0.25", "ruff>=0.11"]`
- Entry point script: `rapid-web = "app.main:cli_entry"` (under `[project.scripts]`)
- Include `[tool.ruff]` section with `line-length = 100`, `target-version = "py312"`

**Verification:**
```bash
cd web/backend && uv sync --frozen 2>&1 | tail -5
```

### Task 2: Create app/__init__.py

**File:** `web/backend/app/__init__.py`
**Action:** Create package init with version constant.

- Define `__version__ = "4.0.0"`
- No other exports -- individual modules are imported directly

**Verification:**
```bash
cd web/backend && uv run python -c "from app import __version__; print(__version__)"
```

### Task 3: Create config.py

**File:** `web/backend/app/config.py`
**Action:** Create Pydantic Settings configuration class.

- Import from `pydantic_settings.BaseSettings`
- Class `Settings(BaseSettings)` with fields:
  - `rapid_web_port: int = 8998`
  - `rapid_web_host: str = "127.0.0.1"`
  - `rapid_web_db_path: Path = Path("~/.rapid/rapid.db").expanduser()`
  - `rapid_web_log_dir: Path = Path("~/.rapid/logs").expanduser()`
  - `rapid_web_log_level: str = "INFO"`
  - `rapid_web: bool = False` (feature gate)
  - `rapid_web_projects_file: Path = Path("~/.rapid/projects.json").expanduser()`
  - `rapid_web_sync_interval: float = 5.0` (seconds between sync polls)
- Use `model_config = SettingsConfigDict(env_prefix="", env_file=".env")` -- no prefix since field names already include `RAPID_WEB_` prefix naturally via the field names. Actually, since Pydantic Settings maps env vars to field names case-insensitively, the field names themselves act as the env var names. Set `model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)`
- Add a module-level `settings` singleton: `settings = Settings()`
- Add a `get_settings()` function that returns the singleton (for FastAPI dependency injection)

**Important:** The `rapid_web_db_path` default must call `.expanduser()` at class definition time. Use `Path.home() / ".rapid" / "rapid.db"` instead of `Path("~/.rapid/rapid.db").expanduser()` to avoid expansion issues in default values. Use `default_factory` or compute in a validator if needed -- but the simplest approach is:
```python
from pathlib import Path
RAPID_DIR = Path.home() / ".rapid"

class Settings(BaseSettings):
    rapid_web_port: int = 8998
    rapid_web_host: str = "127.0.0.1"
    rapid_web_db_path: Path = RAPID_DIR / "rapid.db"
    rapid_web_log_dir: Path = RAPID_DIR / "logs"
    ...
```

**Verification:**
```bash
cd web/backend && uv run python -c "from app.config import settings; print(settings.rapid_web_port, settings.rapid_web_db_path)"
```

### Task 4: Create logging_config.py

**File:** `web/backend/app/logging_config.py`
**Action:** Create structured JSON logging with file rotation.

- Use `python_json_logger.json.JsonFormatter` (v3.x API)
- Function `setup_logging(log_dir: Path, level: str = "INFO") -> None`:
  - Create `log_dir` if it doesn't exist (`log_dir.mkdir(parents=True, exist_ok=True)`)
  - Configure root logger with two handlers:
    1. `RotatingFileHandler` writing to `log_dir / "rapid-web.log"`, maxBytes=10MB, backupCount=5, JSON formatted
    2. `StreamHandler` to stderr with a simple human-readable format for development
  - Set log level from `level` parameter
  - Suppress noisy loggers: `uvicorn.access` set to WARNING
- Function `get_logger(name: str) -> logging.Logger`:
  - Returns `logging.getLogger(f"rapid.{name}")`
  - This is the exported contract function `structured_logger`

**Verification:**
```bash
cd web/backend && uv run python -c "
from app.logging_config import setup_logging, get_logger
from pathlib import Path
import tempfile, json
with tempfile.TemporaryDirectory() as d:
    setup_logging(Path(d))
    log = get_logger('test')
    log.info('hello', extra={'key': 'value'})
    content = open(Path(d) / 'rapid-web.log').read()
    parsed = json.loads(content)
    assert 'message' in parsed
    print('OK:', parsed)
"
```

### Task 5: Create database.py

**File:** `web/backend/app/database.py`
**Action:** Create SQLite engine with WAL mode and session management.

- Import `sqlmodel`, `sqlalchemy.event`
- Define the naming convention dict for Alembic batch mode:
  ```python
  convention = {
      "ix": "ix_%(column_0_label)s",
      "uq": "uq_%(table_name)s_%(column_0_name)s",
      "ck": "ck_%(table_name)s_%(constraint_name)s",
      "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
      "pk": "pk_%(table_name)s",
  }
  ```
- Apply to metadata: `SQLModel.metadata.naming_convention = convention`
- Define all SQLModel table classes in this file (they must be imported before Alembic runs):
  - `Project(SQLModel, table=True)`: id (uuid, pk), name (str), path (str, unique), registered_at (datetime), last_seen_commit (str, nullable), status (str, default="active")
  - `Note(SQLModel, table=True)`: id (uuid, pk), project_id (uuid, FK to project.id), title (str), content (str, default=""), created_at (datetime), updated_at (datetime)
  - `KanbanItem(SQLModel, table=True)`: id (uuid, pk), project_id (uuid, FK to project.id), title (str), description (str, default=""), status (str, default="backlog"), position (int, default=0), created_at (datetime), updated_at (datetime)
  - `SyncState(SQLModel, table=True)`: id (int, pk, autoincrement), project_id (uuid, FK to project.id, unique), last_sync_at (datetime, nullable), last_commit_hash (str, nullable), file_checksums (str, default="{}") -- JSON string of filename->hash
  - `AppConfig(SQLModel, table=True)`: key (str, pk), value (str), updated_at (datetime)
- Use `uuid4` for default id generation via `Field(default_factory=uuid4)`
- Use `datetime.utcnow` for timestamp defaults (via `default_factory`)
- Function `get_engine(db_path: Path | None = None) -> Engine`:
  - If `db_path` is None, use `settings.rapid_web_db_path`
  - Create parent directory: `db_path.parent.mkdir(parents=True, exist_ok=True)`
  - Create engine: `create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False}, pool_pre_ping=True)`
  - Register SQLAlchemy event listener for `"connect"` event to set WAL mode and busy_timeout pragmas
  - Return engine
- Function `get_session(engine: Engine | None = None) -> Generator[Session, None, None]`:
  - If engine is None, create one via `get_engine()`
  - Yield `Session(engine)` in a context manager pattern
  - This is a generator for use as a FastAPI `Depends()` dependency
- Module-level `_engine: Engine | None = None` cache with `get_engine()` populating it on first call

**What NOT to do:**
- Do not set pragmas at engine creation time -- they must be set via the `event.listens_for` pattern on each connection
- Do not use `from sqlmodel import Field` with `sa_column` for simple fields -- use the `Field()` kwargs directly
- Do not forget `check_same_thread=False` -- SQLite default blocks multi-thread access which FastAPI requires

**Verification:**
```bash
cd web/backend && uv run python -c "
from app.database import get_engine, get_session, Project, Note, KanbanItem, SyncState, AppConfig
from sqlmodel import SQLModel
import tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as d:
    db = Path(d) / 'test.db'
    engine = get_engine(db)
    SQLModel.metadata.create_all(engine)
    # Verify WAL mode
    import sqlalchemy
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text('PRAGMA journal_mode')).scalar()
        assert result == 'wal', f'Expected wal, got {result}'
    print('OK: WAL mode confirmed, all tables created')
"
```

### Task 6: Scaffold Alembic and Create Initial Migration

**Files:**
- `web/backend/alembic.ini`
- `web/backend/alembic/__init__.py` (empty)
- `web/backend/alembic/env.py`
- `web/backend/alembic/script.py.mako`
- `web/backend/alembic/versions/` (directory)
- `web/backend/alembic/versions/0001_initial_schema.py` (initial migration)

**Action:**

First, scaffold Alembic using `uv run alembic init alembic` from `web/backend/`, then customize:

**alembic.ini:** Set `sqlalchemy.url = sqlite:///%(RAPID_WEB_DB_PATH)s` -- but actually, the URL will be set programmatically in env.py, so leave the default or set a placeholder. The important setting is `script_location = alembic`.

**alembic/env.py:** Customize the generated env.py:
- Import `from app.database import SQLModel` (to get all model metadata)
- Import `from app.config import settings`
- Set `target_metadata = SQLModel.metadata`
- In `run_migrations_online()`, construct the engine URL from `settings.rapid_web_db_path`
- Enable `render_as_batch=True` in `context.configure()` -- critical for SQLite ALTER TABLE support
- In `run_migrations_offline()`, also use settings for URL and enable `render_as_batch=True`

**Initial migration** (`alembic/versions/0001_initial_schema.py`):
- Use Alembic revision format with a descriptive message: "initial schema"
- Create all 5 tables: project, note, kanbanitem, syncstate, appconfig
- Match the SQLModel definitions exactly (column types, constraints, defaults)
- Include downgrade that drops all tables in reverse dependency order

**Function `run_migrations(engine: Engine) -> None`** -- add to `database.py`:
- Uses `alembic.config.Config` and `alembic.command.upgrade`
- Points config at the alembic.ini relative to the package
- Runs `upgrade("head")`
- This is the contract export

**Verification:**
```bash
cd web/backend && uv run python -c "
from app.database import get_engine, run_migrations
import tempfile
from pathlib import Path
with tempfile.TemporaryDirectory() as d:
    db = Path(d) / 'test.db'
    engine = get_engine(db)
    run_migrations(engine)
    import sqlalchemy
    with engine.connect() as conn:
        tables = conn.execute(sqlalchemy.text(\"SELECT name FROM sqlite_master WHERE type='table'\")).fetchall()
        table_names = [t[0] for t in tables]
        print('Tables:', table_names)
        assert 'project' in table_names
        assert 'note' in table_names
        assert 'alembic_version' in table_names
    print('OK: migrations applied successfully')
"
```

## File Ownership Summary

| File | Action |
|------|--------|
| `web/backend/pyproject.toml` | Create |
| `web/backend/app/__init__.py` | Create |
| `web/backend/app/config.py` | Create |
| `web/backend/app/logging_config.py` | Create |
| `web/backend/app/database.py` | Create |
| `web/backend/alembic.ini` | Create |
| `web/backend/alembic/__init__.py` | Create |
| `web/backend/alembic/env.py` | Create |
| `web/backend/alembic/script.py.mako` | Create |
| `web/backend/alembic/versions/0001_initial_schema.py` | Create |

## Success Criteria

1. `uv sync` completes without errors in `web/backend/`
2. All SQLModel classes importable and create valid tables
3. SQLite engine uses WAL mode (verified via PRAGMA query)
4. Alembic migration runs to head and creates all 5 tables
5. Structured JSON logging writes to a file with rotation
6. Settings load from environment variables correctly
