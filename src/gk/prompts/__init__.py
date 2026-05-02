"""Prompt 加载器 — 从 YAML 文件加载 Agent 提示词."""

from pathlib import Path

import yaml

PROMPTS_DIR = Path(__file__).parent


def load_prompt(name: str) -> dict:
    """加载 {name}.yml.

    Returns:
        {'name': str, 'description': str, 'system': str, 'user_template': str}
    """
    path = PROMPTS_DIR / f"{name}.yml"
    if not path.exists():
        raise FileNotFoundError(f"Prompt 文件不存在: {path}")

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if "system" not in data or "user_template" not in data:
        raise ValueError(f"Prompt 文件缺少 system 或 user_template 字段: {path}")

    return data


def build_crawl_prompt(university: str, url: str) -> tuple[str, str]:
    """构建抓取任务的 (system_prompt, user_prompt)."""
    prompt_data = load_prompt("crawl")
    system = prompt_data["system"]
    user = prompt_data["user_template"].format(university=university, url=url)
    return system, user
