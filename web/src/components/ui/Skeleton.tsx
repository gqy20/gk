import { cn } from "@/lib/utils";

export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-neutral-300/30", className)}
    />
  );
}

export function HomePageSkeleton() {
  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      <div className="flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-24 ml-auto" />
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
