/**
 * 大学人生模拟器 — Prompt 配置加载器
 *
 * 从 simulator-prompts.yaml 加载所有提示词和工具描述，
 * 提供渲染函数替代原来 simulator-server.ts 中的内联模板。
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import yaml from "js-yaml";
import { createLogger } from "./logger";
import type {
  SimulateStartInput,
  SimulateHistoryEntry,
} from "./simulator-types";

const log = createLogger("simulator-prompts");

// ── 类型定义 ────────────────────────────────────────

/** YAML 配置文件的顶层结构 */
interface SimulatorPromptsConfig {
  version: string;
  system_prompts: {
    main_narrative_engine: string;
    ending_observer: string;
  };
  user_prompts: {
    first_round: string;
    subsequent_rounds: string;
    ending_generation: string;
  };
  tool_schemas: {
    simulate_step: {
      name: string;
      description: string;
      input_schema_descriptions: Record<string, string>;
    };
    generate_ending: {
      name: string;
      description: string;
      input_schema_descriptions: Record<string, string>;
    };
  };
}

// ── 单例缓存 ────────────────────────────────────────

let _config: SimulatorPromptsConfig | null = null;

function formatGender(gender: SimulateStartInput["profile"]["gender"]): string {
  switch (gender) {
    case "male":
      return "男生";
    case "female":
      return "女生";
    default:
      return "未指定";
  }
}

function loadConfig(): SimulatorPromptsConfig {
  if (_config) return _config;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filePath = `${__dirname}/simulator-prompts.yaml`;
  const raw = fs.readFileSync(filePath, "utf-8");
  _config = yaml.load(raw) as SimulatorPromptsConfig;

  log.info({ version: _config.version }, "Simulator prompts loaded from YAML");
  return _config;
}

// ── 模板渲染引擎 ────────────────────────────────────

/**
 * 简单的 ${var} 模板替换。
 *
 * 支持:
 *   ${foo}        → 替换为 vars["foo"]
 *   未定义变量     → 保留原样（不报错，方便调试）
 */
function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      log.warn({ key }, "Undefined template variable in prompt");
      return `\$\{${key}\}`; // 保留原始占位符以便排查
    }
    return String(value);
  });
}

// ── 动态轮次区间生成 ────────────────────────────

/**
 * 根据 totalRounds 生成叙事规则的轮次区间描述。
 *
 * 不同轮数需要不同的节奏：
 * - 3 轮：粗粒度（起步→发展→终章）
 * - 8 轮：标准四季（入学适应→学业深入→关键抉择→毕业收尾）
 * - 20 轮：学期级（每学期 2-3 个关键节点）
 * - 50 轮：周级（微观推演，按月/双周推进）
 */
