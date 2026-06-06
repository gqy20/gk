import { NextResponse } from "next/server";
import { handleGetFutureRun } from "@/lib/future/server";
import { createLogger } from "@/lib/future/logger";

const log = createLogger("route");

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    log.debug({ runId }, "GET /api/future-runs/:runId");
    const result = await handleGetFutureRun(runId);
    if (!result) {
      log.warn({ runId }, "GET /api/future-runs/:runId → 404 not found");
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    log.debug({ runId, status: result.run.status }, "GET /api/future-runs/:runId → 200");
    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "GET /api/future-runs/:runId error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "future result lookup failed" },
      { status: 500 },
    );
  }
}
