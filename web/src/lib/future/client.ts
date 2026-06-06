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

  const data = await res.json() as Promise<{ runId: string; status: string }>;
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
