-- Migration 003: Add image uploads, author profiles, and publishing support

-- Author profiles (one per employee, shared across trips)
CREATE TABLE author_profiles (
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

CREATE INDEX idx_author_profiles_email ON author_profiles(work_email);

-- Add image uploads to intake responses
-- Each image: { url, storagePath, description, day? }
ALTER TABLE intake_responses ADD COLUMN images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add publishing and image fields to output payloads
ALTER TABLE output_payloads ADD COLUMN slug TEXT;
ALTER TABLE output_payloads ADD COLUMN featured_image_url TEXT;
ALTER TABLE output_payloads ADD COLUMN image_placements JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Each placement: { url, insertAfterParagraph, caption? }
ALTER TABLE output_payloads ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE output_payloads ADD COLUMN publish_url TEXT;
ALTER TABLE output_payloads ADD COLUMN publish_platform TEXT;
-- publish_platform: 'wordpress' | 'custom'

CREATE INDEX idx_payloads_slug ON output_payloads(slug);
CREATE INDEX idx_payloads_published ON output_payloads(published_at) WHERE published_at IS NOT NULL;
