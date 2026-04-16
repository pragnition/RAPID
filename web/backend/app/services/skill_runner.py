"""Skill runner -- builds the prompt string sent to the agent SDK.

This module satisfies the ``skill_runner_contract`` import locally.
The agent-runtime-foundation set's ``build_sdk_options`` will consume
the prompt produced here.
"""

from typing import Any


def build_prompt(skill_name: str, sanitized_args: dict[str, Any]) -> str:
    """Build a prompt string for the agent SDK from a skill name and sanitized args.

    - If *sanitized_args* has exactly one argument, the value is inlined on the
      command line after the slash command.
    - Otherwise, args are emitted in a structured ``<args>`` XML block.
    - If *sanitized_args* is empty, just the slash command is returned.
    """
    command = f"/rapid:{skill_name}"

    if not sanitized_args:
        return command

    if len(sanitized_args) == 1:
        value = next(iter(sanitized_args.values()))
        return f"{command} {value}"

    # Multi-arg: structured XML block
    lines = [command, "", "<args>"]
    for key, value in sanitized_args.items():
        lines.append(f"  <{key}>{value}</{key}>")
    lines.append("</args>")
    return "\n".join(lines)
