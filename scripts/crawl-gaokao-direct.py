"""
阳光高考网站抓取脚本 (crawl4ai 直连版本)

功能：
1. 使用 crawl4ai 的 AsyncWebCrawler 直接抓取
2. 绕过 WAF 反爬虫（crawl4ai 内部处理了 TLS 指纹和浏览器模拟）
3. BeautifulSoup + Markdown 解析
4. 批量并行抓取
5. 断点续传

运行:
    /home/qy113/workspace/soft/miniforge3/bin/python3.12 scripts/crawl-gaokao-direct.py
"""

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from bs4 import BeautifulSoup

# ============ 配置 ============

BASE_URL = "https://gaokao.chsi.com.cn"
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "data" / "gaokao-output"
SCH_ID_CACHE = PROJECT_ROOT / "data" / "gaokao-schids.json"

MAX_CONCURRENT = 3       # 页面抓取并发数
REQUEST_DELAY = 0.5      # 请求间隔（秒）
PAGE_TIMEOUT = 30000     # 页面加载超时（毫秒）

# ============ 数据模型 ============


@dataclass
class SchoolBasicInfo:
    name: str = ""
    sch_id: str = ""
    location: str = ""
    address: str = ""
    attributes: list = field(default_factory=list)
    phone: str = ""
    website: str = ""
    enrollment_website: str = ""
    admin_department: str = ""


@dataclass
class DocItem:
    title: str = ""
    url: str = ""
    summary: str = ""
    attachments: list = field(default_factory=list)
    publish_date: str = ""
    source_department: str = ""


@dataclass
class StudentExperienceItem:
    topic: str = ""
    content: str = ""
    source_type: str = ""
    source_url: str = ""


@dataclass
class UniversityInfo:
    university: str = ""
    official_url: str = ""
    crawl_time: str = ""
    admission_guide: list = field(default_factory=list)
    enrollment_plan: list = field(default_factory=list)
    historical_admission: list = field(default_factory=list)
    transfer_policy: list = field(default_factory=list)
    transfer_announcement: list = field(default_factory=list)
    major_streaming: list = field(default_factory=list)
    training_program: list = field(default_factory=list)
    minor_program: list = field(default_factory=list)
    employment_report: list = field(default_factory=list)
    postgrad_recommend: list = field(default_factory=list)
    competition_research: list = field(default_factory=list)
    colleges: list = field(default_factory=list)
    student_experiences: list = field(default_factory=list)
    notes: str = ""
    missing_categories: list = field(default_factory=list)
    basic_info: Optional[SchoolBasicInfo] = None
    school_intro: str = ""
    dormitory: str = ""
    admission_rules: str = ""
    faq: list = field(default_factory=list)
    fees: list = field(default_factory=list)


# ============ 工具函数 ============


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


async def save_json(path: Path, data: dict):
    ensure_dir(path.parent)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    )


def load_json(path: Path) -> Optional[list]:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_output_path(sch_id: str) -> Path:
    return OUTPUT_DIR / f"{sch_id}.json"


def is_already_crawled(sch_id: str) -> bool:
    path = get_output_path(sch_id)
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return bool(data.get("basic_info") and data["basic_info"].get("name"))
    except (json.JSONDecodeError, OSError):
        return False


# ============ 解析函数 ============


def parse_school_list_page(markdown: str) -> list[dict]:
    """从学校列表页 markdown 解析学校列表"""
    schools = []
    # 匹配 [学校名](链接) 的模式
    pattern = r'\[\s*([^\]]+?)\s*\]\((https://gaokao\.chsi\.com\.cn/sch/schoolInfo--schId-(\d+)\.dhtml)\)'
    seen = set()
    for match in re.finditer(pattern, markdown):
        name = match.group(1).strip()
        url = match.group(2)
        sch_id = match.group(3)
        if sch_id not in seen and name and len(name) < 30:
            nav_words = {'首页', '资讯', '志愿', '咨询', '动态', '评析', '院校库', '专业库',
                        '满意度', '推荐', '更多', '政策', '选科', '成绩', '章程', '公示',
                        '录取结果', '高职', '工作动态', '心理测评', '直播', '批次线',
                        '专业解读', '各地网站', '职业前景', '特殊类型', '志愿填报',
                        '招办访谈', '登录', '注册'}
            if name not in nav_words:
                seen.add(sch_id)
                schools.append({
                    "name": name,
                    "sch_id": sch_id,
                    "url": url
                })
    return schools


