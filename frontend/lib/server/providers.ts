import type { CandidateOutput, JudgeResult } from "./types";

const CONCENTRATION_SPELLS = new Set([
  "Bless",
  "Web",
  "Hold Person",
  "Fly",
  "Hypnotic Pattern",
  "Slow",
  "Wall of Fire",
  "Polymorph",
  "Banishment",
]);

const AOE_DAMAGE_SPELLS = new Set(["Fireball", "Wall of Fire", "Synaptic Static"]);
const CONTROL_SPELLS = new Set(["Web", "Hypnotic Pattern", "Slow", "Hold Person", "Banishment"]);
const ESCAPE_SPELLS = new Set(["Misty Step", "Dimension Door", "Fly"]);
const ANTI_CASTER_SPELLS = new Set(["Counterspell", "Dispel Magic", "Synaptic Static"]);

function clamp01to5(n: number): number {
  return Math.max(0, Math.min(5, Math.round(n * 100) / 100));
}

function scenarioText(scenario: Record<string, any>): string {
  const parts: string[] = [];
  parts.push(String(scenario.goal ?? ""));
  parts.push(String(scenario.situation_text ?? ""));
  for (const c of scenario.constraints ?? []) parts.push(String(c));
  for (const t of scenario.tags ?? []) parts.push(String(t));
  for (const e of scenario.enemy_summary?.types ?? []) parts.push(String(e));
  return parts.join(" ").toLowerCase();
}

function scoreSpell(spell: string, scenario: Record<string, any>) {
  const text = scenarioText(scenario);
  const isConcentration = CONCENTRATION_SPELLS.has(spell);

  let tactical = 2.8;
  let efficiency = 2.8;
  let risk = 2.8;
  let rules = 3.0;
  const reasons: string[] = [];

  if (CONTROL_SPELLS.has(spell) && (text.includes("stop") || text.includes("disable") || text.includes("delay") || text.includes("control"))) {
    tactical += 1.1;
    reasons.push("matches control objective");
  }

  if (ESCAPE_SPELLS.has(spell) && (text.includes("escape") || text.includes("reposition") || text.includes("chasm") || text.includes("traversal"))) {
    tactical += 1.2;
    reasons.push("supports mobility/escape goal");
  }

  if (ANTI_CASTER_SPELLS.has(spell) && (text.includes("caster") || text.includes("spell"))) {
    tactical += 1.0;
    reasons.push("targets enemy spellcasting pressure");
  }

  if ((spell === "Fly" || spell === "Magic Missile" || spell === "Slow") && text.includes("flying")) {
    tactical += 0.9;
    reasons.push("addresses flying threat");
  }

  if (AOE_DAMAGE_SPELLS.has(spell) && (text.includes("friendly fire") || text.includes("no ally damage") || text.includes("no lethal") || text.includes("public"))) {
    risk -= 1.6;
    tactical -= 0.6;
    reasons.push("aoe conflicts with collateral constraints");
  }

  if (spell === "Hold Person" && (text.includes("undead") || text.includes("fiend") || text.includes("construct"))) {
    rules -= 2.5;
    tactical -= 1.0;
    reasons.push("invalid target type for Hold Person");
  }

  if (isConcentration && scenario.concentration_active) {
    efficiency -= 1.4;
    rules -= 0.8;
    reasons.push("concentration conflict with active spell");
  }

  if (text.includes("conserve") || text.includes("economy") || text.includes("more encounters")) {
    if (spell === "Magic Missile" || spell === "Shield" || spell === "Misty Step") {
      efficiency += 0.8;
      reasons.push("better slot economy for scenario");
    } else if (spell === "Fireball" || spell === "Wall of Fire" || spell === "Banishment") {
      efficiency -= 0.5;
      reasons.push("higher resource cost");
    }
  }

  const tacticalFit = clamp01to5(tactical);
  const efficiencyScore = clamp01to5(efficiency);
  const riskScore = clamp01to5(risk);
  const rulesScore = clamp01to5(rules);
  const weightedTotal = clamp01to5(
    tacticalFit * 0.35 + efficiencyScore * 0.25 + riskScore * 0.2 + rulesScore * 0.2,
  );

  return {
    tactical_fit: tacticalFit,
    efficiency: efficiencyScore,
    risk: riskScore,
    rules_soundness: rulesScore,
    weighted_total: weightedTotal,
    reasons,
  };
}

export function recommendSpell(
  scenario: Record<string, any>,
  role: "baseline" | "candidate",
  _modelId: string,
): CandidateOutput {
  const spells = (scenario.known_or_prepared_spells ?? []) as string[];
  const ranked = spells
    .map((spell) => ({ spell, score: scoreSpell(spell, scenario).weighted_total }))
    .sort((a, b) => b.score - a.score);

  const primary =
    role === "baseline"
      ? (spells[0] ?? "Magic Missile")
      : (ranked[0]?.spell ?? spells[0] ?? "Magic Missile");
  const backups = ranked.map((r) => r.spell).filter((s) => s !== primary).slice(0, 3);
  const detail = scoreSpell(primary, scenario);

  return {
    primary_spell: primary,
    targeting: "Prioritize enemy cluster while respecting constraints",
    why_now: `${role} selected ${primary} (${detail.weighted_total.toFixed(2)}): ${detail.reasons.join("; ") || "generic tactical fit"}.`,
    backup_spells: backups,
    rules_assumptions: [
      "Targets are in range unless scenario states otherwise",
      "Spell text interpretation follows 5e 2014 + Tasha's + Xanathar's",
    ],
  };
}

export function judgePairwise(
  scenario: Record<string, any>,
  baselineOutput: CandidateOutput,
  candidateOutput: CandidateOutput,
  marginThreshold: number,
  _modelId: string,
): JudgeResult {
  const baseline = scoreSpell(baselineOutput.primary_spell, scenario);
  const candidate = scoreSpell(candidateOutput.primary_spell, scenario);
  const margin = Math.round(Math.abs(candidate.weighted_total - baseline.weighted_total) * 100) / 100;

  let winner: "baseline" | "candidate" | "tie" = "tie";
  if (margin >= marginThreshold) {
    winner = candidate.weighted_total > baseline.weighted_total ? "candidate" : "baseline";
  }

  return {
    winner,
    margin,
    scores: {
      baseline: {
        tactical_fit: baseline.tactical_fit,
        efficiency: baseline.efficiency,
        risk: baseline.risk,
        rules_soundness: baseline.rules_soundness,
        weighted_total: baseline.weighted_total,
      },
      candidate: {
        tactical_fit: candidate.tactical_fit,
        efficiency: candidate.efficiency,
        risk: candidate.risk,
        rules_soundness: candidate.rules_soundness,
        weighted_total: candidate.weighted_total,
      },
    },
    assumption_penalty: { applied_to: "none", amount: 0, reason: "none" },
    rationale: `Heuristic rubric judge: baseline=${baselineOutput.primary_spell} (${baseline.weighted_total.toFixed(2)}), candidate=${candidateOutput.primary_spell} (${candidate.weighted_total.toFixed(2)}).`,
  };
}