function buildRoundProgression(totalRounds: number): string {
  if (totalRounds <= 4) {
    // 短模式：三段式
    const mid = Math.ceil(totalRounds * 0.5);
    return [
      `       - 前期（第 1-${Math.max(1, mid - 1)} 轮）：入学报到、认识室友、第一堂课、社团初体验`,
      `       - 中期（第 ${mid}-${totalRounds - 1} 轮）：课程深入、第一次考试、人际关系建立`,
      `       - 终章（第 ${totalRounds} 轮）：阶段性总结或毕业展望`,
    ].join("\n");
  }

  if (totalRounds <= 12) {
    // 标准模式：8 轮细粒度时间锚点（适配 8-12 轮）。
    // 关键修复：把"哪一轮=哪个时间窗口"写死，避免模型把 8 轮压成 8 个月。
    // 当前 8 轮对应：大一上 4 轮 + 大一下 2 轮 + 大二 1 轮 + 大三 1 轮。
    // 若 totalRounds=8 直接用 8 轮细粒度表；9-12 轮在第 7-8 轮后加毕业尾声补位。
    if (totalRounds === 8) {
      return [
        `       - **第 1 轮（9 月·入学第一周）**：报到、宿舍初见、新生班会`,
        `       - **第 2 轮（9 月底~10 月初·社团招新周）**：百团大战、第一次选课、兴趣试探`,
        `       - **第 3 轮（10 月中·学业与社团撞期）**：第一次月考/小测、社团任务进入日常、室友/同学关系定型`,
        `       - **第 4 轮（11 月·期中考试前后）**：第一次大考、人际小摩擦或加深、寒冬前的小决策`,
        `       - **第 5 轮（次年 3 月·大一下开学）**：新学期定位、分流/方向初步选择、寒假后的节奏调整`,
        `       - **第 6 轮（次年 5-6 月·大一下期末）**：期末季、暑期规划（实习/科研/竞赛/旅行）`,
        `       - **第 7 轮（大二上 10 月·专业深入）**：核心专业课、初步科研/竞赛/学生组织角色`,
        `       - **第 8 轮（大三 9-10 月·方向定型）**：保研/考研/就业的第一次明确岔路口、关键 mentor 关系`,
      ].join("\n");
    }
    // 9-12 轮的通用回退
    const q1 = Math.ceil(totalRounds * 0.25);
    const q2 = Math.ceil(totalRounds * 0.5);
    const q3 = Math.ceil(totalRounds * 0.75);
    return [
      `       - 入学适应期（第 1-${q1} 轮）：9 月报到、社团招新、宿舍生活、认识新朋友`,
      `       - 学业深入期（第 ${q1 + 1}-${q2} 轮）：期中考试、课程项目、第一次小组作业、图书馆日常`,
      `       - 关键转折期（第 ${q2 + 1}-${q3} 轮）：大一下到大二，方向初定、暑期关键决策`,
      `       - 毕业收尾期（第 ${q3 + 1}-${totalRounds} 轮）：大三到毕业去向明确前的关键节点`,
    ].join("\n");
  }

  if (totalRounds <= 30) {
    // 深度模式：按学期划分（适配 13-30 轮，约每学期 3-4 个节点）
    const perSemester = Math.ceil(totalRounds / 8); // 8 个学期
    const stages = [
      { name: "大一上", range: [1, perSemester * 1], theme: "入学报到、军训、第一堂课、社团百团大战、室友破冰" },
      { name: "大一下", range: [perSemester * 1 + 1, perSemester * 2], theme: "期中考试、第一次小组作业、寒假规划、社团活动深入" },
      { name: "大二上", range: [perSemester * 2 + 1, perSemester * 3], theme: "专业课深入、竞赛/项目、实习初次接触、人际关系变化" },
      { name: "大二下", range: [perSemester * 3 + 1, perSemester * 4], theme: "暑期实习、技能沉淀、方向初步确定" },
      { name: "大三上", range: [perSemester * 4 + 1, perSemester * 5], theme: "核心课程、科研项目、保研/就业岔路、 leadership 机遇" },
      { name: "大三下", range: [perSemester * 5 + 1, perSemester * 6], theme: "暑期关键决策（实习/保研/留学）、人脉积累" },
      { name: "大四上", range: [perSemester * 6 + 1, perSemester * 7], theme: "秋招/考研冲刺、毕业设计开题、告别准备" },
      { name: "大四下", range: [perSemester * 7 + 1, totalRounds], theme: "毕业答辩、散伙饭、四年回顾、各奔东西" },
    ];
    return stages
      .map((s) => `       - ${s.name}（第 ${s.range[0]}-${Math.min(s.range[1], totalRounds)} 轮）：${s.theme}`)
      .join("\n");
  }

  // 史诗模式（31-50+ 轮）：按月/双周推进，强调微观细节
  const stages = [
    { name: "九月·启程", range: [1, Math.ceil(totalRounds * 0.08)], theme: "开学第一天、领教材、找教室、食堂初体验、室友见面" },
    { name: "十月·探索", range: [], theme: "社团面试、第一次小组讨论、图书馆占座、国庆假期安排" },
    { name: "十一月·磨合", range: [], theme: "期中备考、和室友的第一次摩擦、加入/退出某个组织" },
    { name: "十二月·冲刺", range: [], theme: "期末复习周、选下学期课、元旦跨年计划" },
    { name: "一月·休整", range: [], theme: "寒假回家/留校、春节、高中同学聚会、读书/兼职" },
    { name: "二月·蓄力", range: [], theme: "开学前的准备、新学期目标、考证计划" },
    { name: "三月·深耕", range: [], theme: "专业核心课开始、竞赛报名、实习信息搜集" },
    { name: "四月·绽放", range: [], theme: "春游/踏青、社团活动高峰、期中季" },
    { name: "五月·忙碌", range: [], theme: "课程项目截止、运动会、五四活动" },
    { name: "六月·考验", range: [], theme: "期末决战、暑假安排决定、可能的一次重要告别" },
    { name: "七月·蜕变", range: [], theme: "暑期实习/支教/旅行、技能提升的关键窗口" },
    { name: "八月·沉淀", range: [Math.floor(totalRounds * 0.85), totalRounds], theme: "大四开学、秋招/考研、毕业设计、告别倒计时" },
  ];

  // 为中间阶段分配轮次范围
  const chunkSize = Math.floor((totalRounds - stages[0].range[1] - (stages[stages.length - 1].range[0] || totalRounds)) / (stages.length - 2));
  let nextRound = stages[0].range[1] + 1;
  for (let i = 1; i < stages.length - 1; i++) {
    const end = i === stages.length - 2
      ? stages[stages.length - 1].range[0] - 1
      : Math.min(nextRound + chunkSize - 1, totalRounds);
    stages[i].range = [nextRound, end];
    nextRound = end + 1;
  }

  return stages
    .map((s) => s.range.length > 0
      ? `       - ${s.name}（第 ${s.range[0]}-${s.range[1]} 轮）：${s.theme}`
      : `       - ${s.name}：${s.theme}`)
    .join("\n");
}

