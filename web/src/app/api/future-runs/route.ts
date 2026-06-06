import { after } from "next/server";
import { NextResponse } from "next/server";
import { handleGenerateFutureRun, handleListFutureRuns, handleStartFutureRun } from "@/lib/future/server";
import { createLogger } from "@/lib/future/logger";
import type { FutureRunInput } from "@/lib/future/types";

const log = createLogger("route");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as FutureRunInput;
    log.info({ pathCount: input.pathCount, school: input.choiceContext.school }, "POST /api/future-runs");
    const result = await handleStartFutureRun(input);
    log.info({ runId: result.runId, status: result.status }, "Background generation started");
    after(async () => {
      try {
        await handleGenerateFutureRun(result.runId, input);
        log.info({ runId: result.runId }, "Background generation completed successfully");
      } catch (error) {
        log.error({
          runId: result.runId,
          err: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }, "Background generation FAILED -- error was swallowed in after()");
      }
    });
    return NextResponse.json({ runId: result.runId, status: result.status });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "POST /api/future-runs error");
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
    log.debug({ limit, count: items.length }, "GET /api/future-runs list");
    return NextResponse.json({ items });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "GET /api/future-runs error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "list future runs failed" },
      { status: 500 },
    );
  }
}
