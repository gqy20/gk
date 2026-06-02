/**
 * result 页决策助手的纯函数集合。
 * 与 result/page.tsx 内联实现等价,这里只 export,便于单元测试。
 */
import type { FuturePath, FutureStructuredOutput } from "@/lib/future/types";

export function findRecommendedPath(output: FutureStructuredOutput): FuturePath | null {
  const balanced = (output.comparison?.most_balanced || "").trim();
  // 空串/纯空白时跳过第一段,避免 "甲".includes("") === true 的误匹配
  const matched = balanced
    ? output.paths.find(
        (path) => balanced.includes(path.label) || path.label.includes(balanced),
      )
    : null;
  if (matched) return matched;

  const balancedTone = output.paths
    .filter((path) => path.probability_tone === "均衡")
    .sort((a, b) => b.fit_score - a.fit_score)[0];
  if (balancedTone) return balancedTone;

  return [...output.paths].sort((a, b) => b.fit_score - a.fit_score)[0] || null;
}

export function clipText(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function scoreLabel(key: string) {
  const labels: Record<string, string> = {
    income: "收入",
    stability: "稳定",
    growth: "成长",
    happiness: "幸福",
    risk: "风险",
    school_fit: "学校",
    major_fit: "专业",
  };
  return labels[key] || key;
}

export function buildQualityItems(output: FutureStructuredOutput) {
  const validation = output.validation;
  const allTimelineComplete = output.paths.every((path) => path.timeline.length >= 3);
  const allRisksPresent = output.paths.every((path) => path.key_risks.length > 0);

  return [
    {
      label: "路径差异度",
      value: validation ? `${Math.round(validation.diversityScore * 100)}%` : "未记录",
    },
    {
      label: "结构完整",
      value: validation?.valid ? "通过" : "需复核",
    },
    {
      label: "时间线",
      value: allTimelineComplete ? "3 阶段完整" : "不完整",
    },
    {
      label: "风险覆盖",
      value: allRisksPresent ? "已覆盖" : "需补充",
    },
  ];
}

export function extractActionItems(text: string) {
  const normalized = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  // 用 Array.from 取字符数(中文字符算 1),而非 UTF-16 code units,
  // 否则 "先把绩点稳住" 这种 6 字的中文 length=6,会过严过滤。
  const parts = normalized
    .split(/[。；;]/)
    .map((item) => item.trim())
    .filter((item) => Array.from(item).length >= 4);
  return (parts.length > 0 ? parts : [normalized]).slice(0, 3).map((item) => clipText(item, 52));
}
