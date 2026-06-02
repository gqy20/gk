import { describe, expect, it } from "vitest";
import { planFutureBranches } from "./branch-planner";
import type { FutureRunInput } from "./types";

function makeInput(overrides: Partial<FutureRunInput> = {}): FutureRunInput {
  return {
    profile: {
      province: "湖北",
      subjectTrack: "物理",
      scoreBand: "中上",
      personalityTags: ["理性", "谨慎"],
      interests: ["计算机", "工程"],
      riskTolerance: 5,
      familySupport: "中",
      goals: "希望找到上限和稳定性比较平衡的路径。",
    },
    choiceContext: {
      school: "浙江大学",
      major: "计算机类",
      city: "杭州",
      province: "浙江",
      schoolTags: ["985", "双一流"],
      evidence: [],
    },
    pathCount: 3,
    ...overrides,
  };
}

describe("planFutureBranches", () => {
  it("creates deterministic, distinct branch assumptions for the requested path count", () => {
    const input = makeInput();

    const branches = planFutureBranches(input);

    expect(branches).toHaveLength(3);
    expect(branches.map((branch) => branch.index)).toEqual([1, 2, 3]);
    expect(new Set(branches.map((branch) => branch.name)).size).toBe(3);
    expect(branches[0]).toEqual(planFutureBranches(input)[0]);
    expect(branches[0].assumptions.length).toBeGreaterThanOrEqual(2);
  });

  it("leans toward higher-risk routes when risk tolerance is high", () => {
    const branches = planFutureBranches(
      makeInput({
        profile: {
          ...makeInput().profile,
          riskTolerance: 9,
          goals: "希望挑战高上限路径，也能接受不确定性。",
        },
        pathCount: 4,
      }),
    );

    expect(branches.some((branch) => branch.riskTone === "冒险")).toBe(true);
    expect(branches.some((branch) => branch.name.includes("高上限") || branch.name.includes("跨界"))).toBe(true);
  });
});
