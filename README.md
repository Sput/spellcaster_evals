# Spellcaster Eval Lab

Web app for evaluating D&D spell recommendations via pairwise LLM judging.

## Stack

- Frontend + API: Next.js + TypeScript route handlers
- Persistence: Postgres
- Data: JSON files for spells, scenarios, and gold answers

## Project Layout

- `frontend/`: run/compare/dashboard UI
- `frontend/app/api/`: API, validators, evaluation pipeline
- `data/`: JSON schemas and seed data
- `db/`: Postgres schema and indexes
- `scripts/init_db.sh`: apply DB schema and indexes

## Quick Start (Docker)

```bash
docker compose up --build
```

Then initialize DB tables:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evals
./scripts/init_db.sh
```

Services:

- Frontend: `http://localhost:3000`

## Quick Start (Local)

### App (single server)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Note: DB config is read only from repo-root `.env.local` (`/home/paul/projects/audit-eval/.env.local`).
Set `DATABASE_URL` or `SUPABASE_DB_URL` to a Postgres DSN (`postgres://` or `postgresql://`).
Set `DB_SSL_REJECT_UNAUTHORIZED=false` in root `.env.local` when your provider uses a self-signed/intercepted certificate chain in local dev.


## API Endpoints

- `POST /api/runs`: start evaluation run
- `GET /api/runs/{run_id}`: run details
- `GET /api/runs/{run_id}/samples`: per-scenario outcomes
- `GET /api/metrics?run_id={id}`: aggregate metrics

## Defaults Locked In

- Pairwise judging with 3 judge calls/sample
- Legality hard gate
- Margin threshold: `0.75`
- Assumption penalty: `0.75` points
- Placeholder model IDs until configured

## Data Files

- Scenario schema: `data/schemas/scenario.schema.json`
- Candidate output schema: `data/schemas/candidate_output.schema.json`
- Judge output schema: `data/schemas/judge_output.schema.json`
- Spells: `data/spells/spells.json`
- Scenarios: `data/scenarios/scenarios_v1.json`
- Gold answers: `data/gold/gold_answers_v1.json`
