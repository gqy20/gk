import type { FutureRunInput } from "./types";
import { planFutureBranches } from "./branch-planner";
import { createLogger } from "./logger";

const log = createLogger("prompt");

const PROMPT_VERSION = "gk_future_v2";
const MAX_EVIDENCE_CHARS = 1800;

export function getFuturePromptVersion() {
  return PROMPT_VERSION;
}

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatEvidence(input: FutureRunInput) {
  const rawItems = input.choiceContext.evidence ?? [];
  const items = rawItems.slice(0, 6);
  if (rawItems.length > 6) {
    log.warn({ total: rawItems.length, kept: 6 }, "Evidence truncated to max 6 items");
  }
  if (items.length === 0) return "暂无学校资料证据，需明确标注推演假设。";

  return items
    .map((item, index) => {
      const budget = Math.max(180, Math.floor(MAX_EVIDENCE_CHARS / items.length));
      return `${index + 1}. ${item.label}: ${clip(item.text.replace(/\s+/g, " ").trim(), budget)}`;
    })
    .join("\n");
}

function formatBranchPlan(input: FutureRunInput) {
  return planFutureBranches(input)
    .map((branch) => {
      const assumptions = branch.assumptions.map((item) => `    - ${item}`).join("\n");
      const tradeoffs = branch.requiredTradeoffs.map((item) => `    - ${item}`).join("\n");
      return [
        `${branch.index}. ${branch.name}（${branch.riskTone}）`,
        `  方向：${branch.focus}`,
        "  前提假设：",
        assumptions,
        "  必须呈现的代价：",
        tradeoffs,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildFuturePrompt(input: FutureRunInput) {
  const { profile, choiceContext } = input;
  const p = profile ?? {};

  const system = [
    "你是高考志愿咨询师和职业发展研究员。",
    "你的任务是基于学生画像、学校/专业选择和有限证据，生成高考生能看懂的大学四年预演。",
    "不要把推演写成算命，也不要写成职业咨询报告；要像在帮一个刚填志愿的学生提前看几种大学走法。",
    "每条路线都要说明：适合谁、大一大二做什么、最容易踩什么坑、什么时候说明该换路。",
    "必须承认证据边界，不得编造具体录取分数、就业率、保研率等未提供数据。",
  ].join("\n");

  const user = `请为这个志愿选择生成 ${input.pathCount} 条大学四年路线预演。

【学生画像】
- 生源省份：${p.province || "未提供"}
- 选科/方向：${p.subjectTrack || "未提供"}
- 分数段：${p.scoreBand || "未提供"}
- 性格标签：${(p.personalityTags ?? []).join("、") || "未提供"}
- 兴趣方向：${(p.interests ?? []).join("、") || "未提供"}
- 风险偏好：${typeof p.riskTolerance === "number" ? `${p.riskTolerance}/10` : "未提供"}
- 家庭支持：${p.familySupport || "未提供"}
- 目标/顾虑：${p.goals || "未提供"}

【志愿选择】
- 学校：${choiceContext.school}
- 专业：${choiceContext.major || "未指定"}
- 城市：${choiceContext.city || "未指定"}
- 省份：${choiceContext.province || "未指定"}
- 学校标签：${(choiceContext.schoolTags ?? []).join("、") || "未提供"}

【可用证据】
${formatEvidence(input)}

【分叉计划】
请严格按以下 ${input.pathCount} 个分叉生成路径。每条路径的 branch_ref 必须等于对应分叉名称。
${formatBranchPlan(input)}

【生成要求】
1. 输出必须调用指定工具，不能输出散文或 Markdown。
2. 生成 ${input.pathCount} 条互相有明显差异的大学路线，不能把多个分叉写成同一种建议。
3. label 必须是高考生能一眼看懂的路线名，例如“成绩优先路线”“项目实习路线”“试错探索路线”；不要使用“产业工程”“复合发展”“路径模式”等抽象词。
4. tagline 用一句话讲清楚“这条路主要在做什么”，不要写空泛口号。
5. 每条路径至少包含 3 个 timeline 阶段：大一大二、大三大四、毕业后1-5年。
6. 每条 advice 必须按这四层内容组织：适合谁；大一大二要做什么；最容易踩的坑；什么时候该换路。可以用中文分号分隔。
7. 评分要有区分度，不能全高分。
8. 建议必须能指导学生在大学前两年做什么，避免只写“努力学习”“多参加活动”。
9. choice_context.assumptions 必须包含证据边界和关键推演假设。`;

  log.debug({
    systemChars: system.length,
    userChars: user.length,
    version: PROMPT_VERSION,
    pathCount: input.pathCount,
  }, "buildFuturePrompt completed");
  return { system, user, version: PROMPT_VERSION };
}
