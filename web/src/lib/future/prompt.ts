import type { FutureRunInput } from "./types";
import { planFutureBranches } from "./branch-planner";

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
  const items = input.choiceContext.evidence.slice(0, 6);
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

  const system = [
    "你是高考志愿咨询师和职业发展研究员。",
    "你的任务是基于学生画像、学校/专业选择和有限证据，生成结构化的未来路径推演。",
    "不要把推演写成算命；每条路径都要说明选择后果、风险、转折点和可执行建议。",
    "必须承认证据边界，不得编造具体录取分数、就业率、保研率等未提供数据。",
  ].join("\n");

  const user = `请为这个志愿选择生成 ${input.pathCount} 条未来路径。

【学生画像】
- 生源省份：${profile.province}
- 选科/方向：${profile.subjectTrack}
- 分数段：${profile.scoreBand}
- 性格标签：${profile.personalityTags.join("、") || "未提供"}
- 兴趣方向：${profile.interests.join("、") || "未提供"}
- 风险偏好：${profile.riskTolerance}/10
- 家庭支持：${profile.familySupport}
- 目标/顾虑：${profile.goals || "未提供"}

【志愿选择】
- 学校：${choiceContext.school}
- 专业：${choiceContext.major || "未指定"}
- 城市：${choiceContext.city || "未指定"}
- 省份：${choiceContext.province || "未指定"}
- 学校标签：${choiceContext.schoolTags.join("、") || "未提供"}

【可用证据】
${formatEvidence(input)}

【分叉计划】
请严格按以下 ${input.pathCount} 个分叉生成路径。每条路径的 branch_ref 必须等于对应分叉名称。
${formatBranchPlan(input)}

【生成要求】
1. 输出必须调用指定工具，不能输出散文或 Markdown。
2. 生成 ${input.pathCount} 条互相有明显差异的路径，不能把多个分叉写成同一种人生建议。
3. 每条路径至少包含 3 个 timeline 阶段：大学1-2年级、大学3-4年级、毕业后1-5年。
4. 评分要有区分度，不能全高分。
5. 建议必须能指导学生在大学前两年做什么。
6. choice_context.assumptions 必须包含证据边界和关键推演假设。`;

  return { system, user, version: PROMPT_VERSION };
}
