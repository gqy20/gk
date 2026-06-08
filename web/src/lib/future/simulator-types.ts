/**
 * 大学人生模拟器 — 类型定义
 *
 * 核心交互：每轮展示场景 → 用户 3 选 1 → LLM 推演结果 + 下一轮场景
 * 共 8 轮，最终生成「大学人设卡」结局
 */

// ── 单个选项 ────────────────────────────────────────

export interface SimulatorChoice {
  id: string;
  /** 选项简短描述（卡片正面） */
  label: string;
  /** 选项详细说明（可选，hover 或展开时显示） */
  detail?: string;
}

// ── 推演结果（LLM 返回）────────────────────────────

export interface SimulateStepResult {
  /** 当前回合数（1-based） */
  round: number;
  /** 场景标题（如"入学报到第一天"） */
  scene_title: string;
  /** 场景描述文本（营造氛围） */
  scene_description: string;
  /** 用户面临的 3 个选择 */
  choices: [SimulatorChoice, SimulatorChoice, SimulatorChoice];
  /** 上一步选择的推演结果（第1轮为空） */
  outcome?: {
    /** 选择后的即时反馈叙述 */
    narrative: string;
    /** 这次选择带来的隐性影响标签（如"社交+1""绩点压力+1"） */
    effects: string[];
  };
  /** 下一轮的 3 个选择（仅最后一轮为空） */
  next_choices?: [SimulatorChoice, SimulatorChoice, SimulatorChoice];
  /** 是否为最终回合 */
  is_final: boolean;
}

// ── 结局数据（LLM 最终调用返回）────────────────────

export interface SimulatorEnding {
  /** 人设卡标题（如"社交达人型学霸"） */
  archetype: string;
  /** 人设描述（2-3句话总结大学四年走向） */
  summary: string;
  /** 性格/行为标签（由决策倾向推导） */
  tags: string[];
  /** GPA 区间估计 */
  gpa_estimate: string;
  /** 社交圈类型描述 */
  social_circle: string;
  /** 关键转折点回顾（每条包含：第几轮、选了什么、导致什么） */
  turning_moments: Array<{
    round: number;
    choice_label: string;
    consequence: string;
  }>;
  /** 一句寄语 */
  closing_message: string;
}

// ── 游戏会话状态 ───────────────────────────────────

export type SimulateSessionStatus = "playing" | "ended" | "error";

export interface SimulateSession {
  sessionId: string;
  status: SimulateSessionStatus;
  /** 初始化输入 */
  profile: SimulateProfile;
  /** 当前回合数（已完成的选择数，0 表示还没开始） */
  currentRound: number;
  /** 总回合数 */
  totalRounds: number;
  /** 决策历史 */
  history: SimulateHistoryEntry[];
  /** 当前待选择的场景（初始化时由服务端填入第一轮） */
  currentScene: SimulateStepResult | null;
  /** 结局数据（游戏结束时填入） */
  ending: SimulatorEnding | null;
  /** 错误信息 */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SimulateHistoryEntry {
  round: number;
  scene_title: string;
  choiceId: string;
  choiceLabel: string;
  outcome_narrative: string;
  outcome_effects: string[];
}

// ── 用户输入 ───────────────────────────────────────

export interface SimulateProfile {
  school: string;
  major?: string;
  /** 省份（如"北京""湖北"） */
  province?: string;
  /** 城市 */
  city?: string;
  /** 学校层次标签（如 "985", "211", "双一流"） */
  schoolTier?: string;
  /** 学校类型（如 "综合""理工""师范""医科""财经"） — 从学校所属学院推断 */
  schoolType?: string;
  personalityTags: string[];
  interests: string[];
  riskTolerance: number; // 1-10
}

export interface SimulateStartInput {
  profile: SimulateProfile;
  totalRounds?: number; // 默认 8
}
