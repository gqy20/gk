"""
阳光高考网站抓取脚本 (Playwright 版本)

功能：
1. 抓取院校库学校列表（支持分页）
2. 抓取各学校详情页（简介、专业、录取规则等）
3. 并行抓取优化
4. 输出与现有 UniversityInfo 兼容的 JSON

运行:
    source .venv/bin/activate && python scripts/crawl-gaokao.py
"""

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from playwright.async_api import async_playwright, BrowserContext, Page

# ============ 配置 ============

BASE_URL = "https://gaokao.chsi.com.cn"
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "data" / "gaokao-output"
SCH_ID_CACHE = PROJECT_ROOT / "data" / "gaokao-schids.json"

# categoryId → 页面类型映射
CATEGORY_MAP = {
    "26172": {"name": "school_intro", "alias": ["学校简介", "院校简介"]},
    "26177": {"name": "departments", "alias": ["院系设置"]},
    "417809": {"name": "majors", "alias": ["专业介绍"]},
    "26187": {"name": "admission_rules", "alias": ["录取规则"]},
    "26204": {"name": "scholarship", "alias": ["奖学金设置"]},
    "26208": {"name": "dormitory", "alias": ["食宿条件"]},
    "26221": {"name": "contact", "alias": ["联系办法"]},
    "420549": {"name": "faq", "alias": ["答考生问"]},
    "26201": {"name": "fees", "alias": ["收费项目"]},
    "26216": {"name": "employment", "alias": ["毕业生就业"]},
    "26213": {"name": "facilities", "alias": ["基础设施"]},
    "26196": {"name": "health_requirements", "alias": ["体检要求"]},
    "423317": {"name": "admission_results", "alias": ["录取结果公示"]},
}

# 并行抓取配置
MAX_CONCURRENT = 3  # 最大并发数

# ============ 数据模型 ============


@dataclass
class DocItem:
    title: str = ""
    url: str = ""
    summary: str = ""
    attachments: list = field(default_factory=list)
    publish_date: str = ""
    source_department: str = ""


@dataclass
class CollegeItem:
    name: str = ""
    url: str = ""
    disciplines: list = field(default_factory=list)


@dataclass
class StudentExperienceItem:
    topic: str = ""
    content: str = ""
    source_type: str = ""
    source_url: str = ""


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
    # 阳光高考特有字段
    basic_info: Optional[SchoolBasicInfo] = None
    school_intro: str = ""
    dormitory: str = ""
    admission_rules: str = ""
    faq: list = field(default_factory=list)
    fees: list = field(default_factory=list)


# ============ 工具函数 ============


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def save_json(path: Path, data: dict):
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path: Path) -> Optional[list]:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ============ 解析函数 ============


def parse_school_list_page(html: str) -> list:
    """解析学校列表页"""
    schools = []
    # 匹配包含 js-yxk-yxmc 类的 <a> 标签，获取学校名称和 schId
    pattern = r'<a[^>]+class="[^"]*js-yxk-yxmc[^"]*"[^>]*>([^<]+)</a>'
    for match in re.finditer(pattern, html):
        name = match.group(1).strip()
        # 获取对应的 schId - 往前找 schoolInfo--schId-{id}.dhtml
        start = match.start()
        id_match = re.search(r'/sch/schoolInfo--schId-(\d+)\.dhtml', html[start-500:start])
        if id_match and name and len(name) < 30:
            sch_id = id_match.group(1)
            schools.append({
                "name": name,
                "sch_id": sch_id,
                "url": f"{BASE_URL}/sch/schoolInfo--schId-{sch_id}.dhtml"
            })
    return schools


