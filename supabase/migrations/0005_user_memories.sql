-- Migration: Create user_memories table

CREATE TABLE user_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source_job_id UUID REFERENCES video_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Policies for user_memories
-- Users can view their own memories
CREATE POLICY "Users can view their own memories"
ON user_memories FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own memories
CREATE POLICY "Users can insert their own memories"
ON user_memories FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own memories
CREATE POLICY "Users can delete their own memories"
ON user_memories FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own memories
CREATE POLICY "Users can update their own memories"
ON user_memories FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
