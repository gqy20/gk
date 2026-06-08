/**
 * 大学人生模拟器 — LLM 结构化输出 Schema
 *
 * 两个 tool：
 * 1. simulateStepTool   — 每轮推演（场景 + 3选项 + 上一步结果）
 * 2. generateEndingTool — 最终结局（人设卡）
 */

import type { SimulateStepResult, SimulatorEnding } from "./simulator-types";

type JsonSchema = Record<string, unknown>;

// ── 共享：选项 schema ──────────────────────────────

const choiceSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: '选项唯一标识，如 "a" / "b" / "c"',
    },
    label: {
      type: "string",
      description: "选项简短描述（15字以内），如「主动和室友打招呼」",
    },
    detail: {
      type: "string",
      description: "选项详细说明（30字以内），补充背景和可能的直接后果。可选。",
    },
  },
  required: ["id", "label"],
} satisfies JsonSchema;

// ── Tool 1: 单步推演 ────────────────────────────────

export const simulateStepTool = {
  name: "simulate_step",
  description: "推演大学人生模拟器的单轮场景：根据用户档案和历史决策，生成当前场景、3个选择，以及上一步选择的后果。",
  input_schema: {
    type: "object",
    properties: {
      round: {
        type: "number",
        description: "当前回合数（1-based）",
      },
      scene_title: {
        type: "string",
        description: "场景标题（如'入学报到第一天'、'期末考试周'、'社团招新季'），8字以内",
      },
      scene_description: {
        type: "string",
        description: "场景氛围描述（60-100字）。用第二人称'你'叙述，营造沉浸感。包含时间、地点、周围环境、你当下的状态/心情。",
      },
      choices: {
        type: "array",
        description: "用户面临的3个选择，风格要有明显差异（如社交型vs专注型vs观望型）",
        items: choiceSchema,
        minItems: 3,
        maxItems: 3,
      },
      outcome: {
        type: "object",
        description: "上一步选择的即时推演结果（第1轮时此字段为null或不填）",
        properties: {
          narrative: {
            type: "string",
            description: "选择后的即时反馈叙述（40-80字）。用第二人称讲述发生了什么、周围人的反应、你的感受。",
          },
          effects: {
            type: "array",
            items: { type: "string" },
            description: "隐性影响标签数组（2-4个），如['社交+1','认识了班长','错过了图书馆位置']。简洁有力。",
          },
        },
        required: ["narrative", "effects"],
      },
      is_final: {
        type: "boolean",
        description: "是否为最后一轮（达到总回合数时为true）。最后一轮仍需生成场景和选择，但不再生成next_choices。",
      },
    },
    required: ["round", "scene_title", "scene_description", "choices", "is_final"],
  },
} satisfies {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export type SimulateStepToolOutput = SimulateStepResult;

// ── Tool 2: 结局生成 ───────────────────────────────

export const generateEndingTool = {
  name: "generate_ending",
  description: "根据完整的决策历史，生成大学四年模拟的最终人设卡结局。",
  input_schema: {
    type: "object",
    properties: {
      archetype: {
        type: "string",
        description: "人设卡标题（如'社交达人型学霸''低调实力派''探索者'），6-10字",
      },
      summary: {
        type: "string",
        description: "大学四年走向总结（80-120字）。回顾关键决策如何塑造了这个人的大学生活轨迹。",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "性格/行为标签（5-8个），由决策倾向推导。如['外向','有主见','略焦虑','行动力强']",
      },
      gpa_estimate: {
        type: "string",
        description: "GPA区间估计，如'3.4-3.8/4.0'或'中上水平'",
      },
      social_circle: {
        type: "string",
        description: "社交圈类型描述（20-40字），如'有一个紧密的小圈子，认识各学院的人'",
      },
      turning_moments: {
        type: "array",
        description: "关键转折点回顾（选取最重要的3-4个决策）",
        items: {
          type: "object",
          properties: {
            round: { type: "number", description: "第几轮" },
            choice_label: { type: "string", description: "当时选了什么" },
            consequence: { type: "string", description: "这个选择如何影响了后续走向（20-40字）" },
          },
          required: ["round", "choice_label", "consequence"],
        },
      },
      closing_message: {
        type: "string",
        description: "一句寄语（15-30字），温暖但不鸡汤，贴合这个具体的人设",
      },
    },
    required: ["archetype", "summary", "tags", "gpa_estimate", "social_circle", "turning_moments", "closing_message"],
  },
} satisfies {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export type GenerateEndingToolOutput = SimulatorEnding;