def parse_basic_info(markdown: str, sch_id: str) -> SchoolBasicInfo:
    """解析学校基础信息"""
    info = SchoolBasicInfo(sch_id=sch_id)
    lines = markdown.split('\n')

    # 学校名称 - 通常在 logo 图片后的第一个链接
    for i, line in enumerate(lines):
        if f'common/xh/{sch_id}.jpg' in line:
            for j in range(i + 1, min(i + 5, len(lines))):
                match = re.search(r'\[\s*([^\]]+?)\s*\]\(', lines[j])
                if match:
                    candidate = match.group(1).strip()
                    if len(candidate) > 2 and 'schoolInfoMain' in lines[j]:
                        info.name = candidate
                        break
            break

    dept_match = re.search(r'教育行政主管部门[：:]\s*(.+)', markdown)
    if dept_match:
        info.admin_department = dept_match.group(1).strip()

    if '985' in markdown:
        info.attributes.append("985")
    if '211' in markdown:
        info.attributes.append("211")
    if '双一流' in markdown:
        info.attributes.append("双一流")

    loc_match = re.search(r'所在地[：:]\s*([^\n]+)', markdown)
    if loc_match:
        info.location = loc_match.group(1).strip()

    addr_match = re.search(r'详细地址[：:]\s*([^\n]+)', markdown)
    if addr_match:
        info.address = addr_match.group(1).strip()

    phone_match = re.search(r'官方电话[：:]\s*([^\n\s]+)', markdown)
    if phone_match:
        info.phone = phone_match.group(1).strip()

    website_match = re.search(r'官方网址[：:]\s*<([^>]+)>', markdown)
    if website_match:
        info.website = website_match.group(1).strip()

    enroll_match = re.search(r'招生网址[：:]\s*<([^>]+)>', markdown)
    if enroll_match:
        info.enrollment_website = enroll_match.group(1).strip()

    return info


