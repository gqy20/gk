import type { FutureRunInput, FutureRunResult } from "./types";

export class FutureApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FutureApiError";
  }
}

export function getFutureApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_FUTURE_API_BASE_URL || "").replace(/\/+$/, "");
}

export async function createFutureRunFromClient(input: FutureRunInput) {
  const baseUrl = getFutureApiBaseUrl();
  if (!baseUrl) {
    throw new FutureApiError("尚未配置 NEXT_PUBLIC_FUTURE_API_BASE_URL，无法调用 LLM 推演服务。");
  }

  const res = await fetch(`${baseUrl}/api/future-runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new FutureApiError(await res.text());
  }

  return res.json() as Promise<{ runId: string; status: string }>;
}

export async function fetchFutureRunFromClient(runId: string) {
  const baseUrl = getFutureApiBaseUrl();
  if (!baseUrl) {
    throw new FutureApiError("尚未配置 NEXT_PUBLIC_FUTURE_API_BASE_URL，无法读取推演结果。");
  }

  const res = await fetch(`${baseUrl}/api/future-runs/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    throw new FutureApiError(await res.text());
  }

  return res.json() as Promise<FutureRunResult>;
}
