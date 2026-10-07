--  ================
-- Supabase Database Setup for AI Video Agent
--  ================
-- ⚠️  LEGACY FILE — kept for reference only.
--
-- The current schema lives in two migration files.
-- Run them IN ORDER in Supabase Dashboard → SQL Editor:
--
--   1. docs/supabase_analyses_migration.sql   ← analyses table, RLS, FTS, triggers
--   2. docs/supabase_shares_migration.sql     ← shares table, RLS, increment_share_views RPC
--
-- The tables below (file_metadata, processing_results) are no longer used
-- by the application but are kept here for backward-compatibility reference.
--  ================


-- ── Drop existing tables if re-running (optional) ───────────────────────────
-- Uncomment these lines if you want to start fresh
-- DROP TABLE IF EXISTS processing_results CASCADE;
-- DROP TABLE IF EXISTS file_metadata CASCADE;

-- ── Table: file_metadata  ──
-- Stores metadata about uploaded files
CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  language TEXT,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  title TEXT,
  summary TEXT,
  duration FLOAT,
  error TEXT
);

-- ── Table: processing_results ────────────────────────────────────────────────
-- Stores AI processing results (transcript, summary, etc.)
CREATE TABLE IF NOT EXISTS processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT REFERENCES file_metadata(job_id) ON DELETE CASCADE,
  transcript TEXT,
  action_items TEXT,
  key_decisions TEXT,
  open_questions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Indexes for better query performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_file_metadata_job_id ON file_metadata(job_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_created_at ON file_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_metadata_status ON file_metadata(status);
CREATE INDEX IF NOT EXISTS idx_processing_results_job_id ON processing_results(job_id);

-- ── Enable Row Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_results ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies if re-running (optional) ──────────────────────────
-- Uncomment these lines if you want to recreate policies
-- DROP POLICY IF EXISTS "Allow public read file_metadata" ON file_metadata;
-- DROP POLICY IF EXISTS "Allow public insert file_metadata" ON file_metadata;
-- DROP POLICY IF EXISTS "Allow public update file_metadata" ON file_metadata;
-- DROP POLICY IF EXISTS "Allow public read processing_results" ON processing_results;
-- DROP POLICY IF EXISTS "Allow public insert processing_results" ON processing_results;

-- ── RLS Policies for file_metadata ───────────────────────────────────────────
-- Allow public read access
CREATE POLICY IF NOT EXISTS "Allow public read file_metadata"
  ON file_metadata FOR SELECT
  USING (true);

-- Allow public insert
CREATE POLICY IF NOT EXISTS "Allow public insert file_metadata"
  ON file_metadata FOR INSERT
  WITH CHECK (true);

-- Allow public update
CREATE POLICY IF NOT EXISTS "Allow public update file_metadata"
  ON file_metadata FOR UPDATE
  USING (true);

-- ── RLS Policies for processing_results ──────────────────────────────────────
-- Allow public read access
CREATE POLICY IF NOT EXISTS "Allow public read processing_results"
  ON processing_results FOR SELECT
  USING (true);

-- Allow public insert
CREATE POLICY IF NOT EXISTS "Allow public insert processing_results"
  ON processing_results FOR INSERT
  WITH CHECK (true);

-- ── Verification Queries  ──
-- Run these to verify setup (optional)

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('file_metadata', 'processing_results');

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('file_metadata', 'processing_results');

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('file_metadata', 'processing_results');

-- ── Done!  ─────────────────
-- You should see:
-- - 2 tables created
-- - 4 indexes created
-- - 5 policies created
--  ================
