"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createRun, getMetrics, getRun, getSamples, type RunCreateRequest } from "@/lib/api";

const runNamePrefixes = [
  "Demogorgon",
  "Orcus",
  "Baphomet",
  "Yeenoghu",
  "Juiblex",
  "Zuggtmoy",
  "Fraz-Urb'luu",
];

function generateRunName(): string {
  const prefix = runNamePrefixes[Math.floor(Math.random() * runNamePrefixes.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${suffix}`;
}

function getModelLabel(modelId: string): string {
  return modelOptions.find((option) => option.value === modelId)?.label ?? modelId;
}

function getWinnerLabel(
  winner: string,
  runModels: { baseline: string; candidate: string } | null,
): string {
  if (winner === "baseline") {
    return runModels ? getModelLabel(runModels.baseline) : "Baseline";
  }
  if (winner === "candidate") {
    return runModels ? getModelLabel(runModels.candidate) : "Candidate";
  }
  if (winner === "tie") {
    return "Tie";
  }
  if (winner === "invalid") {
    return "Invalid";
  }
  return winner;
}

const modelOptions = [
  { label: "GPT-4.1 mini", value: "gpt-4.1-mini" },
  { label: "GPT-5 mini", value: "gpt-5-mini" },
  { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-latest" },
  { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
];

const initialForm: RunCreateRequest = {
  name: generateRunName(),
  scenarios_path: "data/scenarios/scenarios_v1.json",
  spells_path: "data/spells/spells.json",
  baseline_model: "gpt-4.1-mini",
  candidate_model: "claude-3-5-haiku-latest",
  judge_model: "claude-3-5-haiku-latest",
  baseline_prompt_version: "baseline_v1",
  candidate_prompt_version: "candidate_v1",
  judge_prompt_version: "judge_pairwise_v1",
  margin_threshold: 0.2,
};

export default function RunEvalPage() {
  const [form, setForm] = useState(initialForm);
  const [runId, setRunId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [runModels, setRunModels] = useState<{ baseline: string; candidate: string } | null>(null);
  const [failureReason, setFailureReason] = useState<string>("");
  const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
  const [samples, setSamples] = useState<Array<Record<string, any>>>([]);
  const [error, setError] = useState<string>("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const run = await createRun(form);
      setRunId(run.id);
      setStatus(run.status);
      setRunModels({
        baseline: form.baseline_model,
        candidate: form.candidate_model,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create run");
    }
  }

  const refreshStatus = useCallback(async () => {
    if (!runId) return;
    try {
      const run = await getRun(runId);
      setStatus(run.status);
      setFailureReason(run?.metadata?.failure_reason ?? "");
      if (run?.baseline_model && run?.candidate_model) {
        setRunModels({
          baseline: String(run.baseline_model),
          candidate: String(run.candidate_model),
        });
      }
      if (run.status === "completed") {
        const [m, s] = await Promise.all([getMetrics(runId), getSamples(runId)]);
        setMetrics(m);
        setSamples(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to refresh run status");
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    if (status === "completed" || status === "failed") return;

    void refreshStatus();
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [runId, status, refreshStatus]);

  return (
    <section className="grid">
      <div className="card">
        <h2>Run Eval</h2>
        <small>Starts a baseline vs candidate run over your local scenario JSON file.</small>
        <form className="grid" onSubmit={onSubmit}>
          <div className="grid grid-2">
            <div>
              <label htmlFor="run-name">Run Name</label>
              <input
                id="run-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="threshold">Margin Threshold</label>
              <input
                id="threshold"
                type="number"
                step="0.01"
                value={form.margin_threshold}
                onChange={(e) => setForm({ ...form, margin_threshold: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-3">
            <div>
              <label htmlFor="baseline-model">Baseline Model</label>
              <select
                id="baseline-model"
                value={form.baseline_model}
                onChange={(e) => setForm({ ...form, baseline_model: e.target.value })}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="candidate-model">Candidate Model</label>
              <select
                id="candidate-model"
                value={form.candidate_model}
                onChange={(e) => setForm({ ...form, candidate_model: e.target.value })}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="judge-model">Judge Model</label>
              <select
                id="judge-model"
                value={form.judge_model}
                onChange={(e) => setForm({ ...form, judge_model: e.target.value })}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit">Start Run</button>
        </form>
      </div>

      <div className="card">
        <h3>Run Status</h3>
        {!runId ? <p>No run started yet.</p> : <p>Run ID: {runId}</p>}
        <p>Status: <strong>{status || "n/a"}</strong></p>
        {status === "failed" && failureReason && (
          <p className="warn">Failure reason: {failureReason}</p>
        )}
        {error && <p className="warn">{error}</p>}
      </div>

      {status === "completed" && metrics && (
        <div className="card">
          <h3>Scoreboard</h3>
          <div className="grid grid-3">
            <div><small>Scenarios</small><div className="kpi">{metrics.scenario_count}</div></div>
            <div><small>{runModels ? getModelLabel(runModels.candidate) : "Candidate"} Win Rate</small><div className="kpi">{(metrics.candidate_win_rate * 100).toFixed(1)}%</div></div>
            <div><small>{runModels ? getModelLabel(runModels.baseline) : "Baseline"} Win Rate</small><div className="kpi">{(metrics.baseline_win_rate * 100).toFixed(1)}%</div></div>
            <div><small>Tie Rate</small><div className="kpi">{(metrics.tie_rate * 100).toFixed(1)}%</div></div>
            <div><small>Illegal {runModels ? getModelLabel(runModels.candidate) : "Candidate"}</small><div className="kpi">{(metrics.illegal_rate_candidate * 100).toFixed(1)}%</div></div>
            <div><small>Illegal {runModels ? getModelLabel(runModels.baseline) : "Baseline"}</small><div className="kpi">{(metrics.illegal_rate_baseline * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      )}

      {status === "completed" && samples.length > 0 && (
        <div className="card">
          <h3>Scenario Details</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>Scenario ID</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>Situation Text</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                    {runModels ? getModelLabel(runModels.baseline) : "Baseline"} Primary Spell
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                    {runModels ? getModelLabel(runModels.candidate) : "Candidate"} Primary Spell
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>Winner</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id}>
                    <td style={{ borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>{s.scenario_id}</td>
                    <td style={{ borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                      {String(s.scenario?.situation_text ?? "")}
                    </td>
                    <td style={{ borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                      {String(s.baseline_output?.primary_spell ?? "")}
                    </td>
                    <td style={{ borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                      {String(s.candidate_output?.primary_spell ?? "")}
                    </td>
                    <td style={{ borderBottom: "1px solid var(--line)", padding: "0.5rem" }}>
                      <strong>{getWinnerLabel(String(s.winner ?? ""), runModels)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
