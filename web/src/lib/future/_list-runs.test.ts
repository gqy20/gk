/**
 * TDD 红测试:FutureRepository.listRuns 契约。
 *
 * 列出最近的推演 run(按 createdAt desc),只返回卡片需要的轻量字段,
 * 不拉完整 output(留给 /api/future-runs/{id} 详情接口)。
 */
import { describe, it, expect } from "vitest";
import { MemoryFutureRepository } from "./repository";
import type { FutureRepository } from "./repository";
import type { FutureRunInput, FutureStructuredOutput } from "./types";

function makeInput(school = "浙江大学"): FutureRunInput {
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
      school,
      major: "计算机类",
      city: "杭州",
      province: "浙江",
      schoolTags: ["985"],
      evidence: [],
    },
    pathCount: 3,
  };
}

function makeOutput(title: string, fitScores: number[], tone: "稳健" | "均衡" | "冒险" = "均衡"): FutureStructuredOutput {
  return {
    title,
    summary: "summary text",
    choice_context: { school: "浙江大学", assumptions: [] },
    paths: fitScores.map((v, i) => ({
      index: i + 1,
      label: `路径 ${i + 1}`,
      tagline: "",
      probability_tone: tone,
      fit_score: v,
      scores: {
        income: { value: 5, reason: "" },
        stability: { value: 5, reason: "" },
        growth: { value: 5, reason: "" },
        happiness: { value: 5, reason: "" },
        risk: { value: 5, reason: "" },
        school_fit: { value: 5, reason: "" },
        major_fit: { value: 5, reason: "" },
      },
      timeline: [],
      key_risks: [],
      turning_points: [],
      advice: "",
    })),
    comparison: {
      best_for_income: "",
      best_for_stability: "",
      best_for_growth: "",
      highest_risk: "",
      most_balanced: "",
    },
    overall_advice: "",
  };
}

async function makeRun(
  repo: FutureRepository,
  opts: { school?: string; status?: "generating" | "completed" | "failed"; output?: FutureStructuredOutput; fitScores?: number[]; tone?: "稳健" | "均衡" | "冒险" } = {},
) {
  const { id } = await repo.createRun({
    status: opts.status ?? "completed",
    input: makeInput(opts.school),
    model: "claude-test",
    promptVersion: "gk_future_v1",
  });
  if (opts.output) {
    await repo.completeRun(id, { output: opts.output, inputTokens: 10, outputTokens: 20 });
  } else if (opts.status === "failed") {
    await repo.failRun(id, "boom");
  }
  return id;
}

describe("FutureRepository.listRuns", () => {
  it("空表返回空数组", async () => {
    const repo = new MemoryFutureRepository();
    const items = await repo.listRuns();
    expect(items).toEqual([]);
  });

  it("按 createdAt 倒序返回(新 run 在前)", async () => {
    const repo = new MemoryFutureRepository();
    const id1 = await makeRun(repo, { school: "A 校" });
    // 等一毫秒,确保 createdAt 不同
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await makeRun(repo, { school: "B 校" });
    await new Promise((r) => setTimeout(r, 5));
    const id3 = await makeRun(repo, { school: "C 校" });

    const items = await repo.listRuns();
    expect(items.map((i) => i.id)).toEqual([id3, id2, id1]);
  });

  it("每条 item 包含卡片所需字段: id/title/school/major/status/fitScoreMax/toneTop/createdAt", async () => {
    const repo = new MemoryFutureRepository();
    const id = await makeRun(repo, {
      output: makeOutput("三条路径推演", [70, 86, 65], "稳健"),
    });

    const items = await repo.listRuns();
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.id).toBe(id);
    expect(item.title).toBe("三条路径推演");
    expect(item.school).toBe("浙江大学");
    expect(item.major).toBe("计算机类");
    expect(item.status).toBe("completed");
    expect(item.fitScoreMax).toBe(86);
    expect(item.toneTop).toBe("稳健");
    expect(typeof item.createdAt).toBe("string");
    // summary 截断
    expect(item.summary.length).toBeLessThanOrEqual(80);
  });

  it("status=generating 的 run 也出现在列表,fitScoreMax=0,toneTop=null", async () => {
    const repo = new MemoryFutureRepository();
    await makeRun(repo, { status: "generating" });
    const items = await repo.listRuns();
    expect(items[0].status).toBe("generating");
    expect(items[0].fitScoreMax).toBe(0);
    expect(items[0].toneTop).toBeNull();
    expect(items[0].title).toBe(""); // 没有 output
  });

  it("status=failed 的 run 也出现在列表,title 留空,errorMessage 带出来", async () => {
    const repo = new MemoryFutureRepository();
    await makeRun(repo, { status: "failed" });
    const items = await repo.listRuns();
    expect(items[0].status).toBe("failed");
    expect(items[0].errorMessage).toBe("boom");
  });

  it("支持 limit 截断", async () => {
    const repo = new MemoryFutureRepository();
    for (let i = 0; i < 5; i++) {
      await makeRun(repo, { school: `S${i}` });
      await new Promise((r) => setTimeout(r, 2));
    }
    const items = await repo.listRuns({ limit: 3 });
    expect(items).toHaveLength(3);
  });

  it("limit 默认 20", async () => {
    const repo = new MemoryFutureRepository();
    // 25 条
    for (let i = 0; i < 25; i++) {
      await makeRun(repo, { school: `S${i}` });
    }
    const items = await repo.listRuns();
    expect(items).toHaveLength(20);
  });
});
