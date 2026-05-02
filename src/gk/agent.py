"""Claude Agent 封装 — 基于 claude-agent-sdk query() 模式.

改进点（参考 quick-template）：
- output_format_schema(): $defs 内联，生成扁平 JSON Schema
- parse_with_model(): 双路径结构化输出提取（structured_output + ToolUseBlock）
- _aclose_silent(): 异步生成器安全关闭
"""

from __future__ import annotations

import asyncio
import logging
import time
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger("gk.agent")

T = TypeVar("T", bound=BaseModel)


# ============================================================================
# 异常体系
# ============================================================================


class AgentError(Exception):
    """Agent 基础异常."""


class AgentConnectionError(AgentError):
    """CLI 未安装或不可达."""


class AgentProcessError(AgentError):
    """子进程执行失败."""

    def __init__(self, message: str, exit_code: int | None = None, stderr: str | None = None):
        self.exit_code = exit_code
        self.stderr = stderr
        super().__init__(message)


class AgentValidationError(AgentError):
    """结构化输出无法通过 Pydantic 验证."""

    def __init__(
        self,
        message: str,
        raw_data: dict[str, Any] | None = None,
        model_class: type[BaseModel] | None = None,
    ):
        self.raw_data = raw_data
        self.model_class = model_class
        super().__init__(message)


class AgentBudgetExceededError(AgentError):
    """超过 max_turns."""

    def __init__(self, message: str, actual_turns: int = 0, actual_cost: float | None = None):
        self.actual_turns = actual_turns
        self.actual_cost = actual_cost
        super().__init__(message)


class AgentRateLimitError(AgentError):
    """触发 API 限流."""

    def __init__(self, message: str, status: str = "", utilization: float | None = None):
        self.status = status
        self.utilization = utilization
        super().__init__(message)


# ============================================================================
# Schema 工具函数
# ============================================================================


def output_format_schema(model_class: type[BaseModel]) -> dict[str, Any]:
    """从 Pydantic 模型生成 SDK output_format（自动内联 $defs）.

    Pydantic 嵌套模型会生成 $defs 引用，某些 SDK 版本无法正确解析。
    此函数将 $defs 内联到 schema 中，生成扁平的 JSON Schema。
    """
    schema = model_class.model_json_schema()
    defs = schema.pop("$defs", {})

    def _inline(node: Any) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                name = ref.removeprefix("#/$defs/")
                if name in defs:
                    resolved = _inline(deepcopy(defs[name]))
                    siblings = {k: v for k, v in node.items() if k != "$ref"}
                    if siblings and isinstance(resolved, dict):
                        resolved.update(_inline(siblings))
                    return resolved
            return {k: _inline(v) for k, v in node.items()}
        if isinstance(node, list):
            return [_inline(item) for item in node]
        return node

    return {
        "type": "json_schema",
        "schema": _inline(schema),
        "name": model_class.__name__,
        "strict": True,
    }


def parse_with_model(message: object, model_class: type[T]) -> T | None:
    """从 SDK 消息提取结构化输出并通过 Pydantic 验证.

    双路径提取：
    1. ResultMessage.structured_output（SDK 原生字段）
    2. ToolUseBlock("StructuredOutput").input（备用路径）
    """
    raw = _extract_raw_dict(message)
    if raw is None:
        return None
    try:
        return model_class.model_validate(raw)
    except ValidationError:
        return None


def _extract_raw_dict(message: object) -> dict[str, Any] | None:
    """从 SDK 消息中提取原始 dict 数据."""
    # 路径 1: ResultMessage.structured_output
    if hasattr(message, "structured_output"):
        output = getattr(message, "structured_output")
        if isinstance(output, dict):
            return output
    # 路径 2: ToolUseBlock("StructuredOutput").input
    if hasattr(message, "content"):
        for block in getattr(message, "content", []):
            if getattr(block, "name", None) == "StructuredOutput":
                inp = getattr(block, "input", None)
                if isinstance(inp, dict):
                    return inp
    return None


# ============================================================================
# 配置 & 统计
# ============================================================================


@dataclass
class QueryStats:
    """查询统计 — 从 ResultMessage 提取完整信息."""

    turns: int = 0
    duration_ms: int = 0
    duration_api_ms: int = 0
    model: str = ""
    cost_usd: float | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    tool_calls: int = 0
    tool_calls_detail: dict[str, int] = field(default_factory=dict)
    stop_reason: str | None = None
    session_id: str = ""
    structured_output: Any = None


@dataclass
class AgentConfig:
    """Agent 配置."""

    model: str = "claude-sonnet-4-20250514"
    system_prompt: str = ""
    cwd: Path | None = None
    max_turns: int = 10
    tools: list[str] | dict | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    mcp_servers: dict[str, Any] = field(default_factory=dict)
    skills: list[str] | str | None = None
    permission_mode: str | None = None
    stderr: Callable[[str], None] | None = None


# ============================================================================
# 事件流收集
# ============================================================================


