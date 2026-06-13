import { NextResponse } from "next/server";
import { handleGetShare } from "@/lib/future/simulator-server";
import { createLogger } from "@/lib/future/logger";

const log = createLogger("simulator:share-get");

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { shareId } = await params;
    const share = await handleGetShare(shareId);
    return NextResponse.json(share);
  } catch (error) {
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "Share fetch failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Share not found" },
      { status: 404 },
    );
  }
}
