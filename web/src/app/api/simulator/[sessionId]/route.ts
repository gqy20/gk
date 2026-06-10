import { NextResponse } from "next/server";
import {
  handleGetSimulatorSession,
  handleSimulateStep,
  handleSimulateStepStream,
} from "@/lib/future/simulator-server";
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

/** 提交选择 → 推演下一步（支持流式和非流式） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const t0 = Date.now();
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { choiceId: string; round: number };

    if (!body.choiceId?.trim()) {
      return NextResponse.json({ error: "choiceId is required" }, { status: 400 });
    }
    if (!Number.isInteger(body.round) || body.round < 1) {
      return NextResponse.json({ error: "round is required" }, { status: 400 });
    }

    // ── 判断是否请求流式模式 ──
    const useStream =
      request.headers.get("accept")?.includes("text/event-stream") ||
      new URL(request.url).searchParams.get("stream") === "true";

    if (useStream) {
      // ── 流式响应：SSE ──
      log.info({ sessionId, choiceId: body.choiceId }, "POST step (stream)");

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const eventGenerator = handleSimulateStepStream(
              sessionId,
              body.choiceId,
              body.round,
            );

            for await (const event of eventGenerator) {
              if (event.type === "error") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
                );
                controller.close();
                return;
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
              );

              // 只在带 result 的最终 done 事件时关闭流
              // provider 层会先发一个无 result 的 done（SSE 流结束信号），
              // server 层随后才发带 result 的真正 done（含完整业务数据）
              if (event.type === "done" && "result" in event) {
                controller.close();
              }
            }
          } catch (err) {
            const errorEvent = {
              type: "error" as const,
              error: err instanceof Error ? err.message : "Stream route error",
              fallback: true,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // ── 非流式响应（原有逻辑不变）──
    log.info({ sessionId, choiceId: body.choiceId }, "POST step");
    const result = await handleSimulateStep(sessionId, body.choiceId, body.round);
    log.info({ sessionId, elapsed: Date.now() - t0 }, "POST step — done");
    return NextResponse.json(result);
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error.message : String(error), elapsed: Date.now() - t0 },
      "POST step error",
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation step failed" },
      { status: 500 },
    );
  }
}
