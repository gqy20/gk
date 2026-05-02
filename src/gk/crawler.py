"""并发调度层 — 多 Agent 并行抓取高校信息."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from gk.agent import Agent, AgentConfig
from gk.config import CrawlConfig
from gk.models import UniversityInfo
from gk.prompts import build_crawl_prompt

logger = logging.getLogger("gk.crawler")
console = Console()


def _build_agent_config(config: CrawlConfig, system_prompt: str) -> AgentConfig:
    """构建 Agent 配置 — 注入 playwright-cli MCP + 自动权限 + 必要工具."""
    return AgentConfig(
        model=config.model,
        system_prompt=system_prompt,
        max_turns=config.max_turns,
        permission_mode="bypassPermissions",
        tools=["Bash", "Read", "Grep", "Glob", "WebFetch"],
        allowed_tools=["Bash", "Read", "Grep", "Glob", "WebFetch"],
        mcp_servers={
            "playwright-cli": {"command": "playwright-cli"},
        },
        stderr=lambda line: logger.debug("CLI stderr: %s", line.rstrip()),
    )


async def crawl_one(
    university: str,
    url: str,
    config: CrawlConfig,
    semaphore: asyncio.Semaphore | None = None,
) -> UniversityInfo:
    """单个 Agent 异步抓取一所高校."""
    async def _run():
        system_prompt, user_prompt = build_crawl_prompt(university, url)
        agent_config = _build_agent_config(config, system_prompt)
        agent = Agent(agent_config)

        console.print(f"[bold cyan]开始: {university}[/] ({url})")
        logger.info("Crawling %s | %s", university, url)

        response_text, stats = await agent.aask(user_prompt, output_type=UniversityInfo)

        console.print(
            f"  [dim]{stats.model} | {stats.turns} turns | "
            f"tools={stats.tool_calls} | api={stats.duration_api_ms}ms | "
            f"cost=${stats.cost_usd or 0:.4f}[/]"
        )

        # 优先使用 structured_output（dict），降级到 JSON 文本解析
        if stats.structured_output and isinstance(stats.structured_output, dict):
            result = UniversityInfo.model_validate(stats.structured_output)
        else:
            result = UniversityInfo.model_validate_json(response_text)
        _save_result(result, config.output_dir)

        console.print(
            f"  [green]完成[/] 招生:{len(result.admission_guide)} | "
            f"学院:{len(result.colleges)} | "
            f"转专业:{len(result.transfer_policy)} | "
            f"推免:{len(result.postgrad_recommend)}"
        )
        return result

    if semaphore:
        async with semaphore:
            return await _run()
    return await _run()


async def crawl_batch(
    universities: list[dict],
    config: CrawlConfig,
    workers: int = 3,
) -> list[UniversityInfo]:
    """并发抓取多所高校."""
    config.output_dir.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(workers)
    total = len(universities)

    console.print(Panel(
        f"目标: {total} 所高校 | 并发: {workers} | 模型: {config.model}",
        title="高校信息抓取", style="bold",
    ))

    tasks = [crawl_one(u["name"], u["url"], config, semaphore) for u in universities]

    results = []
    for coro in asyncio.as_completed(tasks):
        try:
            result = await coro
            results.append(result)
        except Exception as e:
            logger.error("Failed: %s", e)
            console.print(f"  [red]失败: {e}[/]")

    console.print(Panel(
        f"抓取完成: {len(results)}/{total} 所高校成功\n"
        f"输出目录: {config.output_dir}",
        title="汇总", style="bold green",
    ))
    return results


def crawl_batch_sync(
    universities: list[dict],
    config: CrawlConfig,
    workers: int = 3,
) -> list[UniversityInfo]:
    """同步入口."""
    return asyncio.run(crawl_batch(universities, config, workers))


def _save_result(result: UniversityInfo, output_dir: Path) -> Path:
    """保存单所高校结果为 JSON."""
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{result.university}.json"
    path.write_text(result.model_dump_json(indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Saved to %s", path)
    return path
