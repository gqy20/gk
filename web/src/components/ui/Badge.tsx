import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-block border shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
  {
    variants: {
      tone: {
        red: "",
        gold: "",
        green: "",
      },
      variant: {
        solid: "",
        subtle: "",
        outline: "",
      },
      size: {
        sm: "rounded-sm px-1.5 py-px text-[10px]",
        md: "rounded-sm px-2 py-0.5 text-[10px] font-semibold",
        compact: "rounded-sm px-1 py-px text-[9px]",
      },
    },
    compoundVariants: [
      { tone: "red", variant: "solid", className: "border-danger-400/45 bg-danger-50 text-danger-600" },
      { tone: "red", variant: "subtle", className: "border-danger-300/55 bg-danger-100/55 text-danger-600" },
      { tone: "red", variant: "outline", className: "border-danger-300/55 text-danger-500 hover:bg-danger-50" },
      { tone: "gold", variant: "solid", className: "border-accent-400/48 bg-accent-50 text-accent-700" },
      { tone: "gold", variant: "subtle", className: "border-accent-300/70 bg-accent-100/60 text-accent-700" },
      { tone: "gold", variant: "outline", className: "border-accent-300/55 text-accent-600 hover:bg-accent-50" },
      { tone: "green", variant: "solid", className: "border-brand-400/45 bg-success-soft text-brand-700" },
      { tone: "green", variant: "subtle", className: "border-brand-300/60 bg-brand-100/55 text-brand-700" },
      { tone: "green", variant: "outline", className: "border-brand-300/55 text-brand-600 hover:bg-success-soft" },
    ],
    defaultVariants: {
      tone: "gold",
      variant: "solid",
      size: "md",
    },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  label: string;
  compact?: boolean;
  className?: string;
}

export function Badge({
  label,
  tone,
  variant,
  size,
  compact,
  className,
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, variant, size: compact ? "compact" : size }), className)}>
      {label}
    </span>
  );
}
