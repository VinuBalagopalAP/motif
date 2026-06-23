-- Migration: Create messages table
-- Normalizing chat_history out of video_jobs.product_json

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT,
  type TEXT DEFAULT 'chat',
  variants JSONB,
  attachments JSONB,
  user_feedback TEXT CHECK (user_feedback IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of a job's messages
CREATE INDEX idx_messages_job_id ON messages(job_id);
-- Index for ordering messages chronologically
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own messages" 
ON messages FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" 
ON messages FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" 
ON messages FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" 
ON messages FOR DELETE 
USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Data Backfill: Extract existing chat_history from video_jobs
-- This handles migrating all legacy chat_history into the new messages table
INSERT INTO messages (id, job_id, user_id, role, content, type, variants, attachments, user_feedback, created_at)
SELECT 
  -- We don't have existing UUIDs for messages, so we generate them, but we want to preserve order.
  -- For safety, we just generate a new UUID for each.
  uuid_generate_v4() as id,
  v.id as job_id,
  v.user_id as user_id,
  (msg->>'role') as role,
  (msg->>'content') as content,
  COALESCE(msg->>'type', 'chat') as type,
  (msg->'variants') as variants,
  (msg->'attachments') as attachments,
  (msg->>'userFeedback') as user_feedback,
  -- Add a tiny interval based on array index to preserve chronological ordering
  v.created_at + (idx * interval '1 millisecond') as created_at
FROM video_jobs v,
LATERAL jsonb_array_elements(v.product_json->'chat_history') WITH ORDINALITY AS t(msg, idx)
WHERE v.product_json->'chat_history' IS NOT NULL;
