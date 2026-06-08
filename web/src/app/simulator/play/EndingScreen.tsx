"use client";

import { motion } from "framer-motion";
import type { SimulatorEnding, SimulateHistoryEntry } from "@/lib/future/simulator-types";

interface EndingScreenProps {
  ending: SimulatorEnding;
  history: SimulateHistoryEntry[];
  school: string;
  onRestart: () => void;
  onBack: () => void;
}

/**
 * 结局总结 — 大学人设卡
 *
 * 视觉风格参考「成绩单/档案袋」，
 * 展示人设标签、GPA、社交圈、关键转折点回顾
 */
export function EndingScreen({ ending, history, school, onRestart, onBack }: EndingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="space-y-5"
    >
      {/* 人设卡头部 */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated text-center shadow-[0_18px_40px_-28px_rgba(17,24,32,0.35)]">
        <div className="border-b border-border bg-gradient-to-br from-accent/8 via-brand-50/30 to-transparent px-6 py-6 sm:py-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-2">
            {school} · 四年轨迹
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
            {ending.archetype}
          </h2>
        </div>

        <div className="space-y-5 p-5 sm:p-6 text-left">
          {/* 总结 */}
          <p className="leading-relaxed text-sm text-text-secondary sm:text-base">
            {ending.summary}
          </p>

          {/* 标签云 */}
          <div className="flex flex-wrap gap-2">
            {ending.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-brand-200/40 bg-brand-50/50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 数据指标 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="GPA 估计" value={ending.gpa_estimate} />
            <MetricCard label="社交圈" value={ending.social_circle} />
          </div>
        </div>
      </div>

      {/* 关键转折点 */}
      <div className="rounded-xl border border-border bg-surface-subtle p-4 sm:p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent mb-3">
          关键转折点
        </h3>
        <div className="space-y-3">
          {ending.turning_moments.map((tm) => (
            <div key={tm.round} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[11px] text-accent">
                {tm.round}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text">「{tm.choice_label}」</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{tm.consequence}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 完整决策回顾 */}
      <div className="rounded-xl border border-border bg-surface-subtle p-4 sm:p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-3">
          完整决策记录
        </h3>
        <div className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.round}
              className="flex items-center gap-3 rounded-lg bg-surface-elevated px-3 py-2"
            >
              <span className="shrink-0 font-mono text-[11px] text-text-muted w-5">
                {entry.round}
              </span>
              <span className="min-w-0 truncate text-xs text-text-secondary">
                {entry.scene_title}
              </span>
              <span className="shrink-0 text-text-muted">→</span>
              <span className="min-w-0 truncate text-xs font-medium text-text">
                {entry.choiceLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 寄语 */}
      <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-4 text-center sm:p-5">
        <p className="text-sm italic leading-relaxed text-text-secondary sm:text-base">
          &ldquo;{ending.closing_message}&rdquo;
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border border-border bg-surface-elevated px-6 py-2.5 text-sm font-medium text-text shadow-[0_2px_8px_-2px_rgba(17,24,32,0.12)] transition hover:border-accent/40 hover:bg-surface-elevated"
        >
          再玩一次
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border bg-surface-elevated px-6 py-2.5 text-sm font-medium text-text-muted shadow-[0_2px_8px_-2px_rgba(17,24,32,0.12)] transition hover:border-accent/40 hover:text-text-secondary"
        >
          返回首页
        </button>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="text-[10px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-text">{value}</div>
    </div>
  );
}
