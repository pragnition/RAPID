"""Tests for card_routing — label-to-skill routing logic."""

from unittest.mock import MagicMock

from app.agents.card_routing import route_card_to_skill


def _make_card(
    metadata_json: str = "{}",
    card_id: str = "test-id",
    title: str = "Test",
    description: str = "Desc",
) -> MagicMock:
    card = MagicMock()
    card.id = card_id
    card.title = title
    card.description = description
    card.metadata_json = metadata_json
    return card


def test_bug_label_routes_to_bug_fix():
    card = _make_card(metadata_json='{"labels": ["bug"]}')
    skill, _ = route_card_to_skill(card)
    assert skill == "rapid:bug-fix"


def test_feature_label_routes_to_add_set():
    card = _make_card(metadata_json='{"labels": ["feature"]}')
    skill, _ = route_card_to_skill(card)
    assert skill == "rapid:add-set"


def test_no_labels_routes_to_default():
    card = _make_card(metadata_json='{"labels": []}')
    skill, _ = route_card_to_skill(card)
    assert skill == "rapid:quick"


def test_multiple_labels_first_wins():
    card = _make_card(metadata_json='{"labels": ["feature", "bug"]}')
    skill, _ = route_card_to_skill(card)
    assert skill == "rapid:add-set"


def test_invalid_metadata_json():
    card = _make_card(metadata_json="not json")
    skill, _ = route_card_to_skill(card)
    assert skill == "rapid:quick"


def test_args_contain_card_info():
    card = _make_card(
        card_id="abc-123",
        title="Fix login",
        description="Login is broken",
    )
    _, args = route_card_to_skill(card)
    assert args["card_id"] == "abc-123"
    assert args["title"] == "Fix login"
    assert args["description"] == "Login is broken"
