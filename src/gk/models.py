"""数据模型 — 高校信息抓取的结构化输出."""

from datetime import datetime

from pydantic import BaseModel, Field


class DocItem(BaseModel):
    """文档类信息 — 通用文档条目."""

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


class StudentExperienceItem(BaseModel):
    """学生经验分享 — 非官方经验，需标注来源."""

    topic: str = Field(description="经验主题（如'转专业难度'、'选课建议'）")
    content: str = Field(description="经验内容（300字以内）")
    source_type: str = Field(
        default="论坛/社区",
        description="来源类型（知乎/贴吧/B站等），必须标注为非官方",
    )
    source_url: str = Field(default="", description="原始帖子/视频链接")


class UniversityInfo(BaseModel):
    """高校信息抓取结果 — 覆盖招生、教学、就业等 13 类信息."""

    university: str = Field(description="学校名称")
    official_url: str = Field(description="官网地址")
    crawl_time: str = Field(default_factory=lambda: datetime.now().isoformat())

    # --- 招生类 ---
    admission_guide: list[DocItem] = Field(
        default_factory=list, description="招生章程（阳光高考、高校招生网）"
    )
    enrollment_plan: list[DocItem] = Field(
        default_factory=list, description="招生计划（各省考试院、高校招生网）"
    )
    historical_admission: list[DocItem] = Field(
        default_factory=list, description="历年录取数据（省考试院、高校官网、官方志愿系统）"
    )

    # --- 教学管理类 ---
    transfer_policy: list[DocItem] = Field(
        default_factory=list, description="转专业政策（教务处、本科生院、学院通知）"
    )
    transfer_announcement: list[DocItem] = Field(
        default_factory=list, description="转专业公示（教务处/学院拟录取名单，若公开）"
    )
    major_streaming: list[DocItem] = Field(
        default_factory=list, description="大类分流规则（学院官网、本科教学通知）"
    )
    training_program: list[DocItem] = Field(
        default_factory=list, description="培养方案（教务处、学院官网）"
    )
    minor_program: list[DocItem] = Field(
        default_factory=list, description="辅修/双学位/微专业（教务处、本科生院）"
    )

    # --- 发展类 ---
    employment_report: list[DocItem] = Field(
        default_factory=list, description="就业质量报告（高校就业网）"
    )
    postgrad_recommend: list[DocItem] = Field(
        default_factory=list, description="保研/推免方案（研究生院、学院公示）"
    )
    competition_research: list[DocItem] = Field(
        default_factory=list, description="竞赛/科研/实验室（学院官网、实验室官网）"
    )

    # --- 组织架构 ---
    colleges: list[CollegeItem] = Field(
        default_factory=list, description="学院/系列表"
    )

    # --- 非官方（需标注） ---
    student_experiences: list[StudentExperienceItem] = Field(
        default_factory=list,
        description="学生经验分享（必须标注为非官方，不能与官方政策混用）",
    )

    notes: str = Field(default="", description="抓取备注：未找到的信息说明")
    missing_categories: list[str] = Field(
        default_factory=list,
        description="未找到的信息类别",
    )
