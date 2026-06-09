/**
 * 大学人生模拟器 — LLM 结构化输出 Schema
 *
 * 两个 tool：
 * 1. simulateStepTool   — 每轮推演（场景 + 3选项 + 上一步结果）
 * 2. generateEndingTool — 最终结局（人设卡）
 *
 * 结构定义（type/properties/required）在此文件保持不变，
 * 描述文本从 simulator-prompts.yaml 加载。
 */

import type { SimulateStepResult, SimulatorEnding } from "./simulator-types";
import {
  getSimulateStepDescriptions,
  getGenerateEndingDescriptions,
} from "./simulator-prompts";

type JsonSchema = Record<string, unknown>;

// ── 共享：选项 schema ──────────────────────────────

const choiceSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: getSimulateStepDescriptions().input_schema_descriptions.choice_id,
    },
    label: {
      type: "string",
      description: getSimulateStepDescriptions().input_schema_descriptions.choice_label,
    },
    detail: {
      type: "string",
      description: getSimulateStepDescriptions().input_schema_descriptions.choice_detail,
    },
  },
  required: ["id", "label"],
} satisfies JsonSchema;

// ── Tool 1: 单步推演 ────────────────────────────────

const _stepDesc = getSimulateStepDescriptions();
export const simulateStepTool = {
  name: _stepDesc.name,
  description: _stepDesc.description,
  input_schema: {
    type: "object",
    properties: {
      round: {
        type: "number",
        description: _stepDesc.input_schema_descriptions.round,
      },
      scene_title: {
        type: "string",
        description: _stepDesc.input_schema_descriptions.scene_title,
      },
      scene_description: {
        type: "string",
        description: _stepDesc.input_schema_descriptions.scene_description,
      },
      choices: {
        type: "array",
        description: _stepDesc.input_schema_descriptions.choices,
        items: choiceSchema,
        minItems: 3,
        maxItems: 3,
      },
      outcome: {
        type: "object",
        description: _stepDesc.input_schema_descriptions.outcome,
        properties: {
          narrative: {
            type: "string",
            description: _stepDesc.input_schema_descriptions.outcome_narrative,
          },
          effects: {
            type: "array",
            items: { type: "string" },
            description: _stepDesc.input_schema_descriptions.outcome_effects,
          },
        },
        required: ["narrative", "effects"],
      },
      is_final: {
        type: "boolean",
        description: _stepDesc.input_schema_descriptions.is_final,
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

// ── Tool 2: 结局生成 ────────────────────────────────

const _endingDesc = getGenerateEndingDescriptions();
export const generateEndingTool = {
  name: _endingDesc.name,
  description: _endingDesc.description,
  input_schema: {
    type: "object",
    properties: {
      archetype: {
        type: "string",
        description: _endingDesc.input_schema_descriptions.archetype,
      },
      summary: {
        type: "string",
        description: _endingDesc.input_schema_descriptions.summary,
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: _endingDesc.input_schema_descriptions.tags,
      },
      gpa_estimate: {
        type: "string",
        description: _endingDesc.input_schema_descriptions.gpa_estimate,
      },
      social_circle: {
        type: "string",
        description: _endingDesc.input_schema_descriptions.social_circle,
      },
      turning_moments: {
        type: "array",
        description: _endingDesc.input_schema_descriptions.turning_moments,
        items: {
          type: "object",
          properties: {
            round: { type: "number", description: _endingDesc.input_schema_descriptions.tm_round },
            choice_label: { type: "string", description: _endingDesc.input_schema_descriptions.tm_choice_label },
            consequence: { type: "string", description: _endingDesc.input_schema_descriptions.tm_consequence },
          },
          required: ["round", "choice_label", "consequence"],
        },
      },
      closing_message: {
        type: "string",
        description: _endingDesc.input_schema_descriptions.closing_message,
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
