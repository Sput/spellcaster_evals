import { Pool } from "pg";
import { resolveDatabaseUrlFromRootEnv, resolveDbSslRejectUnauthorizedFromRootEnv } from "./db-config";

function normalizeConnectionUrlForPg(raw: string): string {
  const u = new URL(raw);
  // We control TLS behavior explicitly via pool.ssl below.
  u.searchParams.delete("sslmode");
  u.searchParams.delete("uselibpqcompat");
  return u.toString();
}

const DB_REQUIRES_SSL = true;
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const rawDatabaseUrl = resolveDatabaseUrlFromRootEnv();
  const dbSslRejectUnauthorized = resolveDbSslRejectUnauthorizedFromRootEnv();
  const databaseUrl = normalizeConnectionUrlForPg(rawDatabaseUrl);

  pool = new Pool(
    DB_REQUIRES_SSL
      ? {
          connectionString: databaseUrl,
          ssl: { rejectUnauthorized: dbSslRejectUnauthorized },
        }
      : { connectionString: databaseUrl },
  );
  return pool;
}

export async function createRun(run: Record<string, any>): Promise<void> {
  await getPool().query(
    `insert into eval_runs (
      id, name, status,
      baseline_model, baseline_prompt_version,
      candidate_model, candidate_prompt_version,
      judge_model, judge_prompt_version,
      margin_threshold, scenario_count, metadata
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb
    )`,
    [
      run.id,
      run.name,
      run.status,
      run.baseline_model,
      run.baseline_prompt_version,
      run.candidate_model,
      run.candidate_prompt_version,
      run.judge_model,
      run.judge_prompt_version,
      run.margin_threshold,
      run.scenario_count,
      run.metadata,
    ],
  );
}

export async function updateRunStatus(runId: string, status: string): Promise<void> {
  await getPool().query(`update eval_runs set status=$1 where id=$2`, [status, runId]);
}

export async function markRunFailed(runId: string, reason: string): Promise<void> {
  await getPool().query(
    `update eval_runs
     set status='failed',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('failure_reason', $1::text)
     where id=$2`,
    [reason.slice(0, 2000), runId],
  );
}

export async function getRun(runId: string): Promise<Record<string, any> | null> {
  const { rows } = await getPool().query(`select * from eval_runs where id=$1`, [runId]);
  return rows[0] ?? null;
}

export async function listRuns(limit = 100): Promise<Record<string, any>[]> {
  const { rows } = await getPool().query(
    `select
       id,
       name,
       status,
       baseline_model,
       candidate_model,
       judge_model,
       created_at
     from eval_runs
     order by created_at desc
     limit $1`,
    [limit],
  );
  return rows;
}

export async function insertSample(sample: Record<string, any>): Promise<void> {
  await getPool().query(
    `insert into eval_run_samples (
      id, run_id, scenario_id, scenario,
      baseline_output, candidate_output,
      baseline_legal, candidate_legal,
      baseline_illegal_reasons, candidate_illegal_reasons,
      winner, winner_margin, assumption_penalty_applied,
      aggregate_scores
    ) values (
      $1,$2,$3,$4::jsonb,
      $5::jsonb,$6::jsonb,
      $7,$8,
      $9::jsonb,$10::jsonb,
      $11,$12,$13,
      $14::jsonb
    )`,
    [
      sample.id,
      sample.run_id,
      sample.scenario_id,
      sample.scenario,
      sample.baseline_output,
      sample.candidate_output,
      sample.baseline_legal,
      sample.candidate_legal,
      sample.baseline_illegal_reasons,
      sample.candidate_illegal_reasons,
      sample.winner,
      sample.winner_margin,
      sample.assumption_penalty_applied,
      sample.aggregate_scores,
    ],
  );
}

export async function insertJudgement(j: Record<string, any>): Promise<void> {
  await getPool().query(
    `insert into eval_judgements (
      id, sample_id, judge_index, winner, margin,
      scores, rationale, raw_response
    ) values (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb
    )`,
    [j.id, j.sample_id, j.judge_index, j.winner, j.margin, j.scores, j.rationale, j.raw_response],
  );
}

export async function getSamplesForRun(runId: string): Promise<Record<string, any>[]> {
  const { rows } = await getPool().query(
    `select
       id,
       scenario_id,
       scenario,
       baseline_output,
       candidate_output,
       winner,
       winner_margin,
       baseline_legal,
       candidate_legal,
       aggregate_scores
     from eval_run_samples where run_id=$1 order by created_at asc`,
    [runId],
  );
  return rows;
}

export async function getMetrics(runId: string): Promise<Record<string, any>> {
  const { rows } = await getPool().query(
    `with base as (select * from eval_run_samples where run_id=$1)
     select
       count(*)::int as scenario_count,
       coalesce(avg(case when baseline_legal is false then 1.0 else 0.0 end), 0) as illegal_rate_baseline,
       coalesce(avg(case when candidate_legal is false then 1.0 else 0.0 end), 0) as illegal_rate_candidate,
       coalesce(avg(case when winner='candidate' then 1.0 else 0.0 end), 0) as candidate_win_rate,
       coalesce(avg(case when winner='baseline' then 1.0 else 0.0 end), 0) as baseline_win_rate,
       coalesce(avg(case when winner='tie' then 1.0 else 0.0 end), 0) as tie_rate,
       coalesce(avg(coalesce(winner_margin,0)), 0) as average_margin
     from base`,
    [runId],
  );

  return {
    ...(rows[0] ?? {
      scenario_count: 0,
      illegal_rate_baseline: 0,
      illegal_rate_candidate: 0,
      candidate_win_rate: 0,
      baseline_win_rate: 0,
      tie_rate: 0,
      average_margin: 0,
    }),
    slices: { tags: {}, environment: {}, enemy_traits: {} },
  };
}
