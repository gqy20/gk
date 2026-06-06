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
    solid: "border-danger-300/55 bg-danger-soft text-danger-400",
    subtle: "border-danger-200/70 bg-danger-200/18 text-danger-100",
    outline: "border-danger-300/55 text-danger-200 hover:bg-danger-soft",
  },
  gold: {
    solid: "border-accent-300/55 bg-accent-100 text-accent-700",
    subtle: "border-accent-300/80 bg-accent-300/18 text-accent-600",
    outline: "border-accent-300/55 text-accent-200 hover:bg-accent-100",
  },
  green: {
    solid: "border-brand-300/55 bg-success-soft text-brand-400",
    subtle: "border-brand-300/80 bg-brand-300/16 text-brand-100",
    outline: "border-brand-300/55 text-brand-200 hover:bg-success-soft",
  },
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-1.5 py-px text-[10px] rounded",
  md: "px-2 py-0.5 text-[10px] font-semibold rounded-full",
  compact: "px-1 py-px text-[9px] rounded",
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
        "inline-block border",
        toneMap[tone][variant],
        sizeMap[compact ? "compact" : size],
        className,
      )}
    >
      {label}
    </span>
  );
}