def parse_school_detail(markdown: str, sch_id: str, school_name: str) -> UniversityInfo:
    """解析学校详情页 markdown"""
    info = UniversityInfo(
        university=school_name,
        crawl_time=time.strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    info.basic_info = parse_basic_info(markdown, sch_id)
    info.official_url = info.basic_info.website or ""

    # 院校满意度
    satisfaction = {}
    for sat_type in ['综合满意度', '环境满意度', '生活满意度']:
        sat_match = re.search(rf'{sat_type}\s*(\d+)人投票', markdown)
        if sat_match:
            satisfaction[sat_type] = sat_match.group(1) + "人投票"
    if satisfaction:
        info.notes = f"院校满意度: {satisfaction}"

    # 专业满意度
    major_pattern = r'(\d+)\s+([^\n]+?)\s+([\d.]+)\s*（(\d+)人）'
    major_section = re.search(r'专业满意度.*?\n(.*?)(?=专业推荐|考生咨询|分享到)', markdown, re.DOTALL)
    if major_section:
        for match in re.finditer(major_pattern, major_section.group(1)):
            _, name, score, voters = match.groups()
            info.major_streaming.append({
                "title": name.strip(),
                "summary": f"满意度 {score} ({voters}人投票)",
                "url": "", "attachments": [], "publish_date": "", "source_department": ""
            })

    # 专业推荐
    rec_section = re.search(r'专业推荐人数.*?\n(.*?)(?=专业推荐指数|考生咨询|分享到)', markdown, re.DOTALL)
    if rec_section:
        for match in re.finditer(major_pattern, rec_section.group(1)):
            _, name, score, voters = match.groups()
            info.training_program.append({
                "title": name.strip(),
                "summary": f"推荐 {score} ({voters}人推荐)",
                "url": "", "attachments": [], "publish_date": "", "source_department": ""
            })

    # FAQ
    qa_section = re.search(r'考生咨询.*?\n(.*?)(?=分享到)', markdown, re.DOTALL)
    if qa_section:
        qa_pattern = r'([^\n]+?) __\n([^\n]+?)\n([^\n]+?)\n([^\n]+)'
        for match in re.finditer(qa_pattern, qa_section.group(1)):
            topic, question, _, answer = match.groups()
            info.faq.append({
                "topic": topic.strip(),
                "content": f"Q: {question.strip()}\nA: {answer.strip()}",
                "source_type": "考生咨询",
                "source_url": ""
            })

    return info


def serialize_info(info: UniversityInfo) -> dict:
    return {
        "university": info.university,
        "official_url": info.official_url,
        "crawl_time": info.crawl_time,
        "basic_info": asdict(info.basic_info) if info.basic_info else None,
        "school_intro": info.school_intro,
        "admission_rules": info.admission_rules,
        "dormitory": info.dormitory,
        "colleges": info.colleges,
        "admission_guide": info.admission_guide,
        "enrollment_plan": info.enrollment_plan,
        "historical_admission": info.historical_admission,
        "transfer_policy": info.transfer_policy,
        "transfer_announcement": info.transfer_announcement,
        "major_streaming": info.major_streaming,
        "training_program": info.training_program,
        "minor_program": info.minor_program,
        "employment_report": info.employment_report,
        "postgrad_recommend": info.postgrad_recommend,
        "competition_research": info.competition_research,
        "student_experiences": info.student_experiences,
        "faq": info.faq,
        "fees": info.fees,
        "notes": info.notes,
        "missing_categories": info.missing_categories,
    }


# ============ Crawl4AI 配置 ============


def create_crawler_config() -> CrawlerRunConfig:
    """创建爬虫配置"""
    markdown_generator = DefaultMarkdownGenerator(
        options={
            "citations": False,
            "body_width": None,
            "ignore_links": False,
        }
    )
    return CrawlerRunConfig(
        markdown_generator=markdown_generator,
        page_timeout=PAGE_TIMEOUT,
        delay_before_return_html=3.0,
    )


# ============ 抓取函数 ============


async def crawl_school_list(crawler: AsyncWebCrawler) -> list[dict]:
    """获取学校列表"""
    print("获取学校列表...")
    all_schools = []
    config = create_crawler_config()

    page_num = 1
    while True:
        start = (page_num - 1) * 20
        if page_num == 1:
            list_url = f"{BASE_URL}/sch/search--mindex-8,searchText-*,page-{page_num},size-50.dhtml"
        else:
            list_url = f"{BASE_URL}/sch/search--mindex-8,searchText-*,size-50,start-{start}.dhtml"

        print(f"  第 {page_num} 页...")
        try:
            result = await crawler.arun(url=list_url, config=config)
            if not result.success:
                print(f"    抓取失败: {result.error_message}")
                break

            schools = parse_school_list_page(result.markdown.raw_markdown)
            if not schools:
                break

            all_schools.extend(schools)
            print(f"    本页 {len(schools)} 所，累计 {len(all_schools)} 所")

            if len(schools) < 10 or page_num >= 150:
                break

            page_num += 1
            await asyncio.sleep(REQUEST_DELAY)

        except Exception as e:
            print(f"    异常: {e}")
            break

    seen = set()
    unique = []
    for s in all_schools:
        if s['sch_id'] not in seen:
            seen.add(s['sch_id'])
            unique.append(s)

    return unique


async def crawl_school(sch_id: str, school_name: str, crawler: AsyncWebCrawler) -> UniversityInfo:
    """抓取单个学校详情"""
    url = f"{BASE_URL}/sch/schoolInfo--schId-{sch_id}.dhtml"
    config = create_crawler_config()
    result = await crawler.arun(url=url, config=config)

    if not result.success:
        raise Exception(result.error_message or "Unknown error")

    return parse_school_detail(result.markdown.raw_markdown, sch_id, school_name)


async def crawl_worker(school: dict, crawler: AsyncWebCrawler, stats: dict) -> None:
    """工作协程"""
    sch_id = school["sch_id"]
    name = school["name"]

    if is_already_crawled(sch_id):
        stats["skipped"] += 1
        return

    try:
        info = await crawl_school(sch_id, name, crawler)
        await save_json(get_output_path(sch_id), serialize_info(info))
        stats["success"] += 1
        print(f"✅ {name} (schId={sch_id})")
    except Exception as e:
        stats["failed"] += 1
        print(f"❌ {name} (schId={sch_id}): {e}")


# ============ 主流程 ============


async def main():
    print("=== 阳光高考数据抓取 (crawl4ai 直连版) ===\n")
    ensure_dir(OUTPUT_DIR)

    # 使用单个 AsyncWebCrawler 实例（内部会复用浏览器上下文）
    async with AsyncWebCrawler(verbose=False) as crawler:
        # 1. 获取学校列表
        schools = await crawl_school_list(crawler)

        if not schools:
            print("未能获取学校列表，尝试从缓存加载...")
            schools = load_json(SCH_ID_CACHE) or []

        if not schools:
            print("没有学校数据，退出")
            return

        await save_json(SCH_ID_CACHE, schools)
        print(f"\n共 {len(schools)} 所学校\n")

        # 2. 并发抓取
        stats = {"success": 0, "failed": 0, "skipped": 0}
        semaphore = asyncio.Semaphore(MAX_CONCURRENT)

        async def bounded_worker(school: dict):
            async with semaphore:
                await crawl_worker(school, crawler, stats)
                await asyncio.sleep(REQUEST_DELAY)

        tasks = [asyncio.create_task(bounded_worker(s)) for s in schools]
        await asyncio.gather(*tasks, return_exceptions=True)

        print(f"\n========== 完成 ==========")
        print(f"成功: {stats['success']} | 失败: {stats['failed']} | 跳过(已存在): {stats['skipped']}")
        print(f"输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
