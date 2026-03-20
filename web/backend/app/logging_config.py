import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from pythonjsonlogger.json import JsonFormatter


def setup_logging(log_dir: Path, level: str = "INFO") -> None:
    """Configure structured JSON logging with file rotation and stderr output."""
    log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Clear existing handlers to avoid duplicates on re-init
    root.handlers.clear()

    # JSON file handler with rotation
    file_handler = RotatingFileHandler(
        log_dir / "rapid-web.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
    )
    file_handler.setFormatter(JsonFormatter())
    root.addHandler(file_handler)

    # Human-readable stderr handler for development
    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-8s %(name)s — %(message)s")
    )
    root.addHandler(stream_handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger (structured_logger contract)."""
    return logging.getLogger(f"rapid.{name}")
