import type { FutureScoreKey, FutureStructuredOutput, FutureValidationReport } from "./types";

const SCORE_KEYS: FutureScoreKey[] = [
  "income",
  "stability",
  "growth",
  "happiness",
  "risk",
  "school_fit",
  "major_fit",
];

export function validateFutureOutput(
  output: FutureStructuredOutput,
  expectedPathCount: number,
): FutureValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const paths = Array.isArray(output.paths) ? output.paths : [];

  if (paths.length !== expectedPathCount) {
    warnings.push(`路径数量为 ${paths.length}，与请求的 ${expectedPathCount} 条不一致`);
  }

  if (!output.choice_context?.assumptions || output.choice_context.assumptions.length === 0) {
    errors.push("choice_context.assumptions 不能为空");
  }

  for (const path of paths) {
    if (!path.label) errors.push(`路径 ${path.index} 缺少 label`);
    if (!Array.isArray(path.timeline) || path.timeline.length < 3) {
      errors.push(`路径 ${path.index} timeline 少于 3 个阶段`);
    }
    if (!Array.isArray(path.key_risks) || path.key_risks.length === 0) {
      errors.push(`路径 ${path.index} 缺少 key_risks`);
    }
    if (!path.advice) errors.push(`路径 ${path.index} 缺少 advice`);

    for (const key of SCORE_KEYS) {
      const score = path.scores?.[key];
      if (!score || typeof score.value !== "number" || score.value < 1 || score.value > 10) {
        errors.push(`路径 ${path.index} 评分 ${key} 必须在 1-10 之间`);
      }
    }
  }

  const labels = paths.map((path) => path.label).filter(Boolean);
  const uniqueLabels = new Set(labels);
  const diversityScore = paths.length === 0 ? 0 : uniqueLabels.size / paths.length;
  if (paths.length > 1 && diversityScore < 0.8) {
    errors.push(`路径标签不够多样：${uniqueLabels.size}/${paths.length}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    diversityScore,
  };
}
