#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

psql "$DATABASE_URL" -f db/evals_schema.sql
psql "$DATABASE_URL" -f db/evals_indexes.sql

echo "Database schema and indexes applied."
