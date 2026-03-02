import { NextResponse } from "next/server";
import { resolveDatabaseTargetForHealth } from "@/lib/server/db-config";

export async function GET() {
  return NextResponse.json({ status: "ok", db_target: resolveDatabaseTargetForHealth() });
}
