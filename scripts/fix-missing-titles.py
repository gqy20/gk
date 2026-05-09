"""
补全 crawl-sources.json 中缺失的 title 字段。
对每个无 title 的来源 URL 发 HTTP 请求获取 <title> 标签内容。
知乎等反爬站点会跳过（保留原样）。
"""

import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path

SOURCES_PATH = Path(__file__).parent.parent / "web" / "public" / "data" / "crawl-sources.json"
OUTPUT_PATH = SOURCES_PATH  # 原地更新

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

# 跳过的域名（已知反爬或无法提取）
SKIP_DOMAINS = {"zhihu.com", "zhuanlan.zhihu.com"}

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)


def fetch_title(url: str, timeout: int = 8) -> str | None:
    """从 URL 获取页面 <title>，失败返回 None"""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).hostname or ""
        if any(d in domain for d in SKIP_DOMAINS):
            return None

        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=timeout)
        html = resp.read().decode("utf-8", errors="ignore")
        m = TITLE_RE.search(html)
        if m:
            title = m.group(1).strip()
            # 清理多余空白
            title = re.sub(r"\s+", " ", title).strip()
            return title if title else None
    except Exception:
        pass
    return None


def main():
    with open(SOURCES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 收集所有缺失 title 的条目
    missing: list[tuple[str, str, int, dict]] = []
    for school_name, categories in data.items():
        for cat_key, sources in categories.items():
            for idx, src in enumerate(sources):
                if not src.get("title"):
                    missing.append((school_name, cat_key, idx, src))

    total = len(missing)
    print(f"共 {total} 条无标题来源")

    if total == 0:
        print("无需修复")
        return

    fixed = 0
    skipped = 0
    failed = 0

    for i, (school_name, cat_key, idx, src) in enumerate(missing):
        url = src.get("url", "")
        if not url:
            continue

        # 进度
        if i % 20 == 0 or i == total - 1:
            print(f"[{i+1}/{total}] 已修复 {fixed} / 跳过 {skipped} / 失败 {failed}")

        title = fetch_title(url)

        if title:
            src["title"] = title
            fixed += 1
        elif url and any(d in url for d in SKIP_DOMAINS):
            skipped += 1
        else:
            failed += 1

        # 礼貌间隔，避免被限流
        time.sleep(0.15)

    # 写回
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n完成！修复 {fixed} 条，跳过 {skipped} 条（反爬），失败 {failed} 条")
    print(f"已写入: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
