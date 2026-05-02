"""配置模块 — 爬取配置、高校列表加载."""

import csv
from dataclasses import dataclass, field
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent.parent / "data" / "92_list.csv"


@dataclass
class CrawlConfig:
    """爬取配置."""

    model: str | None = None
    max_turns: int = 30
    output_dir: Path = field(default_factory=lambda: Path("data/output"))
    csv_path: Path = field(default_factory=lambda: CSV_PATH)


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
