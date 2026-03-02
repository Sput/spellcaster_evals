import { NextRequest, NextResponse } from "next/server";
import { getMetrics, getRun } from "@/lib/server/repository";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("run_id");
  if (!runId) {
    return NextResponse.json({ detail: "run_id is required" }, { status: 400 });
  }

  const run = await getRun(runId);
  if (!run) {
    return NextResponse.json({ detail: "Run not found" }, { status: 404 });
  }

  const metrics = await getMetrics(runId);
  return NextResponse.json({ run_id: runId, ...metrics });
}
