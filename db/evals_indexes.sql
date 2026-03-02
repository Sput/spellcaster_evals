-- Eval app v1 indexes
-- Apply after tables in db/evals_schema.sql are created.

-- Runs: dashboard listing/filtering
create index if not exists idx_eval_runs_created_at
  on eval_runs (created_at desc);

create index if not exists idx_eval_runs_status_created_at
  on eval_runs (status, created_at desc);

-- Samples: most common joins and run-level metrics slices
create index if not exists idx_eval_run_samples_run_id
  on eval_run_samples (run_id);

create index if not exists idx_eval_run_samples_run_winner
  on eval_run_samples (run_id, winner);

create index if not exists idx_eval_run_samples_run_legality
  on eval_run_samples (run_id, baseline_legal, candidate_legal);

create index if not exists idx_eval_run_samples_scenario_id
  on eval_run_samples (scenario_id);

create index if not exists idx_eval_run_samples_created_at
  on eval_run_samples (created_at desc);

-- Judgements: fetch per-sample triplet quickly and aggregate by sample/run
create index if not exists idx_eval_judgements_sample_id
  on eval_judgements (sample_id);

create index if not exists idx_eval_judgements_sample_winner
  on eval_judgements (sample_id, winner);

create index if not exists idx_eval_judgements_created_at
  on eval_judgements (created_at desc);

-- Scenarios: tags and JSON querying
create index if not exists idx_eval_scenarios_tags_gin
  on eval_scenarios using gin (tags);

create index if not exists idx_eval_scenarios_scenario_gin
  on eval_scenarios using gin (scenario jsonb_path_ops);
