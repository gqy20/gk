"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { SimulatorEnding, SimulateHistoryEntry } from "@/lib/future/simulator-types";

interface EndingScreenProps {
  ending: SimulatorEnding;
  history: SimulateHistoryEntry[];
  school: string;
  totalRounds: number;
  onRestart: () => void;
  onBack: () => void;
}

type EndingTab = "profile" | "turning" | "history";

function buildTabs(totalRounds: number): Array<{ id: EndingTab; label: string; helper: string }> {
  return [
    { id: "profile", label: "人设画像", helper: "结局总结" },
    { id: "turning", label: "关键转折", helper: "决定性选择" },
    { id: "history", label: "完整轨迹", helper: `${totalRounds} 轮记录` },
  ];
}

/**
 * 结局总结 — 大学人设卡
 *
 * 顶部保留结局揭晓，详细内容通过 tab 切换，避免结果页纵向堆叠。
 */
export function EndingScreen({ ending, history, school, totalRounds, onRestart, onBack }: EndingScreenProps) {
  const [activeTab, setActiveTab] = useState<EndingTab>("profile");
  const tabs = buildTabs(totalRounds);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1180px] space-y-4"
    >
      {/* 结局封面 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_18px_40px_-28px_rgba(17,24,32,0.35)]">
        <div className="grid gap-5 border-b border-border bg-gradient-to-br from-brand-50/55 via-surface-elevated to-accent-50/35 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
              className="mb-2 text-xs font-medium text-accent"
            >
              {school} · 大学轨迹 · 大学人设卡
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl font-bold tracking-tight text-text sm:text-4xl"
            >
              {ending.archetype}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base"
            >
              {ending.summary}
            </motion.p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard label="GPA 估计" value={ending.gpa_estimate} />
            <MetricCard label="社交圈" value={ending.social_circle} />
          </div>
        </div>

        <div className="px-5 py-4 sm:px-7">
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
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_12px_30px_-26px_rgba(17,24,32,0.42)]">
        <div className="border-b border-border/70 bg-surface-subtle/70 p-2">
          <div className="grid gap-1 sm:grid-cols-3" role="tablist" aria-label="结局内容">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                  activeTab === tab.id
                    ? "bg-surface-elevated text-text shadow-[0_1px_0_rgba(255,255,255,0.8)]"
                    : "text-text-muted hover:bg-surface-hover hover:text-text-secondary"
                }`}
              >
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className="mt-0.5 block text-[11px]">{tab.helper}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[280px] p-5 sm:p-6">
          {activeTab === "profile" && <ProfileTab ending={ending} />}
          {activeTab === "turning" && <TurningTab ending={ending} />}
          {activeTab === "history" && <HistoryTab history={history} />}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/[0.035] px-5 py-4">
        <p className="max-w-2xl text-sm italic leading-6 text-text-secondary">
          &ldquo;{ending.closing_message}&rdquo;
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl border border-accent/35 bg-accent px-5 py-2.5 text-sm font-medium text-text-inverse transition hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          >
            再玩一次
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-border bg-surface-elevated px-5 py-2.5 text-sm font-medium text-text-muted transition hover:border-accent/40 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            返回首页
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileTab({ ending }: { ending: SimulatorEnding }) {
  const primaryTags = ending.tags.slice(0, 4);
  const secondaryTags = ending.tags.slice(4);

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <div className="rounded-xl border border-border bg-surface-subtle/65 p-4">
        <h3 className="text-sm font-semibold text-text">四年画像</h3>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{ending.summary}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface-subtle/65 p-4">
        <h3 className="text-sm font-semibold text-text">行动风格</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryTags.map((tag) => (
            <span key={tag} className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
              {tag}
            </span>
          ))}
          {secondaryTags.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TurningTab({ ending }: { ending: SimulatorEnding }) {
  return (
    <motion.div
      key="turning"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="grid gap-3 md:grid-cols-2"
    >
      {ending.turning_moments.map((tm) => (
        <div key={tm.round} className="rounded-xl border border-border bg-surface-subtle/65 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent/12 font-mono text-[11px] font-semibold text-accent">
              {tm.round}
            </span>
            <p className="min-w-0 truncate text-sm font-semibold text-text">「{tm.choice_label}」</p>
          </div>
          <p className="text-xs leading-6 text-text-secondary">{tm.consequence}</p>
        </div>
      ))}
    </motion.div>
  );
}

function HistoryTab({ history }: { history: SimulateHistoryEntry[] }) {
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="grid gap-2 md:grid-cols-2"
    >
      {history.map((entry) => (
        <div key={entry.round} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-subtle/55 px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-neutral-900/6 font-mono text-[11px] text-text-muted">
            {entry.round}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-text-muted">{entry.scene_title}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-text">→ {entry.choiceLabel}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated/85 p-3">
      <div className="text-[11px] font-medium text-text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5 text-text">{value}</div>
    </div>
  );
}
