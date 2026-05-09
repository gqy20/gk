/** 数据类型定义 — 对应 gk 项目的 UniversityInfo 模型 */

export interface DocItem {
  title: string;
  url: string;
  summary: string;
  attachments: string[];
  publish_date: string;
  source_department: string;
}

export interface CollegeItem {
  name: string;
  url: string;
  disciplines: string[];
}

export interface StudentExperienceItem {
  topic: string;
  content: string;
  source_type: string;
  source_url: string;
}

/** 阳光高考基础信息（100% 覆盖率） */
export interface GaokaoBasicInfo {
  location: string;
  address: string;
  phone: string;
  website: string;
  enrollment_website: string;
  attributes: string[];
}

/** 阳光高考专业满意度（来自 major_streaming，实际是学生评分） */
export interface MajorSatisfaction {
  title: string;
  score: number;
  votes: number;
}

export interface UniversityInfo {
  university: string;
  official_url: string;
  crawl_time: string;
  admission_guide: DocItem[];
  enrollment_plan: DocItem[];
  historical_admission: DocItem[];
  transfer_policy: DocItem[];
  transfer_announcement: DocItem[];
  major_streaming: DocItem[];
  training_program: DocItem[];
  minor_program: DocItem[];
  employment_report: DocItem[];
  postgrad_recommend: DocItem[];
  competition_research: DocItem[];
  colleges: CollegeItem[];
  student_experiences: StudentExperienceItem[];
  notes: string;
  missing_categories: string[];
  /** output2 新增字段 */
  scholarship: DocItem[];
  dining_dorm: DocItem[];
  contact_info: DocItem[];
  faq: DocItem[];
  school_intro: DocItem[];
  /** 阳光高考数据注入 */
  basic_info?: GaokaoBasicInfo;
  major_satisfaction?: MajorSatisfaction[];
}

/** 前端统一学校数据 */
export interface School {
  name: string;
  province: string;
  url: string;
  is985: boolean;
  is211: boolean;
  isDoubleFirstClass: boolean;
  coord: [number, number];
  status: "done" | "pending";
  detail?: UniversityInfo;
}

/** 省份聚合数据（用于地图着色） */
export interface ProvinceData {
  name: string;
  count: number;
  schools: School[];
}

export type DocCategoryKey =
  | "admission_guide"
  | "enrollment_plan"
  | "historical_admission"
  | "transfer_policy"
  | "transfer_announcement"
  | "major_streaming"
  | "training_program"
  | "minor_program"
  | "employment_report"
  | "postgrad_recommend"
  | "competition_research"
  | "scholarship"
  | "dining_dorm"
  | "contact_info"
  | "faq"
  | "school_intro";

export type DetailCategoryKey =
  | DocCategoryKey
  | "colleges"
  | "student_experiences";

/** 分类标签 → 中文显示名 */
export const CATEGORY_LABELS = {
  admission_guide: "招生章程",
  enrollment_plan: "招生计划",
  historical_admission: "历年录取",
  transfer_policy: "转专业政策",
  transfer_announcement: "转专业公示",
  major_streaming: "大类分流",
  training_program: "培养方案",
  minor_program: "辅修/双学位",
  employment_report: "就业质量报告",
  postgrad_recommend: "保研/推免",
  competition_research: "竞赛/科研/实验室",
  scholarship: "奖学金设置",
  dining_dorm: "食宿条件",
  contact_info: "联系办法",
  faq: "答考生问",
  school_intro: "学校简介",
  colleges: "学院列表",
  student_experiences: "学生经验",
} satisfies Record<DetailCategoryKey, string>;

/** 有数据的详情分类 key 列表 */
export const DETAIL_CATEGORIES = [
  "admission_guide",
  "enrollment_plan",
  "historical_admission",
  "transfer_policy",
  "transfer_announcement",
  "major_streaming",
  "training_program",
  "minor_program",
  "employment_report",
  "postgrad_recommend",
  "competition_research",
  "scholarship",
  "dining_dorm",
  "contact_info",
  "faq",
  "school_intro",
] as const satisfies readonly DocCategoryKey[];

/** 按省份分组 */
export function groupByProvince(schools: School[]): ProvinceData[] {
  const map = new Map<string, School[]>();
  for (const s of schools) {
    const list = map.get(s.province) || [];
    list.push(s);
    map.set(s.province, list);
  }

  return Array.from(map.entries())
    .map(([name, schools]) => ({ name, count: schools.length, schools }))
    .sort((a, b) => b.count - a.count);
}
