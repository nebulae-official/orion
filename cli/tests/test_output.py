"""Tests for output formatting."""


from orion_cli.output import OutputFormat, format_output


def test_json_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.JSON)
    assert '"name": "scout"' in result
    assert '"status": "healthy"' in result


def test_plain_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.PLAIN)
    assert "scout" in result
    assert "healthy" in result


def test_table_format() -> None:
    data = [{"name": "scout", "status": "healthy"}]
    result = format_output(data, fmt=OutputFormat.TABLE)
    assert "scout" in result
    assert "healthy" in result
