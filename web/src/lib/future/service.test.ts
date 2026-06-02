import { describe, expect, it, vi } from "vitest";
import { createFutureRun, generateFutureRun, getFutureRunResult, startFutureRun } from "./service";
import type { FutureRepository } from "./repository";
import type { FutureRunInput, FutureStructuredOutput } from "./types";

function makeInput(): FutureRunInput {
  return {
    profile: {
      province: "湖北",
      subjectTrack: "物理",
      scoreBand: "中上",
      personalityTags: ["理性"],
      interests: ["计算机"],
      riskTolerance: 5,
      familySupport: "中",
      goals: "想读计算机",
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
  };
}

function makeOutput(): FutureStructuredOutput {
  return {
    title: "浙江大学计算机类的 3 种未来路径",
    summary: "路径围绕强平台和专业机会展开。",
    choice_context: {
      school: "浙江大学",
      major: "计算机类",
      city: "杭州",
      assumptions: ["能适应强竞争"],
    },
    paths: [
      {
        index: 1,
        label: "保研深造型",
        tagline: "把学术路线走深",
        probability_tone: "稳健",
        fit_score: 86,
        scores: {
          income: { value: 8, reason: "技术岗收入较高" },
          stability: { value: 7, reason: "学历护城河" },
          growth: { value: 9, reason: "平台资源强" },
          happiness: { value: 6, reason: "压力较高" },
          risk: { value: 5, reason: "周期较长" },
          school_fit: { value: 9, reason: "学校匹配" },
          major_fit: { value: 9, reason: "专业匹配" },
        },
        timeline: [
          {
            stage: "大学 1-2 年级",
            text: "打牢基础并进入实验室。",
            key_events: ["绩点进入前列"],
          },
        ],
        key_risks: ["启动太晚"],
        turning_points: ["大一适应"],
        advice: "前两年抓绩点和项目。",
      },
    ],
    comparison: {
      best_for_income: "大厂工程型",
      best_for_stability: "选调体制型",
      best_for_growth: "科研深造型",
      highest_risk: "创业型",
      most_balanced: "技术专家型",
    },
    overall_advice: "先建立可迁移能力。",
  };
}

describe("future service", () => {
  it("creates a run, calls LLM, stores paths, and marks it completed", async () => {
    const repo: FutureRepository = {
      createRun: vi.fn(async () => ({ id: "run_1" })),
      completeRun: vi.fn(async () => undefined),
      failRun: vi.fn(async () => undefined),
      getRunResult: vi.fn(),
    };
    const provider = {
      generateStructured: vi.fn(async () => ({
        data: makeOutput(),
        usage: { inputTokens: 100, outputTokens: 500 },
      })),
    };

    const result = await createFutureRun({
      input: makeInput(),
      repository: repo,
      provider,
    });

    expect(result.runId).toBe("run_1");
    expect(result.status).toBe("completed");
    expect(repo.createRun).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
    expect(repo.completeRun).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({
        output: expect.objectContaining({ title: expect.stringContaining("浙江大学") }),
        inputTokens: 100,
        outputTokens: 500,
      }),
    );
  });

  it("can start a run without waiting for LLM generation", async () => {
    const repo: FutureRepository = {
      createRun: vi.fn(async () => ({ id: "run_2" })),
      completeRun: vi.fn(async () => undefined),
      failRun: vi.fn(async () => undefined),
      getRunResult: vi.fn(),
    };

    const result = await startFutureRun({
      input: makeInput(),
      repository: repo,
      model: "claude-test",
    });

    expect(result).toEqual({ runId: "run_2", status: "generating" });
    expect(repo.createRun).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
  });

  it("generates an existing run and stores the result", async () => {
    const repo: FutureRepository = {
      createRun: vi.fn(),
      completeRun: vi.fn(async () => undefined),
      failRun: vi.fn(async () => undefined),
      getRunResult: vi.fn(),
    };
    const provider = {
      generateStructured: vi.fn(async () => ({
        data: makeOutput(),
        usage: { inputTokens: 100, outputTokens: 500 },
      })),
    };

    await generateFutureRun({
      runId: "run_2",
      input: makeInput(),
      repository: repo,
      provider,
    });

    expect(repo.completeRun).toHaveBeenCalledWith(
      "run_2",
      expect.objectContaining({ output: expect.objectContaining({ paths: expect.any(Array) }) }),
    );
  });

  it("returns a stored result by id", async () => {
    const stored = { run: { id: "run_1", status: "completed" as const }, output: makeOutput() };
    const repo: FutureRepository = {
      createRun: vi.fn(),
      completeRun: vi.fn(),
      failRun: vi.fn(),
      getRunResult: vi.fn(async () => stored),
    };

    await expect(getFutureRunResult("run_1", repo)).resolves.toBe(stored);
  });
});
