"use client";

interface FilterBarProps {
  query: string;
  activeFilterCount: number;
  onQueryChange: (value: string) => void;
  onReset: () => void;
}

export default function FilterBar({
  query,
  activeFilterCount,
  onQueryChange,
  onReset,
}: FilterBarProps) {
  const hasActiveControls = query.trim().length > 0 || activeFilterCount > 0;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="group flex h-8 w-[170px] min-w-0 items-center gap-2 rounded-md border border-border bg-neutral-0/78 px-2.5 shadow-inner shadow-white/40 transition focus-within:border-primary/70 focus-within:bg-neutral-0 sm:h-9 sm:w-[240px] xl:w-[320px] sm:gap-3 sm:px-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索学校、省份或官方域名"
          placeholder="搜索 / 省份"
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-placeholder sm:text-base sm:placeholder:搜索学校 / 省份"
        />
      </label>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {hasActiveControls && (
          <button
            type="button"
            onClick={onReset}
            className="h-7 shrink-0 rounded-md border border-border bg-neutral-0/70 px-3 text-xs font-medium text-text-secondary transition hover:border-primary/60 hover:bg-brand-50 sm:h-8"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}
