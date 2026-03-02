# Learning: Evals Architecture, Definition, and Testing

This document focuses only on the eval system implemented in this project.

## Level 1: Core Concept

### What this eval system is
This is a **pairwise LLM eval pipeline** for D&D spell recommendations:
- Baseline model proposes a spell choice.
- Candidate model proposes a spell choice.
- A judge model compares both and picks a winner.

### Why it exists
Single-answer grading is noisy. Pairwise comparison gives clearer signal for regression testing ("is new prompt/model better than old one?").

### How evals fit the app
- UI starts runs and views results.
- Backend executes eval pipeline and scoring.
- Postgres stores run/sample/judgement records for dashboards.

### Where this lives in code
- Orchestration: `frontend/lib/server/evaluator.ts`
- API: `frontend/app/api/*/route.ts`
- Validation rules: `frontend/lib/server/validators.ts`
- Winner aggregation: `frontend/lib/server/scoring.ts`
- Persistence/metrics: `frontend/lib/server/repository.ts`

---

## Level 2: How It Works

### 1) How evals are defined
Evals are defined by three contracts plus scenario/spell data.

- Scenario schema: `data/schemas/scenario.schema.json`
  - Includes caster profile, spell list, slots, concentration, action economy, enemy/env context, goal, constraints.
- Candidate output schema: `data/schemas/candidate_output.schema.json`
  - Required JSON output (`primary_spell`, targeting, rationale, backups, assumptions).
- Judge output schema: `data/schemas/judge_output.schema.json`
  - Winner, margin, per-side dimensional scores, assumption penalty, rationale.

Dataset files:
- Spells: `data/spells/spells.json`
- Scenarios: `data/scenarios/scenarios_v1.json`
- Gold acceptable spells: `data/gold/gold_answers_v1.json`

### 2) How eval execution works
For each scenario:
1. Generate baseline output.
2. Generate candidate output.
3. Run deterministic legality checks on both outputs.
4. If either is illegal: mark sample `invalid` with zeroed score.
5. If both legal: call judge 3 times.
6. Aggregate by median score/margin.
7. Force winner only when median margin >= threshold (`0.75`), else tie.
8. Apply assumption penalty (`0.75`) when unsupported certainty assumptions are detected.
9. Persist sample + all 3 judgements.

### 3) Key tradeoffs chosen
- Pairwise > absolute grading: better for change detection.
- Hard legality gate: reduces "good reasoning but illegal action" false positives.
- 3 judge calls + median: more stable than one call, still cheap enough for this scale.
- JSON files for content + Postgres for results: fast iteration with analyzable history.

### 4) Failure modes to watch
- Judge drift: the placeholder judge should be replaced with real Claude API logic.
- Rules edge cases: current validator covers core legality, not every 5e nuance.
- Data quality: if scenario fields are vague, judge consistency drops.
- Path/config errors: route handlers resolve local/container paths via `frontend/lib/server/pathing.ts`.

### 5) How to debug quickly
- Check run status: `GET /api/runs/{id}`
- Inspect sample legality + winner fields: `GET /api/runs/{id}/samples`
- Validate aggregate behavior: `GET /api/metrics?run_id={id}`
- Reproduce legality by exercising `POST /api/runs` with a single-scenario fixture and inspecting sample legality output

---

## Level 3: Deep Dive

### Production behavior details that matter

#### Legality gate is a product decision, not just engineering
Hard-gating legality means your KPI becomes stricter and more trustworthy for game-rule tasks. It also means model creativity is intentionally constrained.

#### Margin threshold changes decision sensitivity
- Lower threshold => more forced winners, less ties, more volatility.
- Higher threshold => more ties, less sensitivity to small prompt changes.
Current `0.75` is a moderate default for 0-5 scoring.

#### Assumption penalty acts as anti-hallucination pressure
The penalty is applied after scoring and before winner aggregation. This nudges both candidate and baseline toward evidence-grounded outputs from scenario facts.

#### Aggregation strategy
Median over 3 judge calls protects against one unstable judge response. This is a practical robustness pattern when model-based judges are non-deterministic.

### Scaling considerations
- Current run execution uses Next.js route-handler background execution (good for small internal use).
- For larger workloads, move to a worker queue (Celery/RQ/Temporal) and stream progress.
- Add DB indexes for slice analytics (already included in `db/evals_indexes.sql`).
- Add materialized views if dashboard latency grows.

### Testing strategy and coverage implemented

Implemented tests:
- Validation and scoring logic live in `frontend/lib/server/validators.ts` and `frontend/lib/server/scoring.ts`.
- In this architecture revision, automated test files were removed with the legacy backend module.

What this gives you:
- Confidence in rule gate behavior.
- Confidence in winner-threshold logic.
- Confidence that adversarial slices are present for evaluation.

What is still missing for stronger production confidence:
- Integration test that creates a run and verifies DB writes end-to-end.
- Contract tests for API responses against schema.
- Deterministic fixture-based tests for assumption penalty triggers.
- Real provider tests once OpenAI/Claude adapters are implemented.

### Senior-engineer perspective
The core challenge is not API wiring; it is **evaluation quality control**:
- tight input schema,
- explicit legality checks,
- stable aggregation,
- metrics that capture regressions by slice.

If those are solid, model/provider swaps become operational details instead of product-risk events.
