"use client";

import { Suspense, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ResultBlessing } from "@/components/GaokaoBlessing";
import { fetchFutureRunFromClient } from "@/lib/future/client";
import type { FuturePath, FutureRunResult, FutureStructuredOutput } from "@/lib/future/types";
import { FuturePanel, FutureShell } from "../FutureShell";
import { FutureLoading, FutureLoadingFallback } from "../FutureLoading";
import { TONE, RADAR_VIEW, toneOf, buildRadarPoints, type ToneKey } from "../_tone";
import { useGsapScrollReveal } from "@/lib/animation/useGsapScrollReveal";
import {
  findRecommendedPath,
  clipText,
  scoreLabel,
  extractActionItems,
} from "../_helpers";

const POLL_INTERVALS = [3000, 4000, 5000] as const;
const MAX_POLL_INDEX = POLL_INTERVALS.length - 1;
const MAX_WAIT_MS = 300_000;
const MAX_RETRIES = 2;

export default function FutureResultPage() {
  return (
    <Suspense fallback={<FutureLoadingFallback message="正在读取预演结果…" />}>
      <FutureResultContent />
    </Suspense>
  );
}

function FutureResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = searchParams.get("runId") || "";
  const [result, setResult] = useState<FutureRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [userSelectedMode, setUserSelectedMode] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }

    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pollIndex = 0;
    let retryCount = 0;
    const startTime = Date.now();

    async function load() {
      // 超时保护
      if (Date.now() - startTime > MAX_WAIT_MS) {
        if (!isCancelled) setError("等待时间过长，请刷新页面重试。");
        return;
      }

      try {
        const next = await fetchFutureRunFromClient(runId);
        if (isCancelled) return;
        setResult(next);
        setError(next.run.error || null);
        retryCount = 0; // 成功后重置重试计数
        if (next.run.status === "generating") {
          const interval = POLL_INTERVALS[Math.min(pollIndex, MAX_POLL_INDEX)];
          pollIndex++;
          timer = setTimeout(load, interval);
        }
      } catch (err) {
        if (isCancelled) return;
        // 瞬态错误自动重试（网络抖动、临时 5xx 等）
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const backoff = Math.min(1000 * Math.pow(2, retryCount), 8000);
          timer = setTimeout(load, backoff);
          return;
        }
        setError(err instanceof Error ? err.message : "读取预演结果失败");
      }
    }

    load();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  const handleCancel = useCallback(() => {
    setCancelled(true);
    router.push("/future");
  }, [router]);

  const handleTimeoutRefresh = useCallback(() => {
    setError(null);
    setResult(null);
    setCancelled(false);
    // 触发重新加载：通过重置 runId 依赖（用 key trick 或直接 reload）
    window.location.reload();
  }, []);

  const output = result?.output;
  const isGenerating = result?.run.status === "generating" && !cancelled;
  const displayError = runId ? error : "缺少 runId，无法读取预演结果。";
  const recommendedPath = output ? findRecommendedPath(output) : null;
  const initialPath = recommendedPath || output?.paths[0] || null;
  const [selectedMode, setSelectedMode] = useState(initialPath ? pathMode(initialPath.index) : "compare");
  const selectedPath = output && selectedMode !== "compare"
    ? output.paths.find((path) => selectedMode === pathMode(path.index)) || initialPath
    : null;
  const isComparisonMode = selectedMode === "compare";

  useEffect(() => {
    if (!initialPath || userSelectedMode) return;
    queueMicrotask(() => setSelectedMode(pathMode(initialPath.index)));
  }, [initialPath, userSelectedMode]);

  const handleModeSelect = useCallback((mode: string) => {
    setUserSelectedMode(true);
    setSelectedMode(mode);
  }, []);

  useGsapScrollReveal(scrollRootRef, [output?.paths.length, selectedMode, isGenerating]);

  return (
    <FutureShell
      title={output?.title || "大学四年预演结果"}
      backHref="/future"
      backLabel="重新预演"
      eyebrow={result?.run.promptVersion || "大学路线预演"}
      headerControls={
        output ? (
          <HeaderPathTabs
            paths={output.paths}
            selectedMode={selectedMode}
            recommendedPath={recommendedPath}
            onSelect={handleModeSelect}
          />
        ) : null
      }
      mainClassName="pb-8"
    >
      <div ref={scrollRootRef} className="space-y-4">
        {displayError && (
          <div className="rounded-lg border border-danger-300/40 bg-danger-soft p-4 text-sm text-danger">
            {displayError}
          </div>
        )}

        {!displayError && (!output || isGenerating) && (
          <FutureLoading
            message={isGenerating ? "正在预演大学四年路线" : "正在读取预演结果…"}
            generating={isGenerating}
            timeoutMs={180_000}
            maxWaitMs={MAX_WAIT_MS}
            onCancel={isGenerating ? handleCancel : undefined}
            onTimeout={handleTimeoutRefresh}
          />
        )}

        {output && (
          <motion.div
            className="space-y-4"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
            }}
          >
            <motion.div variants={panelFade}>
              <AnimatePresence mode="wait">
                {isComparisonMode ? (
                  <motion.div
                    key="compare"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <ComparisonPage output={output} recommendedPath={recommendedPath} />
                  </motion.div>
                ) : selectedPath ? (
                  <motion.div
                    key={selectedPath.index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    <DecisionSummary
                      output={output}
                      run={result?.run}
                      selectedPath={selectedPath}
                      recommendedPath={recommendedPath}
                    />
                    <SelectedPathDetail
                      path={selectedPath}
                      isRecommended={selectedPath.index === recommendedPath?.index}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </div>
    </FutureShell>
  );
}

function HeaderPathTabs({
  paths,
  selectedMode,
  recommendedPath,
  onSelect,
}: {
  paths: FuturePath[];
  selectedMode: string;
  recommendedPath: FuturePath | null;
  onSelect: (mode: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto" role="tablist" aria-label="大学路线">
      {paths.map((path) => {
        const mode = pathMode(path.index);
        const selected = selectedMode === mode;
        const isRecommended = path.index === recommendedPath?.index;
        const tone = toneOf(path);
        const toneCls = TONE[tone];
        return (
          <button
            key={path.index}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`path-panel-${path.index}`}
            onClick={() => onSelect(mode)}
            className={`flex min-w-[176px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
              selected
                ? `border-accent/50 bg-surface ${toneCls.ring} ring-1`
                : "border-border bg-surface-subtle hover:border-accent/35"
            }`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${toneCls.fg}`} />
                <span className="truncate text-xs font-semibold tracking-tight text-text">
                  {path.label}
                </span>
                {isRecommended && (
                  <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
                    推荐
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {path.probability_tone}
              </span>
            </span>
            <span className={`shrink-0 font-mono text-lg font-semibold tabular-nums ${toneCls.fg}`}>
              {path.fit_score}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={selectedMode === "compare"}
        aria-controls="path-panel-compare"
        onClick={() => onSelect("compare")}
        className={`flex min-w-[152px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
          selectedMode === "compare"
            ? "border-accent/50 bg-surface ring-1 ring-accent-300/45"
            : "border-border bg-surface-subtle hover:border-accent/35"
        }`}
      >
        <span>
          <span className="block text-xs font-semibold tracking-tight text-text">路线对比</span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
            COMPARE
          </span>
        </span>
        <span className="font-mono text-lg font-semibold text-accent-300">↔</span>
      </button>
    </div>
  );
}

function DecisionSummary({
  output,
  run,
  selectedPath,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  run: FutureRunResult["run"] | undefined;
  selectedPath: FuturePath | null;
  recommendedPath: FuturePath | null;
}) {
  const activePath = selectedPath || recommendedPath;
  const summary = clipText(output.summary, 150);
  const actions = extractActionItems(activePath?.advice || output.overall_advice);
  const reasons = activePath ? buildRecommendationReasons(activePath, output) : [];
  const tone: ToneKey = activePath ? toneOf(activePath) : "balanced";
  const toneCls = TONE[tone];

  return (
    <div data-scroll-reveal>
      <FuturePanel tone={tone} className="p-4 sm:p-5">
      <ResultBlessing />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.56fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            <span>{activePath?.index === recommendedPath?.index ? "建议先按这条走" : "当前查看"}</span>
            {recommendedPath && <span className="text-text-muted">优先路线：{recommendedPath.label}</span>}
            {run?.model && <span className="text-text-muted">{run.model}</span>}
          </div>
          <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-text">
            {activePath?.label || "先保留大学里的选择权"}
          </h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-text-secondary">{summary}</p>
          {reasons.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {reasons.map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-surface-subtle px-3 py-2">
                  <div className="text-[10px] font-medium text-text-muted">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface-subtle p-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            先确认这 3 件事
          </h3>
          <ul className="mt-2 space-y-1">
            {actions.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-5 text-text-secondary">
                <span aria-hidden className={`mt-2 h-1 w-1 shrink-0 rounded-full bg-current ${toneCls.fg}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </FuturePanel>
    </div>
  );
}

function SelectedPathDetail({
  path,
  isRecommended,
}: {
  path: FuturePath;
  isRecommended: boolean;
}) {
  const tone: ToneKey = toneOf(path);
  const toneCls = TONE[tone];
  const studentGuide = buildStudentGuide(path);

  return (
    <div data-scroll-reveal data-scroll-y="14">
      <FuturePanel
        tone={tone}
        className="p-4 sm:p-5"
        as="article"
      >
      <div
        id={`path-panel-${path.index}`}
        role="tabpanel"
        aria-label={path.label}
        className="grid gap-4 xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)]"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`path-${path.index}`} className="text-xl font-semibold tracking-tight text-text">
              {path.label}
            </h2>
            {isRecommended && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                推荐
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{path.tagline}</p>

          <div className="mt-4 grid gap-2">
            <GuideBlock label="适合谁" value={studentGuide.fit} toneCls={toneCls} />
            <GuideBlock label="大一大二要做什么" value={studentGuide.firstSteps} toneCls={toneCls} />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              为什么可能适合你
            </div>
            <div className="mt-2 grid gap-2">
              {(["school_fit", "major_fit", "happiness"] as const).map((key) => {
                const score = path.scores[key];
                if (!score) return null;
                return (
                  <div key={key} className="rounded-lg border border-border bg-surface-elevated p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-text">{scoreLabel(key)}</span>
                      <span className={`font-mono text-xs tabular-nums ${toneCls.fg}`}>
                        {score.value}/10
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-text-muted">{score.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <ScoreGrid path={path} />
        </div>

        <div className="space-y-4">
          <div data-scroll-reveal data-scroll-y="8" className="rounded-xl border border-border bg-surface-subtle p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              大学四年节奏
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {path.timeline.map((item, i) => (
                <div
                  key={item.stage}
                  data-scroll-reveal
                  data-scroll-y="10"
                  data-scroll-delay={String(Math.min(i * 0.06, 0.18))}
                >
                  <TimelineRow item={item} index={i} />
                </div>
              ))}
            </div>
          </div>

          <div data-scroll-reveal data-scroll-y="8" className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-danger-300/25 bg-danger-500/[0.05] p-3">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-danger-300">
                最容易踩的坑
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-danger-100">
                {(path.key_risks.length > 0 ? path.key_risks : ["暂未识别明确风险"]).map((risk) => (
                  <li key={risk} className="flex gap-1.5">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger-300" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                什么时候该换路
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-text-secondary">
                {(path.turning_points.length > 0 ? path.turning_points : ["等待更多信息确认"]).map((tp) => (
                  <li key={tp} className="flex gap-1.5">
                    <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                    <span>{tp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
      </FuturePanel>
    </div>
  );
}

function GuideBlock({
  label,
  value,
  toneCls,
}: {
  label: string;
  value: string;
  toneCls: (typeof TONE)[ToneKey];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-3">
      <div className={`font-mono text-[10px] uppercase tracking-wider ${toneCls.fg}`}>
        {label}
      </div>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{value}</p>
    </div>
  );
}

function ComparisonPage({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  return (
    <div data-scroll-reveal>
      <FuturePanel className="p-4 sm:p-5">
      <div id="path-panel-compare" className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            路线对比
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-text">几种大学走法怎么选</h2>
        </div>
        {recommendedPath && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            建议先看：{recommendedPath.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <ComparisonTableContent output={output} recommendedPath={recommendedPath} />
      </div>
      </FuturePanel>
    </div>
  );
}

function ComparisonTableContent({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  const rows: Array<{
    label: string;
    render: (path: FuturePath) => ReactNode;
  }> = [
    {
      label: "主要在做什么",
      render: (path) => path.tagline || path.branch_ref || path.probability_tone,
    },
    {
      label: "大一重点",
      render: (path) => buildStudentGuide(path).firstSteps,
    },
    ...(["income", "stability", "growth", "risk"] as const).map((key) => ({
      label: scoreLabel(key),
      render: (path: FuturePath) => <ScoreBar path={path} scoreKey={key} />,
    })),
    {
      label: "最大风险",
      render: (path) =>
        path.key_risks?.[0] ? (
          <span className="text-text-secondary">{path.key_risks[0]}</span>
        ) : (
          <span className="text-text-muted">未提供</span>
        ),
    },
    {
      label: "换路信号",
      render: (path) =>
        buildStudentGuide(path).switchSignal || path.turning_points?.[0] || (
          <span className="text-text-muted">未提供</span>
        ),
    },
  ];

  return <ComparisonGrid output={output} recommendedPath={recommendedPath} rows={rows} />;
}

function ComparisonGrid({
  output,
  recommendedPath,
  rows,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
  rows: Array<{
    label: string;
    render: (path: FuturePath) => ReactNode;
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            <th className="w-24 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              维度
            </th>
            {output.paths.map((path) => {
              const isRec = path.index === recommendedPath?.index;
              const tone = toneOf(path);
              return (
                <th
                  key={path.index}
                  className={`border-b border-border px-3 py-2 ${
                    isRec
                      ? "bg-primary/5 text-primary"
                      : "text-text"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${TONE[tone].fg}`} />
                    <span className="font-semibold tracking-tight">{path.label}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border-b border-border px-3 py-3 align-top font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {row.label}
              </td>
              {output.paths.map((path) => (
                <td
                  key={path.index}
                  className={`border-b border-border px-3 py-3 align-top leading-5 ${
                    path.index === recommendedPath?.index ? "bg-primary/5" : ""
                  }`}
                >
                  {row.render(path)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 单条分数条:在路线对比里以横向 bar + 数字呈现 */
function ScoreBar({ path, scoreKey }: { path: FuturePath; scoreKey: keyof FuturePath["scores"] }) {
  const tone = toneOf(path);
  const score = path.scores[scoreKey];
  const value = score?.value ?? 0;
  return (
    <div className="min-w-[140px]">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-mono tabular-nums text-text">
          {value}<span className="text-text-muted">/10</span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-900/5">
        <div
          className={`h-full ${TONE[tone].bg}`}
          style={{ width: `${value * 10}%`, background: "currentColor" }}
        />
      </div>
      {score?.reason && (
        <p className="mt-1 text-[10px] leading-4 text-text-muted line-clamp-2">{score.reason}</p>
      )}
    </div>
  );
}

function TimelineRow({ item, index }: { item: FuturePath["timeline"][number]; index: number }) {
  return (
    <div className="relative pl-4">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-accent/60 via-primary/30 to-transparent"
      />
      <span
        aria-hidden
        className="absolute left-[-3px] top-1 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_3px_rgba(37,111,143,0.16)]"
      />
      <div className="flex items-center gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent">
          {item.stage}
        </h3>
        <span className="font-mono text-[10px] text-text-muted">STEP {String(index + 1).padStart(2, "0")}</span>
      </div>
      <p className="mt-1 text-xs leading-6 text-text-secondary">{item.text}</p>
      {item.key_events && item.key_events.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] leading-5 text-text-muted">
          {item.key_events.map((ev) => (
            <li key={ev} className="flex gap-1.5">
              <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
              <span>{ev}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreGrid({ path }: { path: FuturePath }) {
  const tone = toneOf(path);
  const keys = Object.keys(path.scores) as Array<keyof FuturePath["scores"]>;
  const pts = buildRadarPoints(path);
  const { size, center: [cx, cy], radius } = RADAR_VIEW;
  const ringRadii = [0.25, 0.5, 0.75, 1].map(s => s * radius);

  return (
    <div className="mt-3 grid items-center gap-3 lg:grid-cols-[150px_minmax(0,1fr)]">
      {/* 雷达图(纯 SVG,无依赖) */}
      <div className="relative mx-auto w-full max-w-[150px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
          <defs>
            <radialGradient id={`rg-${path.index}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          {ringRadii.map((rr, i) => (
            <circle key={i} cx={cx} cy={cy} r={rr} fill="none"
                    stroke="currentColor" strokeOpacity={0.12}
                    strokeDasharray={i === 3 ? "0" : "2 3"} />
          ))}
          {keys.map((_, i) => {
            const ang = -Math.PI / 2 + (Math.PI * 2 * i) / keys.length;
            return <line key={i} x1={cx} y1={cy}
                         x2={cx + Math.cos(ang) * radius} y2={cy + Math.sin(ang) * radius}
                         stroke="currentColor" strokeOpacity={0.1} />;
          })}
          <polygon points={pts.map(p => p.join(",")).join(" ")}
                   fill={`url(#rg-${path.index})`} className={TONE[tone].fg} />
          <polygon points={pts.map(p => p.join(",")).join(" ")}
                   fill="none" stroke="currentColor" strokeWidth="1.5"
                   className={TONE[tone].fg} />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" className={`${TONE[tone].fg} fill-current`} />
          ))}
        </svg>
      </div>
      {/* 7 维并列条形 */}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {keys.map((k) => {
          const v = path.scores[k]?.value ?? 0;
          return (
            <li key={k} className="rounded-lg border border-border bg-surface-subtle p-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted">{scoreLabel(k)}</span>
                <span className="font-mono tabular-nums text-text">{v}/10</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-0/5">
                <div className={`h-full ${TONE[tone].bg}`}
                     style={{ width: `${v * 10}%`, background: "currentColor" }} />
              </div>
              <p className="mt-1 text-[10px] leading-4 text-text-muted line-clamp-1">
                {path.scores[k]?.reason}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 内联 findRecommendedPath / clipText / scoreLabel / extractActionItems
// 已抽出到 ../_helpers.ts,并修了两处边界 bug,见 _helpers.test.ts。

/** stagger reveal:每个子面板 y 12 → 0,opacity 0 → 1 */
const panelFade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function pathMode(index: number) {
  return `path-${index}`;
}

function buildRecommendationReasons(path: FuturePath, output: FutureStructuredOutput) {
  const topScores = (["school_fit", "major_fit", "stability", "growth", "happiness"] as const)
    .map((key) => ({ key, score: path.scores[key] }))
    .filter((item) => item.score?.reason)
    .sort((a, b) => (b.score?.value ?? 0) - (a.score?.value ?? 0))
    .slice(0, 2)
    .map((item) => ({
      label: scoreLabel(item.key),
      value: item.score.reason,
    }));

  const assumption = output.choice_context?.assumptions?.[0];
  return [
    ...topScores,
    assumption ? { label: "判断前提", value: clipText(assumption, 42) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function buildStudentGuide(path: FuturePath) {
  // firstSteps 优先从时间线推导，避免与 DecisionSummary 的 extractActionItems 重复
  const timelineFirst = path.timeline?.[0];
  const firstStepsFromTimeline = timelineFirst
    ? [timelineFirst.text, ...(timelineFirst.key_events ?? [])].filter(Boolean).join("；")
    : "";
  return {
    fit: path.tagline || "适合想先看清这条志愿后续走法的学生。",
    firstSteps:
      firstStepsFromTimeline ||
      "大一大二先把基础课、绩点和一次真实体验做起来。",
    pitfall:
      path.key_risks?.[0] || "只凭想象判断专业，不去验证课程和就业真实情况。",
    switchSignal:
      path.turning_points?.[0] || "如果大一结束后兴趣很低、课程吃力或拿不到有效反馈，就要考虑调整路线。",
  };
}
