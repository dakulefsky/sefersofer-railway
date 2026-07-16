-- SeferSofer initial schema migration
-- Run this against your Supabase PostgreSQL database

CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE page_status AS ENUM ('pending', 'processing', 'transcribed', 'reviewed');

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status job_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  image_url TEXT,
  storage_path TEXT,
  status page_status NOT NULL DEFAULT 'pending',
  word_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS text_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  region_type TEXT NOT NULL DEFAULT 'main',
  region_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  region_id UUID REFERENCES text_regions(id) ON DELETE SET NULL,
  word_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  is_scribble BOOLEAN NOT NULL DEFAULT FALSE,
  is_insertion BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS word_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_job_id ON pages(job_id);
CREATE INDEX IF NOT EXISTS idx_words_page_id ON words(page_id);
CREATE INDEX IF NOT EXISTS idx_words_region_id ON words(region_id);
CREATE INDEX IF NOT EXISTS idx_word_corrections_word_id ON word_corrections(word_id);
CREATE INDEX IF NOT EXISTS idx_word_corrections_user_id ON word_corrections(user_id);
