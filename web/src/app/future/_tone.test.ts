/**
 * TDD 红测试:_tone 工具契约。
 *
 * 覆盖两个纯函数:
 *   1. toneOf(path) — 把 LLM 输出的 probability_tone 字符串映射到 TONE key
 *   2. buildRadarPoints(path, options) — 把 7 维分数映射到 SVG 多边形顶点坐标
 *
 * 这两个函数一旦实现就是 result/page.tsx 雷达图与色编码的基石。
 */
import { describe, it, expect } from "vitest";
import { toneOf, buildRadarPoints, RADAR_VIEW } from "./_tone";
import type { FuturePath } from "@/lib/future/types";

function makePath(overrides: Partial<FuturePath> = {}): FuturePath {
  return {
    index: 1,
    label: "测试路径",
    tagline: "x",
    probability_tone: "均衡",
    fit_score: 8,
    branch_ref: undefined,
    scores: {
      income:     { value: 7, reason: "" },
      stability:  { value: 6, reason: "" },
      growth:     { value: 8, reason: "" },
      happiness:  { value: 5, reason: "" },
      risk:       { value: 4, reason: "" },
      school_fit: { value: 9, reason: "" },
      major_fit:  { value: 7, reason: "" },
    },
    timeline: [],
    key_risks: [],
    turning_points: [],
    advice: "",
    ...overrides,
  };
}

describe("toneOf", () => {
  it("稳健 → steady", () => {
    expect(toneOf(makePath({ probability_tone: "稳健" }))).toBe("steady");
  });
  it("均衡 → balanced", () => {
    expect(toneOf(makePath({ probability_tone: "均衡" }))).toBe("balanced");
  });
  it("冒险 → risky", () => {
    expect(toneOf(makePath({ probability_tone: "冒险" }))).toBe("risky");
  });
  it("未知 tone 兜底为 balanced", () => {
    expect(toneOf(makePath({ probability_tone: "未知" as FuturePath["probability_tone"] }))).toBe("balanced");
  });
});

describe("buildRadarPoints", () => {
  it("返回的顶点数等于分数维度数(7)", () => {
    const pts = buildRadarPoints(makePath());
    expect(pts).toHaveLength(7);
  });

  it("每个顶点都是 [x, y] 数值坐标", () => {
    const pts = buildRadarPoints(makePath());
    for (const [x, y] of pts) {
      expect(typeof x).toBe("number");
      expect(typeof y).toBe("number");
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it("分数 = 0 的维度顶点位于中心(cx, cy)", () => {
    const path = makePath({
      scores: {
        income:     { value: 0, reason: "" },
        stability:  { value: 10, reason: "" },
        growth:     { value: 10, reason: "" },
        happiness:  { value: 10, reason: "" },
        risk:       { value: 10, reason: "" },
        school_fit: { value: 10, reason: "" },
        major_fit:  { value: 10, reason: "" },
      },
    });
    const pts = buildRadarPoints(path);
    const [cx, cy] = RADAR_VIEW.center;
    const [first] = pts;
    expect(first[0]).toBeCloseTo(cx, 5);
    expect(first[1]).toBeCloseTo(cy, 5);
  });

  it("分数 = 10 的维度顶点位于圆周上,距离 = radius", () => {
    const path = makePath({
      scores: {
        income:     { value: 10, reason: "" },
        stability:  { value: 10, reason: "" },
        growth:     { value: 10, reason: "" },
        happiness:  { value: 10, reason: "" },
        risk:       { value: 10, reason: "" },
        school_fit: { value: 10, reason: "" },
        major_fit:  { value: 10, reason: "" },
      },
    });
    const pts = buildRadarPoints(path);
    const { center: [cx, cy], radius } = RADAR_VIEW;
    for (const [x, y] of pts) {
      const dist = Math.hypot(x - cx, y - cy);
      expect(dist).toBeCloseTo(radius, 5);
    }
  });

  it("7 个顶点等角分布(360°/7 ≈ 51.43°)", () => {
    const pts = buildRadarPoints(makePath({
      scores: Object.fromEntries(
        (["income", "stability", "growth", "happiness", "risk", "school_fit", "major_fit"] as const)
          .map(k => [k, { value: 5, reason: "" }])
      ) as FuturePath["scores"],
    }));
    // atan2 在 ±π 处不连续 → 以第一个角度为锚,把后续角度 unwrap 到单调递增
    const { center: [cx, cy] } = RADAR_VIEW;
    const raw = pts.map(([x, y]) => Math.atan2(y - cy, x - cx));
    const angles: number[] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      let v = raw[i];
      // 必须在 [prev, prev + 2π) 区间,否则向前 wrap
      while (v < angles[i - 1]) v += 2 * Math.PI;
      while (v >= angles[i - 1] + 2 * Math.PI) v -= 2 * Math.PI;
      angles.push(v);
    }
    // 第一个顶点应位于 -π/2(顶部)
    expect(angles[0]).toBeCloseTo(-Math.PI / 2, 5);
    // 后续应递增 2π/7
    const expectedStep = (Math.PI * 2) / 7;
    for (let i = 1; i < angles.length; i++) {
      const diff = angles[i] - angles[i - 1];
      expect(diff).toBeCloseTo(expectedStep, 5);
    }
  });
});
