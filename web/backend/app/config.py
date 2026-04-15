from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAPID_DIR = Path.home() / ".rapid"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    rapid_web_port: int = 9889
    rapid_web_host: str = "127.0.0.1"
    rapid_web_db_path: Path = RAPID_DIR / "rapid.db"
    rapid_web_log_dir: Path = RAPID_DIR / "logs"
    rapid_web_log_level: str = "INFO"
    rapid_web: bool = False
    rapid_web_projects_file: Path = RAPID_DIR / "projects.json"
    rapid_web_sync_interval: float = 5.0
    # CORS allow-origins for the web tier. Parsed as JSON when set via env:
    # RAPID_WEB_CORS_ALLOW_ORIGINS='["https://app.example.com","https://admin.example.com"]'
    # Note: combining allow_credentials=True with ["*"] is silently downgraded by Starlette;
    # always enumerate explicit origins when credentials are enabled.
    rapid_web_cors_allow_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]

    # --- agent runtime ---
    rapid_agent_max_concurrent: int = 3
    rapid_agent_daily_cap_usd: float = 10.0
    rapid_agent_orphan_sweep_interval_s: float = 60.0
    rapid_agent_archive_dir: Path = RAPID_DIR / "archive"
    rapid_agent_event_retention_rows: int = 50_000
    rapid_agent_event_retention_days: int = 30
    rapid_agent_ring_buffer_size: int = 1000
    rapid_agent_default_max_turns: int = 40


settings = Settings()


def get_settings() -> Settings:
    """Return the settings singleton (for FastAPI dependency injection)."""
    return settings
