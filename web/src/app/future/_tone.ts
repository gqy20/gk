/**
 * 路径色编码 + 雷达图几何工具。
 *
 * 纯函数,可被 React 组件或 service 代码复用,无副作用。
 */
import type { FuturePath } from "@/lib/future/types";

export const TONE = {
  steady:   { fg: "text-brand-300",  ring: "ring-brand-300/40",  bg: "bg-brand-300/10" },
  balanced: { fg: "text-accent-300",   ring: "ring-accent-300/45",   bg: "bg-accent-300/10" },
  risky:    { fg: "text-risk-400",    ring: "ring-risk-300/40",    bg: "bg-risk-300/10" },
} as const;

export type ToneKey = keyof typeof TONE;

/**
 * 把 LLM 输出的 probability_tone 字符串映射到 TONE key。
 * 未知值兜底为 balanced,避免组件渲染时炸掉。
 */
export function toneOf(path: FuturePath): ToneKey {
  switch (path.probability_tone) {
    case "稳健": return "steady";
    case "冒险": return "risky";
    case "均衡": return "balanced";
    default:     return "balanced";
  }
}

/** 雷达图视图尺寸(以 viewBox 单位计,SVG 自身可缩放) */
export const RADAR_VIEW = {
  size: 240,
  center: [120, 120] as readonly [number, number],
  radius: 102, // size/2 - 18 边距
} as const;

/**
 * 把 7 维分数映射到正多边形顶点(以中心为原点,顶部 12 点钟方向开始)。
 *
 * 数学:
 *   angle_i = -π/2 + 2π * i / 7
 *   radius_i = RADAR_VIEW.radius * (value / 10)
 *   point_i = center + (cos a, sin a) * radius_i
 */
export function buildRadarPoints(path: FuturePath): ReadonlyArray<readonly [number, number]> {
  const keys = Object.keys(path.scores) as Array<keyof FuturePath["scores"]>;
  const [cx, cy] = RADAR_VIEW.center;
  return keys.map((k, i) => {
    const value = path.scores[k]?.value ?? 0;
    const ang = -Math.PI / 2 + (Math.PI * 2 * i) / keys.length;
    const r = RADAR_VIEW.radius * (value / 10);
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r] as const;
  });
}