async def _collect_response(query_fn: Any, prompt: str, options: Any) -> QueryStats:
    """异步收集 Agent 事件流 — 用 isinstance 匹配 SDK 原生消息类型."""
    from claude_agent_sdk.types import (
        AssistantMessage,
        RateLimitEvent,
        ResultMessage,
        TextBlock,
        ToolUseBlock,
    )

    stats = QueryStats()
    text_parts: list[str] = []

    try:
        async for msg in query_fn(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                stats.model = getattr(msg, "model", "") or stats.model
                if msg.usage:
                    stats.input_tokens += msg.usage.get("input_tokens", 0)
                    stats.output_tokens += msg.usage.get("output_tokens", 0)
                for block in msg.content:
                    if isinstance(block, TextBlock) and block.text:
                        text_parts.append(block.text)
                    elif isinstance(block, ToolUseBlock):
                        stats.tool_calls += 1
                        stats.tool_calls_detail[block.name] = (
                            stats.tool_calls_detail.get(block.name, 0) + 1
                        )
                        logger.debug(
                            "Tool call: %s | input=%s",
                            block.name, _truncate(str(block.input), 200),
                        )

            elif isinstance(msg, ResultMessage):
                stats.turns = getattr(msg, "num_turns", stats.turns) or stats.turns
                stats.duration_api_ms = getattr(msg, "duration_api_ms", 0) or 0
                stats.stop_reason = getattr(msg, "stop_reason", None)
                stats.session_id = getattr(msg, "session_id", "") or ""
                stats.cost_usd = getattr(msg, "total_cost_usd", None)
                if msg.usage:
                    stats.input_tokens = msg.usage.get("input_tokens", stats.input_tokens)
                    stats.output_tokens = msg.usage.get("output_tokens", stats.output_tokens)
                if msg.result:
                    text_parts.append(msg.result)
                # 核心改进：直接保存 structured_output 对象
                stats.structured_output = getattr(msg, "structured_output", None)
                if getattr(msg, "is_error", False):
                    errors = getattr(msg, "errors", None) or ["unknown error"]
                    logger.error("Agent result error: %s", errors)

            elif isinstance(msg, RateLimitEvent):
                info = msg.rate_limit_info
                util_pct = (info.utilization or 0) * 100
                if info.status == "rejected":
                    raise AgentRateLimitError(
                        f"限流拒绝: {info.rate_limit_type}",
                        status=info.status,
                        utilization=info.utilization,
                    )
                logger.warning(
                    "Rate limit: status=%s type=%s utilization=%.1f%%",
                    info.status, info.rate_limit_type, util_pct,
                )
    except (AgentRateLimitError, AgentError):
        raise
    except Exception as exc:
        _translate_sdk_error(exc)

    # 存储文本结果
    stats._result_text = "".join(text_parts)  # type: ignore[attr-defined]
    return stats


def _translate_sdk_error(exc: BaseException) -> None:
    """将 SDK 原生异常转换为自定义异常."""
    try:
        from claude_agent_sdk import (
            CLIConnectionError,
            CLINotFoundError,
            ProcessError,
        )
        if isinstance(exc, CLINotFoundError):
            raise AgentConnectionError(f"Claude Code CLI 未找到: {exc}") from exc
        if isinstance(exc, CLIConnectionError):
            raise AgentConnectionError(f"无法连接 Claude Code: {exc}") from exc
        if isinstance(exc, ProcessError):
            raise AgentProcessError(
                str(exc),
                exit_code=getattr(exc, "exit_code", None),
                stderr=getattr(exc, "stderr", None),
            ) from exc
    except ImportError:
        pass
    raise AgentError(f"SDK 错误: {exc}") from exc


async def _aclose_silent(aiter: Any) -> None:
    """安全关闭异步生成器，忽略已关闭/未实现 aclose 的情况."""
    if hasattr(aiter, "aclose"):
        try:
            await aiter.aclose()
        except (RuntimeError, AttributeError, StopAsyncIteration):
            pass


# ============================================================================
# Agent 类
# ============================================================================


def _truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[:max_len] + "..."


class Agent:
    """Claude Agent 封装."""

    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig()
        self._last_stats: QueryStats = QueryStats()

    @property
    def last_stats(self) -> QueryStats:
        return self._last_stats

    def _get_sdk_query(self) -> Any:
        """延迟导入 claude_agent_sdk."""
        try:
            from claude_agent_sdk import query
        except ImportError as e:
            raise AgentConnectionError(
                "claude-agent-sdk 未安装，请运行: uv add claude-agent-sdk"
            ) from e
        return query

    def _build_options(self, output_type: type | None = None) -> Any:
        """构建 SDK options 对象 — 正确映射所有字段."""
        from claude_agent_sdk.types import ClaudeAgentOptions

        cfg = self.config
        options = ClaudeAgentOptions(
            model=cfg.model,
            max_turns=cfg.max_turns,
            system_prompt=cfg.system_prompt or None,
            cwd=str(cfg.cwd) if cfg.cwd else None,
            tools=cfg.tools,
            allowed_tools=cfg.allowed_tools,
            disallowed_tools=cfg.disallowed_tools,
            mcp_servers=cfg.mcp_servers or {},
            stderr=cfg.stderr,
        )

        if cfg.permission_mode:
            options.permission_mode = cfg.permission_mode

        if cfg.skills is not None:
            options.skills = cfg.skills

        # 核心改进：使用 output_format_schema 处理 $defs 内联
        if output_type is not None and issubclass(output_type, BaseModel):
            options.output_format = output_format_schema(output_type)

        return options

    def _parse_structured(self, stats: QueryStats, output_type: type[T] | None) -> str:
        """从 structured_output 解析并返回 JSON 字符串.

        优先使用 structured_output（dict），否则用文本 + 4步降级解析.
        """
        if output_type is None:
            return stats._result_text

        # 路径 1: structured_output（SDK 原生 dict，最可靠）
        if stats.structured_output is not None and isinstance(stats.structured_output, dict):
            try:
                output_type.model_validate(stats.structured_output)
                import json
                return json.dumps(stats.structured_output, ensure_ascii=False)
            except ValidationError:
                pass

        # 路径 2: 文本降级解析（4步）
        text = stats._result_text
        if not text:
            raise AgentValidationError(
                f"无结构化输出 ({stats.turns} turns, {stats.tool_calls} tools)",
                raw_data=stats.structured_output,
                model_class=output_type,
            )

        # 2a: 标准 JSON
        try:
            output_type.model_validate_json(text)
            return text
        except Exception:
            pass

        # 2b: 提取 JSON 块（Agent 可能在 JSON 前后加了文字）
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            candidate = json_match.group()
            try:
                output_type.model_validate_json(candidate)
                return candidate
            except Exception:
                pass

        # 2c: Python dict → JSON（Agent 用了单引号）
        import json
        try:
            parsed = json.loads(text.replace("'", '"'))
            output_type.model_validate(parsed)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception:
            pass

        # 2d: ast.literal_eval
        import ast
        try:
            parsed = ast.literal_eval(text)
            output_type.model_validate(parsed)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception as e:
            raise AgentValidationError(
                f"输出验证失败: {e}",
                raw_data=stats.structured_output,
                model_class=output_type,
            ) from e

    def _log_stats(self, stats: QueryStats) -> None:
        """输出完整日志."""
        detail = " ".join(f"{k}×{v}" for k, v in stats.tool_calls_detail.items())
        logger.info(
            "Agent done | turns=%d | tools=%d (%s) | api=%dms | cost=$%.4f | "
            "tokens=%d+%d | stop=%s | session=%s",
            stats.turns, stats.tool_calls, detail or "-",
            stats.duration_api_ms, stats.cost_usd or 0.0,
            stats.input_tokens, stats.output_tokens,
            stats.stop_reason, stats.session_id[:8] if stats.session_id else "-",
        )

    def ask(self, prompt: str, *, output_type: type[T] | None = None) -> tuple[str, QueryStats]:
        """同步查询 Agent."""
        start = time.monotonic()
        query_fn = self._get_sdk_query()
        options = self._build_options(output_type)

        logger.info("Agent query started | model=%s", self.config.model)
        try:
            sdk_stats = asyncio.run(_collect_response(query_fn, prompt, options))
        except (AgentRateLimitError, AgentProcessError, AgentConnectionError):
            raise
        except AgentError:
            raise
        except Exception as exc:
            _translate_sdk_error(exc)
            raise
        sdk_stats.duration_ms = int((time.monotonic() - start) * 1000)

        self._last_stats = sdk_stats
        self._log_stats(sdk_stats)
        result_text = self._parse_structured(sdk_stats, output_type)

        return result_text, sdk_stats

    async def aask(
        self, prompt: str, *, output_type: type[T] | None = None
    ) -> tuple[str, QueryStats]:
        """异步查询 — 直接 await SDK async 接口，支持并行."""
        start = time.monotonic()
        query_fn = self._get_sdk_query()
        options = self._build_options(output_type)

        logger.info("Agent aask started | model=%s", self.config.model)
        try:
            sdk_stats = await _collect_response(query_fn, prompt, options)
        except (AgentRateLimitError, AgentProcessError, AgentConnectionError):
            raise
        except AgentError:
            raise
        except Exception as exc:
            _translate_sdk_error(exc)
            raise
        sdk_stats.duration_ms = int((time.monotonic() - start) * 1000)

        self._last_stats = sdk_stats
        self._log_stats(sdk_stats)
        result_text = self._parse_structured(sdk_stats, output_type)

        return result_text, sdk_stats


def ask(
    prompt: str,
    *,
    model: str = "claude-sonnet-4-20250514",
    system_prompt: str = "",
    output_type: type[T] | None = None,
) -> tuple[str, QueryStats]:
    """快捷函数：一行调用 Agent."""
    config = AgentConfig(model=model, system_prompt=system_prompt)
    agent = Agent(config)
    return agent.ask(prompt, output_type=output_type)
