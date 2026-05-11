"use client";

import { cn } from "@/lib/utils";
import type { MajorCategory } from "@/types/majors";

const SHORT_NAMES: Record<string, string> = {
  "1050": "本科",
  "1070": "职教本科",
  "1060": "高职专科",
};

interface MajorCategoryNavProps {
  categories: MajorCategory[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export default function MajorCategoryNav({
  categories,
  activeKey,
  onSelect,
}: MajorCategoryNavProps) {
  return (
    <nav
      role="tablist"
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface-elevated/80 px-3 scrollbar-hide sm:overflow-x-visible"
    >
      {categories.map((cat) => {
        const isActive = cat.key === activeKey;
        const label = SHORT_NAMES[cat.key] || cat.name.replace(/（[^）]+）/g, "");
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(cat.key)}
            className={cn(
              "relative shrink-0 h-9 px-3 sm:px-4 text-xs font-medium transition-colors whitespace-nowrap",
              isActive
                ? "text-primary"
                : "text-dark-300 hover:text-text hover:bg-surface-active",
            )}
          >
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
