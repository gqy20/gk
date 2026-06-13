"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { colors } from "@/lib/theme";
import type { TierName } from "@/lib/animation/story-keyframes";
import { TIER_ORDER } from "@/lib/animation/story-keyframes";

interface Phase2LayersProps {
  /** 当前 phase 局部进度 0..1 */
  phaseProgress: number;
  /** 是否进入此阶段 */
  active: boolean;
  /** 当前可见的层级列表 */
  visibleTiers: TierName[];
}

/** 层级元数据 */
const TIER_META: Record<
  string,
  { label: string; color: string; count: string; desc: string }
> = {
  "985": {
    label: "985 工程",
    color: colors.chart.school985,
    count: "39",
    desc: "国家重点建设的高水平大学",
  },
  "211": {
    label: "211 工程",
    color: colors.chart.school211,
    count: "73",
    desc: "面向 21 世纪重点建设的百所高校",
  },
  doubleFirst: {
    label: "双一流",
    color: colors.chart.schoolDoubleFirst,
    count: "147",
    desc: "世界一流大学和一流学科建设",
  },
  normal: {
    label: "普通本科",
    color: colors.chart.schoolNormal,
    count: "1200+",
    desc: "覆盖全国各省市自治区的本科院校",
  },
};

/**
 * Phase 2: 分层展示 (Layers)
 *
 * - 4 张层级卡片按顺序交错入场
 * - 每张卡片：色块 + 名称 + 数量 + 简介
 * - 桌面端右侧排列，移动端堆叠
 */
export default function Phase2Layers({
  phaseProgress,
  active,
  visibleTiers,
}: Phase2LayersProps) {
  // 计算每张卡片的可见性（基于 visibleTiers）
  const cards = useMemo(
    () =>
      TIER_ORDER.map((tier, i) => ({
        tier,
        meta: TIER_META[tier],
        isVisible: visibleTiers.includes(tier),
        index: i,
      })),
    [visibleTiers],
  );

  return (
    <div className="story-layers flex min-h-screen items-center px-6 py-20 sm:px-10 lg:px-16">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ tier, meta, isVisible, index }) => (
          <motion.div
            key={tier}
            className={`tier-card group relative overflow-hidden rounded-xl border bg-white/[0.07] p-5 backdrop-blur-md transition-colors ${
              isVisible ? "border-white/15" : "border-white/5 opacity-40"
            }`}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={
              active && isVisible
                ? { opacity: 1, x: 0, scale: 1 }
                : { opacity: 0, x: 40, scale: 0.96 }
            }
            transition={{
              duration: 0.55,
              delay: active ? index * 0.14 : 0,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* 色条 */}
            <div
              className="mb-3 h-1 w-8 rounded-full"
              style={{ backgroundColor: meta.color }}
            />

            {/* 名称 */}
            <h3 className="mb-1 text-base font-semibold text-white/90 sm:text-lg">
              {meta.label}
            </h3>

            {/* 数量 */}
            <div
              className="mb-2 text-2xl font-bold tracking-tight"
              style={{ color: meta.color }}
            >
              {meta.count}
              <span className="ml-1 text-xs font-normal text-white/35">
                所
              </span>
            </div>

            {/* 描述 */}
            <p className="text-xs leading-relaxed text-white/45 sm:text-sm">
              {meta.desc}
            </p>

            {/* hover 光效 */}
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
