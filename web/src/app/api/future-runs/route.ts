import { NextResponse } from "next/server";
import { handleCreateFutureRun } from "@/lib/future/server";
import type { FutureRunInput } from "@/lib/future/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as FutureRunInput;
    const result = await handleCreateFutureRun(input);
    return NextResponse.json({ runId: result.runId, status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "future generation failed" },
      { status: 500 },
    );
  }
}
