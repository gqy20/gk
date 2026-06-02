import { describe, expect, it, vi } from "vitest";
import { FUTURE_SCHEMA_SQL, PostgresFutureRepository } from "./postgres";
import type { FutureRunInput, FutureStructuredOutput } from "./types";

const input: FutureRunInput = {
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
    schoolTags: ["985"],
    evidence: [],
  },
  pathCount: 1,
};

const output: FutureStructuredOutput = {
  title: "未来路径",
  summary: "summary",
  choice_context: { school: "浙江大学", assumptions: [] },
  paths: [],
  comparison: {
    best_for_income: "A",
    best_for_stability: "B",
    best_for_growth: "C",
    highest_risk: "D",
    most_balanced: "E",
  },
  overall_advice: "advice",
};

describe("PostgresFutureRepository", () => {
  it("declares the required future tables", () => {
    expect(FUTURE_SCHEMA_SQL).toContain("future_runs");
    expect(FUTURE_SCHEMA_SQL).toContain("future_paths");
    expect(FUTURE_SCHEMA_SQL).toContain("llm_events");
    expect(FUTURE_SCHEMA_SQL).toContain("jsonb");
  });

  it("inserts a run and completes it with output and path rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "run_1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const repo = new PostgresFutureRepository({ query });
    const created = await repo.createRun({
      status: "generating",
      input,
      model: "claude-test",
      promptVersion: "gk_future_v1",
    });

    await repo.completeRun("run_1", {
      output,
      inputTokens: 10,
      outputTokens: 20,
    });

    expect(created.id).toBe("run_1");
    expect(query.mock.calls[0][0]).toContain("insert into future_runs");
    expect(query.mock.calls[1][0]).toContain("update future_runs");
    expect(query.mock.calls[2][0]).toContain("delete from future_paths");
    expect(query.mock.calls[3][0]).toContain("insert into llm_events");
  });
});
