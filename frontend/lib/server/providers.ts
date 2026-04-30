import type { CandidateOutput, JudgeResult } from "./types";

type Provider = "openai" | "anthropic";

const REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? "60000");

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

function modelProvider(modelId: string): Provider {
  return modelId.startsWith("claude-") ? "anthropic" : "openai";
}

function getProviderKey(provider: Provider): string | undefined {
  return provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
}

function allowHeuristicFallback(): boolean {
  return (process.env.LLM_ALLOW_HEURISTIC_FALLBACK ?? "true").toLowerCase() !== "false";
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("LLM response did not contain valid JSON");
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeCandidateOutput(value: unknown, scenario: Record<string, any>, role: "baseline" | "candidate"): CandidateOutput {
  const input = value as Partial<CandidateOutput>;
  const knownSpells = asStringArray(scenario.known_or_prepared_spells);
  const primary =
    typeof input.primary_spell === "string" && input.primary_spell.trim()
      ? input.primary_spell.trim()
      : (knownSpells[0] ?? "Magic Missile");

  return {
    primary_spell: primary,
    targeting:
      typeof input.targeting === "string" && input.targeting.trim()
        ? input.targeting.trim()
        : "Prioritize the highest-value legal target.",
    why_now:
      typeof input.why_now === "string" && input.why_now.trim()
        ? input.why_now.trim()
        : `${role} selected ${primary}.`,
    backup_spells: asStringArray(input.backup_spells).slice(0, 3),
    rules_assumptions: asStringArray(input.rules_assumptions),
  };
}

function clampScore(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? clamp01to5(num) : 0;
}

function normalizeScore(value: unknown) {
  const input = value as Record<string, unknown>;
  const tacticalFit = clampScore(input.tactical_fit);
  const efficiency = clampScore(input.efficiency);
  const risk = clampScore(input.risk);
  const rulesSoundness = clampScore(input.rules_soundness);
  const weightedTotal =
    Number.isFinite(Number(input.weighted_total))
      ? clampScore(input.weighted_total)
      : clamp01to5(tacticalFit * 0.35 + efficiency * 0.25 + risk * 0.2 + rulesSoundness * 0.2);

  return {
    tactical_fit: tacticalFit,
    efficiency,
    risk,
    rules_soundness: rulesSoundness,
    weighted_total: weightedTotal,
  };
}

function normalizeJudgeResult(value: unknown, marginThreshold: number): JudgeResult {
  const input = value as Record<string, any>;
  const baseline = normalizeScore(input.scores?.baseline);
  const candidate = normalizeScore(input.scores?.candidate);
  const computedMargin = Math.round(Math.abs(candidate.weighted_total - baseline.weighted_total) * 100) / 100;
  const margin = Number.isFinite(Number(input.margin)) ? Math.round(Number(input.margin) * 100) / 100 : computedMargin;
  const rawWinner = input.winner;
  const winner =
    rawWinner === "baseline" || rawWinner === "candidate" || rawWinner === "tie"
      ? rawWinner
      : margin >= marginThreshold
        ? candidate.weighted_total > baseline.weighted_total
          ? "candidate"
          : "baseline"
        : "tie";

  return {
    winner,
    margin,
    scores: { baseline, candidate },
    assumption_penalty: {
      applied_to:
        input.assumption_penalty?.applied_to === "baseline" ||
        input.assumption_penalty?.applied_to === "candidate" ||
        input.assumption_penalty?.applied_to === "none"
          ? input.assumption_penalty.applied_to
          : "none",
      amount: Number.isFinite(Number(input.assumption_penalty?.amount)) ? Number(input.assumption_penalty.amount) : 0,
      reason:
        typeof input.assumption_penalty?.reason === "string" ? input.assumption_penalty.reason : "none",
    },
    rationale: typeof input.rationale === "string" && input.rationale.trim() ? input.rationale.trim() : "No rationale provided.",
  };
}

async function postWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiJson(modelId: string, system: string, user: string): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const response = await postWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: { type: "json_object" },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `OpenAI request failed with ${response.status}`);
  }

  const outputText =
    typeof data.output_text === "string"
      ? data.output_text
      : data.output
          ?.flatMap((item: any) => item.content ?? [])
          .map((item: any) => item.text ?? "")
          .join("");

  if (!outputText) throw new Error("OpenAI response did not include output text");
  return extractJsonObject(outputText);
}

