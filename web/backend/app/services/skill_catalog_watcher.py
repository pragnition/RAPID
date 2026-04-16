"""SkillCatalogWatcher -- filesystem watcher that hot-reloads the skill catalog on SKILL.md changes.

Mirrors the structure of app/services/file_watcher.py with a coalescing timer
to debounce rapid filesystem events.
"""

import logging
import threading
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from watchdog.observers.api import BaseObserver

from app.services.skill_catalog_service import SkillCatalogService

logger = logging.getLogger(__name__)

_COALESCE_SECONDS = 0.5


class _CatalogEventHandler(FileSystemEventHandler):
    """Watchdog handler that triggers a debounced catalog reload on SKILL.md changes."""

    def __init__(self, skills_root: Path, service: SkillCatalogService) -> None:
        super().__init__()
        self._skills_root = skills_root
        self._service = service
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def _schedule_reload(self) -> None:
        """Cancel any pending timer and schedule a new coalesced reload."""
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(_COALESCE_SECONDS, self._do_reload)
            self._timer.daemon = True
            self._timer.start()

    def _do_reload(self) -> None:
        """Execute the catalog reload (runs on timer thread)."""
        logger.info("SKILL.md change detected, reloading catalog")
        try:
            self._service.reload(self._skills_root)
        except Exception:
            logger.error("Error reloading skill catalog", exc_info=True)

    def on_modified(self, event) -> None:  # noqa: D401
        if not event.is_directory and event.src_path.endswith("SKILL.md"):
            self._schedule_reload()

    def on_created(self, event) -> None:  # noqa: D401
        if not event.is_directory and event.src_path.endswith("SKILL.md"):
            self._schedule_reload()

    def on_moved(self, event) -> None:  # noqa: D401
        src = getattr(event, "src_path", "")
        dest = getattr(event, "dest_path", "")
        if src.endswith("SKILL.md") or dest.endswith("SKILL.md"):
            self._schedule_reload()

    def on_deleted(self, event) -> None:  # noqa: D401
        if not event.is_directory and event.src_path.endswith("SKILL.md"):
            self._schedule_reload()


def create_catalog_observer(
    skills_root: Path, service: SkillCatalogService
) -> BaseObserver:
    """Create a watchdog observer for SKILL.md files under *skills_root*.

    Prefers the native Observer; falls back to PollingObserver on exception.
    Schedules the handler on skills_root and every immediate subdirectory
    (since SKILL.md lives one level down).  Returns the observer without
    starting it.
    """
    handler = _CatalogEventHandler(skills_root, service)

    try:
        observer: BaseObserver = Observer()
    except Exception:
        logger.warning("Native observer unavailable, falling back to PollingObserver")
        from watchdog.observers.polling import PollingObserver
        observer = PollingObserver(timeout=5)

    # Schedule on each immediate subdirectory (non-recursive) so we catch
    # modifications to skills/<name>/SKILL.md without watching the entire tree.
    for child in sorted(skills_root.iterdir()):
        if child.is_dir():
            observer.schedule(handler, str(child), recursive=False)

    return observer


class SkillCatalogWatcher:
    """Wraps the observer with start/stop lifecycle (mirrors FileWatcherService)."""

    def __init__(self, skills_root: Path, service: SkillCatalogService) -> None:
        self._observer = create_catalog_observer(skills_root, service)

    def start(self) -> None:
        """Start the filesystem observer."""
        self._observer.start()
        logger.info("SkillCatalogWatcher started")

    def stop(self) -> None:
        """Stop the filesystem observer and wait for its thread to join."""
        self._observer.stop()
        self._observer.join(timeout=10)
        logger.info("SkillCatalogWatcher stopped")
