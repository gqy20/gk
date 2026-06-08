"use client";

import type { SimulateSession } from "@/lib/future/simulator-types";

interface ProgressBarProps {
  session: SimulateSession;
  onUndo?: (round: number) => void;
}

/**
 * 游戏进度条 + 决策历史时间轴
 *
 * 显示：
 * - 当前回合 / 总回合
 * - 每轮的决策摘要（可点击回退）
 */
export function ProgressBar({ session, onUndo }: ProgressBarProps) {
  const { currentRound, totalRounds, history } = session;
  const progress = (currentRound / totalRounds) * 100;

  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-3 sm:p-4">
      {/* 进度头部 */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          进度
        </span>
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {currentRound} / {totalRounds}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 决策时间轴 */}
      {history.length > 0 && (
        <div className="mt-3 space-y-1">
          {history.map((entry, i) => (
            <button
              key={`${entry.round}-${entry.choiceId}-${i}`}
              type="button"
              onClick={() => onUndo?.(entry.round)}
              disabled={!onUndo}
              className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition
                ${onUndo ? "hover:bg-neutral-0/60 cursor-pointer" : "cursor-default"}
              `}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 font-mono text-[10px] text-accent">
                {entry.round}
              </span>
              <span className="min-w-0 truncate text-xs text-text-muted group-hover:text-text-secondary">
                {entry.scene_title}
              </span>
              <span className="min-w-0 truncate text-[11px] text-text-muted/70">
                → {entry.choiceLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
