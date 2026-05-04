"""环境配置加载 — .env 优先级最高."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent.parent


def load_env() -> dict[str, str | None]:
    """加载 .env 文件，返回 ANTHROPIC_* 配置字典."""
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        load_dotenv(env_file)

    return {
        "api_key": os.getenv("ANTHROPIC_API_KEY"),
        "base_url": os.getenv("ANTHROPIC_BASE_URL"),
        "model": os.getenv("ANTHROPIC_MODEL"),
    }
