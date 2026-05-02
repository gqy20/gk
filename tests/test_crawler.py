"""爬取模块测试 — 配置加载、模型验证、prompt 加载."""

import pytest

from gk.config import CrawlConfig, load_universities, match_universities
from gk.models import CollegeItem, DocItem, UniversityInfo
from gk.prompts import build_crawl_prompt, load_prompt

# --- models ---

def test_doc_item_defaults():
    item = DocItem(title="测试", url="https://example.com")
    assert item.summary == ""
    assert item.attachments == []
    assert item.publish_date == ""
    assert item.source_department == ""


def test_doc_item_with_attachments():
    item = DocItem(
        title="转专业管理办法",
        url="https://test.edu.cn/policy.html",
        summary="学生可在第二学期申请转专业...",
        attachments=["https://test.edu.cn/files/transfer.pdf"],
        publish_date="2025-03-15",
        source_department="教务处",
    )
    assert len(item.attachments) == 1
    assert item.source_department == "教务处"


def test_college_item():
    college = CollegeItem(
        name="计算机科学与技术学院",
        url="https://cs.test.edu.cn",
        disciplines=["计算机科学", "人工智能", "软件工程"],
    )
    assert college.name == "计算机科学与技术学院"
    assert len(college.disciplines) == 3


def test_college_item_minimal():
    college = CollegeItem(name="数学学院")
    assert college.url == ""
    assert college.disciplines == []


def test_university_info_validation():
    data = {
        "university": "测试大学",
        "official_url": "https://test.edu.cn",
        "admission_guide": [
            {
                "title": "2025招生简章",
                "url": "https://test.edu.cn/zs",
                "summary": "本科招生计划3000人",
                "attachments": ["https://test.edu.cn/files/guide.pdf"],
            }
        ],
        "colleges": [
            {"name": "计算机学院", "url": "https://cs.test.edu.cn"},
        ],
        "transfer_policy": [],
        "postgrad_recommend": [],
        "missing_categories": ["推免方案"],
    }
    info = UniversityInfo.model_validate(data)
    assert info.university == "测试大学"
    assert len(info.admission_guide) == 1
    assert len(info.admission_guide[0].attachments) == 1
    assert len(info.colleges) == 1
    assert info.colleges[0].name == "计算机学院"
    assert info.missing_categories == ["推免方案"]


def test_university_info_roundtrip():
    info = UniversityInfo(
        university="测试大学",
        official_url="https://test.edu.cn",
        admission_guide=[DocItem(title="简章", url="https://test.edu.cn/zs")],
        colleges=[CollegeItem(name="理学院")],
        missing_categories=["转专业方案"],
    )
    json_str = info.model_dump_json(indent=2)
    restored = UniversityInfo.model_validate_json(json_str)
    assert restored.university == info.university
    assert len(restored.admission_guide) == 1
    assert len(restored.colleges) == 1
    assert restored.missing_categories == ["转专业方案"]


# --- config ---

def test_load_universities():
    universities = load_universities()
    assert len(universities) > 50
    assert all("name" in u and "url" in u for u in universities)


def test_match_universities():
    all_u = [
        {"name": "北京大学", "url": "https://www.pku.edu.cn"},
        {"name": "清华大学", "url": "https://www.tsinghua.edu.cn"},
        {"name": "浙江大学", "url": "https://www.zju.edu.cn"},
    ]
    matched = match_universities(all_u, ["清华", "浙江"])
    assert len(matched) == 2
    names = [u["name"] for u in matched]
    assert "清华大学" in names
    assert "浙江大学" in names


def test_match_universities_empty():
    all_u = [{"name": "北京大学", "url": "https://www.pku.edu.cn"}]
    assert match_universities(all_u, None) == all_u


def test_crawl_config_defaults():
    config = CrawlConfig()
    assert config.model is None
    assert config.max_turns == 100


# --- prompts YAML ---

def test_load_crawl_prompt():
    data = load_prompt("crawl")
    assert "system" in data
    assert "user_template" in data
    assert "招生简章" in data["system"]
    assert "{university}" in data["user_template"]


def test_build_crawl_prompt():
    system, user = build_crawl_prompt("清华大学", "https://www.tsinghua.edu.cn")
    assert "清华大学" in user
    assert "tsinghua.edu.cn" in user
    assert "招生简章" in system
    assert "附件" in system


def test_load_prompt_not_found():
    with pytest.raises(FileNotFoundError):
        load_prompt("nonexistent")
