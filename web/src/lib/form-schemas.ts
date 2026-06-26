/**
 * Valibot 表单校验 Schema —— 前端表单验证
 *
 * 设计原则：
 * - 极轻量（valibot ~1.4KB gzipped）
 * - 错误信息中文，面向终端用户
 * - 与 react-hook-form 的 @hookform/resolvers/valibot 配合使用
 */

import {
  maxLength,
  minLength,
  object,
  optional,
  pipe,
  string,
} from "valibot";

// ─── 共享消息 ──────────────────────────────────────

const msg = {
  required: "此项为必填",
  schoolRequired: "请选择目标学校",
  maxLen: (max: number) => `不能超过 ${max} 个字符`,
};

// ─── 模拟器表单 Schema ─────────────────────────────

/**
 * 模拟器配置页表单校验规则
 */
export const simulatorSchema = object({
  targetSchool: pipe(
    string(msg.schoolRequired),
    maxLength(50, msg.maxLen(50)),
  ),
  targetMajor: optional(pipe(string(), maxLength(30, msg.maxLen(30)))),
  gender: optional(string()),
  personalityTags: pipe(
    string(msg.required),
    maxLength(100, msg.maxLen(100)),
  ),
  interests: pipe(
    string(msg.required),
    maxLength(100, msg.maxLen(100)),
  ),
  riskTolerance: pipe(
    string(msg.required),
    maxLength(2, msg.maxLen(2)),
  ),
});

// ─── 未来路径表单 Schema ───────────────────────────

/**
 * 未来路径预演表单校验规则
 */
export const futureSchema = object({
  targetSchool: pipe(
    string(msg.schoolRequired),
    maxLength(50, msg.maxLen(50)),
  ),
  targetMajor: optional(pipe(string(), maxLength(30, msg.maxLen(30)))),
  targetCity: optional(pipe(string(), maxLength(20, msg.maxLen(20)))),
  studentProvince: optional(pipe(string(), maxLength(10, msg.maxLen(10)))),
  subjectTrack: optional(string()),
  scoreBand: optional(string()),
  personalityTags: pipe(
    string(msg.required),
    maxLength(100, msg.maxLen(100)),
  ),
  interests: pipe(
    string(msg.required),
    maxLength(100, msg.maxLen(100)),
  ),
  riskTolerance: pipe(
    string(msg.required),
    maxLength(2, msg.maxLen(2)),
  ),
  familySupport: optional(string()),
  goals: optional(pipe(string(), maxLength(500, msg.maxLen(500)))),
});
