from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAPID_DIR = Path.home() / ".rapid"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    rapid_web_port: int = 8998
    rapid_web_host: str = "127.0.0.1"
    rapid_web_db_path: Path = RAPID_DIR / "rapid.db"
    rapid_web_log_dir: Path = RAPID_DIR / "logs"
    rapid_web_log_level: str = "INFO"
    rapid_web: bool = False
    rapid_web_projects_file: Path = RAPID_DIR / "projects.json"
    rapid_web_sync_interval: float = 5.0


settings = Settings()


def get_settings() -> Settings:
    """Return the settings singleton (for FastAPI dependency injection)."""
    return settings
