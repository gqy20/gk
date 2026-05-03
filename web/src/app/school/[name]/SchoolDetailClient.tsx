"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import SchoolMap from "@/components/school-panel/SchoolMap";
import SchoolPanel from "@/components/school-panel/SchoolPanel";
import type { School } from "@/lib/data";

interface Props {
  school: School;
}

export default function SchoolDetailClient({ school }: Props) {
  const router = useRouter();

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-surface text-text">
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2.5 shadow-2xl shadow-black/20 sm:px-4 sm:py-3">
        <Button theme="dark" variant="secondary" size="sm" onClick={() => router.push("/")}>
          ← 返回地图
        </Button>
        <h1 className="min-w-0 truncate text-lg font-semibold text-dark-50 sm:text-xl">
          {school.name}
        </h1>
        <span className="rounded-full border border-border-subtle bg-white/[0.06] px-2.5 py-1 text-xs text-dark-400">
          {school.province}
        </span>
      </header>

      {/* Main content */}
      <main className="relative z-10 grid flex-1 gap-2.5 overflow-hidden p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
        {/* Left: Map */}
        <section className="relative min-h-0 overflow-hidden rounded-lg border border-border bg-surface-elevated/92 shadow-2xl shadow-black/25">
          <SchoolMap school={school} compact={false} />
        </section>

        {/* Right: Detail panel */}
        <aside className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-light text-text-light shadow-2xl shadow-black/25">
          <SchoolPanel school={school} />
        </aside>
      </main>
    </div>
  );
}
