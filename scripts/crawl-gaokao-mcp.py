"""
阳光高考网站抓取脚本 (MCP Client 版本)

功能：
1. 通过 MCP stdio 连接 crawl-mcp 服务器
2. 抓取院校库学校列表（支持分页）
3. 抓取各学校详情页（简介、专业、录取规则等）
4. 批量并行抓取
5. 输出与现有 UniversityInfo 兼容的 JSON

运行:
    source .venv/bin/activate && python scripts/crawl-gaokao-mcp.py
"""

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ============ 配置 ============

BASE_URL = "https://gaokao.chsi.com.cn"
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "data" / "gaokao-output"
SCH_ID_CACHE = PROJECT_ROOT / "data" / "gaokao-schids.json"

# categoryId → 页面类型映射 (从原脚本继承，但注意不同学校的 categoryId 可能不同)
CATEGORY_MAP = {
    "school_intro": {"alias": ["学校简介", "院校简介"]},
    "departments": {"alias": ["院系设置"]},
    "majors": {"alias": ["专业介绍"]},
    "admission_rules": {"alias": ["录取规则"]},
    "scholarship": {"alias": ["奖学金设置"]},
    "dormitory": {"alias": ["食宿条件"]},
    "contact": {"alias": ["联系办法"]},
    "faq": {"alias": ["答考生问"]},
    "fees": {"alias": ["收费项目"]},
    "employment": {"alias": ["毕业生就业"]},
    "facilities": {"alias": ["基础设施"]},
    "health_requirements": {"alias": ["体检要求"]},
    "admission_results": {"alias": ["录取结果公示"]},
}

MAX_CONCURRENT = 3  # 最大并发数
REQUEST_DELAY = 0.5  # 请求间隔（秒）

# MCP 服务器参数（通过 wrapper 过滤 stdout 噪声）
MCP_SERVER_CMD = "/home/qy113/workspace/soft/miniforge3/bin/python3.12"
MCP_SERVER_ARGS = ["/home/qy113/workspace/project/2605/gk/scripts/mcp-json-filter.py"]


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


# ============ MCP 调用封装 ============


