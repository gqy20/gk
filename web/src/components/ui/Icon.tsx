import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  size?: number;
}

export function IconChevronDown({ className, size = 12 }: IconProps) {
  return <ChevronDown className={cn("shrink-0", className)} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export function IconClose({ className, size = 12 }: IconProps) {
  return <X className={cn("shrink-0", className)} size={size} strokeWidth={1.9} aria-hidden="true" />;
}

export function IconCheck({ className, size = 12 }: IconProps) {
  return <Check className={cn("shrink-0", className)} size={size} strokeWidth={2.1} aria-hidden="true" />;
}

export function IconSearch({ className, size = 14 }: IconProps) {
  return <Search className={cn("shrink-0", className)} size={size} strokeWidth={1.8} aria-hidden="true" />;
}
