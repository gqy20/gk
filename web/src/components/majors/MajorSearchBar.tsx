"use client";

import { IconSearch } from "@/components/ui/Icon";

interface MajorSearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export default function MajorSearchBar({
  value,
  onChange,
}: MajorSearchBarProps) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <div className="relative">
        <IconSearch
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          placeholder="搜索专业名称或代码..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-full border border-border bg-surface-subtle pl-9 pr-3 text-xs text-text placeholder:text-text-placeholder outline-none focus:border-primary/50 transition-colors"
        />
      </div>
    </div>
  );
}
