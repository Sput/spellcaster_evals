# Feature Implementation Plan

**Overall Progress:** `100%`

## TLDR
Build a single-user web app to evaluate D&D 5e spell recommendations by comparing baseline vs candidate LLM outputs, scoring with a judge LLM, and tracking run analytics.

## Critical Decisions
- Decision 1: Pairwise judging (`baseline` vs `candidate`) with 3 judge calls per sample and median aggregation - improves scoring stability.
- Decision 2: Legality is a hard gate - illegal outputs are invalid regardless of tactical quality.
- Decision 3: Stack is Next.js + TypeScript single-server app (UI + API routes), shadcn UI, Postgres persistence, no auth - keeps architecture simple.
- Decision 4: Data source is local JSON files for spells/scenarios; runs are stored in Postgres - fast iteration with durable run history.
- Decision 5: Rules scope is 5e 2014 PHB + Tasha’s + Xanathar’s, single-character mode only - constrained and judgeable v1 scope.

## Tasks:

- [x] ✅ **Step 1: Finalize Schemas**
  - [x] ✅ Finalize scenario JSON schema including caster profile, slots, concentration, and action economy fields.
  - [x] ✅ Finalize candidate output JSON schema (`primary_spell`, targeting, rationale, backups, assumptions).
  - [x] ✅ Finalize judge output JSON schema (dimension scores, winner, margin, assumption penalty, rationale).

- [x] ✅ **Step 2: Prepare Data**
  - [x] ✅ Normalize spell catalog JSON format for PHB/Tasha’s/Xanathar’s.
  - [x] ✅ Create 20–30 scenario JSON records for v1.
  - [x] ✅ Generate single-pass gold answers with up to 3 acceptable spells per scenario.

- [x] ✅ **Step 3: App API (Next.js Route Handlers)**
  - [x] ✅ Implement run lifecycle endpoints (`create run`, `run detail`, `samples`, `metrics`).
  - [x] ✅ Implement provider wiring with placeholders for OpenAI candidate model ID and Claude judge model ID.
  - [x] ✅ Implement job orchestration for pairwise evaluation flow.

- [x] ✅ **Step 4: Validation + Scoring Pipeline**
  - [x] ✅ Implement deterministic legality validator (spell availability, slots, concentration, rules checks).
  - [x] ✅ Implement pairwise judge execution (3 runs/sample), median aggregation, and forced winner via margin threshold.
  - [x] ✅ Implement assumption penalty and legality hard-gate behavior.

- [x] ✅ **Step 5: Persistence and Metrics**
  - [x] ✅ Apply [evals_schema.sql](/home/paul/projects/audit-eval/db/evals_schema.sql).
  - [x] ✅ Apply [evals_indexes.sql](/home/paul/projects/audit-eval/db/evals_indexes.sql).
  - [x] ✅ Persist runs/samples/judgements and compute dashboard metrics (illegal rate, average score, win rate, slices).

- [x] ✅ **Step 6: Frontend App (Next.js + shadcn)**
  - [x] ✅ Build Run Eval screen for selecting scenario set and starting runs.
  - [x] ✅ Build Compare Runs screen for baseline vs candidate outcomes.
  - [x] ✅ Build Metrics Dashboard with aggregate and slice-level views.

- [x] ✅ **Step 7: Validate v1 End-to-End**
  - [x] ✅ Add adversarial scenario coverage and tests for concentration, immunity, line-of-sight, friendly-fire, and goal mismatch traps.
  - [x] ✅ Verify scoring threshold behavior and validator logic with unit tests.
  - [x] ✅ Prepare deployment configuration with model ID placeholders for later replacement.
