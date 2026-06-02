import { after } from "next/server";
import { NextResponse } from "next/server";
import { handleGenerateFutureRun, handleListFutureRuns, handleStartFutureRun } from "@/lib/future/server";
import type { FutureRunInput } from "@/lib/future/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as FutureRunInput;
    const result = await handleStartFutureRun(input);
    after(async () => {
      try {
        await handleGenerateFutureRun(result.runId, input);
      } catch {
        // Failure is persisted by handleGenerateFutureRun.
      }
    });
    return NextResponse.json({ runId: result.runId, status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "future generation failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("limit");
    const limit = raw ? Math.min(Math.max(parseInt(raw, 10) || 20, 1), 100) : 20;
    const items = await handleListFutureRuns({ limit });
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "list future runs failed" },
      { status: 500 },
    );
  }
}
