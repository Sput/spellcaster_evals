function parseLevel(levelValue: unknown): number | null {
  if (typeof levelValue === "number") {
    return levelValue;
  }
  if (typeof levelValue === "string") {
    if (levelValue.trim().toLowerCase() === "cantrip") {
      return 0;
    }
    const digits = levelValue.replace(/\D+/g, "");
    return digits ? Number.parseInt(digits, 10) : null;
  }
  return null;
}

function parseBoolish(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return false;
  }
  const text = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(text);
}

export function validateLegality(
  scenario: Record<string, any>,
  output: Record<string, any>,
  spellCatalog: Array<Record<string, any>>,
): { legal: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const spellName = output.primary_spell;
  if (!spellName) {
    return { legal: false, reasons: ["Missing primary_spell in candidate output"] };
  }

  const knownSpells = new Set<string>(scenario.known_or_prepared_spells ?? []);
  if (!knownSpells.has(spellName)) {
    reasons.push("Primary spell is not in known/prepared list");
  }

  const spellEntry = spellCatalog.find((s) => s.name === spellName);
  if (!spellEntry) {
    reasons.push("Primary spell does not exist in allowed spell catalog");
    return { legal: false, reasons };
  }

  const spellLevel = parseLevel(spellEntry.level);
  if (spellLevel == null || spellLevel < 0) {
    reasons.push("Unable to determine spell level");
  } else if (spellLevel > 0) {
    const slots = scenario.slots ?? {};
    const available = Number(slots[String(spellLevel)] ?? 0);
    if (available <= 0) {
      reasons.push(`No slot available for level ${spellLevel}`);
    }
  }

  const actionEconomy = scenario.action_economy ?? {};
  const castingTime = String(spellEntry.casting_time ?? "").toLowerCase();
  if (castingTime.includes("reaction") && !actionEconomy.reaction_available) {
    reasons.push("Spell requires reaction but reaction is unavailable");
  }
  if (castingTime.includes("bonus action") && !actionEconomy.bonus_action_available) {
    reasons.push("Spell requires bonus action but bonus action is unavailable");
  }
  if (
    castingTime.includes("action") &&
    !castingTime.includes("bonus action") &&
    !castingTime.includes("reaction") &&
    !actionEconomy.action_available
  ) {
    reasons.push("Spell requires action but action is unavailable");
  }

  if (parseBoolish(spellEntry.concentration) && scenario.concentration_active) {
    reasons.push("Casting a concentration spell would end currently active concentration spell");
  }

  const enemyTraits = new Set<string>((scenario.enemy_summary?.types ?? []).map((x: string) => x.toLowerCase()));
  if (spellName === "Hold Person" && (enemyTraits.has("undead") || enemyTraits.has("fiend") || enemyTraits.has("construct"))) {
    reasons.push("Hold Person invalid against non-humanoid enemy type");
  }

  return { legal: reasons.length === 0, reasons };
}

export function assumptionPenaltyTarget(scenario: Record<string, any>, output: Record<string, any>): boolean {
  const assumptions = (output.rules_assumptions ?? []).map((a: string) => a.toLowerCase());
  const situation = `${scenario.situation_text ?? ""} ${scenario.goal ?? ""}`.toLowerCase();
  const unsupportedMarkers = ["definitely", "guaranteed", "always", "certain"];

  for (const assumption of assumptions) {
    if (unsupportedMarkers.some((m) => assumption.includes(m)) && !situation.includes(assumption)) {
      return true;
    }
  }
  return false;
}
