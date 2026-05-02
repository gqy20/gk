"""内置示例工具 — Agent 可调用的自定义工具."""

from __future__ import annotations

import json
from datetime import datetime


def get_current_time() -> str:
    """获取当前时间（ISO 格式）."""
    return datetime.now().isoformat()


def calculate(expression: str) -> str:
    """安全计算数学表达式（仅支持基本运算）."""
    allowed = set("0123456789+-*/().% ")
    if not all(c in allowed for c in expression):
        return json.dumps({"error": "表达式包含不允许的字符"})
    try:
        result = eval(expression, {"__builtins__": {}}, {})  # noqa: S307
        return json.dumps({"expression": expression, "result": result})
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_tools() -> list[dict]:
    """列出所有可用工具."""
    return [
        {"name": "get_current_time", "description": "获取当前时间"},
        {"name": "calculate", "description": "安全计算数学表达式"},
    ]