def parse_basic_info(html: str, sch_id: str) -> SchoolBasicInfo:
    """解析学校基础信息页"""
    info = SchoolBasicInfo(sch_id=sch_id)

    # 学校名称 - class="name yxmc"
    name_match = re.search(r'<a[^>]+class="[^"]*yxmc[^"]*"[^>]*>([^<]+)</a>', html)
    if name_match:
        info.name = name_match.group(1).strip()

    # 所在地 - class="yxszd"
    location_match = re.search(r'class="yxszd"[^>]*>([^<]+)</span>', html)
    if location_match:
        info.location = location_match.group(1).strip()

    # 详细地址 - class="txdz"
    address_match = re.search(r'class="txdz"[^>]*>([^<]+)</span>', html)
    if address_match:
        info.address = address_match.group(1).strip()

    # 联系电话 - class="yxdh" 或直接匹配
    phone_match = re.search(r'官方电话：([^<\s]+)', html)
    if phone_match:
        info.phone = phone_match.group(1).strip()

    # 官方网站
    website_match = re.search(r'官方网址：<a[^>]+href="([^"]+)"', html)
    if website_match:
        info.website = website_match.group(1)

    # 招生网址
    enroll_match = re.search(r'招生网址：<a[^>]+href="([^"]+)"', html)
    if enroll_match:
        info.enrollment_website = enroll_match.group(1)

    # 院校特性 (985, 211, 双一流)
    attrs = []
    if '985' in html or '985' in re.sub(r'\s', '', html):
        attrs.append("985")
    if '211' in html:
        attrs.append("211")
    if '双一流' in html:
        attrs.append("双一流")
    if '"双一流"建设高校' in html or '双一流' in html:
        if "双一流" not in attrs:
            attrs.append("双一流")
    info.attributes = attrs

    # 教育行政主管部门
    dept_match = re.search(r'教育行政主管部门：<span[^>]+>([^<]+)</span>', html)
    if dept_match:
        info.admin_department = dept_match.group(1).strip()

    return info


def parse_text_content(html: str) -> str:
    """解析文本内容页，提取主要内容"""
    # 移除脚本和样式
    text = re.sub(r'<script[^>]*>[\s\S]*?</script>', "", html)
    text = re.sub(r'<style[^>]*>[\s\S]*?</style>', "", text)

    # 移除导航和页眉页脚
    text = re.sub(r'<nav[^>]*>[\s\S]*?</nav>', "", text)
    text = re.sub(r'<header[^>]*>[\s\S]*?</header>', "", text)
    text = re.sub(r'<footer[^>]*>[\s\S]*?</footer>', "", text)

    # 移除导航栏
    text = re.sub(r'<div[^>]*class="[^"]*(?:nav|menu|header|footer|sidebar)[^"]*"[^>]*>[\s\S]*?</div>', "", text, flags=re.IGNORECASE)

    # 提取主要内容区域 - 优先查找 content-introduction
    content_match = re.search(r'<div[^>]+class="[^"]*content-introduction[^"]*"[^>]*>([\s\S]*?)</div>', text)
    if content_match:
        text = content_match.group(1)
    else:
        # 尝试 content
        content_match = re.search(r'<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]+class="[^"]*(?:footer|sidebar)|</div>\s*</div>)', text)
        if content_match:
            text = content_match.group(1)

    # 移除详情表格中的标签噪声
    text = re.sub(r'<span[^>]*class="[^"]*(?:yxmc|yxszd|txdz|yxdh|zgbmmc|syl)[^"]*"[^>]*>', "", text)
    text = re.sub(r'<[^>]+class="[^"]*(?:yxmc|yxszd|txdz|yxdh|zgbmmc|syl)[^"]*"[^>]*>', "", text)

    # 转换HTML标签
    text = re.sub(r'<br\s*/?>', "\n", text)
    text = re.sub(r'</p>', "\n\n", text)
    text = re.sub(r'</div>', "\n", text)
    text = re.sub(r'<li[^>]*>', "\n• ", text)
    text = re.sub(r'</li>', "", text)
    text = re.sub(r'<[^>]+>', "", text)

    # 清理空白和特殊字符
    text = re.sub(r'[  　]+', " ", text)  # 移除各种不间断空格
    text = re.sub(r'\n{3,}', "\n\n", text)
    text = re.sub(r'^\s+|\s+$', "", text, flags=re.MULTILINE)
    text = text.strip()

    return text


