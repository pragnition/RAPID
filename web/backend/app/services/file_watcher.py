"""FileWatcherService — monitors .planning/ directories for registered projects.

Watches STATE.json and REGISTRY.json for changes and updates the database accordingly.
Falls back from inotify to polling if OS limits are exhausted.
"""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import sqlalchemy
from sqlmodel import Session, select

from app.database import Project

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _PlanningEventHandler:
    """Watchdog event handler that filters for STATE.json and REGISTRY.json changes."""

    def __init__(self, watcher: "FileWatcherService"):
        self._watcher = watcher

    def dispatch(self, event):
        """Called by watchdog for all events — we filter and delegate."""
        if event.is_directory:
            return
        # Only react to modifications and creations
        if event.event_type not in ("modified", "created"):
            return
        src = getattr(event, "src_path", None)
        if src is None:
            return
        filename = Path(src).name
        if filename in ("STATE.json", "REGISTRY.json"):
            self._watcher._on_file_changed(event)


class FileWatcherService:
    """Watches .planning/ directories for registered projects and syncs DB on changes."""

    def __init__(self, engine: sqlalchemy.Engine):
        self._engine = engine
        self._lock = threading.Lock()
        # project_id -> (watch_handle, project_path)
        self._watches: dict[UUID, tuple[object, str]] = {}
        self._observer = None
        self._handler = _PlanningEventHandler(self)
        self._use_polling = False

    def _create_observer(self, polling: bool = False):
        """Create an observer, with optional polling fallback."""
        if polling:
            from watchdog.observers.polling import PollingObserver
            return PollingObserver(timeout=5)
        try:
            from watchdog.observers import Observer
            return Observer()
        except OSError:
            logger.warning("Native observer unavailable, falling back to PollingObserver")
            self._use_polling = True
            from watchdog.observers.polling import PollingObserver
            return PollingObserver(timeout=5)

    def start(self) -> None:
        """Load active projects from DB, schedule watches, start the observer."""
        self._observer = self._create_observer(polling=self._use_polling)
        # Load all active projects
        with Session(self._engine) as session:
            projects = list(session.exec(
                select(Project).where(Project.status != "deregistered")
            ).all())

        for project in projects:
            self._schedule_watch(project.id, project.path)

        self._observer.start()
        logger.info("FileWatcherService started, watching %d projects", len(self._watches))

    def stop(self) -> None:
        """Stop the observer and join its thread."""
        if self._observer is not None:
            self._observer.stop()
            self._observer.join(timeout=10)
            logger.info("FileWatcherService stopped")

    def add_project(self, project_id: UUID, project_path: str) -> None:
        """Schedule a watch for a newly registered project."""
        self._schedule_watch(project_id, project_path)

    def remove_project(self, project_id: UUID) -> None:
        """Unschedule the watch for a deregistered project."""
        with self._lock:
            entry = self._watches.pop(project_id, None)
        if entry is not None and self._observer is not None:
            watch_handle, _ = entry
            try:
                self._observer.unschedule(watch_handle)
            except Exception:
                logger.debug("Failed to unschedule watch for project %s", project_id)

    def _schedule_watch(self, project_id: UUID, project_path: str) -> None:
        """Schedule a watchdog watch for a project's .planning/ directory."""
        planning_dir = Path(project_path) / ".planning"
        if not planning_dir.is_dir():
            logger.warning(
                "Cannot watch project %s: %s does not exist", project_id, planning_dir
            )
            return

        if self._observer is None:
            return

        try:
            handle = self._observer.schedule(
                self._handler, str(planning_dir), recursive=False
            )
        except OSError:
            # inotify limit hit — switch everything to polling
            logger.warning(
                "OSError scheduling watch for %s, switching to PollingObserver", project_id
            )
            self._switch_to_polling()
            try:
                handle = self._observer.schedule(
                    self._handler, str(planning_dir), recursive=False
                )
            except Exception:
                logger.error("Failed to schedule polling watch for %s", project_id)
                return

        with self._lock:
            self._watches[project_id] = (handle, project_path)

    def _switch_to_polling(self) -> None:
        """Switch from native observer to PollingObserver, re-scheduling all watches."""
        old_observer = self._observer
        was_alive = old_observer is not None and old_observer.is_alive()

        if was_alive:
            try:
                old_observer.stop()
                old_observer.join(timeout=5)
            except Exception:
                pass

        from watchdog.observers.polling import PollingObserver
        self._observer = PollingObserver(timeout=5)
        self._use_polling = True

        # Re-schedule existing watches
        with self._lock:
            old_watches = dict(self._watches)
            self._watches.clear()

        for pid, (_, ppath) in old_watches.items():
            planning_dir = Path(ppath) / ".planning"
            if planning_dir.is_dir():
                try:
                    handle = self._observer.schedule(
                        self._handler, str(planning_dir), recursive=False
                    )
                    with self._lock:
                        self._watches[pid] = (handle, ppath)
                except Exception:
                    logger.error("Failed to re-schedule watch for project %s", pid)

        if was_alive:
            self._observer.start()

    def _on_file_changed(self, event) -> None:
        """Handle a file change event — update the DB for the affected project."""
        try:
            changed_path = Path(event.src_path)
            planning_dir = changed_path.parent

            # Find which project this belongs to
            project_id = None
            project_path = None
            with self._lock:
                for pid, (_, ppath) in self._watches.items():
                    if Path(ppath) / ".planning" == planning_dir:
                        project_id = pid
                        project_path = ppath
                        break

            if project_id is None:
                return

            # Check if project directory still exists
            if not Path(project_path).exists():
                with Session(self._engine) as session:
                    from app.services.project_service import mark_unreachable
                    mark_unreachable(session, project_id)
                return

            # Parse STATE.json and update metadata
            if changed_path.name == "STATE.json":
                self._update_from_state_json(project_id, project_path)

        except Exception:
            logger.error(
                "Error in file watcher callback for %s",
                getattr(event, "src_path", "unknown"),
                exc_info=True,
            )

    def _update_from_state_json(self, project_id: UUID, project_path: str) -> None:
        """Read STATE.json and update the project's metadata in the DB."""
        state_file = Path(project_path) / ".planning" / "STATE.json"
        try:
            raw = state_file.read_text(encoding="utf-8")
            data = json.loads(raw)
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            return

        from app.services.project_service import parse_state_json
        parsed = parse_state_json(Path(project_path))
        metadata = json.dumps(parsed) if parsed else "{}"

        with Session(self._engine) as session:
            project = session.get(Project, project_id)
            if project is not None:
                project.metadata_json = metadata
                project.last_seen_at = _utcnow()
                session.add(project)
                session.commit()