async function callAnthropicJson(modelId: string, system: string, user: string): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await postWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1200,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Anthropic request failed with ${response.status}`);
  }

  const outputText = data.content?.map((item: any) => item.type === "text" ? item.text : "").join("");
  if (!outputText) throw new Error("Anthropic response did not include output text");
  return extractJsonObject(outputText);
}

async function callModelJson(modelId: string, system: string, user: string): Promise<unknown> {
  const provider = modelProvider(modelId);
  return provider === "anthropic"
    ? callAnthropicJson(modelId, system, user)
    : callOpenAiJson(modelId, system, user);
}

function fallbackCandidate(
  scenario: Record<string, any>,
  role: "baseline" | "candidate",
  modelId: string,
  reason: string,
): CandidateOutput {
  const output = heuristicRecommendSpell(scenario, role, modelId);
  return {
    ...output,
    why_now: `${output.why_now} Heuristic fallback used: ${reason}.`,
  };
}

function fallbackJudge(
  scenario: Record<string, any>,
  baselineOutput: CandidateOutput,
  candidateOutput: CandidateOutput,
  marginThreshold: number,
  modelId: string,
  reason: string,
): JudgeResult {
  const output = heuristicJudgePairwise(scenario, baselineOutput, candidateOutput, marginThreshold, modelId);
  return {
    ...output,
    rationale: `${output.rationale} Heuristic fallback used: ${reason}.`,
  };
}

function handleProviderError<T>(operation: () => T, reason: string): T {
  if (!allowHeuristicFallback()) {
    throw new Error(reason);
  }
  return operation();
}

function heuristicRecommendSpell(
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

function heuristicJudgePairwise(
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

export async function recommendSpell(
  scenario: Record<string, any>,
  role: "baseline" | "candidate",
  modelId: string,
): Promise<CandidateOutput> {
  const provider = modelProvider(modelId);
  const providerKey = getProviderKey(provider);
  if (!providerKey) {
    return handleProviderError(
      () => fallbackCandidate(scenario, role, modelId, `${provider.toUpperCase()} API key is not set`),
      `${provider.toUpperCase()} API key is not set`,
    );
  }

  const system = [
    "You are a Dungeons & Dragons 5e tactical spell recommendation engine.",
    "Choose one spell for the given scenario and return only valid JSON.",
    "Use only spells from known_or_prepared_spells.",
    "Do not invent spells, targets, or scenario facts.",
  ].join(" ");
  const user = JSON.stringify({
    task: "Recommend the best legal spell choice.",
    role,
    response_shape: {
      primary_spell: "string",
      targeting: "string",
      why_now: "string",
      backup_spells: ["string"],
      rules_assumptions: ["string"],
    },
    scenario,
  });

  try {
    const data = await callModelJson(modelId, system, user);
    return normalizeCandidateOutput(data, scenario, role);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return handleProviderError(
      () => fallbackCandidate(scenario, role, modelId, reason),
      reason,
    );
  }
}

export async function judgePairwise(
  scenario: Record<string, any>,
  baselineOutput: CandidateOutput,
  candidateOutput: CandidateOutput,
  marginThreshold: number,
  modelId: string,
): Promise<JudgeResult> {
  const provider = modelProvider(modelId);
  const providerKey = getProviderKey(provider);
  if (!providerKey) {
    return handleProviderError(
      () => fallbackJudge(scenario, baselineOutput, candidateOutput, marginThreshold, modelId, `${provider.toUpperCase()} API key is not set`),
      `${provider.toUpperCase()} API key is not set`,
    );
  }

  const system = [
    "You are an impartial Dungeons & Dragons 5e pairwise spell-choice judge.",
    "Evaluate baseline and candidate against tactical fit, resource efficiency, risk, and rules soundness.",
    "Return only valid JSON. Scores must be numbers from 0 to 5.",
  ].join(" ");
  const user = JSON.stringify({
    task: "Judge which output is better for this scenario.",
    margin_threshold: marginThreshold,
    response_shape: {
      winner: "baseline | candidate | tie",
      margin: "number",
      scores: {
        baseline: {
          tactical_fit: "number",
          efficiency: "number",
          risk: "number",
          rules_soundness: "number",
          weighted_total: "number",
        },
        candidate: {
          tactical_fit: "number",
          efficiency: "number",
          risk: "number",
          rules_soundness: "number",
          weighted_total: "number",
        },
      },
      assumption_penalty: {
        applied_to: "baseline | candidate | none",
        amount: "number",
        reason: "string",
      },
      rationale: "string",
    },
    scenario,
    baseline_output: baselineOutput,
    candidate_output: candidateOutput,
  });

  try {
    const data = await callModelJson(modelId, system, user);
    return normalizeJudgeResult(data, marginThreshold);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return handleProviderError(
      () => fallbackJudge(scenario, baselineOutput, candidateOutput, marginThreshold, modelId, reason),
      reason,
    );
  }
}
