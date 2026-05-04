"""命令行入口 — 高校信息并行爬取."""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console

console = Console()
LOG_DIR = Path(__file__).parent.parent.parent / "logs"


def run_crawl(args: argparse.Namespace) -> None:
    """高校信息抓取模式."""
    from gk.config import CrawlConfig, load_universities, match_universities, filter_completed
    from gk.crawler import crawl_batch_sync

    universities = load_universities(args.csv)
    output_dir = Path(args.output)

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

    # 断点续跑：默认跳过已完成，--force 强制全量重跑
    if not args.force:
        before = len(targets)
        targets = filter_completed(targets, output_dir)
        skipped = before - len(targets)
        if skipped > 0:
            console.print(f"[yellow]断点续跑: 跳过 {skipped} 所已完成高校[/]")
    else:
        console.print("[yellow]强制模式: 全量重跑（不跳过已完成的）[/]")

    console.print(f"[bold]目标高校: {len(targets)} 所[/]")
    for u in targets:
        console.print(f"  - {u['name']} ({u['url']})")

    config = CrawlConfig.from_args(model=args.model, output_dir=args.output)
    crawl_batch_sync(targets, config, workers=args.workers, strict_mcp=not args.disable_strict_mcp)


def main() -> None:
    parser = argparse.ArgumentParser(description="GK — 高校信息并行爬取工具")

    parser.add_argument("-u", "--universities", nargs="+", help="目标高校名称（空格分隔）")
    parser.add_argument("-a", "--all", action="store_true", help="抓取全部高校")
    parser.add_argument("-o", "--output", default="data/output", help="输出目录（默认 data/output）")
    parser.add_argument("-m", "--model", default=None, help="指定模型")
    parser.add_argument("-t", "--workers", type=int, default=3, help="并行 Agent 数（默认 3）")
    parser.add_argument("-c", "--csv", type=Path, default=None, help="高校列表 CSV 路径")
    parser.add_argument("-f", "--force", action="store_true", help="强制全量重跑")
    parser.add_argument("-d", "--disable-strict-mcp", action="store_true", help="禁用严格 MCP 模式")
    parser.add_argument("-D", "--debug", action="store_true")

    args = parser.parse_args()

    log_level = logging.DEBUG if args.debug else logging.INFO
    log_format = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
    logging.basicConfig(level=log_level, format=log_format)

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"crawl_{timestamp}.log"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(logging.Formatter(log_format))
    logging.getLogger().addHandler(file_handler)

    console.print(f"[dim]日志文件: {log_file}[/]")
    run_crawl(args)


if __name__ == "__main__":
    main()
