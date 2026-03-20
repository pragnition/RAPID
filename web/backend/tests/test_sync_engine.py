"""Tests for app.sync_engine -- SyncEngine write-through filesystem mirror."""

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from app.database import KanbanItem, Note, Project, SyncState
from app.sync_engine import SyncEngine, _ENTITY_MAP


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def project(session: Session) -> Project:
    """Insert and return a Project record for FK-dependent tests."""
    proj = Project(name="test-project", path="/tmp/test-project")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


@pytest.fixture()
def sync_engine(tmp_path, session: Session) -> SyncEngine:
    """Return a SyncEngine rooted at tmp_path with a live session."""
    return SyncEngine(project_path=tmp_path, session=session)


# ---------------------------------------------------------------------------
# __init__
# ---------------------------------------------------------------------------


def test_init_creates_subdirectories(tmp_path, session: Session):
    SyncEngine(project_path=tmp_path, session=session)
    web_dir = tmp_path / ".rapid-web"
    assert (web_dir / "projects").is_dir()
    assert (web_dir / "notes").is_dir()
    assert (web_dir / "kanban").is_dir()


def test_init_idempotent(tmp_path, session: Session):
    SyncEngine(project_path=tmp_path, session=session)
    SyncEngine(project_path=tmp_path, session=session)
    web_dir = tmp_path / ".rapid-web"
    assert (web_dir / "projects").is_dir()
    assert (web_dir / "notes").is_dir()
    assert (web_dir / "kanban").is_dir()


# ---------------------------------------------------------------------------
# sync_to_disk
# ---------------------------------------------------------------------------


def test_sync_to_disk_writes_json_file(sync_engine: SyncEngine):
    eid = str(uuid4())
    data = {"id": eid, "name": "proj", "path": "/x"}
    sync_engine.sync_to_disk("project", eid, data)
    path = sync_engine.web_dir / "projects" / f"{eid}.json"
    assert path.exists()
    assert json.loads(path.read_text()) == data


def test_sync_to_disk_returns_path(sync_engine: SyncEngine):
    eid = str(uuid4())
    result = sync_engine.sync_to_disk("project", eid, {"id": eid})
    expected = sync_engine.web_dir / "projects" / f"{eid}.json"
    assert result == expected


def test_sync_to_disk_handles_all_entity_types(sync_engine: SyncEngine):
    for entity_type, (subdir, _) in _ENTITY_MAP.items():
        eid = str(uuid4())
        path = sync_engine.sync_to_disk(entity_type, eid, {"id": eid})
        assert path.exists()
        assert subdir in str(path)


def test_sync_to_disk_serializes_uuid_and_datetime(sync_engine: SyncEngine):
    uid = uuid4()
    now = datetime.now(timezone.utc)
    data = {"id": str(uid), "ts": now}
    eid = str(uid)
    path = sync_engine.sync_to_disk("project", eid, data)
    content = json.loads(path.read_text())
    # default=str should have serialized the datetime
    assert isinstance(content["ts"], str)


def test_sync_to_disk_unknown_entity_raises(sync_engine: SyncEngine):
    with pytest.raises(ValueError, match="Unknown entity_type"):
        sync_engine.sync_to_disk("nonexistent", "abc", {})


# ---------------------------------------------------------------------------
# sync_from_disk
# ---------------------------------------------------------------------------


