#!/usr/bin/env python3
"""
MCP 服务器 stdout 过滤器
过滤掉 Crawl4AI 的进度条输出，只保留 JSON-RPC 消息
"""

import json
import subprocess
import sys


def is_jsonrpc_line(line: str) -> bool:
    """判断一行是否为 JSON-RPC 消息"""
    line = line.strip()
    if not line:
        return False
    # JSON-RPC 消息以 { 或 [ 开头
    if line[0] not in ("{", "["):
        return False
    try:
        obj = json.loads(line)
        # 必须有 jsonrpc 字段，或者是数组（batch）
        if isinstance(obj, dict) and "jsonrpc" in obj:
            return True
        if isinstance(obj, list):
            return True
        # 也可能是 FastMCP 的初始化消息
        if isinstance(obj, dict) and any(k in obj for k in ("id", "method", "result", "error")):
            return True
    except json.JSONDecodeError:
        pass
    return False


def main():
    # 启动真正的 MCP 服务器，继承 stderr，但 stdout 会被我们过滤
    proc = subprocess.Popen(
        ["uv", "tool", "uvx", "crawl-mcp"],
        stdin=sys.stdin,
        stdout=subprocess.PIPE,
        stderr=sys.stderr,
        text=True,
        bufsize=1,
    )

    try:
        for line in proc.stdout:
            if is_jsonrpc_line(line):
                sys.stdout.write(line)
                sys.stdout.flush()
    except KeyboardInterrupt:
        pass
    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
