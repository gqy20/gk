"use client";

import type { School } from "@/lib/data";

interface CompareBarProps {
  schools: School[];
  onRemove: (school: School) => void;
  onCompare: () => void;
  onClear: () => void;
}

export default function CompareBar({ schools, onRemove, onCompare, onClear }: CompareBarProps) {
  if (schools.length === 0) return null;

  return (
    <div className="border-t border-black/10 bg-[#f9f5ec] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6414]">
          Compare
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {schools.map((school) => (
            <span
              key={school.name}
              className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#fffaf0] px-2 py-0.5 text-xs text-[#4f4a40]"
            >
              <span className="max-w-[100px] truncate">{school.name}</span>
              <button
                type="button"
                onClick={() => onRemove(school)}
                className="rounded-full p-0.5 text-[#9d3b25] transition hover:bg-[#f9ddd4]"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 2L10 10M10 2L2 10" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-[#5c5549] transition hover:border-[#9d3b25]/40 hover:text-[#9d3b25]"
          >
            清空
          </button>
          <button
            type="button"
            onClick={onCompare}
            disabled={schools.length < 2}
            className="rounded-full border border-[#1a342f] bg-[#1a342f] px-3 py-1.5 text-xs font-medium text-[#fff9ec] transition enabled:hover:bg-[#2c5f55] disabled:cursor-not-allowed disabled:opacity-40"
          >
            对比
          </button>
        </div>
      </div>
    </div>
  );
}
