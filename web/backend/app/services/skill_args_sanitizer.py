"""Sanitize user-supplied skill arguments before they reach the agent SDK.

Wraps string/multi-line/set-ref values in <user_input> tags, enforces
maxLength caps, validates set-ref shape, and rejects unknown arg names.
"""

import re
from typing import Any

from app.schemas.skill_frontmatter import SkillArg, SkillArgType
from app.services.skill_catalog_service import SkillMeta

# Shape-only validation -- no shell defense, just structure.
SET_REF_SHAPE = re.compile(r"^[a-zA-Z0-9._-]+$")

DEFAULT_STRING_MAX = 4096
DEFAULT_MULTILINE_MAX = 32768
DEFAULT_SET_REF_MAX = 128


class SanitizerError(Exception):
    """Raised when an argument fails sanitization."""

    def __init__(self, arg_name: str, reason: str, code: str) -> None:
        self.arg_name = arg_name
        self.reason = reason
        self.code = code
        super().__init__(f"[{code}] {arg_name}: {reason}")

    def to_http_detail(self) -> dict[str, str]:
        """Return a dict suitable for HTTPException(status_code=400, detail=...)."""
        return {"error": self.code, "arg": self.arg_name, "message": self.reason}


def _wrap(value: str) -> str:
    """Wrap a value in <user_input> tags."""
    return f"<user_input>{value}</user_input>"


def _check_length(name: str, value: str, limit: int) -> None:
    if len(value) > limit:
        raise SanitizerError(
            name,
            f"argument exceeds max length ({len(value)} > {limit})",
            "ARG_TOO_LONG",
        )


def sanitize_skill_args(
    catalog_meta: SkillMeta,
    raw_args: dict[str, Any],
) -> dict[str, Any]:
    """Validate and sanitize *raw_args* against the skill's declared arguments.

    Returns a new dict with sanitized values.  Raises SanitizerError on any
    validation failure.
    """
    # Build lookup of declared args by name
    declared: dict[str, SkillArg] = {arg.name: arg for arg in catalog_meta.args}

    # Reject unknown arg names
    for key in raw_args:
        if key not in declared:
            raise SanitizerError(key, "unknown argument", "ARG_UNKNOWN")

    result: dict[str, Any] = {}

    for name, arg in declared.items():
        if name not in raw_args:
            if arg.required:
                raise SanitizerError(name, "missing required argument", "ARG_MISSING")
            if arg.default is not None:
                result[name] = arg.default
            # Optional with no default and not provided -- omit from result
            continue

        value = raw_args[name]

        if arg.type == SkillArgType.STRING:
            value = str(value)
            limit = arg.max_length or DEFAULT_STRING_MAX
            _check_length(name, value, limit)
            result[name] = _wrap(value)

        elif arg.type == SkillArgType.MULTI_LINE:
            value = str(value)
            limit = arg.max_length or DEFAULT_MULTILINE_MAX
            _check_length(name, value, limit)
            result[name] = _wrap(value)

        elif arg.type == SkillArgType.CHOICE:
            value = str(value)
            if arg.choices and value not in arg.choices:
                raise SanitizerError(
                    name,
                    f"value '{value}' not in allowed choices: {arg.choices}",
                    "ARG_INVALID_CHOICE",
                )
            result[name] = value

        elif arg.type == SkillArgType.BOOL:
            if isinstance(value, bool):
                result[name] = value
            elif isinstance(value, str):
                result[name] = value.lower() in ("true", "1", "yes")
            else:
                result[name] = bool(value)

        elif arg.type == SkillArgType.SET_REF:
            value = str(value)
            limit = arg.max_length or DEFAULT_SET_REF_MAX
            _check_length(name, value, limit)
            if not SET_REF_SHAPE.fullmatch(value):
                raise SanitizerError(
                    name,
                    "set-ref must match [a-zA-Z0-9._-]+",
                    "ARG_SHAPE",
                )
            result[name] = _wrap(value)

        else:
            # Fallback for any future types -- pass through as string
            result[name] = str(value)

    return result
