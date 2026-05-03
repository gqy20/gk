"""Claude Agent 封装 — 基于 claude-agent-sdk query() 模式.

核心功能：
- output_format_schema(): $defs 内联，生成扁平 JSON Schema
- _collect_response(): 事件流收集 + Rich 实时进度输出
- _parse_structured(): 结构化输出解析（structured_output + 文本降级）

日志体系（参考 manim-agent）：
- Tool 调用配对：ToolUseBlock ↔ ToolResultBlock，计算单次调用耗时
- Input 摘要：显示工具输入参数（如 Bash command=playwright-cli goto ...）
- Thinking 预览：显示思考块内容截断
- Progress 快照：每轮输出 turn/token/elapsed
- Session Summary：最终统计（turns/cost/tools/tokens）
"""

import asyncio
import logging
import time
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError
from rich.console import Console

logger = logging.getLogger("gk.agent")
console = Console()

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
    """从 Pydantic 模型生成 SDK output_format（自动内联 $defs）."""
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


# ============================================================================
# 配置 & 统计
# ============================================================================


@dataclass
class TaskInfo:
    """子任务信息."""
    task_id: str = ""
    description: str = ""
    status: str = ""
    summary: str = ""


@dataclass
class QueryStats:
    """查询统计."""

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
    tasks: list[TaskInfo] = field(default_factory=list)


@dataclass
class AgentConfig:
    """Agent 配置."""

    model: str | None = None
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
    env: dict[str, str] | None = None
    extra_args: dict[str, str | None] | None = None


# ============================================================================
# 工具输入摘要
# ============================================================================


def _summarize_tool_input(input_dict: dict[str, Any] | None, max_len: int = 120) -> str:
    """将工具输入摘要为一行可读字符串."""
    if not input_dict:
        return ""
    parts = []
    for k, v in input_dict.items():
        v_str = str(v).replace("\n", " ")
        if len(v_str) > 60:
            v_str = v_str[:57] + "..."
        parts.append(f"{k}={v_str}")
    result = " ".join(parts)
    if len(result) > max_len:
        result = result[:max_len - 3] + "..."
    return result


# ============================================================================
# 事件流收集 — 详细 Rich 输出
# ============================================================================


