"use client";

import { motion } from "framer-motion";

interface Phase1HeroProps {
  /** 全局滚动进度 0..1 */
  progress: number;
}

/**
 * Phase 1: 开场 (Hero)
 *
 * - 全屏居中大标题 + 副标题统计
 * - 文字随滚动做 opacity/y 偏移动画
 * - 水墨风装饰元素
 */
export default function Phase1Hero({ progress }: Phase1HeroProps) {
  // Hero 阶段范围: 0 ~ 0.22，计算局部进度
  const localProgress = Math.min(1, Math.max(0, progress / 0.22));
  // 淡出阈值：当 localProgress > 0.6 时开始淡出
  const fadeOut = Math.min(1, Math.max(0, (localProgress - 0.6) / 0.4));

  return (
    <motion.div
      className="story-hero flex min-h-screen items-center justify-center px-6"
      initial={{ opacity: 1 }}
      animate={{
        opacity: 1 - fadeOut * 0.95,
        y: fadeOut * -30,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-2xl text-center">
        {/* 装饰线 */}
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        </motion.div>

        {/* 主标题 */}
        <motion.h1
          className="story-title mb-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1 - fadeOut * 0.9, y: -fadeOut * 12 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          中国高校信息地图
        </motion.h1>

        {/* 副标题统计 */}
        <motion.p
          className="story-subtitle mx-auto mb-8 max-w-md text-base leading-relaxed text-white/70 sm:text-lg"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: (1 - fadeOut * 0.85) * 0.7, y: -fadeOut * 8 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-semibold text-accent-300">148</span> 所高校
          <span className="mx-2 text-white/30">·</span>
          <span className="font-semibold text-accent-300">34</span> 个省份
          <span className="mx-2 text-white/30">·</span>
          覆盖全国
        </motion.p>

        {/* 描述文字 */}
        <motion.p
          className="story-desc mx-auto max-w-sm text-sm leading-relaxed text-white/45 sm:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: (1 - fadeOut * 0.9) * 0.45 }}
          transition={{ duration: 0.55, delay: 0.18, ease: "easeOut" }}
        >
          以三维视角探索中国高等教育的地理分布
        </motion.p>

        {/* 向下滚动提示 */}
        <motion.div
          className="mt-12 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 - fadeOut * 1.2 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.div
            className="flex h-8 w-6 items-start justify-center rounded-full border border-white/25 pt-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <div className="h-1.5 w-1 rounded-full bg-white/50" />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
