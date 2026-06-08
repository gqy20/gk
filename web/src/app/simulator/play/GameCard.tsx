"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { SimulatorChoice, SimulateStepResult } from "@/lib/future/simulator-types";

interface GameCardProps {
  scene: SimulateStepResult;
  currentRound: number;
  totalRounds: number;
  disabled?: boolean;
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
export function GameCard({ scene, currentRound, totalRounds, disabled, onSelect }: GameCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSelect(choiceId: string) {
    if (disabled || selectedId) return;
    setSelectedId(choiceId);
    // 短暂延迟让用户看到选中效果再提交
    setTimeout(() => onSelect(choiceId), 400);
  }

  return (
    <div className="space-y-4">
      {/* 场景头部 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text sm:text-xl">
            {scene.scene_title}
          </h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            第 {scene.round} / {totalRounds} 轮
          </p>
        </div>
        <span className="rounded-full border border-accent/25 bg-accent/8 px-2.5 py-1 font-mono text-[10px] text-accent">
          选择你的行动
        </span>
      </div>

      {/* 场景描述 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-xl border border-border bg-surface-subtle p-4 leading-relaxed text-sm text-text-secondary sm:p-5 sm:text-base"
      >
        {scene.scene_description}
      </motion.div>

      {/* 3 张选项卡牌 */}
      <div className="grid gap-3 sm:grid-cols-3">
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
  // 为每个选项分配一个微妙的色调差异
  const accents = [
    "hover:border-brand-300/50 hover:bg-brand-50/40 selected:border-brand-400 selected:bg-brand-100/50",
    "hover:border-accent-300/50 hover:bg-accent-50/40 selected:border-accent-400 selected:bg-accent-100/50",
    "hover:border-primary/50 hover:bg-primary/5 selected:border-primary selected:bg-primary/10",
  ];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: "easeOut" }}
      onClick={onClick}
      disabled={isDisabled}
      className={`group relative w-full rounded-xl border border-border bg-surface-elevated p-4 text-left
                  shadow-[0_2px_8px_-2px_rgba(17,24,32,0.12)]
                  transition-all duration-200 ease-out
                  ${accents[index % accents.length]}
                  ${isSelected ? "ring-2 ring-accent/30 scale-[1.02]" : ""}
                  ${isDisabled && !isSelected ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
    >
      {/* 选项字母标记 */}
      <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900/5 font-mono text-[11px] font-semibold text-text-muted">
        {String.fromCharCode(65 + index)}
      </span>

      {/* 选项文字 */}
      <p className="mt-2 text-sm font-medium leading-snug text-text">{choice.label}</p>

      {choice.detail && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">{choice.detail}</p>
      )}

      {/* 选中指示器 */}
      {isSelected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white"
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}
