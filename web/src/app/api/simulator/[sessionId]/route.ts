import { NextResponse } from "next/server";
import { handleGetSimulatorSession, handleSimulateStep } from "@/lib/future/simulator-server";
import { createLogger } from "@/lib/future/logger";

const log = createLogger("simulator:step-route");

export const runtime = "nodejs";
export const maxDuration = 120;

/** 获取会话状态 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await handleGetSimulatorSession(sessionId);
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session not found" },
      { status: 404 },
    );
  }
}

/** 提交选择 → 推演下一步 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { choiceId: string };

    if (!body.choiceId?.trim()) {
      return NextResponse.json({ error: "choiceId is required" }, { status: 400 });
    }

    log.info({ sessionId, choiceId: body.choiceId }, "POST step");
    const result = await handleSimulateStep(sessionId, body.choiceId);
    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "POST step error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation step failed" },
      { status: 500 },
    );
  }
}
