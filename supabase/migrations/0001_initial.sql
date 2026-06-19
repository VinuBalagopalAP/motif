-- Migration: Create video_jobs table
-- This table stores the background job state for the video pipeline.

CREATE TABLE video_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  product_json JSONB,
  scraped_data_json JSONB,
  render_spec_json JSONB,
  output_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Supabase Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE video_jobs;
