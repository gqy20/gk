"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FuturePanel } from "./FutureShell";
import { IconDualRingSpinner } from "@/components/ui/Icon";

// ── 阶段定义 ──────────────────────────────────────────────
const STAGES = [
  { key: "analyze", label: "整理你的学校、专业和偏好" },
  { key: "deduce", label: "拆出几种大学走法" },
  { key: "validate", label: "比较每条路的收益和风险" },
  { key: "finalize", label: "生成大一大二行动建议" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

// 基于已等待时间的启发式阶段切换（非 SSE 真实阶段）
function inferStageKey(elapsedMs: number): StageKey {
  if (elapsedMs < 5_000) return "analyze";
  if (elapsedMs < 25_000) return "deduce";
  if (elapsedMs < 35_000) return "validate";
  return "finalize";
}

// ── 不确定进度条：先快后慢缓动（ease-out 感） ───────────
function estimateProgress(elapsedMs: number, timeoutMs = 180_000): number {
  // 用 easeOutQuad 曲线模拟：前 30% 时间走 70% 进度，后 70% 时间慢慢爬到 ~95%
  const t = Math.min(elapsedMs / timeoutMs, 1);
  const eased = t * (2 - t); // ease-out quad
  return Math.min(eased * 0.95, 0.95); // 上限 95%，永远不到 100%
}

// ── 格式化等待时间 ───────────────────────────────────────
function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s}s`;
}

// ── 子组件：单阶段步骤 ───────────────────────────────────
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
    <div className="flex items-center gap-2.5">
      {/* 状态指示点 */}
      <span className="relative flex h-2 w-2 shrink-0">
        {active && (
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
        )}
        <span
          className={`relative h-2 w-2 rounded-full transition-colors duration-300 ${
            done ? "bg-accent" : active ? "bg-accent" : "bg-text-muted/30"
          }`}
        />
        {/* 完成勾选 */}
        {done && (
          <svg
            className="absolute inset-0 h-2 w-2 text-surface"
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

      {/* 标签文字 */}
      <span
        className={`text-xs tracking-wide transition-colors duration-300 ${
          done
            ? "text-text-secondary"
            : active
              ? "text-accent font-medium"
              : "text-text-muted"
        }`}
      >
        {label}
      </span>

      {/* 当前状态标签 */}
      {active && (
        <motion.span
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-auto text-[10px] font-mono uppercase tracking-wider text-accent/70"
        >
          进行中
        </motion.span>
      )}
      {done && (
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-text-muted">
          完成
        </span>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export interface FutureLoadingProps {
  /** 显示的消息文本 */
  message?: string;
  /** 是否为生成中状态（显示完整四阶段 UI） */
  generating?: boolean;
  /** 超时时间（毫秒），用于进度估算，默认 180s */
  timeoutMs?: number;
  /** 最大允许等待时间（毫秒），超时后触发 onTimeout，默认 300s (5min) */
  maxWaitMs?: number;
  /** 取消回调 */
  onCancel?: () => void;
  /** 超时回调 */
  onTimeout?: () => void;
  /** 紧凑模式（用于历史卡片等小场景） */
  compact?: boolean;
}

export function FutureLoading({
  message = "正在加载…",
  generating = false,
  timeoutMs = 180_000,
  maxWaitMs = 300_000,
  onCancel,
  onTimeout,
  compact = false,
}: FutureLoadingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  // 计时器：每秒更新 elapsed
  useEffect(() => {
    startTimeRef.current = Date.now();

    function tick() {
      const now = Date.now();
      setElapsed(now - startTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    // 超时保护
    const timeoutTimer = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, maxWaitMs);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutTimer);
    };
  }, [maxWaitMs, onTimeout]);

  const currentStage = inferStageKey(elapsed);
  const progress = estimateProgress(elapsed, timeoutMs);

  // ── 紧凑模式：仅显示脉冲点 + 文字（用于小场景） ──
  if (compact) {
    return (
      <FuturePanel className="p-5">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span>{message}</span>
          {generating && (
            <span className="font-mono text-xs text-text-muted">{formatElapsed(elapsed)}</span>
          )}
        </div>
      </FuturePanel>
    );
  }

  // ── 完整模式：四阶段 + 计时器 + 进度条 + 取消按钮 ──
  return (
    <FuturePanel className="p-6">
      {/* 头部：图标 + 主消息 + 已等待时间 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5 flex items-center gap-3"
      >
        {/* 动态图标：旋转圆环 */}
        <span aria-hidden className="relative flex h-5 w-5 items-center justify-center">
          <IconDualRingSpinner size={20} className="text-accent" />
        </span>

        <span className="text-sm font-medium text-text-secondary">{message}</span>

        {/* 已等待时间 */}
        <span className="font-mono text-xs tabular-nums text-text-muted">
          已等待 {formatElapsed(elapsed)}
        </span>
      </motion.div>

      {/* 四阶段步骤指示器 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="mb-5 space-y-3 rounded-lg border border-border/50 bg-surface-subtle/50 p-4"
      >
        {STAGES.map((stage) => (
          <StageStep
            key={stage.key}
            label={stage.label}
            active={currentStage === stage.key}
            done={STAGES.indexOf(stage) < STAGES.findIndex((s) => s.key === currentStage)}
          />
        ))}
      </motion.div>

      {/* 不确定进度条 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-4"
      >
        <div className="h-1.5 overflow-hidden rounded-full bg-border/50">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent/70 via-accent to-accent/60"
            style={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {/* 微光 shimmer 效果覆盖在进度条上 */}
        <div
          className="mt-[-7px] h-1.5 w-[30%] rounded-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-[shimmer_2s_ease-in-out_infinite]"
          style={{
            marginLeft: `${Math.max(0, progress * 100 - 30)}%`,
          }}
        />
      </motion.div>

      {/* 底部操作区 */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          {timedOut
            ? "等待时间过长，可能遇到问题"
            : "AI 正在深度分析，请耐心等待…"}
        </span>

        {(onCancel || timedOut) && (
          <div className="flex gap-2">
            {timedOut && onTimeout && (
              <button
                type="button"
                onClick={onTimeout}
                className="rounded-lg border border-warning-300/40 bg-warning-500/10 px-3 py-1.5 text-xs text-warning-200 hover:bg-warning-500/20 transition-colors"
              >
                刷新重试
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:border-danger-300/40 hover:text-danger-300 transition-colors"
              >
                取消
              </button>
            )}
          </div>
        )}
      </div>
    </FuturePanel>
  );
}

/** 默认导出 — 用于 Suspense fallback 等简单场景 */
export function FutureLoadingFallback({ message }: { message?: string }) {
  return <FutureLoading message={message} compact />;
}
