export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type RunStatus = "queued" | "running" | "completed" | "failed";

export type RunCreateRequest = {
  name: string;
  scenarios_path: string;
  spells_path: string;
  baseline_model: string;
  candidate_model: string;
  judge_model: string;
  baseline_prompt_version: string;
  candidate_prompt_version: string;
  judge_prompt_version: string;
  margin_threshold: number;
};

export type RunSummary = {
  id: string;
  name: string;
  status: RunStatus;
  baseline_model: string;
  candidate_model: string;
  judge_model: string;
  created_at: string;
};

export async function createRun(payload: RunCreateRequest) {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(`create run failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  return res.json();
}

export async function getRuns(): Promise<RunSummary[]> {
  const res = await fetch(`${API_BASE}/api/runs`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(`get runs failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  return res.json();
}

export async function getRun(runId: string) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(`get run failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  return res.json();
}

export async function getSamples(runId: string) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}/samples`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(`get samples failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  return res.json();
}

export async function getMetrics(runId: string) {
  const res = await fetch(`${API_BASE}/api/metrics?run_id=${runId}`, { cache: "no-store" });
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(`get metrics failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  return res.json();
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.detail === "string") {
      return data.detail;
    }
    return JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}
