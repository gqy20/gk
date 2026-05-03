"""并发调度层 — 多 Agent 并行抓取高校信息."""

import asyncio
import logging
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from gk.agent import Agent, AgentConfig
from gk.config import CrawlConfig
from gk.models import UniversityInfo
from gk.playwright_session import PlaywrightSession, close_session
from gk.prompts import build_crawl_prompt

logger = logging.getLogger("gk.crawler")
console = Console()


def _build_agent_config(
    config: CrawlConfig,
    system_prompt: str,
    session: PlaywrightSession | None = None,
) -> AgentConfig:
    """构建 Agent 配置 — 白名单限制只允许项目 MCP 工具，排除系统级 MCP.

    Args:
        config: 爬取配置
        system_prompt: 系统提示词
        session: 可选的 Playwright session，用于进程隔离
    """
    agent_config = AgentConfig(
        model=config.model,
        system_prompt=system_prompt,
        max_turns=config.max_turns,
        permission_mode="bypassPermissions",
        skills=["playwright-cli"],
        allowed_tools=[
            # 基础工具
            "Bash", "Read", "Grep", "Glob", "StructuredOutput",
            # 项目 MCP: crawl-mcp（.mcp.json 配置）
            "mcp__crawl-mcp__crawl_single",
            "mcp__crawl-mcp__crawl_batch",
            "mcp__crawl-mcp__crawl_site",
            "mcp__crawl-mcp__extract_url",
            "mcp__crawl-mcp__search_text",
            "mcp__crawl-mcp__search_news",
            "mcp__crawl-mcp__search_images",
            "mcp__crawl-mcp__search_videos",
            "mcp__crawl-mcp__search_books",
            # playwright-cli skill
            "Bash(playwright-cli:*)",
        ],
        stderr=lambda line: logger.debug("CLI stderr: %s", line.rstrip()),
    )
    # 如果提供了 session，设置环境变量以隔离 playwright 进程
    if session:
        agent_config.env = session.env
    return agent_config


async def crawl_one(
    university: str,
    url: str,
    config: CrawlConfig,
    semaphore: asyncio.Semaphore | None = None,
) -> UniversityInfo:
    """单个 Agent 异步抓取一所高校.

    每个任务使用独立的 Playwright session，确保并行时进程隔离。
    """
    async def _run(session: PlaywrightSession):
        system_prompt, user_prompt = build_crawl_prompt(university, url)
        agent_config = _build_agent_config(config, system_prompt, session)
        agent = Agent(agent_config)

        console.print(f"[bold cyan]开始: {university}[/] ({url})")
        logger.info("Crawling %s | %s | session=%s", university, url, session.session_name)

        try:
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

            filled = {
                k: len(v) for k, v in {
                    "招生章程": result.admission_guide,
                    "招生计划": result.enrollment_plan,
                    "历年录取": result.historical_admission,
                    "转专业政策": result.transfer_policy,
                    "大类分流": result.major_streaming,
                    "培养方案": result.training_program,
                    "辅修/双学位": result.minor_program,
                    "就业报告": result.employment_report,
                    "推免": result.postgrad_recommend,
                    "竞赛科研": result.competition_research,
                    "学院": result.colleges,
                    "学生经验": result.student_experiences,
                }.items() if v
            }
            summary = " | ".join(f"{k}:{v}" for k, v in filled.items())
            console.print(f"  [green]完成[/] {summary}")
            return result
        finally:
            # 确保清理 playwright session
            await close_session(session.session_name)
            logger.debug("Session %s cleaned up", session.session_name)

    session = PlaywrightSession()
    if semaphore:
        async with semaphore:
            return await _run(session)
    return await _run(session)


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
