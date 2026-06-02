"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFutureRunFromClient } from "@/lib/future/client";
import type { FutureRunResult } from "@/lib/future/types";

export default function FutureResultPage() {
  return (
    <Suspense fallback={<ResultShell />}>
      <FutureResultContent />
    </Suspense>
  );
}

function ResultShell() {
  return (
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b border-border bg-surface/95 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <a href="/future" className="text-sm text-dark-300 transition hover:text-text">
            ← 新推演
          </a>
          <h1 className="text-lg font-semibold text-dark-50">未来路径推演结果</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="rounded-lg border border-border bg-surface-elevated/50 p-5 text-sm text-dark-300">
          正在读取推演结果…
        </div>
      </main>
    </div>
  );
}

function FutureResultContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId") || "";
  const [result, setResult] = useState<FutureRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setError("缺少 runId，无法读取推演结果。");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const next = await fetchFutureRunFromClient(runId);
        if (cancelled) return;
        setResult(next);
        setError(next.run.error || null);
        if (next.run.status === "generating") {
          timer = setTimeout(load, 3000);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取推演结果失败");
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  const output = result?.output;
  const isGenerating = result?.run.status === "generating";

  return (
    <div className="min-h-screen bg-surface text-text">
      <header className="border-b border-border bg-surface/95 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <a href="/future" className="text-sm text-dark-300 transition hover:text-text">
            ← 新推演
          </a>
          <h1 className="min-w-0 truncate text-lg font-semibold text-dark-50">
            {output?.title || "未来路径推演结果"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && (
          <div className="rounded-lg border border-red-300/40 bg-red-50 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {!error && (!output || isGenerating) && (
          <div className="rounded-lg border border-border bg-surface-elevated/50 p-5 text-sm text-dark-300">
            {isGenerating ? "正在生成未来路径，结果会自动刷新…" : "正在读取推演结果…"}
          </div>
        )}

        {output && (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-surface-elevated/70 p-4">
              <p className="text-sm leading-7 text-dark-200">{output.summary}</p>
              <p className="mt-3 text-sm leading-7 text-dark-300">{output.overall_advice}</p>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              {output.paths.map((path) => (
                <article key={path.index} className="rounded-lg border border-border bg-surface-elevated/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-dark-50">{path.label}</h2>
                      <p className="mt-1 text-xs text-dark-400">{path.tagline}</p>
                    </div>
                    <span className="rounded-full border border-primary/40 bg-primary-soft px-2 py-1 text-xs text-primary">
                      {path.fit_score}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {Object.entries(path.scores).map(([key, score]) => (
                      <div key={key} className="rounded-lg border border-border-subtle bg-surface-active p-2">
                        <div className="text-dark-500">{scoreLabel(key)}</div>
                        <div className="mt-1 font-semibold text-dark-100">{score.value}/10</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3">
                    {path.timeline.map((item) => (
                      <div key={item.stage} className="border-l border-primary/40 pl-3">
                        <h3 className="text-xs font-semibold text-primary">{item.stage}</h3>
                        <p className="mt-1 text-xs leading-6 text-dark-300">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg border border-border-subtle bg-surface-active p-3">
                    <h3 className="text-xs font-semibold text-dark-100">建议</h3>
                    <p className="mt-1 text-xs leading-6 text-dark-300">{path.advice}</p>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function scoreLabel(key: string) {
  const labels: Record<string, string> = {
    income: "收入",
    stability: "稳定",
    growth: "成长",
    happiness: "幸福",
    risk: "风险",
    school_fit: "学校",
    major_fit: "专业",
  };
  return labels[key] || key;
}
