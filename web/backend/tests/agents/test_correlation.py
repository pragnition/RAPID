"""Tests for ``run_id`` ContextVar and the logging filter."""

from __future__ import annotations

import logging

from app.agents.correlation import (
    SAFE_ENV_KEYS,
    RunIdLogFilter,
    bind_run_id,
    get_run_id,
)


def test_run_id_var_default_none():
    assert get_run_id() is None


def test_bind_run_id_restores():
    assert get_run_id() is None
    with bind_run_id("abc"):
        assert get_run_id() == "abc"
    assert get_run_id() is None


def test_log_filter_attaches_run_id(caplog):
    flt = RunIdLogFilter()
    caplog.handler.addFilter(flt)
    logger = logging.getLogger("rapid.test_correlation")
    logger.setLevel(logging.INFO)
    try:
        with caplog.at_level(logging.INFO, logger="rapid.test_correlation"):
            with bind_run_id("test-run"):
                logger.info("inside")
            logger.info("outside")
        records = [r for r in caplog.records if r.name == "rapid.test_correlation"]
        inside = next(r for r in records if r.message == "inside")
        outside = next(r for r in records if r.message == "outside")
        assert getattr(inside, "run_id") == "test-run"
        assert getattr(outside, "run_id") == "-"
    finally:
        caplog.handler.removeFilter(flt)


def test_safe_env_keys_blocks_credentials():
    assert "ANTHROPIC_API_KEY" not in SAFE_ENV_KEYS
    assert "GITHUB_TOKEN" not in SAFE_ENV_KEYS
    assert "PATH" in SAFE_ENV_KEYS
