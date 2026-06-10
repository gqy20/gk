"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";
import type { SimulatorChoice, SimulateStepResult } from "@/lib/future/simulator-types";

interface GameCardProps {
  scene: SimulateStepResult;
  currentRound: number;
  totalRounds: number;
  disabled?: boolean;
  /** 是否为第1轮（显示欢迎仪式） */
  isFirstRound?: boolean;
  onSelect: (choiceId: string) => void;
}

/**
 * 场景展示 + 3 选 1 卡片
 *
 * 布局：
 * - 顶部：场景标题 + 回合指示
 * - 中部：场景描述（氛围文本）
 * - 底部：3 张选项卡牌
 */
export function GameCard({ scene, currentRound, totalRounds, disabled, isFirstRound, onSelect }: GameCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedId);

  function handleSelect(choiceId: string) {
    if (disabled || selectedId) return;
    setSelectedId(choiceId);
    // 短暂延迟让用户看到选中效果再提交
    setTimeout(() => onSelect(choiceId), 400);
  }

  return (
    <section className="mx-auto max-w-[1120px]">
      {/* 首轮欢迎横幅 */}
      {isFirstRound && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-primary/[0.03] to-transparent px-4 py-3"
        >
          <span className="text-base">🎓</span>
          <div>
            <p className="text-xs font-medium text-primary">你的大学故事，从这一刻开始</p>
            <p className="mt-0.5 text-[11px] text-text-muted">每一个选择都会影响你四年的轨迹</p>
          </div>
        </motion.div>
      )}

      <Panel className="p-5 sm:p-6">
        {/* 场景头部 */}
        <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
                第 {currentRound} 轮
              </span>
              <span className="text-xs text-text-muted">
                共 {totalRounds} 轮
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
              {scene.scene_title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-surface-subtle px-3 py-2 text-xs text-text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" />
            先读情境，再选行动
          </div>
        </div>

        {/* 场景描述（文字区域限制最大宽度，保证可读性） */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-5 max-w-[74ch] text-[15px] leading-8 text-text-secondary sm:text-base"
        >
          {scene.scene_description}
        </motion.p>

        {/* 3 张选项卡牌 */}
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">选择你的行动</h3>
              <p className="mt-0.5 text-xs text-text-muted">
                每个选择都会改变下一轮的人际、课程和节奏。
              </p>
            </div>
            {selectedChoice && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-medium text-accent"
              >
                已选择：{selectedChoice.label}
              </motion.span>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {scene.choices.map((choice, i) => (
              <ChoiceCard
                key={choice.id}
                choice={choice}
                index={i}
                isSelected={selectedId === choice.id}
                isDisabled={disabled || !!selectedId}
                onClick={() => handleSelect(choice.id)}
              />
            ))}
          </div>
        </div>
      </Panel>
    </section>
  );
}

/** 单张选项卡牌 */
function ChoiceCard({
  choice,
  index,
  isSelected,
  isDisabled,
  onClick,
}: {
  choice: SimulatorChoice;
  index: number;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const optionLetter = String.fromCharCode(65 + index);
  const toneClasses = [
    "hover:border-brand-400/45 hover:bg-brand-50/65",
    "hover:border-accent-400/45 hover:bg-accent-50/70",
    "hover:border-risk-400/45 hover:bg-risk-50/65",
  ];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: "easeOut" }}
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      className={`group relative flex min-h-[160px] w-full flex-col rounded-xl border bg-surface-subtle/70 p-4 text-left
                  transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                  ${toneClasses[index % toneClasses.length]}
                  ${isSelected ? "border-accent/70 bg-accent-50/55 ring-1 ring-accent/20" : "border-border"}
                  ${isDisabled && !isSelected ? "cursor-not-allowed opacity-45" : "cursor-pointer"}
                `}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-semibold transition-colors ${
          isSelected ? "bg-accent text-text-inverse" : "bg-neutral-900/6 text-text-muted group-hover:bg-neutral-900/9"
        }`}>
          {optionLetter}
        </span>
        <span className={`mt-1 h-3 w-3 rounded-full border transition-colors ${
          isSelected ? "border-accent bg-accent" : "border-border bg-surface-elevated group-hover:border-text-muted"
        }`} />
      </div>

      {/* 选项文字 */}
      <p className="text-[15px] font-semibold leading-snug text-text">{choice.label}</p>

      {choice.detail && (
        <p className="mt-2 text-xs leading-5 text-text-secondary">{choice.detail}</p>
      )}

      {/* 选中指示器 */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-medium text-accent"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-text-inverse">
            ✓
          </span>
          正在推演这个选择
        </motion.div>
      )}
    </motion.button>
  );
}
