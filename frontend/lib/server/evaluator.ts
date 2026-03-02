import fs from "node:fs";
import crypto from "node:crypto";
import { resolvePath } from "./pathing";
import { loadSpellCatalog } from "./spell-catalog";
import { assumptionPenaltyTarget, validateLegality } from "./validators";
import { judgePairwise, recommendSpell } from "./providers";
import { median, round2, winnerFromMedian } from "./scoring";
import { insertJudgement, insertSample, markRunFailed, updateRunStatus } from "./repository";

const ASSUMPTION_PENALTY = Number(process.env.ASSUMPTION_PENALTY ?? "0.75");

function loadJsonArray(pathValue: string): Array<Record<string, any>> {
  const raw = fs.readFileSync(resolvePath(pathValue), "utf-8");
  return JSON.parse(raw);
}

export async function executeRun(opts: {
  runId: string;
  scenariosPath: string;
  spellsPath: string;
  baselineModel: string;
  candidateModel: string;
  judgeModel: string;
  marginThreshold: number;
}): Promise<void> {
  try {
    await updateRunStatus(opts.runId, "running");

    const scenarios = loadJsonArray(opts.scenariosPath);
    const spellCatalog = loadSpellCatalog(resolvePath(opts.spellsPath));

    for (const scenario of scenarios) {
      const sampleId = crypto.randomUUID();

      const baselineOutput = recommendSpell(scenario, "baseline", opts.baselineModel);
      const candidateOutput = recommendSpell(scenario, "candidate", opts.candidateModel);

      const baselineCheck = validateLegality(scenario, baselineOutput, spellCatalog);
      const candidateCheck = validateLegality(scenario, candidateOutput, spellCatalog);

      if (!baselineCheck.legal || !candidateCheck.legal) {
        let winner: "baseline" | "candidate" | "tie" | "invalid" = "invalid";
        if (!baselineCheck.legal && candidateCheck.legal) {
          winner = "candidate";
        } else if (baselineCheck.legal && !candidateCheck.legal) {
          winner = "baseline";
        } else if (!baselineCheck.legal && !candidateCheck.legal) {
          winner = "tie";
        }

        await insertSample({
          id: sampleId,
          run_id: opts.runId,
          scenario_id: scenario.id,
          scenario: JSON.stringify(scenario),
          baseline_output: JSON.stringify(baselineOutput),
          candidate_output: JSON.stringify(candidateOutput),
          baseline_legal: baselineCheck.legal,
          candidate_legal: candidateCheck.legal,
          baseline_illegal_reasons: JSON.stringify(baselineCheck.reasons),
          candidate_illegal_reasons: JSON.stringify(candidateCheck.reasons),
          winner,
          winner_margin: 0,
          assumption_penalty_applied: false,
          aggregate_scores: JSON.stringify({ baseline: { weighted_total: 0 }, candidate: { weighted_total: 0 } }),
        });
        continue;
      }

      const judgeResults = [];
      for (let i = 1; i <= 3; i += 1) {
        const result = judgePairwise(scenario, baselineOutput, candidateOutput, opts.marginThreshold, opts.judgeModel);
        judgeResults.push(result);
      }

      let baselineTotals = judgeResults.map((r) => r.scores.baseline.weighted_total);
      let candidateTotals = judgeResults.map((r) => r.scores.candidate.weighted_total);
      const margins = judgeResults.map((r) => r.margin);
      const winners = judgeResults.map((r) => r.winner);

      let penaltyApplied = false;
      if (assumptionPenaltyTarget(scenario, baselineOutput)) {
        baselineTotals = baselineTotals.map((v) => Math.max(0, round2(v - ASSUMPTION_PENALTY)));
        penaltyApplied = true;
      }
      if (assumptionPenaltyTarget(scenario, candidateOutput)) {
        candidateTotals = candidateTotals.map((v) => Math.max(0, round2(v - ASSUMPTION_PENALTY)));
        penaltyApplied = true;
      }

      const outcome = winnerFromMedian(winners, baselineTotals, candidateTotals, margins, opts.marginThreshold);
      await insertSample({
        id: sampleId,
        run_id: opts.runId,
        scenario_id: scenario.id,
        scenario: JSON.stringify(scenario),
        baseline_output: JSON.stringify(baselineOutput),
        candidate_output: JSON.stringify(candidateOutput),
        baseline_legal: baselineCheck.legal,
        candidate_legal: candidateCheck.legal,
        baseline_illegal_reasons: JSON.stringify(baselineCheck.reasons),
        candidate_illegal_reasons: JSON.stringify(candidateCheck.reasons),
        winner: outcome.winner,
        winner_margin: outcome.margin,
        assumption_penalty_applied: penaltyApplied,
        aggregate_scores: JSON.stringify({
          baseline: { weighted_total: round2(median(baselineTotals)) },
          candidate: { weighted_total: round2(median(candidateTotals)) },
        }),
      });

      for (let i = 0; i < judgeResults.length; i += 1) {
        const result = judgeResults[i];
        await insertJudgement({
          id: crypto.randomUUID(),
          sample_id: sampleId,
          judge_index: i + 1,
          winner: result.winner,
          margin: result.margin,
          scores: JSON.stringify(result.scores),
          rationale: result.rationale,
          raw_response: JSON.stringify(result),
        });
      }
    }

    await updateRunStatus(opts.runId, "completed");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("executeRun failed", { runId: opts.runId, reason });
    await markRunFailed(opts.runId, reason);
    throw err;
  }
}
