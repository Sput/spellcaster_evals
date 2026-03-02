-- Eval app v1 schema
-- PostgreSQL

create table eval_runs (
  id uuid primary key,
  created_at timestamptz not null default now(),
  name text not null,
  status text not null check (status in ('queued','running','completed','failed')),
  baseline_model text not null,
  baseline_prompt_version text not null,
  candidate_model text not null,
  candidate_prompt_version text not null,
  judge_model text not null,
  judge_prompt_version text not null,
  margin_threshold numeric(5,2) not null,
  scenario_count int not null,
  metadata jsonb not null default '{}'::jsonb
);

create table eval_run_samples (
  id uuid primary key,
  run_id uuid not null references eval_runs(id) on delete cascade,
  scenario_id text not null,
  scenario jsonb not null,
  baseline_output jsonb,
  candidate_output jsonb,
  baseline_legal boolean,
  candidate_legal boolean,
  baseline_illegal_reasons jsonb,
  candidate_illegal_reasons jsonb,
  winner text check (winner in ('baseline','candidate','tie','invalid')),
  winner_margin numeric(5,2),
  assumption_penalty_applied boolean not null default false,
  aggregate_scores jsonb,
  created_at timestamptz not null default now()
);

create table eval_judgements (
  id uuid primary key,
  sample_id uuid not null references eval_run_samples(id) on delete cascade,
  judge_index int not null check (judge_index between 1 and 3),
  winner text not null check (winner in ('baseline','candidate','tie')),
  margin numeric(5,2) not null,
  scores jsonb not null,
  rationale text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  unique (sample_id, judge_index)
);

create table eval_scenarios (
  id text primary key,
  source text not null default 'local_json',
  scenario jsonb not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
