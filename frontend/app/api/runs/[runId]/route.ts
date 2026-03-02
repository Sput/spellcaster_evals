import { NextResponse } from "next/server";
import { getRun } from "@/lib/server/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await params;
    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ detail: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("GET /api/runs/[runId] failed", { detail });
    return NextResponse.json({ detail }, { status: 500 });
  }
}
