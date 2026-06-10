import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function NativeSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full appearance-none rounded-xl border border-border bg-neutral-0/70 px-4 pr-10 text-sm text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]",
        "outline-none transition duration-150",
        "hover:border-border-subtle focus:border-accent/60 focus:bg-surface-elevated focus:ring-2 focus:ring-accent/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
