import type { FutureStructuredOutput } from "./types";

type JsonSchema = Record<string, unknown>;

function scoreItem(description: string): JsonSchema {
  return {
    type: "object",
    description,
    properties: {
      value: {
        type: "number",
        description: "1-10 分，风险维度中 10 表示风险最高",
      },
      reason: {
        type: "string",
        description: "20 字以内的原因",
      },
    },
    required: ["value", "reason"],
  };
}

const scoresSchema: JsonSchema = {
  type: "object",
  properties: {
    income: scoreItem("收入上限"),
    stability: scoreItem("路径稳定性"),
    growth: scoreItem("成长空间"),
    happiness: scoreItem("主观幸福感"),
    risk: scoreItem("风险水平"),
    school_fit: scoreItem("学校适配度"),
    major_fit: scoreItem("专业适配度"),
  },
  required: ["income", "stability", "growth", "happiness", "risk", "school_fit", "major_fit"],
};

export const futurePathsTool = {
  name: "generate_future_paths",
  description: "生成高考志愿选择的结构化未来路径推演结果。",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string", description: "对本次选择的整体判断，120字以内" },
      choice_context: {
        type: "object",
        properties: {
          school: { type: "string" },
          major: { type: "string" },
          city: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
        },
        required: ["school", "assumptions"],
      },
      paths: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            label: { type: "string" },
            tagline: { type: "string" },
            probability_tone: { type: "string", enum: ["稳健", "均衡", "冒险"] },
            fit_score: { type: "number", description: "0-100 适配分" },
            scores: scoresSchema,
            timeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stage: { type: "string" },
                  text: { type: "string" },
                  key_events: { type: "array", items: { type: "string" } },
                },
                required: ["stage", "text", "key_events"],
              },
            },
            key_risks: { type: "array", items: { type: "string" } },
            turning_points: { type: "array", items: { type: "string" } },
            advice: { type: "string" },
          },
          required: [
            "index",
            "label",
            "tagline",
            "probability_tone",
            "fit_score",
            "scores",
            "timeline",
            "key_risks",
            "turning_points",
            "advice",
          ],
        },
      },
      comparison: {
        type: "object",
        properties: {
          best_for_income: { type: "string" },
          best_for_stability: { type: "string" },
          best_for_growth: { type: "string" },
          highest_risk: { type: "string" },
          most_balanced: { type: "string" },
        },
        required: [
          "best_for_income",
          "best_for_stability",
          "best_for_growth",
          "highest_risk",
          "most_balanced",
        ],
      },
      overall_advice: { type: "string" },
    },
    required: ["title", "summary", "choice_context", "paths", "comparison", "overall_advice"],
  },
} satisfies {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export type FuturePathsToolOutput = FutureStructuredOutput;
