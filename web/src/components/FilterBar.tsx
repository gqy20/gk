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
    <div className="mt-2.5 sm:mt-3 flex flex-col gap-2 sm:gap-3 lg:grid lg:grid-cols-[minmax(240px,420px)_1fr_auto] lg:items-center">
      <label className="group flex h-11 items-center gap-3 rounded-lg border border-border bg-surface-active px-3 transition focus-within:border-primary/70 focus-within:bg-surface-hover">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索学校、省份或官方域名"
          placeholder="搜索学校 / 省份 / 官方域名"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-dark-700"
        />
      </label>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <FilterTag
          label="985"
          active={filter985}
          onClick={onToggle985}
          tone="red"
        />
        <FilterTag
          label="211"
          active={filter211}
          onClick={onToggle211}
          tone="gold"
        />
        <FilterTag
          label="双一流"
          active={filterDoubleFirst}
          onClick={onToggleDoubleFirst}
          tone="green"
        />
        <span className="hidden text-xs text-dark-500 sm:inline">
          {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省份
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <span className="text-xs text-dark-500 sm:hidden">
          {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省份
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveControls}
          className="h-9 rounded-full border border-border px-4 text-xs font-medium text-dark-200 transition enabled:hover:border-primary/60 enabled:hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          重置
        </button>
      </div>
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: "red" | "gold" | "green";
}) {
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
        className={cn(
          "h-9 rounded-lg border px-4 text-xs font-semibold",
          solidColors[tone],
        )}
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
      className="h-9 rounded-lg border border-border-light bg-white px-4 text-xs font-semibold text-dark-700 shadow-sm"
    >
      {label}
    </motion.button>
  );
}
