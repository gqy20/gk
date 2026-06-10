import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

const panelVariants = cva(
  [
    "group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated",
    "shadow-[0_1px_0_0_rgba(255,255,255,0.72)_inset,0_10px_24px_-22px_rgba(17,24,32,0.28)]",
    "transition",
  ],
  {
    variants: {
      interactive: {
        true: "hover:border-border-subtle",
        false: "",
      },
    },
    defaultVariants: {
      interactive: true,
    },
  },
);

interface PanelProps extends VariantProps<typeof panelVariants> {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}

export function Panel({
  as,
  children,
  className,
  highlight = true,
  interactive,
}: PanelProps) {
  const Component: ElementType = as ?? "section";

  return (
    <Component className={cn(panelVariants({ interactive }), className)}>
      {highlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/80 to-transparent"
        />
      )}
      {children}
    </Component>
  );
}