def test_sync_from_disk_imports_project(sync_engine: SyncEngine, session: Session):
    uid = uuid4()
    data = {
        "id": str(uid),
        "name": "imported",
        "path": "/tmp/imported",
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    fpath = sync_engine.web_dir / "projects" / f"{uid}.json"
    fpath.write_text(json.dumps(data))

    counts = sync_engine.sync_from_disk()
    assert counts["projects"] == 1

    proj = session.get(Project, uid)
    assert proj is not None
    assert proj.name == "imported"


def test_sync_from_disk_imports_note(sync_engine: SyncEngine, project: Project, session: Session):
    uid = uuid4()
    data = {
        "id": str(uid),
        "project_id": str(project.id),
        "title": "Test Note",
        "content": "body",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    fpath = sync_engine.web_dir / "notes" / f"{uid}.json"
    fpath.write_text(json.dumps(data))

    counts = sync_engine.sync_from_disk()
    assert counts["notes"] == 1

    note = session.get(Note, uid)
    assert note is not None
    assert note.title == "Test Note"


def test_sync_from_disk_imports_kanban(sync_engine: SyncEngine, project: Project, session: Session):
    uid = uuid4()
    data = {
        "id": str(uid),
        "project_id": str(project.id),
        "title": "Task A",
        "description": "",
        "status": "backlog",
        "position": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    fpath = sync_engine.web_dir / "kanban" / f"{uid}.json"
    fpath.write_text(json.dumps(data))

    counts = sync_engine.sync_from_disk()
    assert counts["kanbans"] == 1

    item = session.get(KanbanItem, uid)
    assert item is not None
    assert item.title == "Task A"


def test_sync_from_disk_returns_counts(sync_engine: SyncEngine, project: Project):
    # Write 2 projects and 1 note
    for _ in range(2):
        uid = uuid4()
        data = {
            "id": str(uid),
            "name": f"p-{uid}",
            "path": f"/tmp/{uid}",
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }
        (sync_engine.web_dir / "projects" / f"{uid}.json").write_text(json.dumps(data))

    note_uid = uuid4()
    note_data = {
        "id": str(note_uid),
        "project_id": str(project.id),
        "title": "N",
        "content": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    (sync_engine.web_dir / "notes" / f"{note_uid}.json").write_text(json.dumps(note_data))

    counts = sync_engine.sync_from_disk()
    assert counts["projects"] == 2
    assert counts["notes"] == 1
    assert counts["kanbans"] == 0


def test_sync_from_disk_empty_dirs(sync_engine: SyncEngine):
    counts = sync_engine.sync_from_disk()
    assert counts == {"projects": 0, "notes": 0, "kanbans": 0}


def test_sync_from_disk_merge_semantics(sync_engine: SyncEngine, session: Session):
    """merge() should update existing records rather than fail on duplicates."""
    uid = uuid4()
    data = {
        "id": str(uid),
        "name": "original",
        "path": "/tmp/merge-test",
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    fpath = sync_engine.web_dir / "projects" / f"{uid}.json"
    fpath.write_text(json.dumps(data))

    sync_engine.sync_from_disk()
    proj = session.get(Project, uid)
    assert proj.name == "original"

    # Update file and re-import
    data["name"] = "updated"
    fpath.write_text(json.dumps(data))
    sync_engine.sync_from_disk()

    session.expire_all()
    proj = session.get(Project, uid)
    assert proj.name == "updated"


# ---------------------------------------------------------------------------
# delete_from_disk
# ---------------------------------------------------------------------------


def test_delete_from_disk_removes_file(sync_engine: SyncEngine):
    eid = str(uuid4())
    sync_engine.sync_to_disk("project", eid, {"id": eid})
    path = sync_engine.web_dir / "projects" / f"{eid}.json"
    assert path.exists()

    result = sync_engine.delete_from_disk("project", eid)
    assert result is True
    assert not path.exists()


def test_delete_from_disk_nonexistent_returns_false(sync_engine: SyncEngine):
    result = sync_engine.delete_from_disk("project", str(uuid4()))
    assert result is False


def test_delete_from_disk_unknown_entity_raises(sync_engine: SyncEngine):
    with pytest.raises(ValueError, match="Unknown entity_type"):
        sync_engine.delete_from_disk("invalid", "abc")


# ---------------------------------------------------------------------------
# compute_checksums
# ---------------------------------------------------------------------------


def test_compute_checksums_empty(sync_engine: SyncEngine):
    checksums = sync_engine.compute_checksums()
    assert checksums == {}


def test_compute_checksums_correct_md5(sync_engine: SyncEngine):
    eid = str(uuid4())
    data = {"id": eid, "name": "check"}
    path = sync_engine.sync_to_disk("project", eid, data)

    checksums = sync_engine.compute_checksums()
    expected_digest = hashlib.md5(path.read_bytes()).hexdigest()
    rel_key = f"projects/{eid}.json"
    assert checksums[rel_key] == expected_digest


def test_compute_checksums_relative_keys(sync_engine: SyncEngine):
    eid = str(uuid4())
    sync_engine.sync_to_disk("note", eid, {"id": eid})

    checksums = sync_engine.compute_checksums()
    keys = list(checksums.keys())
    assert len(keys) == 1
    assert keys[0] == f"notes/{eid}.json"
    # Ensure no absolute path leaked
    assert not keys[0].startswith("/")


def test_compute_checksums_sorted_deterministic(sync_engine: SyncEngine):
    ids = [str(uuid4()) for _ in range(5)]
    for eid in ids:
        sync_engine.sync_to_disk("project", eid, {"id": eid})

    c1 = sync_engine.compute_checksums()
    c2 = sync_engine.compute_checksums()
    assert list(c1.keys()) == list(c2.keys())
    assert list(c1.keys()) == sorted(c1.keys())


# ---------------------------------------------------------------------------
# needs_bootstrap
# ---------------------------------------------------------------------------


def test_needs_bootstrap_no_sync_state(sync_engine: SyncEngine, project: Project):
    """No SyncState record at all -> needs bootstrap."""
    assert sync_engine.needs_bootstrap(str(project.id)) is True


def test_needs_bootstrap_sync_state_no_last_sync(sync_engine: SyncEngine, project: Project, session: Session):
    """SyncState exists but last_sync_at is None -> needs bootstrap."""
    ss = SyncState(project_id=project.id, last_sync_at=None)
    session.add(ss)
    session.commit()
    assert sync_engine.needs_bootstrap(str(project.id)) is True


def test_needs_bootstrap_disk_files_no_db_project(tmp_path, session: Session):
    """Disk files exist, SyncState has last_sync_at, but no DB Project -> needs bootstrap."""
    from sqlalchemy import text

    engine = SyncEngine(project_path=tmp_path, session=session)
    fake_pid = uuid4()

    # Create a temp project to satisfy FK for SyncState, then delete project via raw SQL
    temp_proj = Project(id=fake_pid, name="temp", path="/tmp/temp-nb")
    session.add(temp_proj)
    session.commit()

    ss = SyncState(project_id=fake_pid, last_sync_at=datetime.now(timezone.utc))
    session.add(ss)
    session.commit()

    # Put a file on disk so has_disk_files is True
    (engine.web_dir / "projects" / "dummy.json").write_text("{}")

    # Remove the project via raw SQL to bypass FK enforcement and session cache
    # SQLModel stores UUIDs as hex without hyphens
    session.execute(text(f"DELETE FROM project WHERE id = '{fake_pid.hex}'"))
    session.commit()
    # Expire all cached objects so session.get() will re-query the DB
    session.expire_all()

    assert engine.needs_bootstrap(str(fake_pid)) is True


def test_needs_bootstrap_returns_false_when_synced(sync_engine: SyncEngine, project: Project, session: Session):
    """SyncState has last_sync_at, project exists in DB, no disk files -> no bootstrap."""
    ss = SyncState(project_id=project.id, last_sync_at=datetime.now(timezone.utc))
    session.add(ss)
    session.commit()
    assert sync_engine.needs_bootstrap(str(project.id)) is False


# ---------------------------------------------------------------------------
# update_sync_state
# ---------------------------------------------------------------------------


def test_update_sync_state_creates_record(sync_engine: SyncEngine, project: Project, session: Session):
    sync_engine.update_sync_state(str(project.id))

    stmt = select(SyncState).where(SyncState.project_id == project.id)
    ss = session.exec(stmt).first()
    assert ss is not None
    assert ss.last_sync_at is not None
    assert ss.file_checksums is not None


def test_update_sync_state_updates_existing(sync_engine: SyncEngine, project: Project, session: Session):
    sync_engine.update_sync_state(str(project.id))

    stmt = select(SyncState).where(SyncState.project_id == project.id)
    ss = session.exec(stmt).first()
    first_sync = ss.last_sync_at

    # Write a file so checksums change
    sync_engine.sync_to_disk("project", str(project.id), {"id": str(project.id)})
    sync_engine.update_sync_state(str(project.id))

    session.expire_all()
    ss = session.exec(stmt).first()
    assert ss.last_sync_at >= first_sync


def test_update_sync_state_with_commit_hash(sync_engine: SyncEngine, project: Project, session: Session):
    sync_engine.update_sync_state(str(project.id), commit_hash="abc123")

    stmt = select(SyncState).where(SyncState.project_id == project.id)
    ss = session.exec(stmt).first()
    assert ss.last_commit_hash == "abc123"


def test_update_sync_state_preserves_commit_hash_when_none(sync_engine: SyncEngine, project: Project, session: Session):
    sync_engine.update_sync_state(str(project.id), commit_hash="first-hash")

    # Update again without commit_hash
    sync_engine.update_sync_state(str(project.id))

    stmt = select(SyncState).where(SyncState.project_id == project.id)
    ss = session.exec(stmt).first()
    assert ss.last_commit_hash == "first-hash"


# ---------------------------------------------------------------------------
# _get_subdir
# ---------------------------------------------------------------------------


def test_get_subdir_valid_types(sync_engine: SyncEngine):
    assert sync_engine._get_subdir("project") == "projects"
    assert sync_engine._get_subdir("note") == "notes"
    assert sync_engine._get_subdir("kanban") == "kanban"


def test_get_subdir_invalid_type(sync_engine: SyncEngine):
    with pytest.raises(ValueError, match="Unknown entity_type 'bogus'"):
        sync_engine._get_subdir("bogus")
