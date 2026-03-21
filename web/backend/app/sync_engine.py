"""Write-through sync engine: SQLite <-> .rapid-web/ filesystem mirror."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select

from app.database import KanbanColumn, KanbanCard, Note, Project, SyncState
from app.logging_config import get_logger

logger = get_logger("sync_engine")

# Map entity type names to subdirectory and model class
_ENTITY_MAP: dict[str, tuple[str, type]] = {
    "project": ("projects", Project),
    "note": ("notes", Note),
    "kanban_column": ("kanban", KanbanColumn),
    "kanban_card": ("kanban", KanbanCard),
}


class SyncEngine:
    """Maintains .rapid-web/ as a filesystem mirror of SQLite data."""

    def __init__(self, project_path: Path, session: Session) -> None:
        self.project_path = project_path
        self.session = session
        self.web_dir = project_path / ".rapid-web"

        # Ensure subdirectories exist
        for subdir, _ in _ENTITY_MAP.values():
            (self.web_dir / subdir).mkdir(parents=True, exist_ok=True)

        logger.debug("SyncEngine initialized for %s", self.web_dir)

    def sync_to_disk(self, entity_type: str, entity_id: str, data: dict) -> Path:
        """Write a single entity to disk as JSON."""
        subdir = self._get_subdir(entity_type)
        path = self.web_dir / subdir / f"{entity_id}.json"
        path.write_text(json.dumps(data, indent=2, default=str))
        logger.debug("Wrote %s/%s to disk", entity_type, entity_id)
        return path

    def sync_from_disk(self) -> dict[str, int]:
        """Bootstrap: read all JSON files from .rapid-web/ and import into DB."""
        counts: dict[str, int] = {}

        for entity_type, (subdir, model_cls) in _ENTITY_MAP.items():
            dir_path = self.web_dir / subdir
            count = 0
            if dir_path.exists():
                for json_file in dir_path.glob("*.json"):
                    raw = json.loads(json_file.read_text())
                    instance = model_cls.model_validate(raw)
                    self.session.merge(instance)
                    count += 1
            counts[entity_type + "s"] = count

        self.session.commit()
        logger.info("Bootstrap import: %s", counts)
        return counts

    def delete_from_disk(self, entity_type: str, entity_id: str) -> bool:
        """Remove a single entity JSON file from disk."""
        subdir = self._get_subdir(entity_type)
        path = self.web_dir / subdir / f"{entity_id}.json"
        if path.exists():
            path.unlink()
            logger.debug("Deleted %s/%s from disk", entity_type, entity_id)
            return True
        return False

    def compute_checksums(self) -> dict[str, str]:
        """Compute MD5 checksums for all JSON files under .rapid-web/."""
        checksums: dict[str, str] = {}
        for subdir, _ in _ENTITY_MAP.values():
            dir_path = self.web_dir / subdir
            if dir_path.exists():
                for json_file in sorted(dir_path.glob("*.json")):
                    rel = str(json_file.relative_to(self.web_dir))
                    digest = hashlib.md5(json_file.read_bytes()).hexdigest()  # noqa: S324
                    checksums[rel] = digest
        return checksums

    def needs_bootstrap(self, project_id: str) -> bool:
        """Check whether a bootstrap from disk is needed for this project."""
        uid = UUID(project_id) if isinstance(project_id, str) else project_id
        stmt = select(SyncState).where(SyncState.project_id == uid)
        sync_state = self.session.exec(stmt).first()

        if sync_state is None or sync_state.last_sync_at is None:
            return True

        # Check if disk has files but DB has no corresponding records
        has_disk_files = any(
            list((self.web_dir / subdir).glob("*.json"))
            for subdir, _ in _ENTITY_MAP.values()
            if (self.web_dir / subdir).exists()
        )
        if has_disk_files:
            db_project = self.session.get(Project, uid)
            if db_project is None:
                return True

        return False

    def update_sync_state(
        self, project_id: str, commit_hash: str | None = None
    ) -> None:
        """Upsert SyncState record with current timestamp and checksums."""
        uid = UUID(project_id) if isinstance(project_id, str) else project_id
        stmt = select(SyncState).where(SyncState.project_id == uid)
        sync_state = self.session.exec(stmt).first()

        now = datetime.now(timezone.utc)
        checksums_json = json.dumps(self.compute_checksums())

        if sync_state is None:
            sync_state = SyncState(
                project_id=uid,
                last_sync_at=now,
                last_commit_hash=commit_hash,
                file_checksums=checksums_json,
            )
            self.session.add(sync_state)
        else:
            sync_state.last_sync_at = now
            if commit_hash is not None:
                sync_state.last_commit_hash = commit_hash
            sync_state.file_checksums = checksums_json
            self.session.add(sync_state)

        self.session.commit()

    def _get_subdir(self, entity_type: str) -> str:
        """Resolve entity type to subdirectory name."""
        if entity_type not in _ENTITY_MAP:
            raise ValueError(
                f"Unknown entity_type '{entity_type}', "
                f"expected one of: {list(_ENTITY_MAP.keys())}"
            )
        return _ENTITY_MAP[entity_type][0]
