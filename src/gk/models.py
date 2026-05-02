"""数据模型 — 高校信息抓取的结构化输出."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DocItem(BaseModel):
    """文档类信息 — 招生简章/转专业方案/推免方案."""

    title: str = Field(description="文档标题")
    url: str = Field(description="来源 URL")
    summary: str = Field(default="", description="核心内容摘要（200字以内）")
    attachments: list[str] = Field(
        default_factory=list, description="附件下载链接（PDF/Word等）"
    )
    publish_date: str = Field(default="", description="发布日期")
    source_department: str = Field(default="", description="发布部门（如教务处、研究生院）")


class CollegeItem(BaseModel):
    """学院/系信息."""

    name: str = Field(description="学院/系名称")
    url: str = Field(default="", description="学院官网链接")
    disciplines: list[str] = Field(
        default_factory=list, description="主要学科/专业方向"
    )


class UniversityInfo(BaseModel):
    """高校信息抓取结果."""

    university: str = Field(description="学校名称")
    official_url: str = Field(description="官网地址")
    crawl_time: str = Field(default_factory=lambda: datetime.now().isoformat())

    admission_guide: list[DocItem] = Field(
        default_factory=list, description="招生简章"
    )
    colleges: list[CollegeItem] = Field(
        default_factory=list, description="学院/系列表"
    )
    transfer_policy: list[DocItem] = Field(
        default_factory=list, description="转专业方案/管理办法"
    )
    postgrad_recommend: list[DocItem] = Field(
        default_factory=list, description="推免（保研）方案/管理办法"
    )

    notes: str = Field(default="", description="抓取备注：未找到的信息说明")
    missing_categories: list[str] = Field(
        default_factory=list,
        description="未找到的信息类别（如 ['推免方案', '转专业方案']）",
    )
