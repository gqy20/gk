import { cn } from "@/lib/utils";

type BadgeTone = "red" | "gold" | "green";
type BadgeVariant = "solid" | "subtle" | "outline";
type BadgeSize = "sm" | "md" | "compact";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  compact?: boolean;
  className?: string;
}

const toneMap: Record<
  BadgeTone,
  Record<BadgeVariant, string>
> = {
  red: {
    solid: "border-danger-400/45 bg-danger-50 text-danger-600",
    subtle: "border-danger-300/55 bg-danger-100/55 text-danger-600",
    outline: "border-danger-300/55 text-danger-500 hover:bg-danger-50",
  },
  gold: {
    solid: "border-accent-400/48 bg-accent-50 text-accent-700",
    subtle: "border-accent-300/70 bg-accent-100/60 text-accent-700",
    outline: "border-accent-300/55 text-accent-600 hover:bg-accent-50",
  },
  green: {
    solid: "border-brand-400/45 bg-success-soft text-brand-700",
    subtle: "border-brand-300/60 bg-brand-100/55 text-brand-700",
    outline: "border-brand-300/55 text-brand-600 hover:bg-success-soft",
  },
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-1.5 py-px text-[10px] rounded-sm",
  md: "px-2 py-0.5 text-[10px] font-semibold rounded-sm",
  compact: "px-1 py-px text-[9px] rounded-sm",
};

export function Badge({
  label,
  tone = "gold",
  variant = "solid",
  size = "md",
  compact,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block border shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
        toneMap[tone][variant],
        sizeMap[compact ? "compact" : size],
        className,
      )}
    >
      {label}
    </span>
  );
}
