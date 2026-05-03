"""Playwright Session 管理测试 — 进程隔离与清理."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest


# --- 依赖导入（确保模块可导入）---
from gk.playwright_session import (
    PlaywrightSession,
    close_session,
    generate_session_name,
)


# --- Session Name 生成 ---


def test_generate_session_name_prefix():
    """Session name 应以 'gk_' 为前缀."""
    name = generate_session_name()
    assert name.startswith("gk_")


def test_generate_session_name_unique():
    """每次生成应产生不同的 name."""
    names = [generate_session_name() for _ in range(10)]
    assert len(set(names)) == 10, "session names should be unique"


def test_generate_session_name_length():
    """Session name 长度合理（不含前缀约 8 字符）."""
    name = generate_session_name()
    # gk_ (3) + uuid (8) = 11 字符
    assert len(name) == 11
    # 验证格式正确
    assert name.startswith("gk_")
    assert len(name.split("_")[1]) == 8


# --- PlaywrightSession 基础功能 ---


def test_playwright_session_init():
    """创建 session 时应生成唯一的 session_name."""
    session = PlaywrightSession()
    assert session.session_name.startswith("gk_")
    assert len(session.session_name) == 11


def test_playwright_session_custom_name():
    """可指定自定义 session name."""
    session = PlaywrightSession(session_name="my_custom_session")
    assert session.session_name == "my_custom_session"


def test_playwright_session_env():
    """Session 的 env 应包含 PLAYWRIGHT_CLI_SESSION."""
    session = PlaywrightSession()
    assert "PLAYWRIGHT_CLI_SESSION" in session.env
    assert session.env["PLAYWRIGHT_CLI_SESSION"] == session.session_name


def test_playwright_session_env_custom():
    """自定义 session name 时 env 也应同步."""
    session = PlaywrightSession(session_name="test_session")
    assert session.env["PLAYWRIGHT_CLI_SESSION"] == "test_session"


def test_playwright_session_entered():
    """可作为 context manager 进入."""
    with patch("gk.playwright_session.close_session"):
        session = PlaywrightSession()
        with session:
            assert session.session_name is not None


def test_playwright_session_enter_returns_self():
    """__enter__ 应返回 session 自身."""
    with patch("gk.playwright_session.close_session"):
        session = PlaywrightSession()
        with session as entered:
            assert entered is session


def test_playwright_session_exited():
    """退出 context manager 时应清理."""
    with patch("gk.playwright_session.asyncio.run"):
        session = PlaywrightSession()
        with session:
            entered_session_name = session.session_name

        # 验证 close_session 被调用（通过 asyncio.run）
        assert session._closed is True


def test_playwright_session_multiple_entries():
    """同一 session 对象可重复进入（幂等）."""
    with patch("gk.playwright_session.asyncio.run"):
        session = PlaywrightSession()
        with session:
            name1 = session.session_name
        with session:
            name2 = session.session_name
        assert name1 == name2
        assert session._closed is True


# --- close_session 函数 ---


@pytest.mark.anyio
async def test_close_session_basic():
    """close_session 应执行 playwright-cli close 命令."""
    mock_proc = AsyncMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("gk.playwright_session.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await close_session("gk_test123")

        mock_exec.assert_called_once()
        args = mock_exec.call_args[0]
        assert "playwright-cli" in args
        assert "-s" in args
        assert "gk_test123" in args
        assert "close" in args


@pytest.mark.anyio
async def test_close_session_with_env():
    """close_session 应传递环境变量."""
    mock_proc = AsyncMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))

    with patch("gk.playwright_session.asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await close_session("gk_test456")

        call_kwargs = mock_exec.call_args[1]
        assert "PLAYWRIGHT_CLI_SESSION" in call_kwargs.get("env", {})


# --- AgentConfig 集成 ---


def test_playwright_session_agent_config():
    """Session 可生成传递给 Agent 的 config."""
    session = PlaywrightSession(session_name="test_config_session")
    config = session.to_agent_config()

    assert "PLAYWRIGHT_CLI_SESSION" in config.env
    assert config.env["PLAYWRIGHT_CLI_SESSION"] == "test_config_session"
    assert config.skills == ["playwright-cli"]
