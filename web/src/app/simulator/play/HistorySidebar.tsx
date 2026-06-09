"use client";

import { motion } from "framer-motion";
import type { SimulateSession, SimulateStepResult } from "@/lib/future/simulator-types";

interface HistorySidebarProps {
  session: SimulateSession;
  /** 当前正在展示的结果（result 阶段时传入） */
  currentResult: SimulateStepResult | null;
  /** 当前阶段 */
  currentPhase: "choosing" | "result" | "ending";
}

/**
 * 左侧历史记录侧边栏
 *
 * 常驻显示，让用户在 LLM 推演过程中也能回顾所有已做选择和结果。
 * 每条记录包含：轮次、场景标题、选择了什么、结果叙述（截断）、影响标签
 */
export function HistorySidebar({ session, currentResult, currentPhase }: HistorySidebarProps) {
  const { history, currentRound, totalRounds } = session;

  // 合并已完成的历史 + 当前正在展示的结果
  const allEntries = [...history];
  if (currentPhase === "result" && currentResult?.outcome) {
    // 当前 result 是刚选完的最新一轮，还没写入 history
    const latestChoice = history.length > 0 ? null : null;
    // result 阶段的 outcome 属于当前轮，在 history 中还没有这条记录
    // 我们单独展示它作为"最新结果"
  }

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div className="sticky top-4 rounded-xl border border-border bg-surface-subtle/80 backdrop-blur-sm overflow-hidden">
        {/* 头部：进度 */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            决策记录
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums font-semibold text-text-secondary">
              {currentRound}
            </span>
            <span className="text-text-muted">/</span>
            <span className="font-mono text-xs tabular-nums text-text-muted">
              {totalRounds}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-1 bg-neutral-900/5">
          <div
            className="h-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500 ease-out"
            style={{ width: `${(currentRound / totalRounds) * 100}%` }}
          />
        </div>

        {/* 历史列表 */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2 space-y-1">
          {history.map((entry, i) => (
            <HistoryEntry key={`hist-${entry.round}-${i}`} entry={entry} />
          ))}

          {/* 当前正在展示的结果（尚未持久化到 history） */}
          {currentPhase === "result" && currentResult?.outcome && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg border border-accent/20 bg-accent/[0.04] p-2.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[10px] font-semibold text-accent">
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
          {history.length === 0 && currentPhase !== "result" && (
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
function HistoryEntry({ entry }: { entry: SimulateSession["history"][number] }) {
  return (
    <div className="rounded-lg px-2.5 py-2 transition-colors hover:bg-neutral-0/50">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-neutral-900/6 font-mono text-[10px] text-text-muted">
          {entry.round}
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-text-secondary">
          {entry.scene_title}
        </span>
      </div>

      <p className="ml-7 mt-0.5 text-[11px] text-text-muted/80">
        → {entry.choiceLabel}
      </p>

      {entry.outcome_narrative && (
        <p className="ml-7 mt-1 text-[11px] leading-relaxed text-text-muted line-clamp-2">
          {entry.outcome_narrative}
        </p>
      )}

      {entry.outcome_effects.length > 0 && (
        <div className="ml-7 mt-1 flex flex-wrap gap-1">
          {entry.outcome_effects.slice(0, 4).map((effect) => (
            <span
              key={effect}
              className="rounded-md border border-border/50 bg-neutral-900/3 px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
            >
              {effect}
            </span>
          ))}
          {entry.outcome_effects.length > 4 && (
            <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-text-muted/60">
              +{entry.outcome_effects.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
