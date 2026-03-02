import { NextResponse } from "next/server";
import { getSamplesForRun } from "@/lib/server/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const rows = await getSamplesForRun(runId);
  return NextResponse.json(rows);
}
