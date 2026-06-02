import { NextResponse } from "next/server";
import { handleGetFutureRun } from "@/lib/future/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    const result = await handleGetFutureRun(runId);
    if (!result) {
      return NextResponse.json({ error: "run not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "future result lookup failed" },
      { status: 500 },
    );
  }
}
