import fs from "node:fs";

function extractArrayPayload(raw: string): string {
  const stripped = raw.trim();
  if (stripped.startsWith("[")) {
    return stripped;
  }
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to locate spell array payload in file");
  }
  return stripped.slice(start, end + 1);
}

function normalizeLevel(level: unknown): number | null {
  if (typeof level === "number") {
    return level;
  }
  if (level == null) {
    return null;
  }
  const text = String(level).trim().toLowerCase();
  if (text === "cantrip") {
    return 0;
  }
  const digits = text.replace(/\D+/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

function normalizeBoolish(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return false;
  }
  const text = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(text);
}

export function loadSpellCatalog(path: string): Array<Record<string, unknown>> {
  const raw = fs.readFileSync(path, "utf-8");
  const payload = extractArrayPayload(raw);
  const parsed = JSON.parse(payload) as Array<Record<string, unknown>>;

  return parsed.map((spell) => ({
    ...spell,
    name: String(spell.name ?? "").trim(),
    level: normalizeLevel(spell.level),
    concentration: normalizeBoolish(spell.concentration),
    casting_time: String(spell.casting_time ?? "").trim(),
  }));
}
