"use client";

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
      <label className="group flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.07] px-3 transition focus-within:border-[#d8b75d]/70 focus-within:bg-white/[0.1]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9f9888]">
          Search
        </span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="学校 / 省份 / 官方域名"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#fff9ec] outline-none placeholder:text-[#7f796b]"
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
        <span className="text-xs text-[#9f9888]">
          {filteredCount}/{totalCount} 所 · {doneCount} 已采集 · {provinceCount} 省份
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 lg:justify-end">
        <span className="text-[11px] uppercase tracking-[0.16em] text-[#746f63]">
          Filters {activeFilterCount}
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveControls}
          className="h-9 rounded-full border border-white/10 px-4 text-xs font-medium text-[#d8caa6] transition enabled:hover:border-[#d8b75d]/60 enabled:hover:bg-[#d8b75d]/10 disabled:cursor-not-allowed disabled:opacity-35"
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
      active: "border-[#f19a7a]/70 bg-[#f19a7a]/18 text-[#ffd7c8]",
      inactive: "border-white/10 bg-white/[0.04] text-[#b7afa0]",
    },
    gold: {
      active: "border-[#d8b75d]/80 bg-[#d8b75d]/18 text-[#ffe2a0]",
      inactive: "border-white/10 bg-white/[0.04] text-[#b7afa0]",
    },
    green: {
      active: "border-[#6fc0a5]/80 bg-[#6fc0a5]/16 text-[#b9f1df]",
      inactive: "border-white/10 bg-white/[0.04] text-[#b7afa0]",
    },
  };
  const classes = active ? colors[tone].active : colors[tone].inactive;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 rounded-full border px-4 text-xs font-semibold transition hover:-translate-y-px hover:border-[#d8b75d]/50 ${classes}`}
    >
      {label}
    </button>
  );
}
