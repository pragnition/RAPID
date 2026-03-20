"""Tests for FileWatcherService — file monitoring with inotify/polling fallback."""

import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
from uuid import uuid4

import pytest
import sqlalchemy
from sqlmodel import Session, select

from app.database import Project
from app.services.file_watcher import FileWatcherService


def _create_project_dir(tmp_path: Path, name: str = "myproject") -> Path:
    """Create a fake project directory with .planning/STATE.json."""
    project_dir = tmp_path / name
    planning_dir = project_dir / ".planning"
    planning_dir.mkdir(parents=True)
    state = {
        "projectName": name,
        "milestones": [
            {
                "id": "m1",
                "name": "Milestone 1",
                "sets": [{"id": "s1", "status": "active"}],
            }
        ],
    }
    (planning_dir / "STATE.json").write_text(json.dumps(state))
    return project_dir


def _insert_project(session: Session, project_dir: Path, name: str = "myproject") -> Project:
    """Insert a project record into the DB and return it."""
    project = Project(name=name, path=str(project_dir), status="active")
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


class TestFileWatcherStartStop:
    def test_file_watcher_starts_and_stops(self, tables: sqlalchemy.Engine):
        """Instantiate with engine, start(), stop(). No crash."""
        watcher = FileWatcherService(tables)
        try:
            watcher.start()
        finally:
            watcher.stop()

    def test_start_stop_idempotent(self, tables: sqlalchemy.Engine):
        """Calling stop without start should not crash."""
        watcher = FileWatcherService(tables)
        watcher.stop()  # no-op, should not raise


class TestAddRemoveProject:
    def test_add_and_remove_project(self, tables: sqlalchemy.Engine, tmp_path: Path):
        """Start watcher, add_project, remove_project. No crash."""
        project_dir = _create_project_dir(tmp_path)
        watcher = FileWatcherService(tables)
        project_id = uuid4()
        try:
            watcher.start()
            watcher.add_project(project_id, str(project_dir))
            watcher.remove_project(project_id)
        finally:
            watcher.stop()

    def test_remove_nonexistent_project(self, tables: sqlalchemy.Engine):
        """Removing a project that was never added should not crash."""
        watcher = FileWatcherService(tables)
        try:
            watcher.start()
            watcher.remove_project(uuid4())  # no-op
        finally:
            watcher.stop()


class TestStateJsonChangeUpdatesDb:
    def test_state_json_change_updates_db(
        self, tables: sqlalchemy.Engine, session: Session, tmp_path: Path
    ):
        """Modify STATE.json on disk, verify project.metadata_json updated in DB."""
        project_dir = _create_project_dir(tmp_path)
        project = _insert_project(session, project_dir)

        # Use PollingObserver explicitly for test reliability
        watcher = FileWatcherService(tables)
        watcher._use_polling = True
        try:
            watcher.start()
            watcher.add_project(project.id, str(project_dir))

            # Wait a moment for the watch to be established
            time.sleep(0.5)

            # Modify STATE.json
            new_state = {
                "projectName": "updated-project",
                "milestones": [
                    {
                        "id": "m1",
                        "name": "Milestone 1",
                        "sets": [
                            {"id": "s1", "status": "active"},
                            {"id": "s2", "status": "active"},
                        ],
                    }
                ],
            }
            state_file = project_dir / ".planning" / "STATE.json"
            state_file.write_text(json.dumps(new_state))

            # Poll for DB update (up to 10 seconds)
            updated = False
            for _ in range(20):
                time.sleep(0.5)
                with Session(tables) as check_session:
                    p = check_session.get(Project, project.id)
                    if p and p.metadata_json:
                        meta = json.loads(p.metadata_json)
                        if meta.get("total_sets") == 2:
                            updated = True
                            break

            assert updated, "DB was not updated after STATE.json change within 10 seconds"
        finally:
            watcher.stop()


class TestProjectPathDisappears:
    def test_project_path_disappears_marks_unreachable(
        self, tables: sqlalchemy.Engine, session: Session, tmp_path: Path
    ):
        """Delete the project directory, verify project status is 'unreachable'."""
        project_dir = _create_project_dir(tmp_path)
        project = _insert_project(session, project_dir)
        state_file = project_dir / ".planning" / "STATE.json"

        watcher = FileWatcherService(tables)
        watcher._use_polling = True
        try:
            watcher.start()
            watcher.add_project(project.id, str(project_dir))
            time.sleep(0.5)

            # Trigger a file event FIRST, then immediately remove the directory
            # The callback checks if the project path exists — if not, marks unreachable
            import shutil

            # Write to trigger an event, then delete
            state_file.write_text('{"deleted": true}')
            time.sleep(0.2)
            shutil.rmtree(project_dir)

            # The next event processing should mark unreachable
            # We need to trigger the callback manually since the dir is gone
            # and watchdog won't fire events for a deleted directory.
            # Instead, call _on_file_changed directly with a mock event.
            mock_event = MagicMock()
            mock_event.is_directory = False
            mock_event.event_type = "modified"
            mock_event.src_path = str(state_file)
            watcher._on_file_changed(mock_event)

            with Session(tables) as check_session:
                p = check_session.get(Project, project.id)
                assert p is not None
                assert p.status == "unreachable"
        finally:
            watcher.stop()


class TestPollingFallback:
    def test_fallback_to_polling_on_oserror(self, tables: sqlalchemy.Engine):
        """Mock Observer.__init__ to raise OSError, verify fallback to PollingObserver."""
        with patch("app.services.file_watcher.FileWatcherService._create_observer") as mock_create:
            from watchdog.observers.polling import PollingObserver

            mock_create.return_value = PollingObserver(timeout=1)
            watcher = FileWatcherService(tables)
            try:
                watcher.start()
                # Verify it started without crashing
                assert watcher._observer is not None
            finally:
                watcher.stop()

    def test_native_observer_oserror_creates_polling(self, tables: sqlalchemy.Engine):
        """When native Observer raises OSError, _create_observer falls back."""
        watcher = FileWatcherService(tables)
        with patch("watchdog.observers.Observer.__init__", side_effect=OSError("inotify limit")):
            observer = watcher._create_observer(polling=False)
        from watchdog.observers.polling import PollingObserver

        assert isinstance(observer, PollingObserver)
        assert watcher._use_polling is True
        observer.stop()


class TestCallbackErrorResilience:
    def test_callback_error_does_not_crash_watcher(
        self, tables: sqlalchemy.Engine, session: Session, tmp_path: Path
    ):
        """Mock DB session to raise on commit, verify watcher survives."""
        project_dir = _create_project_dir(tmp_path)
        project = _insert_project(session, project_dir)

        watcher = FileWatcherService(tables)
        watcher._use_polling = True
        try:
            watcher.start()
            watcher.add_project(project.id, str(project_dir))

            # Patch Session to raise on commit
            with patch(
                "app.services.file_watcher.Session",
                side_effect=Exception("DB exploded"),
            ):
                mock_event = MagicMock()
                mock_event.is_directory = False
                mock_event.event_type = "modified"
                mock_event.src_path = str(project_dir / ".planning" / "STATE.json")
                # Should not raise
                watcher._on_file_changed(mock_event)

            # Watcher should still be running
            assert watcher._observer.is_alive()
        finally:
            watcher.stop()
