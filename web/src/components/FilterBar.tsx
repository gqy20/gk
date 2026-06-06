"use client";

import { IconClose, IconSearch } from "@/components/ui/Icon";

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
      <label className="group flex h-10 w-[min(54vw,360px)] min-w-[190px] items-center gap-2 rounded-lg border border-border/70 bg-neutral-0/82 px-3 shadow-sm shadow-neutral-900/5 backdrop-blur-md transition focus-within:border-primary/55 focus-within:bg-neutral-0 focus-within:shadow-[0_0_0_3px_rgba(63,143,155,0.10)] sm:w-[320px] lg:w-[360px]">
        <IconSearch className="text-text-placeholder transition group-focus-within:text-primary" size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="搜索学校、省份或官方域名"
          placeholder="搜索学校 / 省份 / 官网"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text outline-none placeholder:font-normal placeholder:text-text-placeholder"
        />
        {query.trim().length > 0 && (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={() => onQueryChange("")}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-muted transition hover:bg-brand-50 hover:text-primary"
          >
            <IconClose size={11} />
          </button>
        )}
      </label>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {hasActiveControls && (
          <button
            type="button"
            onClick={onReset}
            className="h-9 shrink-0 rounded-md border border-border/70 bg-neutral-0/70 px-3 text-xs font-medium text-text-secondary shadow-sm shadow-white/30 transition hover:border-primary/50 hover:bg-brand-50 hover:text-primary"
          >
            重置
          </button>
        )}
      </div>
    </div>
  );
}
