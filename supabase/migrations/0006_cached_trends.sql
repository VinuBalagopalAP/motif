-- Run this in your Supabase SQL Editor to create the cached_trends table

CREATE TABLE public.cached_trends (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  niche text NOT NULL,
  trend_data jsonb NOT NULL,
  usage_count integer DEFAULT 0,
  last_fetched_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cached_trends ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access (since the pipeline runs server-side, it uses anon key for queries)
CREATE POLICY "Allow anonymous select on cached_trends"
  ON public.cached_trends
  FOR SELECT
  USING (true);

-- Allow anonymous insert access
CREATE POLICY "Allow anonymous insert on cached_trends"
  ON public.cached_trends
  FOR INSERT
  WITH CHECK (true);

-- Allow anonymous update access
CREATE POLICY "Allow anonymous update on cached_trends"
  ON public.cached_trends
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
