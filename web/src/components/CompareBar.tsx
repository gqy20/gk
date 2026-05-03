"use client";

import { Button } from "@/components/ui/Button";
import { IconClose } from "@/components/ui/Icon";
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
    <div className="border-t border-border-light bg-ink-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-700">
          Compare
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {schools.map((school) => (
            <span
              key={school.name}
              className="inline-flex items-center gap-1 rounded-full border border-border-light bg-ink-50 px-2 py-0.5 text-xs text-dark-950"
            >
              <span className="max-w-[100px] truncate">{school.name}</span>
              <button
                type="button"
                onClick={() => onRemove(school)}
                className="rounded-full p-0.5 text-red-400 transition hover:bg-red-50"
              >
                <IconClose size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button theme="light" variant="danger" size="sm" onClick={onClear}>
            清空
          </Button>
          <Button
            theme="light"
            variant="primary"
            size="sm"
            onClick={onCompare}
            disabled={schools.length < 2}
          >
            对比
          </Button>
        </div>
      </div>
    </div>
  );
}
