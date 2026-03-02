"use client";

import { useEffect, useState } from "react";
import { getMetrics, getRuns, type RunSummary } from "@/lib/api";

type RunMetrics = {
  scenario_count: number;
  illegal_rate_baseline: number;
  illegal_rate_candidate: number;
  candidate_win_rate: number;
  baseline_win_rate: number;
  tie_rate: number;
  average_margin: number;
};

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeMetrics(input: Record<string, unknown>): RunMetrics {
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

export default function CompareRunsPage() {
  const [baselineRunId, setBaselineRunId] = useState("");
  const [candidateRunId, setCandidateRunId] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [baselineMetrics, setBaselineMetrics] = useState<RunMetrics | null>(null);
  const [candidateMetrics, setCandidateMetrics] = useState<RunMetrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRunOptions() {
      try {
        const data = await getRuns();
        setRuns(data);
        if (data.length > 0) {
          setCandidateRunId((prev) => prev || data[0].id);
        }
        if (data.length > 1) {
          setBaselineRunId((prev) => prev || data[1].id);
        } else if (data.length === 1) {
          setBaselineRunId((prev) => prev || data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to load run list");
      }
    }

    void loadRunOptions();
  }, []);

  async function loadRuns() {
    setError("");
    if (!baselineRunId || !candidateRunId) {
      setError("select both runs before loading comparison");
      return;
    }
    try {
      const [baseMetrics, candMetrics] = await Promise.all([
        getMetrics(baselineRunId),
        getMetrics(candidateRunId),
      ]);
      setBaselineMetrics(normalizeMetrics(baseMetrics as Record<string, unknown>));
      setCandidateMetrics(normalizeMetrics(candMetrics as Record<string, unknown>));
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to compare runs");
    }
  }

  const baselineRunName = runs.find((run) => run.id === baselineRunId)?.name ?? "Baseline Run";
  const candidateRunName = runs.find((run) => run.id === candidateRunId)?.name ?? "Candidate Run";

  function formatPct(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  return (
    <section className="grid">
      <div className="card">
        <h2>Compare Runs</h2>
        <small>Compare two runs side-by-side across metrics and shared-scenario behavior.</small>
        <div className="grid grid-3">
          <div>
            <label htmlFor="base-run">Baseline Run ID</label>
            <select id="base-run" value={baselineRunId} onChange={(e) => setBaselineRunId(e.target.value)}>
              <option value="" disabled>Select run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name} ({run.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cand-run">Candidate Run ID</label>
            <select id="cand-run" value={candidateRunId} onChange={(e) => setCandidateRunId(e.target.value)}>
              <option value="" disabled>Select run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name} ({run.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={loadRuns}>Load Comparison</button>
        {error && <p className="warn">{error}</p>}
      </div>

      {baselineMetrics && candidateMetrics && (
        <>
          <div className="grid grid-3">
            <div className="card">
              <h3>{baselineRunName}</h3>
              <p>Candidate win rate: {formatPct(baselineMetrics.candidate_win_rate)}</p>
              <p>Baseline win rate: {formatPct(baselineMetrics.baseline_win_rate)}</p>
              <p>Tie rate: {formatPct(baselineMetrics.tie_rate)}</p>
              <p>Illegal candidate: {formatPct(baselineMetrics.illegal_rate_candidate)}</p>
              <p>Illegal baseline: {formatPct(baselineMetrics.illegal_rate_baseline)}</p>
              <p>Avg margin: {baselineMetrics.average_margin.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>{candidateRunName}</h3>
              <p>Candidate win rate: {formatPct(candidateMetrics.candidate_win_rate)}</p>
              <p>Baseline win rate: {formatPct(candidateMetrics.baseline_win_rate)}</p>
              <p>Tie rate: {formatPct(candidateMetrics.tie_rate)}</p>
              <p>Illegal candidate: {formatPct(candidateMetrics.illegal_rate_candidate)}</p>
              <p>Illegal baseline: {formatPct(candidateMetrics.illegal_rate_baseline)}</p>
              <p>Avg margin: {candidateMetrics.average_margin.toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Delta (Run 2 - Run 1)</h3>
              <p>Candidate win rate: {formatPct(candidateMetrics.candidate_win_rate - baselineMetrics.candidate_win_rate)}</p>
              <p>Baseline win rate: {formatPct(candidateMetrics.baseline_win_rate - baselineMetrics.baseline_win_rate)}</p>
              <p>Tie rate: {formatPct(candidateMetrics.tie_rate - baselineMetrics.tie_rate)}</p>
              <p>Illegal candidate: {formatPct(candidateMetrics.illegal_rate_candidate - baselineMetrics.illegal_rate_candidate)}</p>
              <p>Illegal baseline: {formatPct(candidateMetrics.illegal_rate_baseline - baselineMetrics.illegal_rate_baseline)}</p>
              <p>Avg margin: {(candidateMetrics.average_margin - baselineMetrics.average_margin).toFixed(2)}</p>
            </div>
          </div>

        </>
      )}
    </section>
  );
}
