"use client";

export type SimulatorRoundCount = 3 | 8 | 20 | 50;

const ROUND_OPTIONS = [
  { value: 3 as const, label: "3 轮", desc: "快速体验", detail: "入学、适应、起步，约 2 分钟" },
  { value: 8 as const, label: "8 轮", desc: "标准模式", detail: "完整四年脉络：入学到毕业" },
  { value: 20 as const, label: "20 轮", desc: "深度沉浸", detail: "覆盖每个学期的关键节点" },
  { value: 50 as const, label: "50 轮", desc: "长期推演", detail: "周级别微观推演，约 15 分钟" },
] as const;

export function RoundSelector({
  value,
  onChange,
}: {
  value: SimulatorRoundCount;
  onChange: (value: SimulatorRoundCount) => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-1">
      {ROUND_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={`group relative flex min-h-[104px] flex-col rounded-xl border p-3.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
              isSelected
                ? "border-primary/45 bg-primary/[0.08] ring-1 ring-primary/20"
                : "border-border bg-neutral-0/70 hover:border-primary/30 hover:bg-surface-elevated"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-text"}`}>
                {option.label}
              </span>
              {isSelected && (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-text-inverse"
                >
                  ✓
                </span>
              )}
            </div>
            <span className={`mt-2 text-xs font-medium ${isSelected ? "text-primary" : "text-text-secondary"}`}>
              {option.desc}
            </span>
            <span className={`mt-1 text-[11px] leading-5 ${isSelected ? "text-primary/80" : "text-text-muted"}`}>
              {option.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}
