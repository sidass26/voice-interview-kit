-- Add itinerary and trip duration to intake_responses
ALTER TABLE intake_responses
  ADD COLUMN IF NOT EXISTS trip_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS itinerary JSONB DEFAULT '[]'::jsonb;

-- Backfill existing rows with empty itinerary
UPDATE intake_responses
SET itinerary = '[]'::jsonb
WHERE itinerary IS NULL;
