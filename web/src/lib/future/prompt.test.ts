import { describe, expect, it } from "vitest";
import { buildFuturePrompt } from "./prompt";
import type { FutureRunInput } from "./types";

describe("buildFuturePrompt", () => {
  it("includes student profile, choice context, and bounded school evidence", () => {
    const input: FutureRunInput = {
      profile: {
        province: "湖北",
        subjectTrack: "物理",
        scoreBand: "中上",
        personalityTags: ["理性", "谨慎"],
        interests: ["计算机", "工程"],
        riskTolerance: 5,
        familySupport: "中",
        goals: "希望去大城市，有机会读研",
      },
      choiceContext: {
        school: "浙江大学",
        major: "计算机类",
        city: "杭州",
        province: "浙江",
        schoolTags: ["985", "211", "双一流"],
        evidence: [
          { label: "就业质量报告", text: "毕业生去向包括重点行业和升学。".repeat(30) },
          { label: "转专业政策", text: "允许学生申请转专业。".repeat(30) },
        ],
      },
      pathCount: 6,
    };

    const prompt = buildFuturePrompt(input);

    expect(prompt.system).toContain("高考志愿咨询师");
    expect(prompt.user).toContain("浙江大学");
    expect(prompt.user).toContain("计算机类");
    expect(prompt.user).toContain("生成 6 条");
    expect(prompt.user.length).toBeLessThan(7000);
  });
});
