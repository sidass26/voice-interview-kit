-- Migration 004: Generalize intake storage and add framework metadata columns
--
-- Goal: intake_responses can now store any config's intake fields without
-- schema migrations. All intake data is written to `data JSONB` as the
-- primary source of truth. Typed columns are kept nullable for backward
-- compatibility with existing sessions and the listPublishedStories join.
--
-- Apply: paste into Supabase SQL editor and run.

-- ── 1. intake_responses: add generic data column ──────────────────────────

ALTER TABLE intake_responses
  ADD COLUMN IF NOT EXISTS data JSONB;

-- Make travel-specific typed columns nullable so non-travel configs
-- can insert without providing travel-specific values.
ALTER TABLE intake_responses
  ALTER COLUMN destination_country DROP NOT NULL,
  ALTER COLUMN destination_cities  DROP NOT NULL,
  ALTER COLUMN trip_type           DROP NOT NULL,
  ALTER COLUMN trip_purpose        DROP NOT NULL,
  ALTER COLUMN num_travelers       DROP NOT NULL;

-- Backfill `data` for all existing rows by serialising the typed columns.
-- `to_jsonb(intake_responses.*)` snapshots the full row; we strip the
-- system columns that don't belong in the payload.
UPDATE intake_responses
SET data = (
  to_jsonb(intake_responses.*) - 'id' - 'session_id' - 'created_at' - 'data'
)
WHERE data IS NULL;

-- Fast lookup by subject email (works for any config via data->>'work_email').
CREATE INDEX IF NOT EXISTS idx_intake_data_email
  ON intake_responses ((data->>'work_email'));

-- ── 2. article_drafts: track which output config generated each draft ─────

ALTER TABLE article_drafts
  ADD COLUMN IF NOT EXISTS output_id TEXT NOT NULL DEFAULT 'article';

-- ── 3. interview_sessions: record which config created the session ─────────

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS config_version TEXT;
