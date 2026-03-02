import crypto from "node:crypto";
import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { executeRun } from "@/lib/server/evaluator";
import { resolvePath } from "@/lib/server/pathing";
import { createRun, listRuns } from "@/lib/server/repository";
import type { RunCreateRequest } from "@/lib/server/types";

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json(runs);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("GET /api/runs failed", { detail });
    return NextResponse.json({ detail }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RunCreateRequest;

  const runId = crypto.randomUUID();
  const scenarioPath = resolvePath(body.scenarios_path);
  const spellPath = resolvePath(body.spells_path);
  const scenarioCount = JSON.parse(fs.readFileSync(scenarioPath, "utf-8")).length;

  await createRun({
    id: runId,
    name: body.name,
    status: "queued",
    baseline_model: body.baseline_model,
    baseline_prompt_version: body.baseline_prompt_version,
    candidate_model: body.candidate_model,
    candidate_prompt_version: body.candidate_prompt_version,
    judge_model: body.judge_model,
    judge_prompt_version: body.judge_prompt_version,
    margin_threshold: body.margin_threshold,
    scenario_count: scenarioCount,
    metadata: "{}",
  });

  void executeRun({
    runId,
    scenariosPath: scenarioPath,
    spellsPath: spellPath,
    baselineModel: body.baseline_model,
    candidateModel: body.candidate_model,
    judgeModel: body.judge_model,
    marginThreshold: body.margin_threshold,
  }).catch((err) => {
    console.error("executeRun background error", { runId, err: err instanceof Error ? err.message : String(err) });
  });

  return NextResponse.json({ id: runId, status: "queued" });
}
