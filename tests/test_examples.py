"""内置工具测试."""

from gk.examples import calculate, get_current_time, list_tools


def test_get_current_time():
    result = get_current_time()
    assert "T" in result  # ISO 格式
    assert len(result) > 10


def test_calculate_basic():
    result = calculate("2 + 3")
    assert "5" in result
    assert "error" not in result


def test_calculate_invalid_chars():
    result = calculate("import os")
    assert "error" in result


def test_list_tools():
    tools = list_tools()
    assert len(tools) == 2
    names = {t["name"] for t in tools}
    assert "get_current_time" in names
    assert "calculate" in names
