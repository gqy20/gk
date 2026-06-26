import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  X,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  size?: number;
}

/** 全局统一的描边粗细，避免各组件 inline SVG 各写各的 */
export const ICON_STROKE_WIDTH = 1.8;

export function IconChevronDown({ className, size = 12 }: IconProps) {
  return <ChevronDown className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}

export function IconChevronLeft({ className, size = 16 }: IconProps) {
  return <ChevronLeft className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}

export function IconChevronRight({ className, size = 16 }: IconProps) {
  return <ChevronRight className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}

export function IconClose({ className, size = 12 }: IconProps) {
  return <X className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH + 0.1} aria-hidden="true" />;
}

export function IconCheck({ className, size = 12 }: IconProps) {
  return <Check className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH + 0.2} aria-hidden="true" />;
}

export function IconSearch({ className, size = 14 }: IconProps) {
  return <Search className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}

export function IconHistory({ className, size = 16 }: IconProps) {
  return <History className={cn("shrink-0", className)} size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />;
}

/**
 * 旋转加载 spinner（lucide LoaderCircle），用于按钮 loading 态等通用场景。
 * 默认带 animate-spin，可通过 className 覆盖。
 */
export function IconSpinner({ className, size = 14 }: IconProps) {
  return (
    <LoaderCircle
      className={cn("animate-spin shrink-0", className)}
      size={size}
      strokeWidth={ICON_STROKE_WIDTH}
      aria-hidden="true"
    />
  );
}

/**
 * 双环加载 spinner（定制）：半透明背景圆 + 旋转弧线。
 * 供 ThinkingPanel / FutureLoading 等大尺寸 loading 场景复用，替代散落的内联 SVG。
 */
export function IconDualRingSpinner({
  className,
  size = 24,
  done = false,
}: IconProps & { done?: boolean }) {
  return (
    <svg
      className={cn(done ? "" : "animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" className="stroke-current opacity-20" />
      {done ? (
        <path d="M8 12l2.5 2.5L16 9" className="stroke-current" />
      ) : (
        <path d="M12 3a9 9 0 0 1 6.36 2.64" className="stroke-current" />
      )}
    </svg>
  );
}
