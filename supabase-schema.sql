-- ============================================================
-- MRCP Question Bank — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- 1. Create the questions table
CREATE TABLE IF NOT EXISTS questions (
  id              TEXT PRIMARY KEY,
  part            TEXT NOT NULL CHECK (part IN ('Part 1', 'Part 2')),
  system          TEXT NOT NULL,
  topic           TEXT NOT NULL DEFAULT '',
  year            TEXT,
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  stem            TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL,
  explanation     TEXT NOT NULL,
  reference       TEXT,
  tags            TEXT[],
  image_url       TEXT,
  image_type      TEXT,
  image_caption   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 3. Allow public read/write (using anon key from the app)
CREATE POLICY "Allow public read"   ON questions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON questions FOR DELETE USING (true);
