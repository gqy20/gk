import { cn } from "@/lib/utils";
import type { LabelHTMLAttributes } from "react";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block space-y-2 text-xs font-medium text-text-secondary", className)}
      {...props}
    />
  );
}
