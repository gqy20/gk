export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-dark-300/30 ${className}`}
    />
  );
}

export function HomePageSkeleton() {
  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      {/* Header 骨架 */}
      <div className="flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-24 ml-auto" />
      </div>

      {/* Main 骨架 */}
      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[1fr_400px]">
        {/* 地图区骨架 */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface-elevated/92">
          <Skeleton className="absolute inset-0" />
          <div className="absolute left-4 top-4">
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* 右侧面板骨架 */}
        <div className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface-light p-3">
          {/* 标题栏 */}
          <Skeleton className="h-5 w-28" />
          {/* 省份卡片 × 4 */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border-light bg-ink-50 p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-10 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-full" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
