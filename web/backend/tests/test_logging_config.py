"""Tests for app/logging_config.py — logging setup and logger factory."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import pytest
from pythonjsonlogger.json import JsonFormatter

from app.logging_config import get_logger, setup_logging


@pytest.fixture(autouse=True)
def _clean_root_logger():
    """Save and restore root logger state around every test."""
    root = logging.getLogger()
    original_level = root.level
    original_handlers = root.handlers[:]
    yield
    root.handlers = original_handlers
    root.setLevel(original_level)


class TestSetupLogging:
    def test_creates_log_dir(self, tmp_path: Path):
        log_dir = tmp_path / "nested" / "logs"
        setup_logging(log_dir)
        assert log_dir.is_dir()

    def test_creates_file_handler(self, tmp_path: Path):
        setup_logging(tmp_path)
        root = logging.getLogger()
        file_handlers = [h for h in root.handlers if isinstance(h, RotatingFileHandler)]
        assert len(file_handlers) == 1

    def test_creates_stream_handler(self, tmp_path: Path):
        setup_logging(tmp_path)
        root = logging.getLogger()
        stream_handlers = [
            h
            for h in root.handlers
            if isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler)
        ]
        assert len(stream_handlers) == 1

    def test_file_handler_rotation_config(self, tmp_path: Path):
        setup_logging(tmp_path)
        root = logging.getLogger()
        fh = next(h for h in root.handlers if isinstance(h, RotatingFileHandler))
        assert fh.maxBytes == 10 * 1024 * 1024
        assert fh.backupCount == 5

    def test_sets_root_level(self, tmp_path: Path):
        setup_logging(tmp_path, level="DEBUG")
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_invalid_level_falls_back_to_info(self, tmp_path: Path):
        setup_logging(tmp_path, level="BOGUS")
        root = logging.getLogger()
        assert root.level == logging.INFO

    def test_clears_existing_handlers(self, tmp_path: Path):
        root = logging.getLogger()
        root.addHandler(logging.StreamHandler())
        root.addHandler(logging.StreamHandler())
        assert len(root.handlers) >= 2
        setup_logging(tmp_path)
        # After setup: exactly 1 file + 1 stream = 2 handlers
        assert len(root.handlers) == 2

    def test_suppresses_uvicorn_access(self, tmp_path: Path):
        setup_logging(tmp_path)
        uvicorn_access = logging.getLogger("uvicorn.access")
        assert uvicorn_access.level == logging.WARNING


class TestGetLogger:
    def test_namespace(self):
        log = get_logger("test_module")
        assert log.name == "rapid.test_module"

    def test_log_file_json_format(self, tmp_path: Path):
        setup_logging(tmp_path)
        root = logging.getLogger()
        fh = next(h for h in root.handlers if isinstance(h, RotatingFileHandler))
        assert isinstance(fh.formatter, JsonFormatter)
