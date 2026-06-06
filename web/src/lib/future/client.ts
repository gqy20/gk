import type { FutureRunInput, FutureRunListItem, FutureRunResult } from "./types";

export class FutureApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FutureApiError";
  }
}

// 前端轻量日志（不引入 pino 避免增大 bundle）
const DEV = process.env.NODE_ENV === "development";
const clog = {
  debug: (...args: unknown[]) => { if (DEV) console.debug("[future:client]", ...args); },
  info:  (...args: unknown[]) => { if (DEV) console.info("[future:client]", ...args); },
  warn:  (...args: unknown[]) => console.warn("[future:client]", ...args),
  error: (...args: unknown[]) => console.error("[future:client]", ...args),
};

// ── 轮询配置常量 ────────────────────────────────────────
/** 阶梯退避间隔（ms）：3s → 4s → 5s → 5s 上限 */
const POLL_INTERVALS = [3000, 4000, 5000] as const;
/** 瞬态错误最大自动重试次数 */
const MAX_RETRIES = 2;
/** 默认最大等待时间（ms） */
const DEFAULT_MAX_WAIT_MS = 300_000; // 5 分钟

export function getFutureApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_FUTURE_API_BASE_URL || "").replace(/\/+$/, "");
}

function futureApiUrl(path: string) {
  const baseUrl = getFutureApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

export async function createFutureRunFromClient(input: FutureRunInput) {
  clog.info("POST /api/future-runs", { pathCount: input.pathCount, school: input.choiceContext.school });
  const res = await fetch(futureApiUrl("/api/future-runs"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errText = await res.text();
    clog.warn("POST /api/future-runs failed", { status: res.status, error: errText.slice(0, 200) });
    throw new FutureApiError(errText);
  }

  const data = (await res.json()) as { runId: string; status: string };
  clog.info("POST /api/future-runs ok", { runId: data.runId, status: data.status });
  return data;
}

export async function fetchFutureRunFromClient(runId: string) {
  clog.debug("GET /api/future-runs/:runId", { runId });
  const res = await fetch(futureApiUrl(`/api/future-runs/${encodeURIComponent(runId)}`));
  if (!res.ok) {
    clog.warn("GET /api/future-runs/:runId failed", { runId, status: res.status });
    throw new FutureApiError(await res.text());
  }
  return res.json() as Promise<FutureRunResult>;
}

export async function fetchFutureRunsFromClient(opts: { limit?: number } = {}) {
  const qs = opts.limit ? `?limit=${encodeURIComponent(String(opts.limit))}` : "";
  clog.debug("GET /api/future-runs list", { limit: opts.limit });
  const res = await fetch(futureApiUrl(`/api/future-runs${qs}`));
  if (!res.ok) {
    clog.warn("GET /api/future-runs list failed", { status: res.status });
    throw new FutureApiError(await res.text());
  }
  const data = (await res.json()) as { items?: FutureRunListItem[] };
  clog.debug("GET /api/future-runs list ok", { count: data.items?.length ?? 0 });
  return data.items ?? [];
}

// ── 可复用的轮询工具 ────────────────────────────────────

export interface PollOptions {
  /** 轮询间隔序列（ms），默认 [3000, 4000, 5000] */
  intervals?: readonly number[];
  /** 瞬态错误最大重试次数，默认 2 */
  maxRetries?: number;
  /** 最大等待时间（ms），默认 300000 (5min) */
  maxWaitMs?: number;
  /** 每次轮询回调（用于更新 UI 状态） */
  onPoll?: (result: FutureRunResult) => void;
  /** 取消信号 */
  signal?: AbortSignal;
}

/**
 * 智能轮询：阶梯退避 + 瞬态错误重试 + 超时保护
 *
 * @example
 * ```ts
 * const result = await pollFutureRunUntilDone("run_xxx", {
 *   onPoll: (r) => console.log("status:", r.run.status),
 *   signal: abortController.signal,
 * });
 * ```
 */
export async function pollFutureRunUntilDone(
  runId: string,
  opts: PollOptions = {},
): Promise<FutureRunResult> {
  const {
    intervals = POLL_INTERVALS,
    maxRetries = MAX_RETRIES,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    onPoll,
    signal,
  } = opts;

  let pollIndex = 0;
  let retryCount = 0;
  const startTime = Date.now();
  const maxIndex = intervals.length - 1;

  while (true) {
    // 检查取消信号
    if (signal?.aborted) {
      throw new FutureApiError("轮询已取消");
    }

    // 超时保护
    if (Date.now() - startTime > maxWaitMs) {
      throw new FutureApiError(`轮询超时（>${Math.round(maxWaitMs / 1000)}s）`);
    }

    try {
      const result = await fetchFutureRunFromClient(runId);
      onPoll?.(result);
      retryCount = 0; // 成功后重置重试计数

      // 非生成状态 → 返回结果
      if (result.run.status !== "generating") {
        return result;
      }

      // 继续轮询：取当前间隔（不超过最大值）
      const interval = intervals[Math.min(pollIndex, maxIndex)];
      pollIndex++;
      clog.debug("poll: continue", { runId, nextInterval: interval, pollIndex });
      await sleep(interval, signal);
    } catch (err) {
      // 取消信号导致的错误直接抛出
      if (signal?.aborted || err instanceof FutureApiError && err.message === "轮询已取消") {
        throw err;
      }

      // 瞬态错误自动重试
      if (retryCount < maxRetries) {
        retryCount++;
        const backoff = Math.min(1000 * Math.pow(2, retryCount), 8000);
        clog.warn("poll: transient error, retrying", { runId, retryCount, backoff, error: String(err) });
        await sleep(backoff, signal);
        continue;
      }

      // 重试耗尽，抛出错误
      throw err;
    }
  }
}

/** 可中断的 sleep 工具 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