class McpCrawler:
    """MCP Client 封装，管理连接和工具调用"""

    def __init__(self):
        self.session: Optional[ClientSession] = None
        self._read_stream = None
        self._write_stream = None
        self._cm = None
        self._session_cm = None

    async def connect(self):
        """连接 MCP 服务器"""
        server_params = StdioServerParameters(
            command=MCP_SERVER_CMD,
            args=MCP_SERVER_ARGS,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        self._cm = stdio_client(server_params)
        self._read_stream, self._write_stream = await self._cm.__aenter__()
        self._session_cm = ClientSession(self._read_stream, self._write_stream)
        self.session = await self._session_cm.__aenter__()
        await self.session.initialize()
        print("✅ MCP 服务器连接成功")

    async def close(self):
        """关闭连接"""
        try:
            if self._session_cm:
                await self._session_cm.__aexit__(None, None, None)
                self._session_cm = None
            if self._cm:
                await self._cm.__aexit__(None, None, None)
                self._cm = None
        except Exception as e:
            print(f"关闭连接时出错: {e}")
        print("🔌 MCP 连接已关闭")

    async def crawl_single(self, url: str, enhanced: bool = False) -> dict:
        """调用 crawl_single 工具"""
        result = await self.session.call_tool(
            "crawl_single",
            {"url": url, "enhanced": enhanced}
        )
        return self._parse_tool_result(result)

    async def crawl_batch(self, urls: list, concurrent: int = 3) -> list[dict]:
        """调用 crawl_batch 工具"""
        result = await self.session.call_tool(
            "crawl_batch",
            {"urls": urls, "concurrent": concurrent}
        )
        parsed = self._parse_tool_result(result)
        return parsed if isinstance(parsed, list) else []

    @staticmethod
    def _parse_tool_result(result) -> dict | list:
        """解析 MCP 工具返回结果"""
        if hasattr(result, 'content') and result.content:
            for item in result.content:
                if hasattr(item, 'text') and item.text:
                    try:
                        return json.loads(item.text)
                    except json.JSONDecodeError:
                        return {"success": False, "error": item.text}
        return {"success": False, "error": "Empty result"}


# ============ BeautifulSoup 解析 ============


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
        # 过滤导航链接和已抓取的
        if sch_id not in seen and name and len(name) < 30 and 'schoolInfoMain' not in url:
            # 额外检查：名字不能是导航关键词
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

    # 学校名称 - 通常在 ![](logo) 之后的第一行链接
    for i, line in enumerate(lines):
        if f'common/xh/{sch_id}.jpg' in line:
            # 下几行应该包含学校名称
            for j in range(i + 1, min(i + 5, len(lines))):
                match = re.search(r'\[\s*([^\]]+?)\s*\]\(', lines[j])
                if match:
                    candidate = match.group(1).strip()
                    if len(candidate) > 2 and 'schoolInfoMain' in lines[j]:
                        info.name = candidate
                        break
            break

    # 教育行政主管部门
    dept_match = re.search(r'教育行政主管部门[：:]\s*(.+)', markdown)
    if dept_match:
        info.admin_department = dept_match.group(1).strip()

    # 院校特性
    if '985' in markdown:
        info.attributes.append("985")
    if '211' in markdown:
        info.attributes.append("211")
    if '双一流' in markdown:
        info.attributes.append("双一流")

    # 所在地
    loc_match = re.search(r'所在地[：:]\s*([^\n]+)', markdown)
    if loc_match:
        info.location = loc_match.group(1).strip()

    # 详细地址
    addr_match = re.search(r'详细地址[：:]\s*([^\n]+)', markdown)
    if addr_match:
        info.address = addr_match.group(1).strip()

    # 官方电话
    phone_match = re.search(r'官方电话[：:]\s*([^\n\s]+)', markdown)
    if phone_match:
        info.phone = phone_match.group(1).strip()

    # 官方网站
    website_match = re.search(r'官方网址[：:]\s*<([^>]+)>', markdown)
    if website_match:
        info.website = website_match.group(1).strip()

    # 招生网址
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

    # 基础信息
    info.basic_info = parse_basic_info(markdown, sch_id)
    info.official_url = info.basic_info.website or ""

    # 院校满意度
    if '院校满意度' in markdown:
        satisfaction = {}
        sat_match = re.search(r'综合满意度\s*(\d+)人投票', markdown)
        if sat_match:
            satisfaction["综合满意度"] = sat_match.group(1) + "人投票"
        env_match = re.search(r'环境满意度\s*(\d+)人投票', markdown)
        if env_match:
            satisfaction["环境满意度"] = env_match.group(1) + "人投票"
        life_match = re.search(r'生活满意度\s*(\d+)人投票', markdown)
        if life_match:
            satisfaction["生活满意度"] = life_match.group(1) + "人投票"
        if satisfaction:
            info.notes = f"院校满意度: {satisfaction}"

    # 专业满意度 (提取前10)
    major_satisfaction = []
    major_pattern = r'(\d+)\s+([^\n]+?)\s+([\d.]+)\s*（(\d+)人）'
    # 只在"专业满意度"区域匹配
    major_section = re.search(r'专业满意度.*?\n(.*?)(?=专业推荐|考生咨询|分享到)', markdown, re.DOTALL)
    if major_section:
        for match in re.finditer(major_pattern, major_section.group(1)):
            rank, name, score, voters = match.groups()
            major_satisfaction.append({
                "title": name.strip(),
                "summary": f"满意度 {score} ({voters}人投票)",
                "url": "",
                "attachments": [],
                "publish_date": "",
                "source_department": ""
            })
    if major_satisfaction:
        info.major_streaming = major_satisfaction[:20]

    # 专业推荐
    recommendations = []
    rec_section = re.search(r'专业推荐人数.*?\n(.*?)(?=专业推荐指数|考生咨询|分享到)', markdown, re.DOTALL)
    if rec_section:
        for match in re.finditer(major_pattern, rec_section.group(1)):
            rank, name, score, voters = match.groups()
            recommendations.append({
                "title": name.strip(),
                "summary": f"推荐 {score} ({voters}人推荐)",
                "url": "",
                "attachments": [],
                "publish_date": "",
                "source_department": ""
            })
    if recommendations:
        info.training_program = recommendations[:20]

    # 考生咨询 (FAQ)
    faqs = []
    qa_pattern = r'([^\n]+?) __\n([^\n]+?)\n([^\n]+?)\n([^\n]+)'
    qa_section = re.search(r'考生咨询.*?\n(.*?)(?=分享到)', markdown, re.DOTALL)
    if qa_section:
        for match in re.finditer(qa_pattern, qa_section.group(1)):
            topic, question, user_info, answer = match.groups()
            faqs.append({
                "topic": topic.strip(),
                "content": f"Q: {question.strip()}\nA: {answer.strip()}",
                "source_type": "考生咨询",
                "source_url": ""
            })
    if faqs:
        info.faq = faqs[:20]

    # 从导航栏提取各分类链接
    for cat_name, cat_info in CATEGORY_MAP.items():
        for alias in cat_info["alias"]:
            # 查找导航链接
            nav_pattern = rf'\[\s*{re.escape(alias)}\s*\]\(([^)]+)\)'
            nav_match = re.search(nav_pattern, markdown)
            if nav_match:
                # 记录该分类存在，但实际内容需要单独抓取子页面
                pass

    return info


def serialize_info(info: UniversityInfo) -> dict:
    """序列化 UniversityInfo"""
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


# ============ 抓取函数 ============


async def crawl_school_list(mcp: McpCrawler) -> list[dict]:
    """获取学校列表（支持分页）"""
    print("获取学校列表...")
    all_schools = []

    page_num = 1
    while True:
        # 使用 start 参数分页
        start = (page_num - 1) * 20
        if page_num == 1:
            list_url = f"{BASE_URL}/sch/search--mindex-8,searchText-*,page-{page_num},size-50.dhtml"
        else:
            list_url = f"{BASE_URL}/sch/search--mindex-8,searchText-*,size-50,start-{start}.dhtml"

        print(f"  第 {page_num} 页...")
        result = await mcp.crawl_single(list_url)

        if not result.get("success"):
            print(f"    抓取失败: {result.get('error', 'unknown')}")
            break

        schools = parse_school_list_page(result.get("markdown", ""))
        if not schools:
            break

        all_schools.extend(schools)
        print(f"    本页 {len(schools)} 所，累计 {len(all_schools)} 所")

        # 检查是否到最后一页（不足50条认为是最后一页）
        # 但从 MCP 返回的 markdown 难以判断，这里限制最大页数
        if len(schools) < 10 or page_num >= 150:
            break

        page_num += 1
        await asyncio.sleep(REQUEST_DELAY)

    # 去重
    seen = set()
    unique = []
    for s in all_schools:
        if s['sch_id'] not in seen:
            seen.add(s['sch_id'])
            unique.append(s)

    return unique


async def crawl_school(sch_id: str, school_name: str, mcp: McpCrawler) -> UniversityInfo:
    """抓取单个学校的详情页"""
    url = f"{BASE_URL}/sch/schoolInfo--schId-{sch_id}.dhtml"
    result = await mcp.crawl_single(url)

    if not result.get("success"):
        raise Exception(result.get("error", "Unknown error"))

    info = parse_school_detail(result.get("markdown", ""), sch_id, school_name)
    return info


async def crawl_worker(school: dict, mcp: McpCrawler, stats: dict) -> None:
    """工作协程：抓取单个学校并保存"""
    sch_id = school["sch_id"]
    name = school["name"]

    if is_already_crawled(sch_id):
        stats["skipped"] += 1
        return

    try:
        info = await crawl_school(sch_id, name, mcp)
        await save_json(get_output_path(sch_id), serialize_info(info))
        stats["success"] += 1
        print(f"✅ {name} (schId={sch_id})")
    except Exception as e:
        stats["failed"] += 1
        print(f"❌ {name} (schId={sch_id}): {e}")


# ============ 主流程 ============


async def main():
    print("=== 阳光高考数据抓取 (MCP Client 版本) ===\n")
    ensure_dir(OUTPUT_DIR)

    mcp = McpCrawler()
    await mcp.connect()

    try:
        # 1. 获取学校列表
        schools = await crawl_school_list(mcp)

        # 尝试加载缓存
        if not schools:
            print("未能获取学校列表，尝试从缓存加载...")
            schools = load_json(SCH_ID_CACHE) or []

        if not schools:
            print("没有学校数据，退出")
            return

        # 保存缓存
        await save_json(SCH_ID_CACHE, schools)
        print(f"\n共 {len(schools)} 所学校\n")

        # 2. 并发抓取
        stats = {"success": 0, "failed": 0, "skipped": 0}
        semaphore = asyncio.Semaphore(MAX_CONCURRENT)

        async def bounded_worker(school: dict):
            async with semaphore:
                await crawl_worker(school, mcp, stats)
                await asyncio.sleep(REQUEST_DELAY)

        tasks = [asyncio.create_task(bounded_worker(s)) for s in schools]
        await asyncio.gather(*tasks, return_exceptions=True)

        print(f"\n========== 完成 ==========")
        print(f"成功: {stats['success']} | 失败: {stats['failed']} | 跳过(已存在): {stats['skipped']}")
        print(f"输出目录: {OUTPUT_DIR}")

    finally:
        await mcp.close()


if __name__ == "__main__":
    asyncio.run(main())
