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
    <div className="ink-wash-bg flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      {/* topbar：logo + 标题 + 搜索 + 导航 */}
      <div className="paper-shell home-topbar relative z-20 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" className="h-8 w-8" />
          <Skeleton shape="text" className="h-5 w-28 sm:w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="hidden h-8 w-48 rounded-lg sm:block" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="hidden h-7 w-20 rounded-full lg:block" />
          </div>
        </div>
      </div>

      {/* main：地图 + 侧栏列表（贴合真实首页 grid 布局） */}
      <div className="grid flex-1 gap-2.5 overflow-hidden p-2.5 pt-2 sm:gap-3 sm:p-3 sm:pt-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]">
        {/* 地图区 */}
        <div className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92">
          <Skeleton className="absolute inset-0" />
          <div className="absolute left-4 top-4">
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* 侧栏学校列表区 */}
        <div className="paper-card hidden min-h-0 flex-col overflow-hidden rounded-lg border lg:flex">
          <div className="border-b border-border-light bg-accent-50/45 px-4 py-3">
            <Skeleton shape="text" className="h-4 w-24" />
          </div>
          <div className="flex-1 space-y-2 overflow-hidden p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-border-light bg-neutral-0/72 p-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton shape="circle" className="h-5 w-5" />
                  <Skeleton shape="text" className="h-3 flex-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
