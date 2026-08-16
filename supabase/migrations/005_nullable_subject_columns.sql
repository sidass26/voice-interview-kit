-- Migration 005: finish what 004 started — make the subject columns nullable
--
-- Migration 004 dropped NOT NULL on destination_country, destination_cities,
-- trip_type, trip_purpose and num_travelers, but missed employee_name and
-- work_email. Those two stayed mandatory, so a config whose intake fields
-- aren't named exactly `employee_name` / `work_email` fails the INSERT:
-- saveIntake writes the generic `data` blob fine, but the row never lands.
--
-- Apply: paste into the Supabase SQL editor and run.

ALTER TABLE intake_responses
  ALTER COLUMN employee_name DROP NOT NULL,
  ALTER COLUMN work_email    DROP NOT NULL;

-- KNOWN REMAINING COUPLING (not fixed here):
-- author_profiles.work_email is UNIQUE NOT NULL and upsertAuthorProfile keys
-- on it, so author profiles still require an email-shaped field. Making that
-- generic needs a JSONB column on author_profiles, the same way
-- intake_responses.data works — a larger change than this migration.
