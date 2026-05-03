"use client";

import { cn } from "@/lib/utils";

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
    <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(240px,420px)_1fr_auto] lg:items-center">
      <label className="group flex h-11 items-center gap-3 rounded-lg border border-border bg-surface-active px-3 transition focus-within:border-primary/70 focus-within:bg-surface-hover">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索学校 / 省份 / 官方域名"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-dark-700"
        />
      </label>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        <span className="text-xs text-dark-500">
          {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省份
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
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
  const colors: Record<typeof tone, { active: string; inactive: string }> = {
    red: {
      active: "border-red-200/70 bg-red-200/18 text-red-100",
      inactive: "border-border bg-surface-hover text-dark-400",
    },
    gold: {
      active: "border-primary/80 bg-primary/18 text-gold-600",
      inactive: "border-border bg-surface-hover text-dark-400",
    },
    green: {
      active: "border-green-300/80 bg-green-300/16 text-green-100",
      inactive: "border-border bg-surface-hover text-dark-400",
    },
  };
  const classes = active ? colors[tone].active : colors[tone].inactive;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-4 text-xs font-semibold transition hover:-translate-y-px hover:border-primary/50",
        classes,
      )}
    >
      {label}
    </button>
  );
}