class _EventCollector:
    """SDK 事件流收集器 — 处理所有消息类型，输出 Rich 实时进度."""

    def __init__(self, max_turns: int = 0):
        self.stats = QueryStats()
        self.text_parts: list[str] = []
        self._max_turns = max_turns
        self._pending_tools: dict[str, tuple[str, int]] = {}  # id → (name, start_ms)
        self._start_ms = int(time.monotonic() * 1000)

    def _elapsed(self) -> int:
        return int(time.monotonic() * 1000) - self._start_ms

    # ── AssistantMessage ──────────────────────────────────────────

    def handle_assistant(self, msg: Any) -> None:
        """处理 AssistantMessage — turn 进度 + 详细 block 输出."""
        from claude_agent_sdk.types import TextBlock, ThinkingBlock, ToolResultBlock, ToolUseBlock

        self.stats.model = msg.model or self.stats.model
        if msg.usage:
            self.stats.input_tokens += msg.usage.get("input_tokens", 0)
            self.stats.output_tokens += msg.usage.get("output_tokens", 0)

        self.stats.turns += 1
        turn = self.stats.turns
        max_t = self._max_turns or "?"

        for block in msg.content:
            if isinstance(block, TextBlock):
                text = block.text or ""
                if text:
                    preview = text[:120].replace("\n", " ")
                    if len(text) > 120:
                        preview += "..."
                    console.print(f"    [dim]{preview}[/]")

            elif isinstance(block, ThinkingBlock):
                thinking = block.thinking or ""
                preview = thinking[:80].replace("\n", " ")
                if len(thinking) > 80:
                    preview += "..."
                console.print(f"    [dim italic]thinking: {preview}[/]")

            elif isinstance(block, ToolUseBlock):
                self.stats.tool_calls += 1
                self.stats.tool_calls_detail[block.name] = (
                    self.stats.tool_calls_detail.get(block.name, 0) + 1
                )
                input_summary = _summarize_tool_input(
                    block.input if isinstance(block.input, dict) else None
                )
                # 记录到配对表
                self._pending_tools[block.id] = (block.name, self._elapsed())

                console.print(
                    f"  [yellow][{turn}/{max_t}][/yellow] "
                    f"[bold]{block.name}[/] {input_summary}"
                )

            elif isinstance(block, ToolResultBlock):
                self._print_tool_result(block, turn, max_t)

        # 如果没有 ToolUseBlock/ToolResultBlock，显示纯文本 turn
        has_tools = any(
            isinstance(b, (ToolUseBlock, ToolResultBlock)) for b in msg.content
        )
        if not has_tools:
            console.print(f"  [cyan][{turn}/{max_t}][/cyan] Text")

    def _print_tool_result(self, block: Any, turn: int, max_t: int | str) -> None:
        """打印工具执行结果，配对计算耗时."""
        now_ms = self._elapsed()
        pending = self._pending_tools.pop(block.tool_use_id, None)
        name = pending[0] if pending else "?"
        start_ms = pending[1] if pending else now_ms
        duration = max(0, now_ms - start_ms)

        content_preview = ""
        if block.content:
            if isinstance(block.content, str):
                content_preview = block.content[:80].replace("\n", " ")
            elif isinstance(block.content, list) and block.content:
                content_preview = str(block.content[0])[:80].replace("\n", " ")
        if len(content_preview) > 80:
            content_preview = content_preview[:77] + "..."

        if block.is_error:
            console.print(
                f"  [red][{turn}/{max_t}][/red] "
                f"[bold]{name}[/] [red]ERROR[/] {duration}ms | {content_preview}"
            )
        else:
            console.print(
                f"  [green][{turn}/{max_t}][/green] "
                f"{name} [dim]{duration}ms[/] {content_preview}"
            )

    # ── ResultMessage ─────────────────────────────────────────────

    def handle_result(self, msg: Any) -> None:
        """处理 ResultMessage."""
        self.stats.turns = msg.num_turns or self.stats.turns
        self.stats.duration_api_ms = msg.duration_api_ms or 0
        self.stats.stop_reason = msg.stop_reason
        self.stats.session_id = msg.session_id or ""
        self.stats.cost_usd = msg.total_cost_usd
        if msg.usage:
            self.stats.input_tokens = msg.usage.get("input_tokens", self.stats.input_tokens)
            self.stats.output_tokens = msg.usage.get("output_tokens", self.stats.output_tokens)
        if msg.result:
            self.text_parts.append(msg.result)
        self.stats.structured_output = msg.structured_output

        if getattr(msg, "is_error", False):
            errors = getattr(msg, "errors", None) or ["unknown error"]
            console.print(f"  [red bold]RESULT ERROR[/] {errors}")
            logger.error("Agent result error: %s", errors)
        else:
            # 输出结构化输出状态
            if self.stats.structured_output and isinstance(self.stats.structured_output, dict):
                console.print("  [green bold]structured_output[/] extracted from ResultMessage")
            elif self.text_parts:
                console.print("  [dim]structured_output: None (will parse from text)[/]")

    # ── Task messages ─────────────────────────────────────────────

    def handle_task_started(self, msg: Any) -> None:
        task = TaskInfo(
            task_id=getattr(msg, "task_id", ""),
            description=getattr(msg, "description", ""),
            status="running",
        )
        self.stats.tasks.append(task)
        desc = task.description[:60] if task.description else task.task_id[:8]
        console.print(f"  [yellow bold]TASK+[/]   {desc}")

    def handle_task_progress(self, msg: Any) -> None:
        task_id = getattr(msg, "task_id", "")
        desc = getattr(msg, "description", "")
        last_tool = getattr(msg, "last_tool_name", None)
        for t in self.stats.tasks:
            if t.task_id == task_id:
                t.description = desc or t.description
                break
        parts = []
        if desc:
            parts.append(desc[:50])
        if last_tool:
            parts.append(f"tool={last_tool}")
        logger.debug("TaskProgress | %s | %s", task_id[:8], " | ".join(parts))

    def handle_task_notification(self, msg: Any) -> None:
        task_id = getattr(msg, "task_id", "")
        status = getattr(msg, "status", "?")
        summary = getattr(msg, "summary", "")
        for t in self.stats.tasks:
            if t.task_id == task_id:
                t.status = status
                t.summary = summary
                break
        icon = "[green]TASK done[/]" if status == "completed" else "[red]TASK fail[/]"
        line = f"  {icon}   {task_id[:8]}"
        if summary:
            line += f" | {summary[:80]}"
        console.print(line)

    # ── System / RateLimit ────────────────────────────────────────

    def handle_system(self, msg: Any) -> None:
        subtype = getattr(msg, "subtype", "")
        logger.debug("System | %s", subtype)

    def handle_rate_limit(self, msg: Any) -> None:
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

    # ── Session Summary ───────────────────────────────────────────

    def print_summary(self) -> None:
        """打印会话摘要."""
        s = self.stats
        console.print("\n  ─────────────────────────────────")
        parts = []
        if s.model:
            parts.append(f"[cyan]{s.model}[/]")
        parts.append(f"{s.turns} turns")
        parts.append(f"{s.tool_calls} tools")
        dur_s = s.duration_ms / 1000 if s.duration_ms else 0
        if dur_s:
            parts.append(f"{dur_s:.1f}s")
        if s.cost_usd is not None:
            parts.append(f"${s.cost_usd:.4f}")
        console.print(f"  {' | '.join(parts)}")

        if s.tool_calls_detail:
            tools_str = " ".join(f"{k} x{v}" for k, v in s.tool_calls_detail.items())
            console.print(f"  [dim]{tools_str}[/]")

        if s.input_tokens or s.output_tokens:
            console.print(
                f"  [dim]tokens: {s.input_tokens} in + {s.output_tokens} out[/]"
            )

        if s.session_id:
            console.print(f"  [dim]session: {s.session_id[:12]}[/]")
        console.print("  ─────────────────────────────────")


