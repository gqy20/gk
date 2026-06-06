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
    name: "学术深造",
    riskTone: "稳健",
    focus: "保研、考研或继续深造，以学校平台和专业基础换取长期选择权。",
    assumptions: ["学生愿意把前两年重点放在绩点、基础课和科研入门上", "家庭能接受较长培养周期"],
    requiredTradeoffs: ["短期收入启动较慢", "大学前两年压力集中在成绩和竞赛/科研门槛"],
  },
  {
    name: "稳定就业",
    riskTone: "稳健",
    focus: "围绕国企、事业单位、选调或稳定行业岗位准备。",
    assumptions: ["学生更重视下限和生活稳定性", "愿意提前准备考试、实习或组织经历"],
    requiredTradeoffs: ["收入上限可能不如高强度市场化岗位", "专业兴趣可能需要让位于稳定性"],
  },
];

const BALANCED_BRANCHES: BranchTemplate[] = [
  {
    name: "产业工程",
    riskTone: "均衡",
    focus: "用项目、实习和专业能力进入产业岗位，在收入与成长之间取平衡。",
    assumptions: ["学生能持续做可展示项目", "目标城市存在相关产业机会"],
    requiredTradeoffs: ["需要承受同辈竞争和岗位周期波动", "如果只学课程不做实践，路径质量会下降"],
  },
  {
    name: "复合发展",
    riskTone: "均衡",
    focus: "把专业能力与城市、行业、产品或管理方向结合，保留转向空间。",
    assumptions: ["学生有跨领域兴趣或沟通能力", "学校资源允许辅修、社团、项目或跨学院探索"],
    requiredTradeoffs: ["容易分散精力", "需要主动筛选机会，不能只等待学校安排"],
  },
];

const RISK_BRANCHES: BranchTemplate[] = [
  {
    name: "高上限冲刺",
    riskTone: "冒险",
    focus: "瞄准高强度、高回报岗位或顶尖深造机会，用强投入换上限。",
    assumptions: ["学生能接受高竞争和阶段性不确定", "愿意用作品、竞赛、论文或实习证明能力"],
    requiredTradeoffs: ["心理压力和失败成本更高", "需要更早建立反馈机制，避免盲目硬冲"],
  },
  {
    name: "跨界转向",
    riskTone: "冒险",
    focus: "保留转专业、跨行业、创业或新兴方向探索空间。",
    assumptions: ["学生风险偏好较高或目标中包含探索诉求", "家庭支持能覆盖至少一次试错"],
    requiredTradeoffs: ["路径不确定性最高", "需要明确止损点和可迁移能力"],
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
