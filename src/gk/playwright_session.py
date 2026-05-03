"""Playwright Session 管理 — 支持并行任务的进程隔离与清理."""

import asyncio
import uuid
from typing import Any

from gk.agent import AgentConfig


def generate_session_name() -> str:
    """生成唯一的 session name，格式: gk_<8位uuid>."""
    return f"gk_{uuid.uuid4().hex[:8]}"


class PlaywrightSession:
    """Playwright 会话管理器 — 支持 context manager 模式.

    每个 session 有独立的浏览器上下文，清理时只关闭自己的会话，
    不影响其他并行任务。
    """

    def __init__(self, session_name: str | None = None):
        self.session_name = session_name or generate_session_name()
        self.env = {"PLAYWRIGHT_CLI_SESSION": self.session_name}
        self._closed = False

    def __enter__(self) -> "PlaywrightSession":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        # 同步调用 close（用于 context manager）
        import asyncio
        asyncio.run(close_session(self.session_name))
        self._closed = True
        return False

    def to_agent_config(self) -> AgentConfig:
        """生成传递给 Agent 的配置，包含 session 环境变量."""
        return AgentConfig(
            env=self.env.copy(),
            skills=["playwright-cli"],
        )


async def close_session(session_name: str) -> None:
    """关闭指定 session 的浏览器进程.

    Args:
        session_name: 要关闭的 session 名称

    Raises:
        TimeoutError: 清理超时
        RuntimeError: playwright-cli 未安装
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "playwright-cli", "-s", session_name, "close",
            env={"PLAYWRIGHT_CLI_SESSION": session_name},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(proc.communicate(), timeout=10)
        except asyncio.TimeoutError:
            proc.kill()
            raise TimeoutError(f"close session {session_name} timeout")
    except FileNotFoundError:
        raise RuntimeError("playwright-cli not found")
