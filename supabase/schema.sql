-- =============================================================================
-- voice-interview-kit — complete database schema
-- =============================================================================
--
-- FRESH INSTALL: paste this whole file into the Supabase SQL editor and Run.
-- It is idempotent — running it twice is safe and does nothing the second time.
--
-- ALREADY RUNNING AN OLDER VERSION? Use supabase/migrations/ instead and apply
-- only the numbered files you haven't run yet. This file is the same schema
-- (migrations 001–006 combined) rewritten for one-shot setup; keep the two in
-- sync when you add a migration.
--
-- AFTER RUNNING THIS you still need a storage bucket for photo uploads:
--   Storage → New bucket → name it exactly `trip-images` → toggle Public ON.
-- Nothing here creates it, and uploads fail with an unhelpful 500 without it.
-- =============================================================================


-- ── Tables ───────────────────────────────────────────────────────────────────

-- Interview sessions: top-level entity.
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'intake'
    CHECK (status IN ('intake', 'researching', 'ready', 'interviewing', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  -- Identifies the config that created this session (migration 004).
  config_version TEXT
);

-- Intake form responses.
--
-- `data` is the source of truth: the full intake payload as submitted, so any
-- config's fields persist without a schema change. The typed columns below it
-- are travel-specific and kept only because listPublishedStories still joins
-- on them; they are all nullable.
CREATE TABLE IF NOT EXISTS intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  data JSONB,
  employee_name TEXT,
  work_email TEXT,
  destination_country TEXT,
  destination_cities TEXT[],
  trip_type TEXT,
  trip_purpose TEXT,
  num_travelers INTEGER DEFAULT 1,
  trip_duration_days INTEGER,
  itinerary JSONB DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Research snapshots — the interview brief, built before the call starts.
CREATE TABLE IF NOT EXISTS research_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  research_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transcript storage. raw_entries is appended to during the interview.
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  raw_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  cleaned_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Article drafts, versioned — re-processing adds a row rather than replacing.
CREATE TABLE IF NOT EXISTS article_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  extraction_data JSONB,
  -- Which config output produced this draft (migration 004).
  output_id TEXT NOT NULL DEFAULT 'article',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMS-ready output payloads.
CREATE TABLE IF NOT EXISTS output_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'published')),
  slug TEXT,
  featured_image_url TEXT,
  -- Each placement: { url, insertAfterParagraph, caption? }
  image_placements JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  publish_url TEXT,
  publish_platform TEXT, -- 'wordpress' | 'custom'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Author profiles — one per person, shared across their interviews.
CREATE TABLE IF NOT EXISTS author_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_email TEXT UNIQUE NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  photo_url TEXT,
  photo_storage_path TEXT,
  twitter TEXT,
  instagram TEXT,
  linkedin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── Upgrade path ─────────────────────────────────────────────────────────────
-- These run as no-ops on a fresh database (the columns are already in the
-- CREATE TABLE statements above). They exist so this file also repairs a
-- database created by an earlier version of the schema.

ALTER TABLE intake_responses
  ADD COLUMN IF NOT EXISTS data JSONB,
  ADD COLUMN IF NOT EXISTS trip_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS itinerary JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE intake_responses
  ALTER COLUMN employee_name       DROP NOT NULL,
  ALTER COLUMN work_email          DROP NOT NULL,
  ALTER COLUMN destination_country DROP NOT NULL,
  ALTER COLUMN destination_cities  DROP NOT NULL,
  ALTER COLUMN trip_type           DROP NOT NULL,
  ALTER COLUMN trip_purpose        DROP NOT NULL,
  ALTER COLUMN num_travelers       DROP NOT NULL;

ALTER TABLE output_payloads
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_placements JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_url TEXT,
  ADD COLUMN IF NOT EXISTS publish_platform TEXT;

ALTER TABLE article_drafts
  ADD COLUMN IF NOT EXISTS output_id TEXT NOT NULL DEFAULT 'article';

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS config_version TEXT;

-- Backfill `data` for rows created before it existed.
UPDATE intake_responses
SET data = (to_jsonb(intake_responses.*) - 'id' - 'session_id' - 'created_at' - 'data')
WHERE data IS NULL;

UPDATE intake_responses SET itinerary = '[]'::jsonb WHERE itinerary IS NULL;


-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_intake_session       ON intake_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_research_session     ON research_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_session  ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_drafts_session       ON article_drafts(session_id);
CREATE INDEX IF NOT EXISTS idx_payloads_session     ON output_payloads(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_author_profiles_email ON author_profiles(work_email);
CREATE INDEX IF NOT EXISTS idx_payloads_slug        ON output_payloads(slug);
CREATE INDEX IF NOT EXISTS idx_payloads_published   ON output_payloads(published_at)
  WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_data_email    ON intake_responses ((data->>'work_email'));


-- ── Row Level Security ───────────────────────────────────────────────────────
--
-- The anon key ships to the browser. Without RLS it could read and write every
-- table directly — including every interviewee's name, email and transcript.
--
-- RLS is enabled with NO policies, which denies anon everything. The app is
-- unaffected: all data access uses the service-role key server-side, which
-- bypasses RLS. If you add user-facing auth later, add policies here rather
-- than turning RLS off.
--
-- This protects the database, not the app: the Next.js routes are still
-- unauthenticated. Anyone with a session URL can view it through the app.

ALTER TABLE interview_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_drafts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_payloads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_profiles     ENABLE ROW LEVEL SECURITY;