def parse_doc_list(html: str) -> list:
    """解析文档列表页"""
    docs = []

    # 先移除导航和侧边栏区域
    text = re.sub(r'<div[^>]+class="[^"]*(?:nav|menu|header|footer|sidebar|left|right)[^"]*"[^>]*>[\s\S]*?</div>', "", html, flags=re.IGNORECASE)

    # PDF 文档
    pattern = r'<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([^<]+)</a>'
    for match in re.finditer(pattern, text):
        url, title = match.groups()
        docs.append(DocItem(
            title=title.strip(),
            url=url if url.startswith("http") else BASE_URL + url
        ))

    # 普通链接 - 过滤导航
    link_pattern = r'<a[^>]+href="(/sch/[^"]+)"[^>]*>([^<]+)</a>'
    skip_words = ['schoolInfoMain', 'categoryId', 'mindex', 'sch/search', 'listzyjs', 'listZszc', 'listHireInfo']
    for match in re.finditer(link_pattern, text):
        url, title = match.groups()
        full_url = BASE_URL + url
        if not any(w in url for w in skip_words):
            if not any(d.url == full_url for d in docs):
                docs.append(DocItem(title=title.strip(), url=full_url))

    return docs[:20]  # 限制数量


def parse_colleges(html: str) -> list:
    """解析学院列表"""
    colleges = []
    # 先移除导航和侧边栏区域
    text = re.sub(r'<div[^>]+class="[^"]*(?:nav|menu|header|footer|sidebar|left|right)[^"]*"[^>]*>[\s\S]*?</div>', "", html, flags=re.IGNORECASE)

    # 查找院系设置的链接 - 必须在内容区域内
    pattern = r'<a[^>]+href="(/sch/[^"]+)"[^>]*>([^<]+)</a>'
    seen = set()
    for match in re.finditer(pattern, text):
        url, name = match.groups()
        name = name.strip()
        # 过滤掉导航链接和短名称
        skip_words = ['学校首页', '学校简介', '专业介绍', '录取规则',
                      '奖学金设置', '食宿条件', '联系办法', '答考生问',
                      '更多信息', '收费项目', '毕业生就业', '基础设施',
                      '公示栏', '体检要求', '录取结果公示', '其他',
                      '招生章程', '高校专业选科要求', '招办访谈', '直播信息',
                      '院系设置', 'schoolInfo', 'listzyjs', 'listZszc',
                      'listHireInfo', 'categoryId', 'mindex']
        if len(name) > 4 and not any(w in url for w in skip_words):
            if url not in seen:
                seen.add(url)
                colleges.append(CollegeItem(
                    name=name,
                    url=BASE_URL + url
                ))
    return colleges[:20]  # 限制数量


# ============ 浏览器创建 ============


def get_browser_args():
    """获取浏览器启动参数"""
    return [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--disable-renderer-backgrounding",
        "--disable-ipc-flooding-protection",
        "--force-color-profile=srgb",
        "--mute-audio",
        "--disable-background-timer-throttling",
        "--disable-features=OptimizationHints,MediaRouter,DialMediaRouteProvider",
        "--disable-component-update",
        "--disable-domain-reliability",
    ]


async def create_browser_context(p: async_playwright) -> BrowserContext:
    """创建浏览器上下文"""
    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
    proxy_config = {"server": proxy} if proxy else None

    # 使用临时目录存储用户数据
    import tempfile
    user_data_dir = tempfile.mkdtemp(prefix="playwright_")

    return await p.chromium.launch_persistent_context(
        user_data_dir,
        headless=True,
        args=get_browser_args(),
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/116.0.0.0 Safari/537.36",
        viewport={"width": 1080, "height": 600},
        proxy=proxy_config,
    )


# ============ 抓取函数 ============


