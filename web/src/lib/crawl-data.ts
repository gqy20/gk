/** 采集数据类型定义 — 对应 export-crawl-data.ts 导出的 JSON */

export interface CategoryStatus {
  status: "done" | "pending" | "failed" | "in_progress";
  attempts: number;
  urls_collected: number;
  last_error?: string;
}

export type CrawlStatusMap = Record<string, Record<string, CategoryStatus>>;

export interface SourceItem {
  url: string;
  title: string | null;
  relevance_note: string;
  source_type: string;
  agent_confidence: number;
  http_status: number | null;
}

export type CrawlSourcesMap = Record<string, Record<string, SourceItem[]>>;

export interface RunRecord {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  universities_planned: number;
  categories_completed: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  notes: string | null;
}

/** 5 个校园生活类别 → 中文标签 */
export const CRAWL_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  dorm: { label: "宿舍", icon: "🏠" },
  commute: { label: "交通", icon: "🚗" },
  facilities: { label: "设施", icon: "🏢" },
  majors: { label: "专业", icon: "📚" },
  climate: { label: "气候", icon: "🌤️" },
};

export const CRAWL_CATEGORIES = Object.keys(CRAWL_CATEGORY_LABELS) as string[];
