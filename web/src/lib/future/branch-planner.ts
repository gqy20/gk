import type { FutureBranchPlan, FutureRunInput, ProbabilityTone } from "./types";
import { createLogger} from "./logger";

const log = createLogger("branch-planner");

interface BranchTemplate {
  name: string;
  riskTone: ProbabilityTone;
  focus: string;
  assumptions: string[];
  requiredTradeoffs: string[];
}

const STEADY_BRANCHES: BranchTemplate[] = [
  {
    name: "成绩优先路线",
    riskTone: "稳健",
    focus: "先把绩点、基础课和英语稳住，保留保研、考研、转专业和实习等选择权。",
    assumptions: ["学生愿意把大一大二重点放在课程、绩点和学习习惯上", "家庭能接受先打基础、晚一点确定就业方向"],
    requiredTradeoffs: ["短期看起来不如实习和项目热闹", "如果只刷成绩、不了解专业真实方向，后面仍可能迷茫"],
  },
  {
    name: "稳定选择路线",
    riskTone: "稳健",
    focus: "提前了解考公、国企、事业单位、教师或稳定行业岗位需要什么准备。",
    assumptions: ["学生更重视下限、生活节奏和家庭可接受度", "愿意从大一开始积累成绩、证书、学生工作或考试准备"],
    requiredTradeoffs: ["收入上限可能不如高强度市场化岗位", "专业兴趣和城市选择可能需要让位于稳定性"],
  },
];

const BALANCED_BRANCHES: BranchTemplate[] = [
  {
    name: "项目实习路线",
    riskTone: "均衡",
    focus: "大一大二边学基础课边做项目、竞赛或实习，尽早判断这个专业能不能变成工作能力。",
    assumptions: ["学生愿意主动找项目、竞赛、社团或实习反馈", "目标城市或学校周边存在相关实践机会"],
    requiredTradeoffs: ["会比只上课更忙，需要自己找机会", "如果基础课没跟上，项目和实习会变成表面经历"],
  },
  {
    name: "试错探索路线",
    riskTone: "均衡",
    focus: "先体验课程、社团、通识课、辅修和项目，尽快判断自己是不是真的适合这个专业。",
    assumptions: ["学生现在还没完全确定兴趣或担心选错专业", "学校资源允许辅修、跨学院选课、社团或转专业尝试"],
    requiredTradeoffs: ["容易分散精力", "必须设置阶段目标，不能一直试但不做决定"],
  },
];

const RISK_BRANCHES: BranchTemplate[] = [
  {
    name: "冲高上限路线",
    riskTone: "冒险",
    focus: "冲竞赛、强实习、名校升学、头部岗位或更高平台，用更高投入换更高上限。",
    assumptions: ["学生能接受高竞争和阶段性不确定", "愿意用成绩、作品、竞赛、论文或实习证明能力"],
    requiredTradeoffs: ["心理压力和失败成本更高", "需要更早建立反馈机制，避免盲目硬冲"],
  },
  {
    name: "转向预案路线",
    riskTone: "冒险",
    focus: "如果入学后发现专业不适合，提前准备转专业、辅修、跨考或换就业方向。",
    assumptions: ["学生担心专业不适合，或目标中包含探索诉求", "家庭支持能覆盖至少一次试错"],
    requiredTradeoffs: ["路径不确定性最高", "需要明确止损点，不能等到大三才开始想退路"],
  },
];

function pickTemplate(pool: BranchTemplate[], index: number) {
  return pool[index % pool.length];
}

function templateOrder(input: FutureRunInput) {
  const profile = input.profile ?? {};
  const riskTolerance = typeof profile.riskTolerance === "number" ? profile.riskTolerance : 5;
  const goalText = (profile.goals ?? "").toLowerCase();
  const wantsStability = /稳|稳定|保底|下限|体制|国企/.test(goalText);
  const wantsGrowth = /上限|挑战|创业|探索|跨|一线|高薪/.test(goalText);

  if (riskTolerance >= 8 || wantsGrowth) {
    return [RISK_BRANCHES, BALANCED_BRANCHES, STEADY_BRANCHES];
  }
  if (riskTolerance <= 3 || wantsStability) {
    return [STEADY_BRANCHES, BALANCED_BRANCHES, RISK_BRANCHES];
  }
  return [STEADY_BRANCHES, BALANCED_BRANCHES, RISK_BRANCHES];
}

function contextualAssumptions(input: FutureRunInput) {
  const assumptions: string[] = [];
  const { choiceContext, profile } = input;
  const interests = profile?.interests ?? [];
  const evidence = choiceContext.evidence ?? [];

  if (choiceContext.major) assumptions.push(`以${choiceContext.major}作为主要能力起点`);
  if (choiceContext.city) assumptions.push(`城市机会以${choiceContext.city}及周边为主要外部环境`);
  if (interests.length > 0) assumptions.push(`兴趣方向包含${interests.slice(0, 3).join("、")}`);
  if (evidence.length === 0) assumptions.push("缺少学校细项证据时，只能做方向性推演");

  return assumptions;
}

export function planFutureBranches(input: FutureRunInput): FutureBranchPlan[] {
  const count = Math.max(1, Math.min(6, input.pathCount));
  if (input.pathCount !== count) {
    log.warn({ requested: input.pathCount, clamped: count }, "pathCount clamped to [1, 6]");
  }
  const pools = templateOrder(input);
  const sharedAssumptions = contextualAssumptions(input);

  return Array.from({ length: count }, (_, index) => {
    const pool = pools[index % pools.length];
    const template = pickTemplate(pool, Math.floor(index / pools.length));
    return {
      index: index + 1,
      name: template.name,
      riskTone: template.riskTone,
      focus: template.focus,
      assumptions: [...template.assumptions, ...sharedAssumptions].slice(0, 5),
      requiredTradeoffs: template.requiredTradeoffs,
    };
  }).map((b) => {
    log.debug({ index: b.index, name: b.name, riskTone: b.riskTone }, "planFutureBranches branch assigned");
    return b;
  });
}
