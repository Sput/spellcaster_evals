"use client";

import { useEffect, useState } from "react";
import { getMetrics, getRuns, type RunSummary } from "@/lib/api";

type Metrics = {
  scenario_count: number;
  illegal_rate_baseline: number;
  illegal_rate_candidate: number;
  candidate_win_rate: number;
  baseline_win_rate: number;
  tie_rate: number;
  average_margin: number;
};

const modelLabelById: Record<string, string> = {
  "gpt-4.1-mini": "GPT-4.1 mini",
  "gpt-5-mini": "GPT-5 mini",
  "claude-3-5-haiku-latest": "Claude 3.5 Haiku",
  "claude-3-haiku-20240307": "Claude 3 Haiku",
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeMetrics(input: Record<string, unknown>): Metrics {
  return {
    scenario_count: toNumber(input.scenario_count),
    illegal_rate_baseline: toNumber(input.illegal_rate_baseline),
    illegal_rate_candidate: toNumber(input.illegal_rate_candidate),
    candidate_win_rate: toNumber(input.candidate_win_rate),
    baseline_win_rate: toNumber(input.baseline_win_rate),
    tie_rate: toNumber(input.tie_rate),
    average_margin: toNumber(input.average_margin),
  };
}

export default function DashboardPage() {
  const [runId, setRunId] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRunOptions() {
      try {
        const data = await getRuns();
        setRuns(data);
        if (data.length > 0) {
          setRunId((prev) => prev || data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to load run list");
      }
    }

    void loadRunOptions();
  }, []);

  async function loadMetrics() {
    setError("");
    if (!runId) {
      setError("select a run before loading metrics");
      return;
    }
    try {
      const data = await getMetrics(runId);
      setMetrics(normalizeMetrics(data as Record<string, unknown>));
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to fetch metrics");
      setMetrics(null);
    }
  }

  const selectedRun = runs.find((run) => run.id === runId);
  const baselineModelName = selectedRun
    ? (modelLabelById[selectedRun.baseline_model] ?? selectedRun.baseline_model)
    : "Baseline";
  const candidateModelName = selectedRun
    ? (modelLabelById[selectedRun.candidate_model] ?? selectedRun.candidate_model)
    : "Candidate";

  return (
    <section className="grid">
      <div className="card">
        <h2>Metrics Dashboard</h2>
        <label htmlFor="run-id">Run ID</label>
        <select id="run-id" value={runId} onChange={(e) => setRunId(e.target.value)}>
          <option value="" disabled>Select run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.name} ({run.id.slice(0, 8)})
            </option>
          ))}
        </select>
        <button onClick={loadMetrics}>Load Metrics</button>
        {error && <p className="warn">{error}</p>}
      </div>

      {metrics && (
        <div className="grid grid-3">
          <div className="card"><h3>Scenarios</h3><p className="kpi">{metrics.scenario_count}</p></div>
          <div className="card">
            <h3>
              Win Rate
              <br />
              <small>{candidateModelName}</small>
            </h3>
            <p className="kpi">{(metrics.candidate_win_rate * 100).toFixed(1)}%</p>
          </div>
          <div className="card">
            <h3>
              Win Rate
              <br />
              <small>{baselineModelName}</small>
            </h3>
            <p className="kpi">{(metrics.baseline_win_rate * 100).toFixed(1)}%</p>
          </div>
          <div className="card"><h3>Tie Rate</h3><p className="kpi">{(metrics.tie_rate * 100).toFixed(1)}%</p></div>
          <div className="card">
            <h3>
              Illegal Answers
              <br />
              <small>{baselineModelName}</small>
            </h3>
            <p className="kpi">{(metrics.illegal_rate_baseline * 100).toFixed(1)}%</p>
          </div>
          <div className="card">
            <h3>
              Illegal Answers
              <br />
              <small>{candidateModelName}</small>
            </h3>
            <p className="kpi">{(metrics.illegal_rate_candidate * 100).toFixed(1)}%</p>
          </div>
          <div className="card"><h3>Average Margin</h3><p className="kpi">{metrics.average_margin.toFixed(2)}</p></div>
        </div>
      )}
    </section>
  );
}
