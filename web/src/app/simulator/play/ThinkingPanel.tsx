"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IconDualRingSpinner } from "@/components/ui/Icon";

// ── 流式阶段类型 ──────────────────────────────────────

export type StreamPhase =
  | "waiting"       // 刚进入 loading，还没收到任何 SSE 事件（保留假动画作为兜底）
  | "thinking"      // 收到 thinking_start：模型正在推理
  | "narrating"     // 收到 text_delta：模型正在输出叙述文字
  | "generating"    // 收到 tool_use_start：模型正在生成结构化 JSON
  | "complete";     // 收到 done（此时组件即将卸载）

// ── 阶段定义（非流式兜底）───────────────────────────

const FALLBACK_STAGES = [
  { key: "analyze", label: "整理你的选择和上下文" },
  { key: "llm", label: "调用大模型推演后果" },
  { key: "generate", label: "生成下一轮场景和选项" },
] as const;

type FallbackStageKey = (typeof FALLBACK_STAGES)[number]["key"];

/** 基于已等待时间的启发式阶段切换（仅 waiting 阶段使用） */
function inferStageKey(elapsedMs: number): FallbackStageKey {
  if (elapsedMs < 3_000) return "analyze";
  if (elapsedMs < 12_000) return "llm";
  return "generate";
}

