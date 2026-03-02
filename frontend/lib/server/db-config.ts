import fs from "node:fs";
import path from "node:path";

const ROOT_ENV_PATH = path.resolve(process.cwd(), "..", ".env.local");

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function getEnv(): Record<string, string> {
  const fileEnv = parseEnvFile(ROOT_ENV_PATH);
  return {
    ...fileEnv,
    ...(Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )),
  };
}

function isPgConnectionString(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v.startsWith("postgres://") || v.startsWith("postgresql://");
}

export function resolveDatabaseUrlFromRootEnv(): string {
  const env = getEnv();
  const candidates = [env.DATABASE_URL, env.SUPABASE_DB_URL];

  for (const candidate of candidates) {
    if (isPgConnectionString(candidate)) {
      return candidate as string;
    }
  }

  throw new Error(
    `No valid Postgres DSN found in ${ROOT_ENV_PATH}. Set DATABASE_URL or SUPABASE_DB_URL to a postgres:// or postgresql:// URL.`,
  );
}

export function resolveDatabaseTargetForHealth(): string {
  const dsn = resolveDatabaseUrlFromRootEnv();
  const u = new URL(dsn);
  return `${u.protocol}//${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`;
}

export function resolveDbSslRejectUnauthorizedFromRootEnv(): boolean {
  const env = getEnv();
  const raw = (env.DB_SSL_REJECT_UNAUTHORIZED ?? "false").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(raw);
}
