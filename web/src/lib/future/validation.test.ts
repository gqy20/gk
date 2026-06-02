import { describe, expect, it } from "vitest";
import { validateFutureOutput } from "./validation";
import type { FutureStructuredOutput } from "./types";

function makeOutput(): FutureStructuredOutput {
  return {
    title: "浙江大学计算机类的未来路径",
    summary: "围绕平台、专业和城市机会展开。",
    choice_context: {
      school: "浙江大学",
      major: "计算机类",
      city: "杭州",
      assumptions: ["能适应强竞争", "未提供具体就业率数据"],
    },
    paths: [
      {
        index: 1,
        label: "科研深造型",
        tagline: "以保研和科研能力建立长期壁垒",
        probability_tone: "稳健",
        fit_score: 86,
        branch_ref: "学术深造",
        scores: {
          income: { value: 8, reason: "技术岗上限高" },
          stability: { value: 7, reason: "学历增强稳定" },
          growth: { value: 9, reason: "平台资源强" },
          happiness: { value: 6, reason: "竞争压力高" },
          risk: { value: 5, reason: "周期较长" },
          school_fit: { value: 9, reason: "学校匹配" },
          major_fit: { value: 9, reason: "专业匹配" },
        },
        timeline: [
          { stage: "大学 1-2 年级", text: "打牢基础并进入实验室。", key_events: ["绩点进入前列"] },
          { stage: "大学 3-4 年级", text: "参与科研和竞赛。", key_events: ["确定导师方向"] },
          { stage: "毕业后 1-5 年", text: "继续深造或进入技术岗位。", key_events: ["完成方向选择"] },
        ],
        key_risks: ["启动太晚"],
        turning_points: ["大一适应"],
        advice: "前两年抓绩点和项目。",
      },
      {
        index: 2,
        label: "工程就业型",
        tagline: "以项目和实习快速进入产业",
        probability_tone: "均衡",
        fit_score: 80,
        branch_ref: "产业就业",
        scores: {
          income: { value: 8, reason: "就业上限较高" },
          stability: { value: 6, reason: "市场波动存在" },
          growth: { value: 8, reason: "项目反馈快" },
          happiness: { value: 7, reason: "目标清晰" },
          risk: { value: 6, reason: "竞争激烈" },
          school_fit: { value: 8, reason: "平台加分" },
          major_fit: { value: 9, reason: "专业匹配" },
        },
        timeline: [
          { stage: "大学 1-2 年级", text: "完成基础课程和个人项目。", key_events: ["建立作品集"] },
          { stage: "大学 3-4 年级", text: "争取实习并确定方向。", key_events: ["完成实习"] },
          { stage: "毕业后 1-5 年", text: "进入技术团队持续成长。", key_events: ["确定技术栈"] },
        ],
        key_risks: ["只刷题不做项目"],
        turning_points: ["第一次实习"],
        advice: "尽早做可展示项目。",
      },
    ],
    comparison: {
      best_for_income: "工程就业型",
      best_for_stability: "科研深造型",
      best_for_growth: "科研深造型",
      highest_risk: "工程就业型",
      most_balanced: "工程就业型",
    },
    overall_advice: "先建立可迁移能力。",
  };
}

describe("validateFutureOutput", () => {
  it("accepts complete, diverse future output", () => {
    const report = validateFutureOutput(makeOutput(), 2);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.diversityScore).toBe(1);
  });

  it("reports invalid scores and missing timeline stages without throwing", () => {
    const output = makeOutput();
    output.paths[0].scores.income.value = 12;
    output.paths[0].timeline = output.paths[0].timeline.slice(0, 1);

    const report = validateFutureOutput(output, 2);

    expect(report.valid).toBe(false);
    expect(report.errors.some((error) => error.includes("income"))).toBe(true);
    expect(report.errors.some((error) => error.includes("timeline"))).toBe(true);
  });

  it("warns when path labels are too repetitive", () => {
    const output = makeOutput();
    output.paths[1].label = output.paths[0].label;

    const report = validateFutureOutput(output, 2);

    expect(report.valid).toBe(false);
    expect(report.errors.some((error) => error.includes("路径标签不够多样"))).toBe(true);
  });
});
