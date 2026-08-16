-- Migration 006: enable Row Level Security on every table
--
-- WHY THIS MATTERS
-- NEXT_PUBLIC_SUPABASE_ANON_KEY ships to the browser by design. Without RLS,
-- that key can read and write every table directly against Supabase's REST
-- endpoint — meaning anyone who opens devtools on a deployed instance can dump
-- intake_responses: every interviewee's name, work email and full transcript.
--
-- WHY IT'S SAFE
-- All application data access goes through src/lib/supabase/server.ts, which
-- uses SUPABASE_SERVICE_ROLE_KEY. Service-role bypasses RLS entirely, so every
-- server route keeps working unchanged. The browser client
-- (src/lib/supabase/client.ts) currently has no importers at all.
--
-- Enabling RLS with NO policies is deliberate: it denies anon everything.
-- If you later add user-facing auth, add policies here rather than
-- disabling RLS.
--
-- Apply: paste into the Supabase SQL editor and run.

ALTER TABLE interview_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_drafts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE output_payloads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_profiles     ENABLE ROW LEVEL SECURITY;

-- NOTE: this protects the database, not the app. The Next.js routes remain
-- unauthenticated — anyone with a session URL can still view it through the
-- app. Add application auth before collecting real people's data.
