"use client";

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
        <svg
          className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          placeholder="搜索专业名称或代码..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-full border border-border bg-surface-active pl-9 pr-3 text-xs text-text placeholder:text-dark-500 outline-none focus:border-primary/50 transition-colors"
        />
      </div>
    </div>
  );
}
