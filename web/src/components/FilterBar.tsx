"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FilterBarProps {
  query: string;
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
  totalCount: number;
  filteredCount: number;
  doneCount: number;
  provinceCount: number;
  activeFilterCount: number;
  onQueryChange: (value: string) => void;
  onToggle985: () => void;
  onToggle211: () => void;
  onToggleDoubleFirst: () => void;
  onReset: () => void;
}

export default function FilterBar({
  query,
  filter985,
  filter211,
  filterDoubleFirst,
  totalCount,
  filteredCount,
  doneCount,
  provinceCount,
  activeFilterCount,
  onQueryChange,
  onToggle985,
  onToggle211,
  onToggleDoubleFirst,
  onReset,
}: FilterBarProps) {
  const hasActiveControls = query.trim().length > 0 || activeFilterCount > 0;

  return (
    <div className="flex flex-col gap-1.5 sm:gap-3 lg:grid lg:grid-cols-[minmax(240px,420px)_1fr_auto] lg:items-center">
      {/* 移动端：搜索框 + 筛选标签 + 重置 单行排列；桌面端保持原布局 */}
      <div className="flex items-center gap-1.5 sm:flex-col sm:items-stretch">
        <label className="group flex h-8 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-active px-2.5 transition focus-within:border-primary/70 focus-within:bg-surface-hover sm:h-11 sm:gap-3 sm:px-3">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="搜索学校、省份或官方域名"
            placeholder="搜索 / 省份"
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-dark-700 sm:placeholder:搜索学校 / 省份 / 官方域名"
          />
        </label>

        <div className="flex shrink-0 items-center gap-1 sm:flex-wrap sm:gap-2 sm:w-full">
          <FilterTag label="985" active={filter985} onClick={onToggle985} tone="red" compact />
          <FilterTag label="211" active={filter211} onClick={onToggle211} tone="gold" compact />
          <FilterTag label="双一流" active={filterDoubleFirst} onClick={onToggleDoubleFirst} tone="green" compact />
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveControls}
            className="hidden h-7 shrink-0 rounded-full border border-border px-2.5 text-[10px] font-medium text-dark-200 transition enabled:hover:border-primary/60 enabled:hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex sm:h-9 sm:px-4 sm:text-xs"
          >
            重置
          </button>
        </div>
      </div>

      {/* 统计信息：移动端内联显示，桌面端独立行 */}
      <span className="text-[10px] text-dark-500 sm:text-xs sm:hidden">
        {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省
      </span>
      <span className="hidden text-xs text-dark-500 sm:inline">
        {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省份
      </span>
    </div>
  );
}

const solidColors: Record<"red" | "gold" | "green", string> = {
  red: "bg-red-500 text-white border-transparent shadow-md shadow-red-500/25",
  gold: "bg-gold-500 text-white border-transparent shadow-md shadow-gold-500/25",
  green: "bg-green-500 text-white border-transparent shadow-md shadow-green-500/25",
};

function FilterTag({
  label,
  active,
  onClick,
  tone,
  compact,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: "red" | "gold" | "green";
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-7 px-2 text-[10px]" : "h-9 px-4 text-xs";

  if (active) {
    return (
      <motion.button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        whileTap={{ scale: 0.95 }}
        className={cn("shrink-0 rounded-lg border font-semibold", sizeClass, solidColors[tone])}
      >
        {label}
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileHover={{ scale: 1.04, borderColor: "rgba(216,183,93,0.5)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "shrink-0 rounded-lg border border-border-light bg-white font-semibold text-dark-700 shadow-sm",
        sizeClass,
      )}
    >
      {label}
    </motion.button>
  );
}
