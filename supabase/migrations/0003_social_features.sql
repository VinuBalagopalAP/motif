-- Migration: Add social and feedback features

-- 1. Create shared_chats table (Snapshot method)
CREATE TABLE shared_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_job_id UUID REFERENCES video_jobs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  messages_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for shared_chats
ALTER TABLE shared_chats ENABLE ROW LEVEL SECURITY;

-- Policies for shared_chats
-- Anyone can view a shared chat if they have the ID
CREATE POLICY "Anyone can view shared chats"
ON shared_chats FOR SELECT
USING (true);

-- Only authenticated users can insert (share) a chat, tied to their user_id
CREATE POLICY "Users can insert shared chats"
ON shared_chats FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only the owner can delete a shared chat
CREATE POLICY "Users can delete their shared chats"
ON shared_chats FOR DELETE
USING (auth.uid() = user_id);


-- 2. Create chat_feedback table
CREATE TABLE chat_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES video_jobs(id) ON DELETE CASCADE,
  message_index INTEGER NOT NULL,
  is_positive BOOLEAN NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, message_index, user_id)
);

-- Enable RLS for chat_feedback
ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for chat_feedback
CREATE POLICY "Users can view their own feedback"
ON chat_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
ON chat_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON chat_feedback FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE shared_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_feedback;
