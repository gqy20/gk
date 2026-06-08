"use client";

import { motion } from "framer-motion";
import type { SimulateStepResult } from "@/lib/future/simulator-types";

interface ResultPanelProps {
  result: SimulateStepResult;
}

/**
 * 推演结果面板 — 展示用户选择后的即时反馈
 *
 * 显示：
 * - narrative：叙述性反馈（发生了什么）
 * - effects：隐性影响标签数组
 */
export function ResultPanel({ result }: ResultPanelProps) {
  const outcome = result.outcome;
  if (!outcome) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="overflow-hidden rounded-xl border border-accent/20 bg-accent/[0.04] p-4 sm:p-5"
    >
      {/* 叙述文本 */}
      <p className="leading-relaxed text-sm text-text-secondary sm:text-base">
        {outcome.narrative}
      </p>

      {/* 影响标签 */}
      {outcome.effects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {outcome.effects.map((effect) => (
            <span
              key={effect}
              className="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 font-mono text-[11px] text-accent"
            >
              {effect}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
