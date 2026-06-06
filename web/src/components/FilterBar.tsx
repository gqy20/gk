"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FilterBarProps {
  query: string;
  filter985: boolean;
  filter211: boolean;
  filterDoubleFirst: boolean;
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
  activeFilterCount,
  onQueryChange,
  onToggle985,
  onToggle211,
  onToggleDoubleFirst,
  onReset,
}: FilterBarProps) {
  const hasActiveControls = query.trim().length > 0 || activeFilterCount > 0;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="group flex h-8 w-[170px] min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-subtle px-2.5 transition focus-within:border-primary/70 focus-within:bg-surface-hover sm:h-9 sm:w-[240px] xl:w-[320px] sm:gap-3 sm:px-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索学校、省份或官方域名"
          placeholder="搜索 / 省份"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-placeholder sm:text-base sm:placeholder:搜索学校 / 省份"
        />
      </label>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <FilterTag label="985" active={filter985} onClick={onToggle985} tone="red" />
        <FilterTag label="211" active={filter211} onClick={onToggle211} tone="gold" />
        <FilterTag label="双一流" active={filterDoubleFirst} onClick={onToggleDoubleFirst} tone="green" />
        {hasActiveControls && (
          <button
            type="button"
            onClick={onReset}
            className="h-7 shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition hover:border-primary/60 hover:bg-primary/10 sm:h-8"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}

const solidColors: Record<"red" | "gold" | "green", string> = {
  red: "bg-danger-500 text-text-inverse border-transparent shadow-md shadow-danger-500/25",
  gold: "bg-accent-500 text-text-inverse border-transparent shadow-md shadow-accent-500/25",
  green: "bg-brand-500 text-text-inverse border-transparent shadow-md shadow-brand-500/25",
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
  const sizeClass = "h-7 px-3 text-xs sm:h-8 sm:px-3.5";

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
      whileHover={{ scale: 1.04, borderColor: "rgba(37,111,143,0.45)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "shrink-0 rounded-lg border border-border-light bg-neutral-0 font-semibold text-text-light-muted shadow-sm",
        sizeClass,
      )}
    >
      {label}
    </motion.button>
  );
}
