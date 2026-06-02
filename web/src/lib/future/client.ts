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

function futureApiUrl(path: string) {
  const baseUrl = getFutureApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

export async function createFutureRunFromClient(input: FutureRunInput) {
  const res = await fetch(futureApiUrl("/api/future-runs"), {
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
  const res = await fetch(futureApiUrl(`/api/future-runs/${encodeURIComponent(runId)}`));
  if (!res.ok) {
    throw new FutureApiError(await res.text());
  }

  return res.json() as Promise<FutureRunResult>;
}
