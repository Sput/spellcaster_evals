import path from "node:path";
import fs from "node:fs";

export function resolvePath(pathValue: string): string {
  const direct = path.resolve(pathValue);
  const candidates = [
    direct,
    path.resolve(process.cwd(), pathValue),
    path.resolve(process.cwd(), "..", pathValue),
    path.resolve(process.cwd(), "..", "..", pathValue),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  throw new Error(`Unable to resolve path: ${pathValue}`);
}