async def fetch_page(page: Page, url: str, retry: int = 3) -> str:
    """带重试的页面获取"""
    for i in range(retry):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # 等待 Vue 渲染
            await asyncio.sleep(5)
            return await page.evaluate('document.body.innerHTML')
        except Exception as e:
            if i == retry - 1:
                raise
            print(f"  重试 {i+1}/{retry}: {e}")
            await asyncio.sleep(2)
    return ""


async def crawl_school_list(context: BrowserContext) -> tuple[list, int]:
    """获取学校列表（支持分页）"""
    print("获取学校列表...")

    page = context.pages[0] if context.pages else await context.new_page()
    all_schools = []

    try:
        page_num = 1
        while True:
            list_url = f"{BASE_URL}/sch/search--mindex-8,searchText-*,page-{page_num},size-50.dhtml"
            print(f"  获取第 {page_num} 页...")

            await page.goto(list_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(10)  # 等待 Vue 渲染

            html = await page.evaluate('document.body.innerHTML')
            schools = parse_school_list_page(html)

            if not schools:
                break

            all_schools.extend(schools)
            print(f"    第 {page_num} 页: {len(schools)} 所学校")

            # 检查是否有下一页
            if len(schools) < 50:
                break
            page_num += 1

        # 去重
        seen = set()
        unique = []
        for s in all_schools:
            if s['sch_id'] not in seen:
                seen.add(s['sch_id'])
                unique.append(s)

        return unique, len(unique)
    finally:
        if page in context.pages:
            await page.close()


async def crawl_school_page(page: Page, sch_id: str, category_id: str) -> str:
    """抓取单个学校的单个页面（复用页面对象）"""
    url = f"{BASE_URL}/sch/schoolInfo--schId-{sch_id},categoryId-{category_id},mindex-8.dhtml"
    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
    await asyncio.sleep(4)  # 等待 Vue 渲染
    # 获取内容前检查页面是否正常加载
    body = await page.query_selector('body')
    if body is None:
        raise Exception("页面 body 为空")
    return await page.evaluate('document.body.innerHTML')


async def crawl_school(sch_id: str, school_name: str, context: BrowserContext) -> UniversityInfo:
    """抓取单个学校的所有信息"""
    info = UniversityInfo(
        university=school_name,
        crawl_time=time.strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    page = context.pages[0] if context.pages else await context.new_page()

    try:
        # 1. 抓取基础信息页
        try:
            html = await crawl_school_page(page, sch_id, "26172")
            info.basic_info = parse_basic_info(html, sch_id)
            info.official_url = info.basic_info.website or ""
        except Exception as e:
            print(f"  基础信息: 失败 ({e})")

        await asyncio.sleep(0.3)

        # 2. 抓取各子页面
        for category_id, category in CATEGORY_MAP.items():
            cat_name = category["name"]
            try:
                html = await crawl_school_page(page, sch_id, category_id)

                if cat_name == "school_intro":
                    info.school_intro = parse_text_content(html)
                elif cat_name == "dormitory":
                    info.dormitory = parse_text_content(html)
                elif cat_name == "admission_rules":
                    info.admission_rules = parse_text_content(html)
                elif cat_name == "departments":
                    info.colleges = parse_colleges(html)
                elif cat_name in ["majors", "fees", "employment", "faq"]:
                    docs = parse_doc_list(html)
                    if cat_name == "majors":
                        info.major_streaming = docs
                    elif cat_name == "fees":
                        info.fees = docs
                    elif cat_name == "employment":
                        info.employment_report = docs
                    elif cat_name == "faq":
                        info.faq = docs
                else:
                    docs = parse_doc_list(html)
                    if docs:
                        info.admission_guide = docs

                print(f"  抓取 {cat_name}: 成功")

            except Exception as e:
                print(f"  {cat_name}: 失败 ({e})")
                info.missing_categories.append(cat_name)

            await asyncio.sleep(0.2)

    except Exception as e:
        print(f"  整体抓取失败: {e}")

    return info


def save_school_info(sch_id: str, info: UniversityInfo):
    """保存单个学校的抓取结果"""
    file_path = OUTPUT_DIR / f"{sch_id}.json"
    data = {
        "university": info.university,
        "official_url": info.official_url,
        "crawl_time": info.crawl_time,
        "basic_info": asdict(info.basic_info) if info.basic_info else None,
        "school_intro": info.school_intro,
        "admission_rules": info.admission_rules,
        "dormitory": info.dormitory,
        "colleges": [asdict(c) for c in info.colleges],
        "admission_guide": [asdict(d) for d in info.admission_guide],
        "enrollment_plan": [asdict(d) for d in info.enrollment_plan],
        "historical_admission": [asdict(d) for d in info.historical_admission],
        "transfer_policy": [asdict(d) for d in info.transfer_policy],
        "transfer_announcement": [asdict(d) for d in info.transfer_announcement],
        "major_streaming": [asdict(d) for d in info.major_streaming],
        "training_program": [asdict(d) for d in info.training_program],
        "minor_program": [asdict(d) for d in info.minor_program],
        "employment_report": [asdict(d) for d in info.employment_report],
        "postgrad_recommend": [asdict(d) for d in info.postgrad_recommend],
        "competition_research": [asdict(d) for d in info.competition_research],
        "student_experiences": [asdict(s) for s in info.student_experiences],
        "faq": [asdict(d) for d in info.faq],
        "fees": [asdict(d) for d in info.fees],
        "notes": info.notes,
        "missing_categories": info.missing_categories,
    }
    save_json(file_path, data)


# ============ 并行抓取 ============


async def crawl_single_school(school: dict, p: async_playwright, index: int, total: int) -> tuple[int, int]:
    """抓取单个学校（独立浏览器上下文）"""
    sch_id = school["sch_id"]
    name = school["name"]
    print(f"[{index}/{total}] {name} ... ", end="", flush=True)

    context = None
    try:
        context = await create_browser_context(p)
        info = await crawl_school(sch_id, name, context)
        save_school_info(sch_id, info)
        print("✅")
        return 1, 0
    except Exception as e:
        print(f"❌ ({e})")
        return 0, 1
    finally:
        if context:
            await context.close()


async def crawl_batch_parallel(schools: list, start_idx: int, p: async_playwright) -> tuple[int, int]:
    """真正并行抓取一批学校"""
    end_idx = min(start_idx + MAX_CONCURRENT, len(schools))
    batch = schools[start_idx:end_idx]

    tasks = [
        crawl_single_school(school, p, start_idx + i + 1, len(schools))
        for i, school in enumerate(batch)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    success = sum(r[0] if isinstance(r, tuple) else 0 for r in results)
    failed = sum(r[1] if isinstance(r, tuple) else 0 for r in results)

    return success, failed


# ============ 主流程 ============


async def main():
    print("=== 阳光高考数据抓取 (Playwright) ===\n")

    ensure_dir(OUTPUT_DIR)

    async with async_playwright() as p:
        # 创建浏览器上下文（仅用于获取列表）
        browser_context = await create_browser_context(p)

        # 1. 获取学校列表
        schools, total = await crawl_school_list(browser_context)
        await browser_context.close()

        if not schools:
            print("未能获取学校列表，尝试从缓存加载...")
            cached = load_json(SCH_ID_CACHE)
            if cached:
                schools = cached
            else:
                print("没有学校列表缓存，退出")
                return

        # 保存列表缓存
        save_json(SCH_ID_CACHE, schools)
        print(f"\n获取到 {len(schools)} 所学校\n")

        # 2. 分批并行抓取学校详情
        print(f"开始抓取 {len(schools)} 所学校的详情（并行度: {MAX_CONCURRENT}）...\n")

        total_success = 0
        total_failed = 0

        for i in range(0, len(schools), MAX_CONCURRENT):
            success, failed = await crawl_batch_parallel(schools, i, p)
            total_success += success
            total_failed += failed

        print(f"\n========== 完成 ==========")
        print(f"成功: {total_success} | 失败: {total_failed}")
        print(f"输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
