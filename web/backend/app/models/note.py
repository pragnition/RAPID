"""Re-export Note model from database for conventional import path."""

from app.database import Note

__all__ = ["Note"]
