"use client";

import { motion } from "framer-motion";
import SchoolPanel from "@/components/school-panel/SchoolPanel";
import { Button } from "@/components/ui/Button";
import type { School } from "@/lib/data";

interface ComparePanelProps {
  schools: School[];
  onClose: () => void;
  onRemove: (school: School) => void;
  loading?: boolean;
}

export default function ComparePanel({
  schools,
  onClose,
  onRemove,
  loading = false,
}: ComparePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/90 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-neutral-900/90 px-6 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-white">学校对比</h1>
          <p className="mt-0.5 text-xs text-white/55">
            {schools.length} 所学校 · 每列独立滚动 · 点击 ← 移除学校
          </p>
        </div>
        <div className="flex items-center gap-2">
          {schools.length > 3 && (
            <span className="hidden text-[11px] text-white/40 sm:block">
              ← 横向滑动 →
            </span>
          )}
          <Button theme="dark" variant="secondary" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </header>

      {/* Body — N 列 SchoolPanel 并排（居中 + 固定列宽） */}
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4">
        <div className="flex h-full items-stretch justify-center gap-3 sm:gap-4">
          {schools.map((school) => (
            <div
              key={school.name}
              className="h-full min-w-[480px] flex-1 max-w-[800px]"
            >
              <SchoolPanel
                school={school}
                onClose={() => onRemove(school)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/80 px-8 py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-sm text-white/70">正在加载对比数据…</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
