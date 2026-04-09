"""Tests for app/config.py — Settings defaults and env overrides."""

from pathlib import Path

import pytest

from app.config import RAPID_DIR, Settings, get_settings


class TestSettingsDefaults:
    """Verify all default values match the contract."""

    def test_default_port(self):
        s = Settings()
        assert s.rapid_web_port == 9889

    def test_default_host(self):
        s = Settings()
        assert s.rapid_web_host == "127.0.0.1"

    def test_default_db_path(self):
        s = Settings()
        assert s.rapid_web_db_path == RAPID_DIR / "rapid.db"

    def test_default_log_dir(self):
        s = Settings()
        assert s.rapid_web_log_dir == RAPID_DIR / "logs"

    def test_default_log_level(self):
        s = Settings()
        assert s.rapid_web_log_level == "INFO"

    def test_default_rapid_web_disabled(self):
        s = Settings()
        assert s.rapid_web is False

    def test_default_projects_file(self):
        s = Settings()
        assert s.rapid_web_projects_file == RAPID_DIR / "projects.json"

    def test_default_sync_interval(self):
        s = Settings()
        assert s.rapid_web_sync_interval == 5.0


class TestSettingsEnvOverrides:
    """Verify env vars override defaults — each test creates a fresh Settings."""

    def test_env_override_port(self, monkeypatch):
        monkeypatch.setenv("RAPID_WEB_PORT", "9999")
        s = Settings()
        assert s.rapid_web_port == 9999

    def test_env_override_log_level(self, monkeypatch):
        monkeypatch.setenv("RAPID_WEB_LOG_LEVEL", "DEBUG")
        s = Settings()
        assert s.rapid_web_log_level == "DEBUG"

    def test_env_override_rapid_web_enabled(self, monkeypatch):
        monkeypatch.setenv("RAPID_WEB", "true")
        s = Settings()
        assert s.rapid_web is True


class TestGetSettings:
    def test_get_settings_returns_singleton(self):
        """get_settings() returns the module-level settings instance."""
        from app.config import settings as module_settings

        result = get_settings()
        assert result is module_settings
