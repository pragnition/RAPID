import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from pythonjsonlogger.json import JsonFormatter

from app.agents.correlation import RunIdLogFilter


def setup_logging(log_dir: Path, level: str = "INFO") -> None:
    """Configure structured JSON logging with file rotation and stderr output.

    Handlers are attached to the ``rapid`` namespace logger rather than
    root so that uvicorn's ``--reload`` log reconfiguration cannot clobber
    them.  Propagation is disabled on ``rapid`` to avoid double-logging
    through root handlers that uvicorn may install.
    """
    log_dir.mkdir(parents=True, exist_ok=True)

    resolved_level = getattr(logging, level.upper(), logging.INFO)

    # Use the ``rapid`` namespace logger — all get_logger() callers are
    # children of this logger, so propagation carries messages here.
    ns = logging.getLogger("rapid")
    ns.setLevel(resolved_level)
    ns.propagate = False  # don't double-log through root

    # Clear existing handlers to avoid duplicates on re-init
    ns.handlers.clear()

    run_id_filter = RunIdLogFilter()

    # JSON file handler with rotation
    file_handler = RotatingFileHandler(
        log_dir / "rapid-web.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
    )
    file_handler.setFormatter(JsonFormatter("%(asctime)s %(name)s %(levelname)s %(run_id)s %(message)s"))
    file_handler.addFilter(run_id_filter)

    # Human-readable stderr handler for development
    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-8s %(name)s [run=%(run_id)s] — %(message)s")
    )
    stream_handler.addFilter(run_id_filter)

    ns.addHandler(file_handler)
    ns.addHandler(stream_handler)

    # Re-enable any ``rapid.*`` loggers that were disabled by a prior
    # logging.config.fileConfig / dictConfig call (e.g. alembic migrations
    # set disable_existing_loggers=True which silently disables loggers
    # created before the config runs).
    for name, lgr in logging.Logger.manager.loggerDict.items():
        if isinstance(lgr, logging.Logger) and name.startswith("rapid"):
            lgr.disabled = False

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger (structured_logger contract)."""
    return logging.getLogger(f"rapid.{name}")
