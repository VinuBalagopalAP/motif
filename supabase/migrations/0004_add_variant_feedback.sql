-- Drop the existing unique constraint
ALTER TABLE chat_feedback DROP CONSTRAINT IF EXISTS chat_feedback_job_id_message_index_user_id_key;

-- Add variant_index column
ALTER TABLE chat_feedback ADD COLUMN IF NOT EXISTS variant_index integer DEFAULT 0;

-- Create a new unique constraint that includes variant_index
ALTER TABLE chat_feedback ADD CONSTRAINT chat_feedback_job_message_variant_user_unique UNIQUE (job_id, message_index, variant_index, user_id);
