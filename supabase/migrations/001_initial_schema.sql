-- Interview sessions: top-level entity
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'intake'
    CHECK (status IN ('intake', 'researching', 'ready', 'interviewing', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT
);

-- Intake form responses (minimal — rest captured during interview)
CREATE TABLE intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  destination_cities TEXT[] NOT NULL,
  trip_type TEXT NOT NULL,
  trip_purpose TEXT NOT NULL,
  num_travelers INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Research snapshots
CREATE TABLE research_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  research_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transcript storage
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  raw_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  cleaned_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Article drafts
CREATE TABLE article_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  extraction_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WordPress-ready output payloads (stored, not sent)
CREATE TABLE output_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_intake_session ON intake_responses(session_id);
CREATE INDEX idx_research_session ON research_snapshots(session_id);
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_drafts_session ON article_drafts(session_id);
CREATE INDEX idx_payloads_session ON output_payloads(session_id);
CREATE INDEX idx_sessions_status ON interview_sessions(status);