async def _collect_response(query_fn: Any, prompt: str, options: Any) -> QueryStats:
    """异步收集 Agent 事件流."""
    from claude_agent_sdk.types import (
        AssistantMessage,
        RateLimitEvent,
        ResultMessage,
        StreamEvent,
        SystemMessage,
        TaskNotificationMessage,
        TaskProgressMessage,
        TaskStartedMessage,
    )

    max_turns = getattr(options, "max_turns", 0) or 0
    collector = _EventCollector(max_turns=max_turns)

    try:
        async for msg in query_fn(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                collector.handle_assistant(msg)
                from claude_agent_sdk.types import TextBlock
                for block in msg.content:
                    if isinstance(block, TextBlock) and block.text:
                        collector.text_parts.append(block.text)

            elif isinstance(msg, ResultMessage):
                collector.handle_result(msg)

            elif isinstance(msg, TaskStartedMessage):
                collector.handle_task_started(msg)

            elif isinstance(msg, TaskProgressMessage):
                collector.handle_task_progress(msg)

            elif isinstance(msg, TaskNotificationMessage):
                collector.handle_task_notification(msg)

            elif isinstance(msg, SystemMessage):
                collector.handle_system(msg)

            elif isinstance(msg, RateLimitEvent):
                collector.handle_rate_limit(msg)

            elif isinstance(msg, StreamEvent):
                pass

    except (AgentRateLimitError, AgentError):
        raise
    except Exception as exc:
        _translate_sdk_error(exc)

    collector.stats._result_text = "".join(collector.text_parts)  # type: ignore[attr-defined]
    return collector.stats


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


# ============================================================================
# Agent 类
# ============================================================================


class Agent:
    """Claude Agent 封装."""

    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig()
        self._last_stats: QueryStats = QueryStats()

    @property
    def last_stats(self) -> QueryStats:
        return self._last_stats

    def _get_sdk_query(self) -> Any:
        try:
            from claude_agent_sdk import query
        except ImportError as e:
            raise AgentConnectionError(
                "claude-agent-sdk 未安装，请运行: uv add claude-agent-sdk"
            ) from e
        return query

    def _build_options(self, output_type: type | None = None) -> Any:
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
            mcp_servers=cfg.mcp_servers if cfg.mcp_servers else None,
            stderr=cfg.stderr,
        )
        if cfg.permission_mode:
            options.permission_mode = cfg.permission_mode
        if cfg.skills is not None:
            options.skills = cfg.skills
        if cfg.env is not None:
            options.env = cfg.env
        if cfg.extra_args is not None:
            options.extra_args = cfg.extra_args
        if output_type is not None and issubclass(output_type, BaseModel):
            options.output_format = output_format_schema(output_type)
        return options

    def _parse_structured(self, stats: QueryStats, output_type: type[T] | None) -> str:
        if output_type is None:
            return stats._result_text

        import json

        if stats.structured_output is not None and isinstance(stats.structured_output, dict):
            try:
                output_type.model_validate(stats.structured_output)
                return json.dumps(stats.structured_output, ensure_ascii=False)
            except ValidationError:
                pass

        text = stats._result_text
        if not text:
            raise AgentValidationError(
                f"无结构化输出 ({stats.turns} turns, {stats.tool_calls} tools)",
                raw_data=stats.structured_output,
                model_class=output_type,
            )

        try:
            output_type.model_validate_json(text)
            return text
        except Exception:
            pass

        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            candidate = json_match.group()
            try:
                output_type.model_validate_json(candidate)
                return candidate
            except Exception:
                pass

        raise AgentValidationError(
            "输出验证失败：无法从响应中提取有效 JSON",
            raw_data=stats.structured_output,
            model_class=output_type,
        )

    def _log_stats(self, stats: QueryStats) -> None:
        detail = " ".join(f"{k}x{v}" for k, v in stats.tool_calls_detail.items())
        logger.info(
            "Agent done | turns=%d | tools=%d (%s) | api=%dms | cost=$%.4f | "
            "tokens=%d+%d | stop=%s | session=%s | tasks=%d",
            stats.turns, stats.tool_calls, detail or "-",
            stats.duration_api_ms, stats.cost_usd or 0.0,
            stats.input_tokens, stats.output_tokens,
            stats.stop_reason, stats.session_id[:8] if stats.session_id else "-",
            len(stats.tasks),
        )

    def ask(self, prompt: str, *, output_type: type[T] | None = None) -> tuple[str, QueryStats]:
        """同步查询 Agent."""
        start = time.monotonic()
        query_fn = self._get_sdk_query()
        options = self._build_options(output_type)

        console.print(f"  [bold]Agent start[/] model={self.config.model or 'default'} max_turns={self.config.max_turns}")
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

        # 打印摘要
        collector = _EventCollector.__new__(_EventCollector)
        collector.stats = sdk_stats
        collector.print_summary()

        result_text = self._parse_structured(sdk_stats, output_type)
        return result_text, sdk_stats

    async def aask(
        self, prompt: str, *, output_type: type[T] | None = None
    ) -> tuple[str, QueryStats]:
        """异步查询 — 直接 await SDK async 接口，支持并行."""
        start = time.monotonic()
        query_fn = self._get_sdk_query()
        options = self._build_options(output_type)

        console.print(f"  [bold]Agent start[/] model={self.config.model or 'default'} max_turns={self.config.max_turns}")
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

        collector = _EventCollector.__new__(_EventCollector)
        collector.stats = sdk_stats
        collector.print_summary()

        result_text = self._parse_structured(sdk_stats, output_type)
        return result_text, sdk_stats


def ask(
    prompt: str,
    *,
    model: str | None = None,
    system_prompt: str = "",
    output_type: type[T] | None = None,
) -> tuple[str, QueryStats]:
    """快捷函数：一行调用 Agent."""
    config = AgentConfig(model=model, system_prompt=system_prompt)
    agent = Agent(config)
    return agent.ask(prompt, output_type=output_type)
