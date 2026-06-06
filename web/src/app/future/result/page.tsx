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
  const alternatePaths = output
    ? output.paths.filter((path) => path.index !== recommendedPath?.index)
    : [];

  return (
    <FutureShell
      title={output?.title || "未来路径推演结果"}
      subtitle="先看推荐结论和路径对比，再展开每条路径的时间线、风险和行动建议。"
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
              <InsightPanels output={output} />
            </motion.div>
            <motion.div variants={panelFade}>
              <ComparisonTable output={output} recommendedPath={recommendedPath} />
            </motion.div>
            {output.branch_plan && output.branch_plan.length > 0 && (
              <motion.div variants={panelFade}>
                <BranchPlanStrip output={output} recommendedPath={recommendedPath} />
              </motion.div>
            )}
            <motion.section
              variants={panelFade}
              className="space-y-3"
            >
              {recommendedPath && (
                <PathCard
                  path={recommendedPath}
                  isRecommended
                />
              )}
              {alternatePaths.length > 0 && (
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  {alternatePaths.map((path) => (
                    <PathCard key={path.index} path={path} isRecommended={false} />
                  ))}
                </div>
              )}
            </motion.section>
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
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {run?.model && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">模型：{run.model}</span>}
            {run?.promptVersion && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">Prompt：{run.promptVersion}</span>}
            {typeof run?.inputTokens === "number" && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">输入：{run.inputTokens} tok</span>}
            {typeof run?.outputTokens === "number" && <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-text-muted">输出：{run.outputTokens} tok</span>}
          </div>
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

function InsightPanels({ output }: { output: FutureStructuredOutput }) {
  const qualityItems = buildQualityItems(output);
  const assumptionCount = output.choice_context.assumptions?.length || 0;
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <FuturePanel className="p-5">
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
      </FuturePanel>

      <FuturePanel className="p-5">
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
      </FuturePanel>
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

  return (
    <FuturePanel className="p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            路径对比
          </div>
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-text">取舍一览</h2>
          <p className="mt-1 max-w-prose text-xs leading-5 text-text-muted">
            先比较取舍，再展开细节。
          </p>
        </div>
        {recommendedPath && (
          <span className="hidden rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary sm:inline">
            推荐：{recommendedPath.label}
          </span>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
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
    </FuturePanel>
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

function BranchPlanStrip({
  output,
  recommendedPath,
}: {
  output: FutureStructuredOutput;
  recommendedPath: FuturePath | null;
}) {
  if (!output.branch_plan || output.branch_plan.length === 0) return null;

  return (
    <FuturePanel className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
        分叉计划
      </div>
      <h2 className="mt-1 text-sm font-semibold tracking-tight text-text">三条路径怎么选</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {output.branch_plan.map((branch) => {
          const isRecommended = !!recommendedPath?.branch_ref?.includes(branch.name);
          const tone: ToneKey =
            branch.riskTone === "稳健"
              ? "steady"
              : branch.riskTone === "冒险"
                ? "risky"
                : "balanced";
          const toneCls = TONE[tone];
          return (
            <a
              key={branch.index}
              href={`#path-${branch.index}`}
              className={`group relative overflow-hidden rounded-xl border p-4 transition duration-200 hover:-translate-y-0.5 ${
                isRecommended
                  ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/30"
                  : "border-border bg-surface-subtle hover:border-accent/40"
              }`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/70 to-transparent"
              />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-tight text-text">
                  {branch.name}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 ${toneCls.bg} ${toneCls.fg} ${toneCls.ring}`}
                >
                  {branch.riskTone}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-text-secondary">{branch.focus}</p>
              {branch.requiredTradeoffs && branch.requiredTradeoffs.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-2 text-[11px] leading-5 text-text-muted">
                  {branch.requiredTradeoffs.slice(0, 2).map((t) => (
                    <li key={t} className="flex gap-1.5">
                      <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
              <span
                className={`mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  isRecommended ? "text-primary" : "text-text-muted group-hover:text-accent"
                }`}
              >
                展开
                <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
              </span>
            </a>
          );
        })}
      </div>
    </FuturePanel>
  );
}

function PathCard({ path, isRecommended }: { path: FuturePath; isRecommended: boolean }) {
  const [expanded, setExpanded] = useState(isRecommended);
  const tone: ToneKey = toneOf(path);
  const toneCls = TONE[tone];

  return (
    <article
      id={`path-${path.index}`}
      className={`group/path scroll-mt-20 overflow-hidden rounded-2xl border p-4 transition duration-200 sm:p-5 ${
        isRecommended
          ? "border-accent/40 bg-surface-elevated ring-1 ring-accent/30"
          : "border-border bg-surface-elevated hover:border-accent/30 hover:-translate-y-0.5"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/70 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-text">{path.label}</h2>
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
          <p className="mt-1 text-xs leading-5 text-text-secondary">{path.tagline}</p>
          {path.branch_ref && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
              分叉：{path.branch_ref}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            FIT
          </div>
          <div className={`text-2xl font-semibold tabular-nums ${toneCls.fg}`}>
            {path.fit_score}
          </div>
        </div>
      </div>

      <ScoreGrid path={path} />

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        {path.timeline.slice(0, 3).map((item) => (
          <div
            key={item.stage}
            className="rounded-xl border border-border bg-surface-subtle p-3"
          >
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent">
              {item.stage}
            </h3>
            <p className="mt-1 line-clamp-2 leading-5 text-text-secondary">
              {item.key_events?.[0] || clipText(item.text, 34)}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent"
      >
        {expanded ? "收起详情" : "展开时间线与建议"}
        <span
          aria-hidden
          className={`transition-transform ${expanded ? "rotate-90" : "rotate-0"}`}
        >
          ›
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
              {path.timeline.map((item, i) => (
                <TimelineRow key={item.stage} item={item} index={i} />
              ))}

              <div className="rounded-xl border border-border bg-surface-subtle p-3">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-accent">
                  前两年行动建议
                </h3>
                <p className="mt-1 text-xs leading-6 text-text-secondary">{path.advice}</p>
              </div>

              {path.key_risks.length > 0 && (
                <div className="rounded-xl border border-danger-300/25 bg-danger-500/[0.05] p-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-wider text-danger-300">
                    需要提前管理的风险
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {path.key_risks.map((risk) => (
                      <span
                        key={risk}
                        className="rounded-full border border-danger-300/30 bg-danger-500/10 px-2 py-1 text-[11px] text-danger-200"
                      >
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {path.turning_points.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-subtle p-3">
                  <h3 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    关键转折点
                  </h3>
                  <ul className="mt-2 space-y-1 text-[11px] leading-5 text-text-secondary">
                    {path.turning_points.map((tp) => (
                      <li key={tp} className="flex gap-1.5">
                        <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                        <span>{tp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
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

function scoreText(path: FuturePath, key: keyof FuturePath["scores"]) {
  const score = path.scores[key];
  if (!score) return "未提供";
  return `${score.value}/10 ${score.reason}`;
}
