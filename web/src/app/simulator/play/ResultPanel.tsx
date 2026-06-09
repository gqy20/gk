"use client";

import { motion } from "framer-motion";
import type { SimulateStepResult } from "@/lib/future/simulator-types";

interface ResultPanelProps {
  result: SimulateStepResult;
  /** 普通轮次：用户确认后回调 */
  onContinue?: () => void;
  /** 是否为最终轮（有 pendingEnding 等待揭幕） */
  isFinalRound?: boolean;
  /** 最终轮：触发结局揭幕 */
  onRevealEnding?: () => void;
}

/**
 * 推演结果面板 — 展示用户选择后的即时反馈
 *
 * 显示：
 * - narrative：叙述性反馈（发生了什么）
 * - effects：隐性影响标签数组
 */
export function ResultPanel({ result, onContinue, isFinalRound, onRevealEnding }: ResultPanelProps) {
  const outcome = result.outcome;
  if (!outcome) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto max-w-[980px] overflow-hidden rounded-2xl border border-accent/25 bg-surface-elevated p-5 shadow-[0_14px_34px_-28px_rgba(17,24,32,0.55)] sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <p className="text-xs font-medium text-accent">选择后的变化</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-text">
            {isFinalRound ? "最后一轮的终章回响" : "这一轮的即时后果"}
          </h2>
        </div>
        {isFinalRound ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            🎓 终章 · 即将揭晓
          </span>
        ) : (
          <span className="rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1 text-xs text-accent">
            已写入轨迹
          </span>
        )}
      </div>

      {/* 叙述文本 */}
      <p className="leading-8 text-[15px] text-text-secondary sm:text-base">
        {outcome.narrative}
      </p>

      {/* 影响标签 */}
      {outcome.effects.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {outcome.effects.map((effect) => (
            <span
              key={effect}
              className="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-accent"
            >
              {effect}
            </span>
          ))}
        </div>
      )}

      {/* 按钮区 — 根据是否最终轮显示不同操作 */}
      {(onContinue || onRevealEnding) && (
        <div className="mt-5 flex justify-end">
          {isFinalRound && onRevealEnding ? (
            // ── 最终轮：人设卡揭幕按钮 ──
            <motion.button
              type="button"
              onClick={onRevealEnding}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="group relative inline-flex items-center gap-2.5 rounded-xl border border-primary/35 bg-gradient-to-r from-primary to-primary/90 px-6 py-3 text-sm font-semibold text-text-inverse shadow-[0_8px_24px_-12px_rgba(63,143,155,0.45)] transition-all hover:border-primary/50 hover:shadow-[0_12px_32px_-16px_rgba(63,143,155,0.55)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
                <span className="relative text-xs">🎓</span>
              </span>
              查看你的大学人设卡
              <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
            </motion.button>
          ) : onContinue ? (
            // ── 普通轮次：继续按钮 ──
            <motion.button
              type="button"
              onClick={onContinue}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-accent/35 bg-accent px-5 py-2.5 text-sm font-medium text-text-inverse transition hover:border-accent/50 hover:bg-accent-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              继续下一步
              <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
            </motion.button>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
