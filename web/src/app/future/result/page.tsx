"use client";

import { Suspense, useEffect, useState, useCallback, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { fetchFutureRunFromClient } from "@/lib/future/client";
import type { FuturePath, FutureRunResult, FutureStructuredOutput } from "@/lib/future/types";
import { FuturePanel, FutureShell } from "../FutureShell";
import { FutureLoading, FutureLoadingFallback } from "../FutureLoading";
import { TONE, RADAR_VIEW, toneOf, buildRadarPoints, type ToneKey } from "../_tone";
import {
  findRecommendedPath,
  clipText,
  scoreLabel,
  buildQualityItems,
  extractActionItems,
} from "../_helpers";

export default function FutureResultPage() {
  return (
    <Suspense fallback={<FutureLoadingFallback message="正在读取推演结果…" />}>
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

  // 阶梯退避：3s → 4s → 5s → 5s 上限
  const POLL_INTERVALS = [3000, 4000, 5000];
  const MAX_POLL_INDEX = POLL_INTERVALS.length - 1;
  const MAX_WAIT_MS = 300_000; // 5 分钟超时保护
  const MAX_RETRIES = 2; // 瞬态错误自动重试次数

  useEffect(() => {
    if (!runId) {
      setError("缺少 runId，无法读取推演结果。");
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
        setError(err instanceof Error ? err.message : "读取推演结果失败");
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
  const recommendedPath = output ? findRecommendedPath(output) : null;

  return (
    <FutureShell
      title={output?.title || "未来路径推演结果"}
      subtitle="先确定推荐方向，再在三条路径之间切换查看。对比和推演依据放在辅助区。"
      backHref="/future"
      backLabel="新推演"
      eyebrow={result?.run.promptVersion || "结构化推演结果"}
    >
        {error && (
          <div className="rounded-lg border border-danger-300/40 bg-danger-soft p-4 text-sm text-danger">
            {error}
          </div>
        )}

        {!error && (!output || isGenerating) && (
          <FutureLoading
            message={isGenerating ? "正在推演未来路径" : "正在读取推演结果…"}
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
              <DecisionHero output={output} run={result?.run} recommendedPath={recommendedPath} />
            </motion.div>
            <motion.div variants={panelFade}>
              <PathDecisionStage output={output} recommendedPath={recommendedPath} />
            </motion.div>
            <motion.div variants={panelFade}>
              <SupportSections output={output} run={result?.run} recommendedPath={recommendedPath} />
            </motion.div>
          </motion.div>
        )}
    </FutureShell>
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
  const tone: ToneKey = recommendedPath ? toneOf(recommendedPath) : "balanced";
  const toneCls = TONE[tone];

  return (
    <FuturePanel tone={tone} className="p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            <span>推荐结论</span>
            <span aria-hidden className="h-px w-6 bg-accent/40" />
            {recommendedPath && (
              <span className="text-text-muted">FIT {recommendedPath.fit_score}/10</span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-text sm:text-3xl">
            {recommendedPath?.label || "先保留三条路径的选择权"}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{summary}</p>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-text-muted">{adviceIntro}</p>
          {run?.model && (
            <div className="mt-4 inline-flex rounded-full border border-border bg-surface-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {run.model}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface-subtle p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">推荐适配分</p>
              <div className={`mt-1 text-5xl font-semibold tabular-nums ${toneCls.fg}`}>
                {recommendedPath?.fit_score ?? "--"}
              </div>
            </div>
            {recommendedPath && (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ${toneCls.bg} ${toneCls.fg} ${toneCls.ring}`}
              >
                {recommendedPath.probability_tone}
              </span>
            )}
          </div>
          <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              前两年行动清单
            </h3>
            <ul className="space-y-1.5">
              {actions.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-6 text-text-secondary">
                  <span
                    aria-hidden
                    className={`mt-2 h-1 w-1 shrink-0 rounded-full bg-current ${toneCls.fg}`}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </FuturePanel>
  );
}

function PathDecisionStage({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  const initialPath = recommendedPath || output.paths[0] || null;
  const [selectedIndex, setSelectedIndex] = useState(initialPath?.index ?? 0);
  const selectedPath =
    output.paths.find((path) => path.index === selectedIndex) || initialPath;

  if (!selectedPath) return null;

  return (
    <section className="space-y-4">
      <FuturePanel className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              三条未来路径
            </div>
            <h2 className="mt-1 text-sm font-semibold tracking-tight text-text">
              选择一条路径查看完整推演
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-text-muted">
            当前只展开一条路径，避免三份时间线和建议互相挤压。
          </p>
        </div>

        <div
          className="mt-4 grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]"
          role="tablist"
          aria-label="未来路径"
        >
          {output.paths.map((path) => (
            <PathOptionCard
              key={path.index}
              path={path}
              selected={path.index === selectedPath.index}
              isRecommended={path.index === recommendedPath?.index}
              onSelect={() => setSelectedIndex(path.index)}
            />
          ))}
        </div>
      </FuturePanel>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedPath.index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <SelectedPathDetail
            path={selectedPath}
            isRecommended={selectedPath.index === recommendedPath?.index}
          />
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function PathOptionCard({
  path,
  selected,
  isRecommended,
  onSelect,
}: {
  path: FuturePath;
  selected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}) {
  const tone = toneOf(path);
  const toneCls = TONE[tone];
  const mainRisk = path.key_risks?.[0] || "风险待观察";
  const mainStrength = bestScoreLabel(path);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`path-panel-${path.index}`}
      onClick={onSelect}
      className={`group relative min-h-[190px] overflow-hidden rounded-xl border p-4 text-left transition duration-200 ${
        selected
          ? `border-accent/50 bg-surface-elevated ${toneCls.ring} ring-1`
          : "border-border bg-surface-subtle hover:-translate-y-0.5 hover:border-accent/35"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-0.5 bg-current ${selected ? toneCls.fg : "text-border"}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-text">{path.label}</h3>
            {isRecommended && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                推荐
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-secondary">
            {path.tagline}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            FIT
          </div>
          <div className={`text-3xl font-semibold tabular-nums ${toneCls.fg}`}>
            {path.fit_score}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 ${toneCls.bg} ${toneCls.fg} ${toneCls.ring}`}
        >
          {path.probability_tone}
        </span>
        {path.branch_ref && (
          <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {path.branch_ref}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 border-t border-border/60 pt-3 text-[11px] leading-5">
        <div>
          <span className="font-mono uppercase tracking-wider text-text-muted">优势</span>
          <p className="mt-0.5 text-text-secondary">{mainStrength}</p>
        </div>
        <div>
          <span className="font-mono uppercase tracking-wider text-text-muted">风险</span>
          <p className="mt-0.5 line-clamp-1 text-text-secondary">{mainRisk}</p>
        </div>
      </div>
    </button>
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
  const actionItems = extractActionItems(path.advice);

  return (
    <FuturePanel
      tone={tone}
      className="p-5 sm:p-6"
      as="article"
    >
      <div
        id={`path-panel-${path.index}`}
        role="tabpanel"
        aria-label={path.label}
        className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`path-${path.index}`} className="text-2xl font-semibold tracking-tight text-text">
              {path.label}
            </h2>
            {isRecommended && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                推荐
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 ${toneCls.bg} ${toneCls.fg} ${toneCls.ring}`}
            >
              {path.probability_tone}
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-text-secondary">{path.tagline}</p>

          <div className="mt-5 rounded-xl border border-border bg-surface-subtle p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              适合你，因为
            </div>
            <div className="mt-3 grid gap-2">
              {(["school_fit", "major_fit", "happiness"] as const).map((key) => {
                const score = path.scores[key];
                if (!score) return null;
                return (
                  <div key={key} className="rounded-lg border border-border bg-surface-elevated p-3">
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
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              未来节奏
            </div>
            <div className="mt-4 space-y-4">
              {path.timeline.map((item, i) => (
                <TimelineRow key={item.stage} item={item} index={i} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-danger-300/25 bg-danger-500/[0.05] p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-danger-300">
                需要警惕
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

            <div className="rounded-xl border border-border bg-surface-subtle p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                关键转折点
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

          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent">
              下一步
            </h3>
            <ul className="mt-2 space-y-1.5">
              {actionItems.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-6 text-text-secondary">
                  <span aria-hidden className={`mt-2 h-1 w-1 shrink-0 rounded-full bg-current ${toneCls.fg}`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </FuturePanel>
  );
}

function SupportSections({
  output,
  run,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  run: FutureRunResult["run"] | undefined;
  recommendedPath: FuturePath | null;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DisclosurePanel title="对比三条路径" kicker="路径对比" defaultOpen={false}>
        <ComparisonTableContent output={output} recommendedPath={recommendedPath} />
      </DisclosurePanel>
      <DisclosurePanel title="推演依据" kicker="依据与质量" defaultOpen={false}>
        <InsightPanels output={output} run={run} />
      </DisclosurePanel>
    </div>
  );
}

function DisclosurePanel({
  title,
  kicker,
  children,
  defaultOpen = false,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <FuturePanel className="p-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
      >
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            {kicker}
          </span>
          <span className="mt-1 block text-sm font-semibold tracking-tight text-text">
            {title}
          </span>
        </span>
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-text-muted transition ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 p-4 sm:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </FuturePanel>
  );
}

function InsightPanels({
  output,
  run,
}: {
  output: FutureStructuredOutput;
  run: FutureRunResult["run"] | undefined;
}) {
  const qualityItems = buildQualityItems(output);
  const assumptionCount = output.choice_context.assumptions?.length || 0;
  return (
    <section className="grid gap-3">
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              推演假设
            </div>
            <h2 className="mt-1 text-sm font-semibold tracking-tight text-text">前置条件</h2>
          </div>
          <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {assumptionCount} 条
          </span>
        </div>
        <ul className="mt-3 grid gap-2 text-xs leading-6 text-text-secondary sm:grid-cols-2">
          {(output.choice_context.assumptions || []).slice(0, 6).map((assumption) => (
            <li
              key={assumption}
              className="rounded-lg border border-border bg-surface-subtle px-3 py-2"
            >
              {assumption}
            </li>
          ))}
          {assumptionCount === 0 && (
            <li className="rounded-lg border border-dashed border-border bg-surface-subtle px-3 py-2 text-text-muted">
              未提供前置条件
            </li>
          )}
        </ul>
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          质量检查
        </div>
        <h2 className="mt-1 text-sm font-semibold tracking-tight text-text">结构化指标</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {qualityItems.map((item) => {
            // 绿=通过,金=待复核,红=缺失
            const passLike = item.value === "通过" || item.value === "已覆盖" || item.value === "3 阶段完整";
            const warnLike = item.value === "需复核" || item.value === "需补充" || item.value === "不完整";
            const accent = passLike
              ? "text-brand-300"
              : warnLike
                ? "text-warning"
                : "text-text";
            return (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-surface-subtle p-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {item.label}
                </div>
                <div className={`mt-1 text-sm font-semibold tabular-nums ${accent}`}>
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
        {output.validation && !output.validation.valid && (
          <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs leading-5 text-warning">
            {[...output.validation.errors, ...output.validation.warnings].slice(0, 3).map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3 text-[11px]">
        {run?.promptVersion && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">Prompt：{run.promptVersion}</span>}
        {typeof run?.inputTokens === "number" && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">输入：{run.inputTokens} tok</span>}
        {typeof run?.outputTokens === "number" && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">输出：{run.outputTokens} tok</span>}
      </div>
    </section>
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
      label: "适合人群",
      render: (path) => path.branch_ref || path.probability_tone,
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
      label: "第一步",
      render: (path) =>
        path.timeline?.[0]?.key_events?.[0] || path.timeline?.[0]?.stage || (
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

/** 单条分数条:在路径对比里以横向 bar + 数字呈现 */
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
    <div className="mt-3 grid items-center gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* 雷达图(纯 SVG,无依赖) */}
      <div className="relative mx-auto w-full max-w-[220px]">
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
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {keys.map((k) => {
          const v = path.scores[k]?.value ?? 0;
          return (
            <li key={k} className="rounded-lg border border-border bg-surface-subtle p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted">{scoreLabel(k)}</span>
                <span className="font-mono tabular-nums text-text">{v}/10</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-0/5">
                <div className={`h-full ${TONE[tone].bg}`}
                     style={{ width: `${v * 10}%`, background: "currentColor" }} />
              </div>
              <p className="mt-1 text-[10px] leading-4 text-text-muted line-clamp-2">
                {path.scores[k]?.reason}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 内联 findRecommendedPath / clipText / scoreLabel / buildQualityItems / extractActionItems
// 已抽出到 ../_helpers.ts,并修了两处边界 bug,见 _helpers.test.ts。

/** stagger reveal:每个子面板 y 12 → 0,opacity 0 → 1 */
const panelFade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function bestScoreLabel(path: FuturePath) {
  const entries = Object.entries(path.scores) as Array<[keyof FuturePath["scores"], FuturePath["scores"][keyof FuturePath["scores"]]]>;
  const [key, score] = entries
    .filter(([, item]) => item)
    .sort((a, b) => b[1].value - a[1].value)[0] || ["growth", null];
  if (!score) return "优势待观察";
  return `${scoreLabel(key)} ${score.value}/10`;
}
