"""命令行入口."""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from gk.agent import Agent, AgentConfig

console = Console()
LOG_DIR = Path(__file__).parent.parent.parent / "logs"


def run_interactive(config: AgentConfig) -> None:
    """交互式对话模式."""
    agent = Agent(config)
    console.print(Panel("GK Agent — 输入消息开始对话，Ctrl+C 退出", style="bold green"))

    while True:
        try:
            prompt = console.input("[bold cyan]> [/]")
            if not prompt.strip():
                continue
            if prompt.strip().lower() in {"exit", "quit", "q"}:
                console.print("[dim]再见！[/]")
                break

            response, stats = agent.ask(prompt)
            console.print(Panel(response, title="Agent", border_style="blue"))
            console.print(
                f"[dim]{stats.model} | {stats.turns} turns | {stats.duration_ms}ms[/]"
            )

        except KeyboardInterrupt:
            console.print("\n[dim]再见！[/]")
            break
        except Exception as e:
            console.print(f"[red]错误: {e}[/]")


def run_single(config: AgentConfig, prompt: str) -> None:
    """单次查询模式."""
    agent = Agent(config)
    response, stats = agent.ask(prompt)
    console.print(Panel(response, title="Agent", border_style="blue"))
    console.print(f"[dim]{stats.model} | {stats.turns} turns | {stats.duration_ms}ms[/]")


def run_crawl(args: argparse.Namespace) -> None:
    """高校信息抓取模式."""
    from gk.config import CrawlConfig, load_universities, match_universities
    from gk.crawler import crawl_batch_sync

    universities = load_universities(args.csv)

    if args.all:
        targets = universities
    elif args.universities:
        targets = match_universities(universities, args.universities)
        if not targets:
            console.print(f"[red]未匹配到高校: {args.universities}[/]")
            sys.exit(1)
    else:
        console.print("[red]请指定 --universities 或 --all[/]")
        sys.exit(1)

    console.print(f"[bold]目标高校: {len(targets)} 所[/]")
    for u in targets:
        console.print(f"  - {u['name']} ({u['url']})")

    config = CrawlConfig(model=args.model, output_dir=Path(args.output))
    crawl_batch_sync(targets, config, workers=args.workers)


def main() -> None:
    parser = argparse.ArgumentParser(description="GK — Claude Agent SDK 智能体")
    subparsers = parser.add_subparsers(dest="command")

    # chat 子命令
    chat_parser = subparsers.add_parser("chat", help="对话模式")
    chat_parser.add_argument("prompt", nargs="?", help="单次查询内容")
    chat_parser.add_argument("--model", default=None)
    chat_parser.add_argument("--system", default="")

    # crawl 子命令
    crawl_parser = subparsers.add_parser("crawl", help="抓取高校信息")
    crawl_parser.add_argument(
        "--universities", nargs="+", help="目标高校名称（空格分隔）"
    )
    crawl_parser.add_argument("--all", action="store_true", help="抓取全部高校")
    crawl_parser.add_argument(
        "--output", default="data/output", help="输出目录（默认 data/output）"
    )
    crawl_parser.add_argument("--model", default=None)
    crawl_parser.add_argument("--workers", type=int, default=3, help="并行 Agent 数（默认 3）")
    crawl_parser.add_argument("--csv", type=Path, help="高校列表 CSV 路径")

    # 全局参数
    parser.add_argument("--debug", action="store_true")

    args = parser.parse_args()

    log_level = logging.DEBUG if args.debug else logging.INFO
    log_format = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"

    # 控制台日志
    logging.basicConfig(level=log_level, format=log_format)

    # 文件日志 — 写入 logs/ 目录
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    command = args.command or "default"
    log_file = LOG_DIR / f"{command}_{timestamp}.log"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(logging.Formatter(log_format))
    logging.getLogger().addHandler(file_handler)

    console.print(f"[dim]日志文件: {log_file}[/]")

    if args.command == "crawl":
        run_crawl(args)
    elif args.command == "chat":
        config = AgentConfig(model=args.model, system_prompt=args.system)
        if args.prompt:
            run_single(config, args.prompt)
        else:
            run_interactive(config)
    else:
        config = AgentConfig()
        run_interactive(config)


if __name__ == "__main__":
    main()
