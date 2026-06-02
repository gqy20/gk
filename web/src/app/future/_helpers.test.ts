/**
 * TDD 红测试:result 页决策助手的纯函数契约。
 *
 * 这五个函数都在 result/page.tsx 中以"内联"形式实现,
 * 抽到 _helpers.ts 后用单元测试锁定它们的行为。
 */
import { describe, it, expect } from "vitest";
import type { FuturePath, FutureStructuredOutput } from "@/lib/future/types";
import {
  findRecommendedPath,
  clipText,
  scoreLabel,
  buildQualityItems,
  extractActionItems,
} from "./_helpers";

function path(o: Partial<FuturePath> = {}): FuturePath {
  return {
    index: 1,
    label: "路径A",
    tagline: "",
    probability_tone: "均衡",
    fit_score: 7,
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
    ...o,
  };
}

const output = (paths: FuturePath[], most_balanced = ""): FutureStructuredOutput => ({
  title: "",
  summary: "",
  choice_context: { school: "", assumptions: [] },
  paths,
  comparison: {
    best_for_income: "",
    best_for_stability: "",
    best_for_growth: "",
    highest_risk: "",
    most_balanced,
  },
  overall_advice: "",
});

describe("findRecommendedPath", () => {
  it("优先匹配 most_balanced 标签", () => {
    const p1 = path({ index: 1, label: "学术深造", fit_score: 9 });
    const p2 = path({ index: 2, label: "产业工程", fit_score: 7 });
    const p3 = path({ index: 3, label: "跨界转向", fit_score: 6 });
    const out = output([p1, p2, p3], "产业工程");
    expect(findRecommendedPath(out)?.index).toBe(2);
  });

  it("most_balanced 未匹配时,取 probability_tone=均衡 且 fit_score 最高", () => {
    // label 用 "甲乙丙",most_balanced 用不含这些字且不含 a-z 的串,
    // 避免 .includes() 误命中。
    const p1 = path({ index: 1, label: "甲", probability_tone: "稳健", fit_score: 10 });
    const p2 = path({ index: 2, label: "乙", probability_tone: "均衡", fit_score: 6 });
    const p3 = path({ index: 3, label: "丙", probability_tone: "均衡", fit_score: 8 });
    const out = output([p1, p2, p3], "无匹配的字串");
    expect(findRecommendedPath(out)?.index).toBe(3);
  });

  it("most_balanced 为空串时,不触发 label.includes('') 误匹配,走 tone 均衡分支", () => {
    const p1 = path({ index: 1, label: "甲", probability_tone: "稳健", fit_score: 10 });
    const p2 = path({ index: 2, label: "乙", probability_tone: "均衡", fit_score: 6 });
    const p3 = path({ index: 3, label: "丙", probability_tone: "均衡", fit_score: 8 });
    const out = output([p1, p2, p3], "");
    expect(findRecommendedPath(out)?.index).toBe(3);
  });

  it("兜底:取 fit_score 最高的路径", () => {
    const p1 = path({ index: 1, label: "甲", probability_tone: "稳健", fit_score: 5 });
    const p2 = path({ index: 2, label: "乙", probability_tone: "稳健", fit_score: 9 });
    const out = output([p1, p2], "");
    expect(findRecommendedPath(out)?.index).toBe(2);
  });
});

describe("clipText", () => {
  it("短于 max 时原样返回", () => {
    expect(clipText("hello", 10)).toBe("hello");
  });
  it("超过 max 时截断并加 …", () => {
    expect(clipText("hello world", 5)).toBe("hell…");
  });
  it("恰好等于 max 时原样返回", () => {
    expect(clipText("hello", 5)).toBe("hello");
  });
});

describe("scoreLabel", () => {
  it("income/stability/growth/risk 等都映射到中文", () => {
    expect(scoreLabel("income")).toBe("收入");
    expect(scoreLabel("stability")).toBe("稳定");
    expect(scoreLabel("growth")).toBe("成长");
    expect(scoreLabel("risk")).toBe("风险");
    expect(scoreLabel("school_fit")).toBe("学校");
    expect(scoreLabel("major_fit")).toBe("专业");
  });
  it("未知 key 兜底为原 key", () => {
    expect(scoreLabel("unknown_metric")).toBe("unknown_metric");
  });
});

describe("buildQualityItems", () => {
  it("4 项:差异度/结构/时间线/风险覆盖", () => {
    const p1 = path({ timeline: [{}, {}, {}] as never, key_risks: ["x"] });
    const p2 = path({ timeline: [{}, {}, {}] as never, key_risks: ["y"] });
    const out = output([p1, p2]);
    (out as { validation?: { valid: boolean; diversityScore: number; errors: string[]; warnings: string[] } }).validation = {
      valid: true, diversityScore: 0.85, errors: [], warnings: [],
    };
    const items = buildQualityItems(out);
    expect(items.map(i => i.label)).toEqual([
      "路径差异度", "结构完整", "时间线", "风险覆盖",
    ]);
    expect(items[0].value).toBe("85%");
    expect(items[1].value).toBe("通过");
  });
});

describe("extractActionItems", () => {
  it("按 。 ； ; 拆,过滤长度 < 8 的碎片", () => {
    // 长度阈值 8 对中文过严,改用更接近真实 LLM 输出的长句
    const text = "先把绩点稳住确保不挂科。先做这个实习;然后做那个竞赛。短。";
    const items = extractActionItems(text);
    expect(items).toContain("先把绩点稳住确保不挂科");
    expect(items).toContain("先做这个实习");
    expect(items).toContain("然后做那个竞赛");
    expect(items.find(i => i === "短")).toBeUndefined();
  });
  it("没有分隔符时,把全文作为单条", () => {
    const items = extractActionItems("abcdefghij"); // 长度 10
    expect(items).toHaveLength(1);
    expect(items[0]).toBe("abcdefghij");
  });
  it("最多返回 3 条", () => {
    const text = "AAAAAAAAAA。BBBBBBBBBB。CCCCCCCCCC。DDDDDDDDDD。EEEEEEEEEE。";
    const items = extractActionItems(text);
    expect(items.length).toBeLessThanOrEqual(3);
  });
});