function estimateProgress(elapsedMs: number, timeoutMs = 60_000): number {
  const t = Math.min(elapsedMs / timeoutMs, 1);
  const eased = t * (2 - t); // ease-out quad
  return Math.min(eased * 0.92, 0.92);
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s}s`;
}

// ── 真实进度阶段配置（流式驱动）────────────────────

interface StageConfig {
  key: string;
  label: string;
  active: boolean;
  done: boolean;
}

function getStreamStages(phase: StreamPhase): StageConfig[] {
  switch (phase) {
    case "waiting":
      // 还没收到事件，用 fallback 阶段
      return [];
    case "thinking":
      return [
        { key: "connect", label: "连接 AI 服务", active: false, done: true },
        { key: "analyze", label: "整理你的选择和上下文", active: true, done: false },
        { key: "generate", label: "生成下一轮场景和选项", active: false, done: false },
      ];
    case "narrating":
      return [
        { key: "connect", label: "连接 AI 服务", active: false, done: true },
        { key: "analyze", label: "整理你的选择和上下文", active: false, done: true },
        { key: "narrate", label: "撰写推演叙述", active: true, done: false },
        { key: "generate", label: "生成下一轮场景和选项", active: false, done: false },
      ];
    case "generating":
      return [
        { key: "connect", label: "连接 AI 服务", active: false, done: true },
        { key: "analyze", label: "整理你的选择和上下文", active: false, done: true },
        { key: "narrate", label: "撰写推演叙述", active: false, done: true },
        { key: "generate", label: "生成下一轮场景和选项", active: true, done: false },
      ];
    case "complete":
      return [
        { key: "connect", label: "连接 AI 服务", active: false, done: true },
        { key: "analyze", label: "整理你的选择和上下文", active: false, done: true },
        { key: "narrate", label: "撰写推演叙述", active: false, done: true },
        { key: "generate", label: "生成下一轮场景和选项", active: false, done: true },
      ];
  }
}

function getProgressPercent(stages: StageConfig[]): number {
  if (stages.length === 0) return 0;
  const doneCount = stages.filter((s) => s.done).length;
  const hasActive = stages.some((s) => s.active);
  return Math.round(((doneCount + (hasActive ? 0.5 : 0)) / stages.length) * 100);
}

// ── 子组件：单阶段步骤 ─────────────────────────────

function StageStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {active && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
        )}
        <span
          className={`relative h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
            done ? "bg-accent" : active ? "bg-accent" : "bg-text-muted/30"
          }`}
        />
        {done && (
          <svg
            className="absolute inset-0 h-2.5 w-2.5 text-surface"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 5l2 2 3-4" />
          </svg>
        )}
      </span>

      <span
        className={`text-sm leading-6 transition-colors duration-300 ${
          done
            ? "text-text-secondary"
            : active
              ? "text-accent font-medium"
              : "text-text-muted"
        }`}
      >
        {label}
      </span>

      {active && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-auto text-xs font-medium text-accent/75"
        >
          进行中
        </motion.span>
      )}
      {done && (
        <span className="ml-auto text-xs text-text-muted">
          完成
        </span>
      )}
    </div>
  );
}

// ── 打字机动画的点 ──────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-accent/70"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

// ── 辅助函数 ──────────────────────────────────────────

function getPhaseLabel(phase: StreamPhase): string {
  switch (phase) {
    case "thinking": return "正在深度思考...";
    case "narrating": return "正在撰写叙述...";
    case "generating": return "正在生成选项...";
    default: return "";
  }
}

function getPhaseBadge(phase: StreamPhase): string {
  switch (phase) {
    case "waiting": return "连接中";
    case "thinking": return "思考中";
    case "narrating": return "叙述中";
    case "generating": return "生成中";
    case "complete": return "已完成";
  }
}

function getPhaseHint(phase: StreamPhase): string {
  switch (phase) {
    case "thinking": return "AI 正在分析你的选择对后续发展的影响...";
    case "narrating": return "AI 正在构思这一选择的即时后果...";
    case "generating": return "AI 正在构建下一轮的场景和选项...";
    case "complete": return "推演完成！正在展示结果...";
    default: return "大模型正在分析你的选择并推演后续发展，请稍候…";
  }
}

// ── 主组件 ───────────────────────────────────────────

interface ThinkingPanelProps {
  /** loading 开始的时间戳（Date.now()） */
  startTime: number;
  /** 当前正在推演的轮次 */
  currentRound: number;
  /** 总轮次 */
  totalRounds: number;

  // ── 新增：流式状态 props ──
  /** 当前流式阶段 */
  streamPhase?: StreamPhase;
  /** 累积的思考 token 数 */
  thinkingTokens?: number;
  /** 累积的叙述文字内容（用于打字机展示） */
  narrativeText?: string;
}

export function ThinkingPanel({
  startTime,
  currentRound,
  totalRounds,
  streamPhase = "waiting",
  thinkingTokens = 0,
  narrativeText = "",
}: ThinkingPanelProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const isRealProgress = streamPhase !== "waiting";
  const fallbackStage: FallbackStageKey | null = isRealProgress ? null : inferStageKey(elapsed);
  const streamStages = isRealProgress ? getStreamStages(streamPhase) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* 头部：状态 + 轮次 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* 旋转圆圈图标 / 完成勾选 */}
          <span aria-hidden className="relative flex h-6 w-6 items-center justify-center">
            <IconDualRingSpinner
              size={24}
              done={streamPhase === "complete"}
              className={streamPhase === "complete" ? "text-green-500" : "text-accent"}
            />
          </span>

          <div>
            <p className="text-base font-semibold text-text-secondary">
              AI 正在推演第{" "}
              <span className="font-semibold tabular-nums text-accent">{currentRound}</span>
              {" "}/ {totalRounds} 轮
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
              {streamPhase === "complete" ? (
                <span className="text-green-500">推演完成</span>
              ) : (
                <>
                  <TypingDots />
                  <span>
                    {isRealProgress
                      ? `${getPhaseLabel(streamPhase)}${thinkingTokens > 0 ? ` (${thinkingTokens} tokens)` : ""}`
                      : `已等待 ${formatElapsed(elapsed)}`
                    }
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            streamPhase === "complete"
              ? "border-green-500/25 bg-green-500/8 text-green-500"
              : "border-accent/25 bg-accent/8 text-accent"
          }`}
        >
          {getPhaseBadge(streamPhase)}
        </span>
      </div>

      {/* 阶段步骤指示器 */}
      <div className="space-y-4 rounded-2xl border border-border/50 bg-surface-subtle/50 p-5">
        {isRealProgress ? (
          // ── 真实进度阶段（流式驱动）──
          streamStages.map((stage) => (
            <StageStep
              key={stage.key}
              label={stage.label}
              active={stage.active}
              done={stage.done}
            />
          ))
        ) : (
          // ── 假动画阶段（时间启发式，waiting 兜底）──
          FALLBACK_STAGES.map((stage) => {
            const fallbackIdx = fallbackStage ? FALLBACK_STAGES.findIndex((s) => s.key === fallbackStage) : -1;
            const currentIdx = FALLBACK_STAGES.findIndex((s) => s.key === stage.key);
            return (
              <StageStep
                key={stage.key}
                label={stage.label}
                active={fallbackStage === stage.key}
                done={currentIdx >= 0 && fallbackIdx >= 0 && currentIdx < fallbackIdx}
              />
            );
          })
        )}
      </div>

      {/* ── 叙述文字预览（narrating 阶段展示）── */}
      {streamPhase === "narrating" && narrativeText && (
        <div className="rounded-xl border border-accent/15 bg-accent/[0.02] p-4">
          <p className="text-xs text-text-muted mb-2 font-medium">推演叙述</p>
          <p className="leading-relaxed text-sm text-text-secondary">
            {narrativeText}
            <span className="inline-block w-1.5 h-4 bg-accent/60 ml-0.5 animate-pulse" />
          </p>
        </div>
      )}

      {/* 进度条 */}
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-border/50">
          <motion.div
            className={`h-full rounded-full ${
              streamPhase === "complete"
                ? "bg-gradient-to-r from-green-500/70 via-green-500 to-green-500/60"
                : "bg-gradient-to-r from-accent/70 via-accent to-accent/60"
            }`}
            style={{
              width: isRealProgress
                ? `${getProgressPercent(streamStages)}%`
                : `${estimateProgress(elapsed) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {/* shimmer 微光效果 */}
        {!isRealProgress && (
          <div
            className="mt-[-8px] h-2 w-[30%] rounded-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent animate-[shimmer_2s_ease-in-out_infinite]"
            style={{
              marginLeft: `${Math.max(0, estimateProgress(elapsed) * 100 - 30)}%`,
            }}
          />
        )}
      </div>

      {/* 底部提示 */}
      <p className="text-sm leading-6 text-text-muted">
        {getPhaseHint(streamPhase)}
      </p>
    </motion.div>
  );
}
