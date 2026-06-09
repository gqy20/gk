import { NextResponse } from "next/server";
import { handleCreateSimulatorSession } from "@/lib/future/simulator-server";
import { createLogger } from "@/lib/future/logger";
import type { SimulateStartInput } from "@/lib/future/simulator-types";

const log = createLogger("simulator:route");

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const input = (await request.json()) as SimulateStartInput;
    log.info({ school: input.profile.school }, "POST /api/simulator — create session");
    const session = await handleCreateSimulatorSession(input);
    log.info({ sessionId: session.sessionId, elapsed: Date.now() - t0 }, "POST /api/simulator — done");
    return NextResponse.json(session);
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error), elapsed: Date.now() - t0 }, "POST /api/simulator error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create simulator session" },
      { status: 500 },
    );
  }
}
