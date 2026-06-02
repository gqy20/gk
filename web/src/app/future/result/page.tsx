"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFutureRunFromClient } from "@/lib/future/client";
import type { FuturePath, FutureRunResult, FutureStructuredOutput } from "@/lib/future/types";

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
  const recommendedPath = output ? findRecommendedPath(output) : null;

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
            <DecisionHero output={output} run={result?.run} recommendedPath={recommendedPath} />
            <InsightPanels output={output} />
            <ComparisonTable output={output} recommendedPath={recommendedPath} />
            <BranchPlanStrip output={output} recommendedPath={recommendedPath} />
            <section className="grid gap-3 lg:grid-cols-2">
              {output.paths.map((path) => (
                <PathCard
                  key={path.index}
                  path={path}
                  isRecommended={path.index === recommendedPath?.index}
                />
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function DecisionHero({
  output,
  run,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  run: FutureRunResult["run"] | undefined;
  recommendedPath: FuturePath | null;
}) {
  const summary = clipText(output.summary, 110);
  const adviceIntro = clipText(output.overall_advice, 180);
  const actions = extractActionItems(recommendedPath?.advice || output.overall_advice);

  return (
    <section className="rounded-lg border border-primary/30 bg-surface-elevated/80 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div>
          <p className="text-xs font-medium text-primary">推荐结论</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-dark-50 sm:text-3xl">
            {recommendedPath?.label || "先保留三条路径的选择权"}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-dark-200">{summary}</p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-dark-300">{adviceIntro}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-dark-400">
            {run?.model && <span className="rounded-full border border-border bg-surface-active px-2.5 py-1">模型：{run.model}</span>}
            {run?.promptVersion && <span className="rounded-full border border-border bg-surface-active px-2.5 py-1">Prompt：{run.promptVersion}</span>}
            {typeof run?.inputTokens === "number" && <span className="rounded-full border border-border bg-surface-active px-2.5 py-1">输入：{run.inputTokens} tokens</span>}
            {typeof run?.outputTokens === "number" && <span className="rounded-full border border-border bg-surface-active px-2.5 py-1">输出：{run.outputTokens} tokens</span>}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-active p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-dark-400">推荐适配分</p>
              <div className="mt-1 text-4xl font-semibold text-primary">{recommendedPath?.fit_score ?? "--"}</div>
            </div>
            {recommendedPath && (
              <span className="rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-xs text-primary">
                {recommendedPath.probability_tone}
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold text-dark-100">前两年行动清单</h3>
            {actions.map((item) => (
              <p key={item} className="text-xs leading-6 text-dark-300">• {item}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InsightPanels({ output }: { output: FutureStructuredOutput }) {
  const qualityItems = buildQualityItems(output);
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <div className="rounded-lg border border-border bg-surface-elevated/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-dark-50">推演假设</h2>
          <span className="text-xs text-dark-500">{output.choice_context.assumptions?.length || 0} 条</span>
        </div>
        <ul className="mt-3 grid gap-2 text-xs leading-6 text-dark-300 sm:grid-cols-2">
          {(output.choice_context.assumptions || []).slice(0, 6).map((assumption) => (
            <li key={assumption} className="rounded-lg border border-border-subtle bg-surface-active px-3 py-2">
              {assumption}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated/70 p-4">
        <h2 className="text-sm font-semibold text-dark-50">质量检查</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {qualityItems.map((item) => (
            <div key={item.label} className="rounded-lg border border-border-subtle bg-surface-active p-3">
              <div className="text-[11px] text-dark-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-dark-100">{item.value}</div>
            </div>
          ))}
        </div>
        {output.validation && !output.validation.valid && (
          <div className="mt-3 space-y-1 text-xs leading-5 text-amber-300">
            {[...output.validation.errors, ...output.validation.warnings].slice(0, 3).map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ComparisonTable({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  const rows = [
    { label: "适合人群", get: (path: FuturePath) => path.branch_ref || path.probability_tone },
    { label: "收入", get: (path: FuturePath) => scoreText(path, "income") },
    { label: "稳定", get: (path: FuturePath) => scoreText(path, "stability") },
    { label: "成长", get: (path: FuturePath) => scoreText(path, "growth") },
    { label: "风险", get: (path: FuturePath) => scoreText(path, "risk") },
    { label: "最大风险", get: (path: FuturePath) => path.key_risks?.[0] || "未提供" },
    { label: "第一步", get: (path: FuturePath) => path.timeline?.[0]?.key_events?.[0] || path.timeline?.[0]?.stage || "未提供" },
  ];

  return (
    <section className="rounded-lg border border-border bg-surface-elevated/70 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-dark-50">路径对比</h2>
          <p className="mt-1 text-xs text-dark-400">先比较取舍，再展开细节。</p>
        </div>
        {recommendedPath && (
          <span className="hidden rounded-full border border-primary/40 bg-primary-soft px-2.5 py-1 text-xs text-primary sm:inline">
            推荐：{recommendedPath.label}
          </span>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr>
              <th className="w-24 border-b border-border-subtle px-3 py-2 text-dark-500">维度</th>
              {output.paths.map((path) => (
                <th
                  key={path.index}
                  className={`border-b border-border-subtle px-3 py-2 ${
                    path.index === recommendedPath?.index ? "text-primary" : "text-dark-100"
                  }`}
                >
                  {path.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-b border-border-subtle px-3 py-2 text-dark-500">{row.label}</td>
                {output.paths.map((path) => (
                  <td key={path.index} className="border-b border-border-subtle px-3 py-2 leading-5 text-dark-300">
                    {row.get(path)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BranchPlanStrip({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  if (!output.branch_plan || output.branch_plan.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface-elevated/70 p-4">
      <h2 className="text-sm font-semibold text-dark-50">分叉计划</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {output.branch_plan.map((branch) => {
          const isRecommended = recommendedPath?.branch_ref?.includes(branch.name);
          return (
            <a
              key={branch.index}
              href={`#path-${branch.index}`}
              className={`rounded-lg border p-3 transition hover:border-primary/40 hover:bg-primary/5 ${
                isRecommended
                  ? "border-primary/35 bg-primary-soft"
                  : "border-border-subtle bg-surface-active"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-dark-100">{branch.name}</h3>
                <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] text-primary">
                  {branch.riskTone}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-dark-300">{branch.focus}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PathCard({ path, isRecommended }: { path: FuturePath; isRecommended: boolean }) {
  const [expanded, setExpanded] = useState(isRecommended);

  return (
    <article
      id={`path-${path.index}`}
      className={`scroll-mt-20 rounded-lg border p-4 ${
        isRecommended
          ? "border-primary/40 bg-surface-elevated shadow-2xl shadow-black/20"
          : "border-border bg-surface-elevated/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-dark-50">{path.label}</h2>
            {isRecommended && (
              <span className="rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                推荐
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-dark-400">{path.tagline}</p>
          {path.branch_ref && <p className="mt-1 text-[11px] text-primary">分叉：{path.branch_ref}</p>}
        </div>
        <span className="shrink-0 rounded-full border border-primary/40 bg-primary-soft px-2 py-1 text-xs text-primary">
          {path.fit_score}
        </span>
      </div>

      <ScoreGrid path={path} />

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        {path.timeline.slice(0, 3).map((item) => (
          <div key={item.stage} className="rounded-lg border border-border-subtle bg-surface-active p-3">
            <h3 className="font-semibold text-primary">{item.stage}</h3>
            <p className="mt-1 line-clamp-2 leading-5 text-dark-300">{item.key_events?.[0] || clipText(item.text, 34)}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-4 w-full rounded-lg border border-border-subtle bg-surface-active px-3 py-2 text-xs font-medium text-dark-100 transition hover:border-primary/40 hover:text-primary"
      >
        {expanded ? "收起详情" : "展开时间线与建议"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {path.timeline.map((item) => (
            <div key={item.stage} className="border-l border-primary/40 pl-3">
              <h3 className="text-xs font-semibold text-primary">{item.stage}</h3>
              <p className="mt-1 text-xs leading-6 text-dark-300">{item.text}</p>
            </div>
          ))}

          <div className="rounded-lg border border-border-subtle bg-surface-active p-3">
            <h3 className="text-xs font-semibold text-dark-100">前两年行动建议</h3>
            <p className="mt-1 text-xs leading-6 text-dark-300">{path.advice}</p>
          </div>

          {path.key_risks.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-surface-active p-3">
              <h3 className="text-xs font-semibold text-dark-100">需要提前管理的风险</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {path.key_risks.map((risk) => (
                  <span key={risk} className="rounded-full border border-red-300/30 px-2 py-1 text-[11px] text-red-200">
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ScoreGrid({ path }: { path: FuturePath }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      {Object.entries(path.scores).map(([key, score]) => (
        <div key={key} className="rounded-lg border border-border-subtle bg-surface-active p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-dark-500">{scoreLabel(key)}</span>
            <span className="font-semibold text-dark-100">{score.value}/10</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, score.value * 10)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function findRecommendedPath(output: FutureStructuredOutput) {
  const balanced = output.comparison?.most_balanced || "";
  const matched = output.paths.find((path) => balanced.includes(path.label) || path.label.includes(balanced));
  if (matched) return matched;

  const balancedTone = output.paths
    .filter((path) => path.probability_tone === "均衡")
    .sort((a, b) => b.fit_score - a.fit_score)[0];
  if (balancedTone) return balancedTone;

  return [...output.paths].sort((a, b) => b.fit_score - a.fit_score)[0] || null;
}

function buildQualityItems(output: FutureStructuredOutput) {
  const validation = output.validation;
  const allTimelineComplete = output.paths.every((path) => path.timeline.length >= 3);
  const allRisksPresent = output.paths.every((path) => path.key_risks.length > 0);

  return [
    {
      label: "路径差异度",
      value: validation ? `${Math.round(validation.diversityScore * 100)}%` : "未记录",
    },
    {
      label: "结构完整",
      value: validation?.valid ? "通过" : "需复核",
    },
    {
      label: "时间线",
      value: allTimelineComplete ? "3 阶段完整" : "不完整",
    },
    {
      label: "风险覆盖",
      value: allRisksPresent ? "已覆盖" : "需补充",
    },
  ];
}

function extractActionItems(text: string) {
  const normalized = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const parts = normalized
    .split(/[。；;]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
  return (parts.length > 0 ? parts : [normalized]).slice(0, 3).map((item) => clipText(item, 52));
}

function scoreText(path: FuturePath, key: keyof FuturePath["scores"]) {
  const score = path.scores[key];
  if (!score) return "未提供";
  return `${score.value}/10 ${score.reason}`;
}

function clipText(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
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
