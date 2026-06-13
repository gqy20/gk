"use client";

import { motion } from "framer-motion";
import {
  MapPin,
  Filter,
  GitCompareArrows,
  FileText,
} from "lucide-react";

interface Phase3FeaturesProps {
  /** 当前 phase 局部进度 0..1 */
  phaseProgress: number;
  /** 是否进入此阶段 */
  active: boolean;
}

/** 功能卡片数据 */
const FEATURES = [
  {
    icon: MapPin,
    title: "省份下钻",
    desc: "点击任意省份，查看该省高校分布与详情",
    gradient: "from-brand-400/20 to-brand-600/10",
  },
  {
    icon: Filter,
    title: "智能筛选",
    desc: "按 985 / 211 / 双一流等标签快速过滤",
    gradient: "from-accentScale-300/20 to-accentScale-600/10",
  },
  {
    icon: GitCompareArrows,
    title: "学校对比",
    desc: "多维度对比不同高校的各项指标",
    gradient: "from-dangerScale-300/20 to-dangerScale-500/10",
  },
  {
    icon: FileText,
    title: "详情查看",
    desc: "深入查看学校历史、专业、录取信息",
    gradient: "from-riskScale-300/20 to-riskScale-500/10",
  },
];

/**
 * Phase 3: 功能预览 (Features)
 *
 * - 2×2 功能卡片网格
 * - staggered 入场动画
 * - 图标用 lucide-react
 */
export default function Phase3Features({
  phaseProgress,
  active,
}: Phase3FeaturesProps) {
  return (
    <div className="story-features flex min-h-screen items-center px-6 py-20 sm:px-10 lg:px-16">
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, desc, gradient }, i) => (
          <motion.div
            key={title}
            className={`feature-card group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.08]`}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={
              active
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 30, scale: 0.97 }
            }
            transition={{
              duration: 0.5,
              delay: active ? i * 0.12 : 0,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* 渐变背景装饰 */}
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 transition-opacity group-hover:opacity-80`}
            />

            <div className="relative z-10">
              {/* 图标 */}
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-5 w-5 text-white/80" />
              </div>

              {/* 标题 */}
              <h3 className="mb-1.5 text-base font-semibold text-white/90">
                {title}
              </h3>

              {/* 描述 */}
              <p className="text-sm leading-relaxed text-white/45">{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
