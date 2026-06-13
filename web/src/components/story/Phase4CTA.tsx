"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

interface Phase4CTAProps {
  /** 当前 phase 局部进度 0..1 */
  phaseProgress: number;
  /** 是否进入此阶段 */
  active: boolean;
  /** 点击进入按钮回调 */
  onEnter: () => void;
  /** 当前激活的 phase 索引 */
  currentPhase: number;
  /** 总 phase 数量 */
  totalPhases: number;
}

const PHASE_LABELS = ["开场", "分层", "功能", "探索"];

/**
 * Phase 4: 行动召唤 (CTA)
 *
 * - 居中 CTA 按钮 "开始探索"
 * - 进度指示点（4 个圆点）
 * - 相机回归最佳交互视角
 */
export default function Phase4CTA({
  phaseProgress,
  active,
  onEnter,
  currentPhase,
  totalPhases,
}: Phase4CTAProps) {
  return (
    <div className="story-cta flex min-h-[70vh] items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        {/* 进度指示点 */}
        <div className="story-progress-dots mb-10 flex items-center gap-2.5">
          {PHASE_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <motion.div
                className={`h-2 w-2 rounded-full transition-colors ${
                  i <= currentPhase
                    ? "bg-accent-400"
                    : "bg-white/20"
                }`}
                animate={
                  active && i === currentPhase
                    ? { scale: [1, 1.3, 1] }
                    : {}
                }
                transition={
                  active && i === currentPhase
                    ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                    : {}
                }
                aria-label={`${label} ${i <= currentPhase ? "已完成" : "未到达"}`}
              />
              {i < totalPhases - 1 && (
                <div
                  className={`h-px w-6 transition-colors ${
                    i < currentPhase ? "bg-accent-400/60" : "bg-white/15"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* CTA 主按钮区域 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={active ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.button
            type="button"
            onClick={onEnter}
            className="story-cta-button group relative inline-flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-brand-400 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/35 sm:text-lg"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
            进入地图探索
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />

            {/* 按钮光泽效果 */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </motion.button>
        </motion.div>

        {/* 辅助提示文字 */}
        <motion.p
          className="mt-5 text-sm text-white/35"
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          或继续向下滚动自动进入
        </motion.p>
      </div>
    </div>
  );
}
