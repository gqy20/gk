"use client";

import { motion } from "framer-motion";
import type { SimulateSession, SimulateStepResult } from "@/lib/future/simulator-types";

interface HistorySidebarProps {
  session: SimulateSession;
  /** 当前正在展示的结果（result 阶段时传入） */
  currentResult: SimulateStepResult | null;
  /** 当前阶段 */
  currentPhase: "choosing" | "result" | "ending" | "loading";
  /** loading 阶段正在推演的轮次（与右侧 ThinkingPanel 保持一致） */
  loadingRound?: number;
}

/**
 * 左侧历史记录侧边栏
 *
 * 常驻显示，让用户在 LLM 推演过程中也能回顾所有已做选择和结果。
 * 每条记录包含：轮次、场景标题、选择了什么、结果叙述（截断）、影响标签
 */
export function HistorySidebar({ session, currentResult, currentPhase, loadingRound }: HistorySidebarProps) {
  const { history, currentRound, totalRounds } = session;
  const progressPercent = Math.min((currentRound / totalRounds) * 100, 100);
  const isLoading = currentPhase === "loading";
  const activeRound = isLoading ? (loadingRound ?? currentRound + 1) : currentRound;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-4 flex max-h-[calc(100vh-88px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/90 shadow-[0_12px_32px_-28px_rgba(17,24,32,0.5)] backdrop-blur-sm">
        {/* 头部：进度 */}
        <div className="shrink-0 border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-text">
              大学轨迹
            </span>
            <div className="flex items-baseline gap-1 text-text-muted">
              <span className="font-mono text-sm tabular-nums font-semibold text-text">
                {currentRound}
              </span>
              <span className="text-xs">/</span>
              <span className="font-mono text-xs tabular-nums">
                {totalRounds}
              </span>
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            回看关键选择，判断这条路正在变成什么样。
          </p>
        </div>

        {/* 进度条 */}
        <div className="h-1 shrink-0 bg-neutral-900/5">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {isLoading && (
          <div className="shrink-0 border-b border-border/50 bg-primary/[0.035] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="absolute inset-0 animate-ping rounded-xl bg-primary/25" />
                <span className="relative font-mono text-[10px] font-semibold text-primary">
                  {activeRound}
                </span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text">
                  正在推演第 {activeRound} 轮
                </p>
                <p className="mt-0.5 truncate text-[11px] text-text-muted">
                  根据上一轮选择生成下一段情境。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 历史列表 */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 [scrollbar-color:rgba(63,143,155,0.24)_transparent]">
          {history.map((entry, i) => (
            <HistoryEntry
              key={`hist-${entry.round}-${i}`}
              entry={entry}
              isLatest={i === history.length - 1 && currentPhase === "choosing"}
              isFirst={i === 0}
              isLast={i === history.length - 1}
            />
          ))}

          {/* 当前正在展示的结果（尚未持久化到 history） */}
          {currentPhase === "result" && currentResult?.outcome && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-xl border border-accent/25 bg-accent/[0.06] p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-mono text-[10px] font-semibold text-accent">
                  {currentRound}
                </span>
                <span className="min-w-0 truncate text-xs font-medium text-text-secondary">
                  {currentResult.scene_title}
                </span>
              </div>
              {/* 找到当前选择的 label */}
              {(() => {
                const choice = currentResult.choices.find((c) =>
                  history[history.length - 1]?.choiceId === c.id,
                );
                return choice ? (
                  <p className="ml-7 text-[11px] text-accent/80">
                    → {choice.label}
                  </p>
                ) : null;
              })()}
              <p className="ml-7 mt-1.5 text-[11px] leading-relaxed text-text-muted line-clamp-3">
                {currentResult.outcome.narrative}
              </p>
              {currentResult.outcome.effects.length > 0 && (
                <div className="ml-7 mt-1.5 flex flex-wrap gap-1">
                  {currentResult.outcome.effects.map((effect) => (
                    <span
                      key={effect}
                      className="rounded-md border border-accent/15 bg-accent/6 px-1.5 py-0.5 font-mono text-[10px] text-accent/80"
                    >
                      {effect}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 空状态 */}
          {history.length === 0 && currentPhase !== "result" && currentPhase !== "loading" && (
            <div className="py-8 text-center text-[11px] text-text-muted">
              还没有决策记录<br />做出第一个选择后这里会显示
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

/** 单条历史记录 */
function HistoryEntry({
  entry,
  isLatest = false,
  isFirst = false,
  isLast = false,
}: {
  entry: SimulateSession["history"][number];
  isLatest?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-2.5">
      <div className="relative flex w-7 shrink-0 justify-center">
        {!isFirst && <span className="absolute top-0 h-3 w-px bg-border/70" />}
        {!isLast && <span className="absolute bottom-0 top-7 w-px bg-border/70" />}
        <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-xl font-mono text-[10px] ${
          isLatest ? "bg-primary/15 font-semibold text-primary ring-1 ring-primary/20" : "bg-neutral-900/6 text-text-muted"
        }`}>
          {entry.round}
        </span>
      </div>

      <div className={`min-w-0 flex-1 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-hover ${
        isLatest ? "border border-primary/20 bg-primary/8" : "border border-transparent"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-semibold text-text-secondary">
            {entry.scene_title}
          </span>
          {isLatest && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              最新
            </span>
          )}
        </div>

        <p className="mt-1 text-[11px] leading-4 text-text-secondary">
          → {entry.choiceLabel}
        </p>

        {entry.outcome_narrative && (
          <p className={`mt-1 text-[11px] leading-5 text-text-muted ${isLatest ? "line-clamp-2" : "line-clamp-1"}`}>
            {entry.outcome_narrative}
          </p>
        )}

        {entry.outcome_effects.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entry.outcome_effects.slice(0, isLatest ? 4 : 3).map((effect) => (
              <span
                key={effect}
                className="rounded-md border border-border/50 bg-neutral-900/3 px-1.5 py-0.5 text-[10px] text-text-muted"
              >
                {effect}
              </span>
            ))}
            {entry.outcome_effects.length > (isLatest ? 4 : 3) && (
              <span className="rounded-md px-1.5 py-0.5 text-[10px] text-text-muted/60">
                +{entry.outcome_effects.length - (isLatest ? 4 : 3)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
