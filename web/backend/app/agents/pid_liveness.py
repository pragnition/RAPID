"""OS-level PID liveness helpers (no psutil).

Used by the orphan sweeper to decide whether a recorded ``AgentRun.pid`` still
references a live process. The calls are intentionally cheap: ``os.kill(pid, 0)``
sends no signal and only probes for the existence of the target process.

CONTEXT.md explicitly rejects ``psutil`` — this module stays stdlib-only.
"""

from __future__ import annotations

import os
import signal as _signal


def is_pid_alive(pid: int | None) -> bool:
    """Return True if ``pid`` refers to a live process this OS can see.

    A ``PermissionError`` from ``os.kill`` means the process exists but is
    owned by a different UID: for liveness purposes that still counts as
    alive (the pid is not free for re-use).
    """
    if pid is None or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but we cannot signal it (owned by another user).
        return True
    except OSError:
        # Any other OSError (e.g. ESRCH on some platforms): treat as gone.
        return False


def send_sigterm(pid: int) -> bool:
    """Send ``SIGTERM`` to ``pid``. Return True only if the signal was delivered."""
    if not is_pid_alive(pid):
        return False
    try:
        os.kill(pid, _signal.SIGTERM)
        return True
    except (ProcessLookupError, PermissionError):
        return False
    except OSError:
        return False
