import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-border bg-neutral-0/70 px-4 py-3 text-sm leading-6 text-text",
        "shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]",
        "outline-none transition duration-150 placeholder:text-text-placeholder",
        "hover:border-border-subtle focus:border-accent/60 focus:bg-surface-elevated focus:ring-2 focus:ring-accent/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
