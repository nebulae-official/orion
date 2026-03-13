"""Tests for EventBus channel constants."""

from __future__ import annotations

from orion_common.events import Channels


def test_channels_have_orion_prefix() -> None:
    """All channel names should start with 'orion.'."""
    channel_attrs = [
        attr for attr in dir(Channels)
        if not attr.startswith("_") and isinstance(getattr(Channels, attr), str)
    ]
    assert len(channel_attrs) > 0, "Channels class should have at least one channel"
    for attr in channel_attrs:
        value = getattr(Channels, attr)
        assert value.startswith("orion."), f"{attr} = {value!r} does not start with 'orion.'"


def test_expected_channels_exist() -> None:
    """Core channels required by the system should be defined."""
    assert hasattr(Channels, "CONTENT_CREATED")
    assert hasattr(Channels, "CONTENT_UPDATED")
    assert hasattr(Channels, "CONTENT_PUBLISHED")
    assert hasattr(Channels, "TREND_DETECTED")
    assert hasattr(Channels, "TREND_EXPIRED")
    assert hasattr(Channels, "MEDIA_GENERATED")
    assert hasattr(Channels, "MEDIA_FAILED")
    assert hasattr(Channels, "PIPELINE_STAGE_CHANGED")


def test_channel_values_are_unique() -> None:
    """No two channels should share the same string value."""
    channel_attrs = [
        attr for attr in dir(Channels)
        if not attr.startswith("_") and isinstance(getattr(Channels, attr), str)
    ]
    values = [getattr(Channels, attr) for attr in channel_attrs]
    assert len(values) == len(set(values)), "Duplicate channel values found"


def test_channel_names_are_dotted() -> None:
    """Channel values should follow dotted naming convention (e.g. orion.content.created)."""
    channel_attrs = [
        attr for attr in dir(Channels)
        if not attr.startswith("_") and isinstance(getattr(Channels, attr), str)
    ]
    for attr in channel_attrs:
        value = getattr(Channels, attr)
        parts = value.split(".")
        assert len(parts) >= 3, f"{attr} = {value!r} should have at least 3 dot-separated parts"
