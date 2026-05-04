"""配置模块 — 爬取配置、高校列表加载."""

import csv
from dataclasses import dataclass, field
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent.parent / "data" / "92_list.csv"


@dataclass
class CrawlConfig:
    """爬取配置."""

    model: str | None = None
    max_turns: int = 100
    output_dir: Path = field(default_factory=lambda: Path("data/output"))
    csv_path: Path = field(default_factory=lambda: CSV_PATH)

    @classmethod
    def from_args(cls, **kwargs) -> "CrawlConfig":
        """从参数创建，.env 值优先于 CLI 参数."""
        from gk.env import load_env

        env = load_env()
        return cls(
            model=env.get("model") or kwargs.get("model"),
            max_turns=kwargs.get("max_turns", 100),
            output_dir=Path(kwargs.get("output_dir", "data/output")),
            csv_path=kwargs.get("csv_path"),
        )


def load_universities(csv_path: Path | None = None) -> list[dict]:
    """从 CSV 加载高校列表."""
    path = csv_path or CSV_PATH
    if not path.exists():
        raise FileNotFoundError(f"高校列表不存在: {path}")

    universities = []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            universities.append({
                "name": row["学校名称"].strip(),
                "province": row["所在省份"].strip(),
                "url": row["学校官网"].strip(),
                "is_985": row["是否985"].strip() == "是",
                "is_211": row["是否211"].strip() == "是",
            })
    return universities


def match_universities(
    all_universities: list[dict],
    names: list[str] | None = None,
) -> list[dict]:
    """按名称过滤高校（支持模糊匹配）."""
    if not names:
        return all_universities

    matched = []
    for name in names:
        name = name.strip()
        for u in all_universities:
            if name in u["name"] or u["name"] in name:
                matched.append(u)
                break
    return matched


def filter_completed(
    universities: list[dict],
    output_dir: Path,
) -> list[dict]:
    """跳过 output 目录中已存在的高校，实现断点续跑.

    匹配规则：CSV 学校名 → output 中 {学校名}.json 文件。
    名称不一致的会保留在结果中（不会被误跳过）。
    """
    if not output_dir.exists():
        return universities

    done_names = {f.stem for f in output_dir.glob("*.json")}

    remaining = []
    skipped = []
    for u in universities:
        if u["name"] in done_names:
            skipped.append(u["name"])
        else:
            remaining.append(u)

    if skipped:
        logger = __import__("logging").getLogger("gk.config")
        logger.info(
            "断点续跑: 跳过 %d 所已完成高校，剩余 %d 所",
            len(skipped), len(remaining),
        )
        if len(skipped) <= 20:
            logger.debug("已跳过: %s", ", ".join(skipped))

    return remaining