// ── Prompt 渲染函数（公开 API）──────────────────────

/**
 * 构建主叙事引擎的系统提示词。
 * 对应原来的 buildSystemPrompt()。
 */
export function buildSystemPrompt(
  profile: SimulateStartInput["profile"],
  round: number,
  totalRounds: number,
): string {
  const cfg = loadConfig();

  // 动态构建学校上下文段落（与原逻辑一致）
  const schoolContextLines: string[] = [];
  if (profile.schoolTier) schoolContextLines.push(`学校层次：${profile.schoolTier}`);
  if (profile.schoolType) schoolContextLines.push(`学校类型：${profile.schoolType}`);
  if (profile.province) schoolContextLines.push(`所在省份：${profile.province}`);
  if (profile.city) schoolContextLines.push(`所在城市：${profile.city}`);

  const schoolContextStr = schoolContextLines.length > 0
    ? "\n" + schoolContextLines.map((l) => `- ${l}`).join("\n")
    : "";

  // 动态生成轮次区间描述
  const roundProgression = buildRoundProgression(totalRounds);

  return renderTemplate(cfg.system_prompts.main_narrative_engine, {
    "profile.school": profile.school,
    "school_context_lines": schoolContextStr,
    "profile_major_line": profile.major ? `- 专业方向：${profile.major}` : "",
    "profile_gender_line": `- 性别设定：${formatGender(profile.gender)}`,
    "profile.personalityTags": profile.personalityTags.join("、") || "未指定",
    "profile.interests": profile.interests.join("、") || "未指定",
    "profile.riskTolerance": profile.riskTolerance,
    round,
    totalRounds,
    round_progression: roundProgression,
  });
}

/**
 * 构建用户提示词（每轮场景请求）。
 * 对应原来的 buildUserPromptForRound()。
 */
export function buildUserPromptForRound(
  profile: SimulateStartInput["profile"],
  history: SimulateHistoryEntry[],
  previousChoiceLabel?: string,
  totalRounds?: number,
): string {
  const cfg = loadConfig();

  if (history.length === 0) {
    return cfg.user_prompts.first_round; // 无模板变量，直接返回
  }

  const lastEntry = history[history.length - 1]!;
  // 下一轮 = 上一轮 + 1；如果调用方传入 totalRounds，则用于模板提示
  const nextRound = lastEntry.round + 1;

  // 格式化决策历史（与原逻辑一致）
  const historyFormatted = history
    .map((h) => `**第${h.round}轮 — ${h.scene_title}**
选择了：${h.choiceLabel}
结果：${h.outcome_narrative}
影响：${h.outcome_effects.join("、")}`)
    .join("\n\n");

  return renderTemplate(cfg.user_prompts.subsequent_rounds, {
    history_formatted: historyFormatted,
    last_round: lastEntry.round,
    next_round: nextRound,
    totalRounds: totalRounds ?? (history.length + 1),
    previous_choice_label: previousChoiceLabel || lastEntry.choiceLabel,
  });
}

/**
 * 构建结局生成的用户提示词。
 * 对应原来的 buildEndingPrompt()。
 */
export function buildEndingPrompt(
  profile: SimulateStartInput["profile"],
  history: SimulateHistoryEntry[],
): string {
  const cfg = loadConfig();

  // 构建上下文摘要（与原逻辑一致）
  const contextParts = [profile.school];
  if (profile.schoolTier) contextParts.push(profile.schoolTier);
  if (profile.schoolType) contextParts.push(profile.schoolType);
  if (profile.province) contextParts.push(profile.province);
  if (profile.major) contextParts.push(profile.major);

  // 格式化结局用历史（与原逻辑一致）
  const historyForEnding = history
    .map((h) => `第${h.round}轮 [${h.scene_title}] → 选了「${h.choiceLabel}」→ ${h.outcome_effects.join(",")}`)
    .join("\n");

  return renderTemplate(cfg.user_prompts.ending_generation, {
    context_summary: contextParts.join(" · "),
    history_count: history.length,
    history_for_ending: historyForEnding,
  });
}

/**
 * 获取结局观察者的系统提示词。
 * 对应原来 simulator-server.ts line 353 的内联字符串。
 */
export function getEndingSystemPrompt(): string {
  return loadConfig().system_prompts.ending_observer;
}

// ── Schema 描述加载器（公开 API）────────────────────

/**
 * 获取 simulate_step 工具的描述配置。
 * 返回 name + description + 各字段描述映射。
 */
export function getSimulateStepDescriptions() {
  return loadConfig().tool_schemas.simulate_step;
}

/**
 * 获取 generate_ending 工具的描述配置。
 */
export function getGenerateEndingDescriptions() {
  return loadConfig().tool_schemas.generate_ending;
}

/**
 * 获取 prompt 版本号（用于日志和调试）。
 */
export function getSimulatorPromptsVersion(): string {
  return loadConfig().version;
}
