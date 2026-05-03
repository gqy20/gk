import { cn } from "@/lib/utils";

type BadgeTone = "red" | "gold" | "green";
type BadgeVariant = "solid" | "subtle" | "outline";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const toneMap: Record<
  BadgeTone,
  Record<BadgeVariant, string>
> = {
  red: {
    solid: "border-red-300/55 bg-red-50 text-red-400",
    subtle: "border-red-200/70 bg-red-200/18 text-red-100",
    outline: "border-red-300/55 text-red-200 hover:bg-red-50",
  },
  gold: {
    solid: "border-gold-300/55 bg-gold-100 text-gold-700",
    subtle: "border-gold-300/80 bg-gold-300/18 text-gold-600",
    outline: "border-gold-300/55 text-gold-200 hover:bg-gold-100",
  },
  green: {
    solid: "border-green-300/55 bg-green-50 text-green-400",
    subtle: "border-green-300/80 bg-green-300/16 text-green-100",
    outline: "border-green-300/55 text-green-200 hover:bg-green-50",
  },
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-1.5 py-px text-[10px] rounded",
  md: "px-2 py-0.5 text-[10px] font-semibold rounded-full",
};

export function Badge({
  label,
  tone = "gold",
  variant = "solid",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block border",
        toneMap[tone][variant],
        sizeMap[size],
        className,
      )}
    >
      {label}
    </span>
  );
}
