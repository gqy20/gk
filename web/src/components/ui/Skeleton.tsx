import { cn } from "@/lib/utils";

type SkeletonShape = "rect" | "circle" | "text";

interface SkeletonProps {
  className?: string;
  /** 形状变体：rect（默认矩形）、circle（圆形头像）、text（文本行） */
  shape?: SkeletonShape;
}

/**
 * 骨架屏占位 —— shimmer 扫光动画（linear-gradient 平移）。
 *
 * 相比 animate-pulse 的整体透明度脉冲，shimmer 更接近
 * Linear / Vercel 的加载质感：一道高光从左扫到右。
 */
export function Skeleton({ className, shape = "rect" }: SkeletonProps) {
  const shapeClass =
    shape === "circle"
      ? "rounded-full"
      : shape === "text"
        ? "rounded"
        : "rounded-lg";

  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer", shapeClass, className)}
    />
  );
}

export function HomePageSkeleton() {
  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      <div className="flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3">
        <Skeleton shape="circle" className="h-8 w-8" />
        <Skeleton shape="text" className="h-6 w-40" />
        <Skeleton className="ml-auto h-5 w-24" />
      </div>

      <div className="grid flex-1 grid-rows-1 gap-2.5 overflow-hidden p-2.5 pt-2 sm:gap-3 sm:p-3 sm:pt-2.5">
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface-elevated/92">
          <Skeleton className="absolute inset-0" />
          <div className="absolute left-4 top-4">
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
