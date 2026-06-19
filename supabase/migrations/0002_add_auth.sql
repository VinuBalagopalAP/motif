-- Migration: Add user authentication to video_jobs

-- 1. Add user_id column
ALTER TABLE video_jobs ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- 2. Enable Row Level Security
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
-- Users can only view their own jobs
CREATE POLICY "Users can view their own jobs" 
ON video_jobs FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert jobs tied to their own user_id
CREATE POLICY "Users can insert their own jobs" 
ON video_jobs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs
CREATE POLICY "Users can update their own jobs" 
ON video_jobs FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own jobs (optional but good practice)
CREATE POLICY "Users can delete their own jobs" 
ON video_jobs FOR DELETE 
USING (auth.uid() = user_id);
