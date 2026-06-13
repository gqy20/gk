import { NextResponse } from "next/server";
import { handleCreateShare } from "@/lib/future/simulator-server";
import { createLogger } from "@/lib/future/logger";

const log = createLogger("simulator:share-route");

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      school?: string;
      major?: string;
      ending?: Record<string, unknown>;
    };

    if (!body.sessionId?.trim()) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!body.school?.trim()) {
      return NextResponse.json({ error: "school is required" }, { status: 400 });
    }
    if (!body.ending || typeof body.ending !== "object") {
      return NextResponse.json({ error: "ending is required" }, { status: 400 });
    }

    const result = await handleCreateShare({
      sessionId: body.sessionId,
      school: body.school,
      major: body.major,
      ending: body.ending,
    });

    log.info({ shareId: result.shareId, sessionId: body.sessionId, elapsed: Date.now() - t0 }, "Share created");
    return NextResponse.json(result);
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error.message : String(error), elapsed: Date.now() - t0 },
      "Share creation error",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create share" },
      { status: 500 },
    );
  }
}
